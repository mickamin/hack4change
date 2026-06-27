"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { TERYT_COMMUNES, type TerytCommune } from "@/app/api/data/mockData";
import type { DistributorResult } from "@/utils/distributors";
import type { GeoPoint } from "@/utils/emptyRuns";

const Map = dynamic(() => import("@/components/Map"), { ssr: false });

const T = {
  bg: "#faf7f0", card: "#fffdf7", surface: "#f5f0e4", border: "#ddd4b8",
  accent: "#2d5a1b", accentHi: "#3a7a22", gold: "#c8781a", text: "#2a1a08", muted: "#7a6a48", subtle: "#9a8a60",
};

type Act = 1 | 2 | 3;
type Unit = "palety" | "kg";
interface SelectedCrop { name: string; qty: number; unit: Unit }

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function communeCentroid(c: TerytCommune): GeoPoint {
  return { lat: (c.latMin + c.latMax) / 2, lng: (c.lngMin + c.lngMax) / 2 };
}

export default function DystrybutorPage() {
  const { isOnline } = useOfflineSync();
  const [hydrated, setHydrated] = useState(false);
  const [act, setAct] = useState<Act>(2);

  const [name, setName] = useState("");
  const [allCrops, setAllCrops] = useState<string[]>([]);
  const [cropsLoading, setCropsLoading] = useState(false);
  const [cropSearch, setCropSearch] = useState("");
  const [selectedCrops, setSelectedCrops] = useState<SelectedCrop[]>([]);
  const [near, setNear] = useState<TerytCommune>(TERYT_COMMUNES[0]);

  const [result, setResult] = useState<DistributorResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setHydrated(true);
    setCropsLoading(true);
    fetch("/api/crops/all")
      .then((r) => r.json())
      .then((json) => { setAllCrops(json.availableCrops ?? []); })
      .catch(() => setAllCrops([]))
      .finally(() => setCropsLoading(false));
  }, []);

  const filteredCrops = cropSearch.trim()
    ? allCrops.filter((c) => c.toLowerCase().includes(cropSearch.toLowerCase()))
    : [];

  function addCrop(crop: string) {
    if (!selectedCrops.find((s) => s.name === crop)) {
      setSelectedCrops((prev) => [...prev, { name: crop, qty: 10, unit: "palety" }]);
    }
    setCropSearch("");
  }

  function removeCrop(crop: string) {
    setSelectedCrops((prev) => prev.filter((s) => s.name !== crop));
  }

  function updateCrop(crop: string, patch: Partial<SelectedCrop>) {
    setSelectedCrops((prev) => prev.map((s) => s.name === crop ? { ...s, ...patch } : s));
  }

  async function handleSubmit() {
    if (selectedCrops.length === 0) return;
    setLoading(true);
    const first = selectedCrops[0];
    const neededPallets = first.unit === "palety" ? first.qty : Math.ceil(first.qty / 600);
    try {
      const res = await fetch("/api/distributors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          distributorName: name,
          crop: first.name,
          neededPallets,
          near: communeCentroid(near),
          nearLabel: near.name,
        }),
      });
      const raw = (await res.json()) as Partial<DistributorResult>;
      setResult({
        crop: raw.crop ?? first.name as import("@/app/api/data/mockData").CropKey,
        matches: Array.isArray(raw.matches) ? raw.matches : [],
        gatheredPallets: raw.gatheredPallets ?? 0,
        neededPallets: raw.neededPallets ?? neededPallets,
        fillPct: raw.fillPct ?? 0,
        estValuePln: raw.estValuePln ?? 0,
        nearLabel: raw.nearLabel ?? near.name,
      });
      setAct(3);
    } catch {
      setResult({ crop: first.name as import("@/app/api/data/mockData").CropKey, matches: [], gatheredPallets: 0, neededPallets, fillPct: 0, estValuePln: 0, nearLabel: near.name });
      setAct(3);
    } finally {
      setLoading(false);
    }
  }

  if (!hydrated) {
    return <div style={{ minHeight: "100dvh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontSize: "1.2rem", color: T.muted, fontWeight: 700 }}>Ladowanie...</span></div>;
  }

  // ── AKT 1 ───────────────────────────────────────────────────────────────────
  if (act === 1) {
    return (
      <div style={{ minHeight: "100dvh", background: T.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}>
        <div style={{ maxWidth: "440px", width: "100%", textAlign: "center" }}>
          <h1 style={{ fontSize: "clamp(1.6rem, 6vw, 2.2rem)", fontWeight: 900, color: T.text, lineHeight: 1.2, letterSpacing: "-0.02em", margin: "0 0 1rem" }}>
            Szukasz towaru hurtem?<br /><span style={{ color: T.accentHi }}>Zbierz nadwyzki z regionu.</span>
          </h1>
          <button onClick={() => setAct(2)} style={{ background: T.accent, color: "#fff", border: "none", borderRadius: "1.25rem", padding: "1.1rem 2.5rem", fontSize: "1.15rem", fontWeight: 900, cursor: "pointer", width: "100%", boxShadow: `0 6px 20px ${T.accent}55` }}>
            Jestem dystrybutorem
          </button>
        </div>
      </div>
    );
  }

  // ── AKT 2 ───────────────────────────────────────────────────────────────────
  if (act === 2) {
    const inputBase: React.CSSProperties = { background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: "0.875rem", color: T.text, width: "100%", padding: "0.875rem 1rem", fontSize: "1rem", outline: "none", boxSizing: "border-box" };
    const canSubmit = selectedCrops.length > 0 && !loading;
    return (
      <div style={{ minHeight: "100dvh", background: T.bg, display: "flex", flexDirection: "column", color: T.text }}>
        <div style={{ background: T.card, borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: "1rem", padding: "1rem 1.25rem" }}>
          <a href="/" style={{ background: "none", border: "none", cursor: "pointer", color: T.muted, fontSize: "1.5rem", padding: 0, lineHeight: 1, textDecoration: "none" }}>&#8592;</a>
          <div><div style={{ fontWeight: 900, fontSize: "1rem", color: T.accentHi }}>Czego potrzebujesz</div><div style={{ fontSize: "0.7rem", color: T.subtle }}>Produkt, ilosc i miejsce dostawy</div></div>
          <div style={{ marginLeft: "auto" }}><OnlineBadge isOnline={isOnline} /></div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem", maxWidth: "520px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Crop search — identical to rolnik */}
          <section>
            <Label>Jaki produkt</Label>
            <input
              type="text"
              placeholder={cropsLoading ? "Ladowanie upraw..." : "Szukaj uprawy..."}
              value={cropSearch}
              onChange={(e) => setCropSearch(e.target.value)}
              disabled={cropsLoading}
              style={{ ...inputBase, marginBottom: "0.625rem" }}
            />
            {cropsLoading ? (
              <div style={{ textAlign: "center", padding: "1rem", color: T.subtle, fontSize: "0.85rem" }}>Ladowanie...</div>
            ) : cropSearch.trim() && filteredCrops.length === 0 ? (
              <p style={{ color: T.subtle, fontSize: "0.85rem", margin: 0 }}>Brak wynikow.</p>
            ) : cropSearch.trim() ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", maxHeight: "200px", overflowY: "auto" }}>
                {filteredCrops.slice(0, 12).map((c) => {
                  const added = selectedCrops.some((s) => s.name === c);
                  return (
                    <button key={c} type="button" onClick={() => addCrop(c)}
                      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.625rem 0.875rem", borderRadius: "0.75rem", border: `1.5px solid ${added ? T.accent : T.border}`, background: added ? "#f0faeb" : T.surface, cursor: "pointer", touchAction: "manipulation" }}>
                      <span style={{ fontSize: "0.9rem", fontWeight: 600, color: added ? T.accent : T.text }}>{capitalize(c)}</span>
                      <span style={{ fontSize: "1rem", color: added ? T.accent : T.subtle }}>{added ? "v" : "+"}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </section>

          {/* Selected crops with qty + unit toggle */}
          {selectedCrops.length > 0 && (
            <section>
              <Label>Moje zamowienia</Label>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {selectedCrops.map((sc) => (
                  <div key={sc.name} style={{ padding: "0.875rem", background: T.card, border: `1.5px solid ${T.accent}55`, borderRadius: "0.875rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.625rem" }}>
                      <div style={{ flex: 1, fontWeight: 700, fontSize: "0.9rem", color: T.text }}>{capitalize(sc.name)}</div>
                      <button type="button" onClick={() => removeCrop(sc.name)}
                        style={{ width: "28px", height: "28px", borderRadius: "50%", border: `1.5px solid ${T.border}`, background: T.surface, color: T.muted, fontSize: "0.9rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, touchAction: "manipulation" }}>x</button>
                    </div>
                    {/* Unit toggle */}
                    <div style={{ display: "flex", gap: "0.375rem", marginBottom: "0.625rem" }}>
                      {(["palety", "kg"] as Unit[]).map((u) => (
                        <button key={u} type="button" onClick={() => updateCrop(sc.name, { unit: u, qty: u === "palety" ? 10 : 1000 })}
                          style={{ flex: 1, padding: "0.5rem", borderRadius: "0.625rem", border: `1.5px solid ${sc.unit === u ? T.accent : T.border}`, background: sc.unit === u ? "#f0faeb" : T.surface, color: sc.unit === u ? T.accent : T.muted, fontSize: "0.8rem", fontWeight: 700, cursor: "pointer", touchAction: "manipulation" }}>
                          {u === "palety" ? "Palety" : "Kilogramy"}
                        </button>
                      ))}
                    </div>
                    {/* Qty counter with manual input */}
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", width: "100%" }}>
                      <button type="button" onClick={() => updateCrop(sc.name, { qty: Math.max(sc.unit === "palety" ? 1 : 100, sc.qty - (sc.unit === "palety" ? 1 : 100)) })}
                        style={{ width: "40px", minWidth: "40px", height: "40px", borderRadius: "0.625rem", background: T.surface, border: `1.5px solid ${T.border}`, color: T.text, fontSize: "1.2rem", fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, touchAction: "manipulation" }}>-</button>
                      <input type="number" value={sc.qty}
                        onChange={(e) => { const v = parseInt(e.target.value); if (!isNaN(v) && v > 0) updateCrop(sc.name, { qty: v }); }}
                        style={{ width: "80px", minWidth: 0, flex: "1 1 80px", textAlign: "center", fontSize: "1.3rem", fontWeight: 900, color: T.accent, background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: "0.625rem", padding: "0.4rem 0.25rem", outline: "none", fontVariantNumeric: "tabular-nums", boxSizing: "border-box", MozAppearance: "textfield" } as React.CSSProperties} />
                      <button type="button" onClick={() => updateCrop(sc.name, { qty: Math.min(sc.unit === "palety" ? 200 : 50000, sc.qty + (sc.unit === "palety" ? 1 : 100)) })}
                        style={{ width: "40px", minWidth: "40px", height: "40px", borderRadius: "0.625rem", background: T.surface, border: `1.5px solid ${T.border}`, color: T.text, fontSize: "1.2rem", fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, touchAction: "manipulation" }}>+</button>
                      <span style={{ fontSize: "0.75rem", color: T.muted, fontWeight: 600, flexShrink: 0 }}>{sc.unit === "palety" ? "palet" : "kg"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Commune dropdown */}
          <section>
            <Label>Miejsce dostawy</Label>
            <select
              value={near.code}
              onChange={(e) => {
                const c = TERYT_COMMUNES.find((c) => c.code === Number(e.target.value));
                if (c) setNear(c);
              }}
              style={{ background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: "0.875rem", color: T.text, width: "100%", padding: "0.875rem 1rem", fontSize: "1rem", outline: "none", boxSizing: "border-box" as const, appearance: "none" as const, backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%237a6a48' strokeWidth='1.5' fill='none' strokeLinecap='round'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 1rem center", paddingRight: "2.5rem" }}
            >
              {TERYT_COMMUNES.filter((c) => c.powiat !== "Gdańsk").map((c) => (
                <option key={c.code} value={c.code}>{c.name} ({c.powiat})</option>
              ))}
            </select>
          </section>

          <section>
            <Label>Firma (opcjonalnie)</Label>
            <input type="text" placeholder="np. Hurtownia Kaszuby" value={name} onChange={(e) => setName(e.target.value)} style={inputBase} />
          </section>

          <button type="button" onClick={handleSubmit} disabled={!canSubmit} style={{ background: canSubmit ? T.accent : T.subtle, color: "#fff", border: "none", borderRadius: "1.25rem", padding: "1.2rem", fontSize: "1.1rem", fontWeight: 900, cursor: canSubmit ? "pointer" : "not-allowed", width: "100%", boxShadow: canSubmit ? `0 6px 20px ${T.accent}44` : "none", opacity: loading ? 0.7 : 1 }}>
            {loading ? "Szukam dostawcow..." : "Znajdz dostawcow"}
          </button>
          <div style={{ height: "1rem" }} />
        </div>
      </div>
    );
  }

  // ── AKT 3 ───────────────────────────────────────────────────────────────────
  const r = result!;
  const nearPoint = communeCentroid(near);
  const mapPoints = [
    { lat: nearPoint.lat, lng: nearPoint.lng, name: `Dostawa: ${near.name}`, isUser: true, isHub: false },
    ...r.matches.map((m) => ({ lat: m.lat, lng: m.lng, name: `${m.commune} · ${m.availablePallets} pal.`, isUser: false, isHub: false })),
  ];
  const routePts = [nearPoint, ...r.matches.map((m) => ({ lat: m.lat, lng: m.lng }))];

  return (
    <div style={{ minHeight: "100dvh", background: T.bg, display: "flex", flexDirection: "column", color: T.text }}>
      <div style={{ background: T.card, borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: "1rem", padding: "0.875rem 1.25rem" }}>
        <button onClick={() => setAct(2)} style={{ background: "none", border: "none", cursor: "pointer", color: T.muted, fontSize: "1.5rem", padding: 0, lineHeight: 1 }}>&#8592;</button>
        <div><div style={{ fontWeight: 900, fontSize: "1rem", color: T.accentHi }}>{r.crop}</div><div style={{ fontSize: "0.7rem", color: T.subtle }}>dostawa: {r.nearLabel}</div></div>
        <div style={{ marginLeft: "auto" }}><OnlineBadge isOnline={isOnline} /></div>
      </div>

      <div style={{ height: "44dvh", minHeight: "260px", position: "relative" }}>
        <Map points={mapPoints} isOnline={isOnline} route={routePts} focusPoint={nearPoint} />
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "1rem 1.25rem", maxWidth: "560px", width: "100%", margin: "0 auto" }}>
        <div style={{ marginBottom: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: T.muted, marginBottom: "0.3rem" }}>
            <span>{r.gatheredPallets} / {r.neededPallets} palet zebrane</span>
            <span style={{ color: r.fillPct >= 100 ? T.accent : T.subtle }}>{r.fillPct}%</span>
          </div>
          <div style={{ height: "8px", background: T.surface, borderRadius: "999px", overflow: "hidden", border: `1px solid ${T.border}` }}>
            <div style={{ height: "100%", width: `${r.fillPct}%`, background: r.fillPct >= 100 ? T.accent : T.accentHi, borderRadius: "999px", transition: "width 0.6s ease" }} />
          </div>
        </div>

        {r.matches.length === 0 ? (
          <div style={{ background: "#fdf4e6", border: `1px solid ${T.gold}`, borderRadius: "0.875rem", padding: "1rem", fontSize: "0.9rem" }}>
            Brak "{r.crop}" w regionie na teraz. Sprobuj innego produktu.
          </div>
        ) : (
          <>
            <div style={{ fontSize: "0.65rem", fontWeight: 700, color: T.subtle, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.5rem" }}>
              Dostawcy w regionie ({r.matches.length} gmin)
            </div>
            {r.matches.map((m) => (
              <div key={m.terytCode} style={{ display: "flex", alignItems: "center", padding: "0.6rem 0", borderBottom: `1px solid ${T.border}`, gap: "0.7rem" }}>
                <div style={{ width: "30px", height: "30px", borderRadius: "50%", background: T.surface, border: `1.5px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "0.75rem", fontWeight: 700, color: T.muted }}>G</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: "0.9rem", color: T.text }}>{m.commune}</div>
                  <div style={{ fontSize: "0.72rem", color: T.subtle }}>{m.distanceKm} km od dostawy</div>
                </div>
                <div style={{ flexShrink: 0, textAlign: "right" }}>
                  <div style={{ fontWeight: 900, fontSize: "0.95rem", color: T.accent, fontVariantNumeric: "tabular-nums" }}>{m.availablePallets}</div>
                  <div style={{ fontSize: "0.6rem", color: T.subtle }}>pal.</div>
                </div>
              </div>
            ))}

            <div style={{ marginTop: "1rem", background: "#f0faeb", border: "1px solid #b0d88a", borderRadius: "0.875rem", padding: "0.875rem" }}>
              <div style={{ fontSize: "0.8rem", fontWeight: 800, color: T.accent, marginBottom: "0.625rem" }}>
                {r.gatheredPallets} palet {r.crop.toLowerCase()} z {r.matches.length} gmin
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                <StatBox label="Szac. wartosc" value={`${r.estValuePln.toLocaleString("pl-PL")} zl`} />
                <StatBox label="Pokrycie" value={`${r.fillPct}%`} />
              </div>
            </div>
          </>
        )}

        <div style={{ padding: "1rem 0 1.5rem", display: "flex", gap: "0.625rem" }}>
          <button onClick={() => setAct(2)} style={{ flex: 1, padding: "0.75rem", borderRadius: "0.875rem", border: `1.5px solid ${T.border}`, background: T.surface, color: T.muted, fontWeight: 700, fontSize: "0.85rem", cursor: "pointer" }}>+ Nowe zapytanie</button>
          <a href="/" style={{ flex: 1, padding: "0.75rem", borderRadius: "0.875rem", border: "none", background: T.accent, color: "#fff", fontWeight: 900, fontSize: "0.85rem", cursor: "pointer", textAlign: "center", textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>Zglos</a>
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "0.625rem", padding: "0.5rem 0.625rem" }}>
      <div style={{ fontSize: "0.6rem", color: T.subtle, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
      <div style={{ fontSize: "1rem", fontWeight: 900, color: T.accentHi, fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p style={{ color: T.muted, fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "0.5rem" }}>{children}</p>;
}

function OnlineBadge({ isOnline }: { isOnline: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", padding: "0.3rem 0.7rem", borderRadius: "999px", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", background: isOnline ? "rgba(240,250,235,0.9)" : "rgba(253,240,235,0.9)", border: `1.5px solid ${isOnline ? T.accent : "#c87050"}`, color: isOnline ? T.accent : "#7a2808" }}>
      <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: isOnline ? T.accent : "#c87050" }} />
      {isOnline ? "Online" : "Offline"}
    </span>
  );
}
