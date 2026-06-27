"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { TERYT_COMMUNES, type TerytCommune, type CropKey } from "@/app/api/data/mockData";
import type { DistributorResult } from "@/utils/distributors";
import type { GeoPoint } from "@/utils/emptyRuns";

const Map = dynamic(() => import("@/components/Map"), { ssr: false });

const T = {
  bg: "#faf7f0", card: "#fffdf7", surface: "#f5f0e4", border: "#ddd4b8",
  accent: "#2d5a1b", accentHi: "#3a7a22", gold: "#c8781a", text: "#2a1a08", muted: "#7a6a48", subtle: "#9a8a60",
};

const CROPS: CropKey[] = [
  "Kapusta biała", "Kapusta kiszona", "Ziemniaki", "Marchew", "Buraki ćwikłowe", "Cebula", "Jabłka",
];

type Act = 1 | 2 | 3;

function communeCentroid(c: TerytCommune): GeoPoint {
  return { lat: (c.latMin + c.latMax) / 2, lng: (c.lngMin + c.lngMax) / 2 };
}

export default function DystrybutorPage() {
  const { isOnline } = useOfflineSync();
  const [hydrated, setHydrated] = useState(false);
  const [act, setAct] = useState<Act>(1);

  const [name, setName] = useState("");
  const [crop, setCrop] = useState<CropKey>("Kapusta biała");
  const [needed, setNeeded] = useState(20);
  const [near, setNear] = useState<TerytCommune>(TERYT_COMMUNES[0]);

  const [result, setResult] = useState<DistributorResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => setHydrated(true), []);

  async function handleSubmit() {
    setLoading(true);
    try {
      const res = await fetch("/api/distributors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          distributorName: name,
          crop,
          neededPallets: needed,
          near: communeCentroid(near),
          nearLabel: near.name,
        }),
      });
      const raw = (await res.json()) as Partial<DistributorResult>;
      setResult({
        crop: raw.crop ?? crop,
        matches: Array.isArray(raw.matches) ? raw.matches : [],
        gatheredPallets: raw.gatheredPallets ?? 0,
        neededPallets: raw.neededPallets ?? needed,
        fillPct: raw.fillPct ?? 0,
        estValuePln: raw.estValuePln ?? 0,
        nearLabel: raw.nearLabel ?? near.name,
      });
      setAct(3);
    } catch {
      setResult({ crop, matches: [], gatheredPallets: 0, neededPallets: needed, fillPct: 0, estValuePln: 0, nearLabel: near.name });
      setAct(3);
    } finally {
      setLoading(false);
    }
  }

  if (!hydrated) {
    return <div style={{ minHeight: "100dvh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontSize: "2.5rem" }}>📦</span></div>;
  }

  // ── AKT 1 ───────────────────────────────────────────────────────────────────
  if (act === 1) {
    return (
      <div style={{ minHeight: "100dvh", background: T.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}>
        <div style={{ maxWidth: "440px", width: "100%", textAlign: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", background: T.card, border: `1px solid ${T.border}`, borderRadius: "999px", padding: "0.3rem 0.9rem", marginBottom: "1.5rem" }}>
            <span>📦</span><span style={{ fontWeight: 800, fontSize: "0.85rem", color: T.accentHi }}>AgroPool</span><span style={{ fontSize: "0.65rem", color: T.subtle }}>· dla dystrybutorów</span>
          </div>
          <h1 style={{ fontSize: "clamp(1.6rem, 6vw, 2.2rem)", fontWeight: 900, color: T.text, lineHeight: 1.2, letterSpacing: "-0.02em", margin: "0 0 1rem" }}>
            Szukasz towaru hurtem?<br /><span style={{ color: T.accentHi }}>Zbierz nadwyżki z regionu.</span>
          </h1>
          <p style={{ color: T.muted, fontSize: "1rem", lineHeight: 1.6, margin: "0 0 2rem" }}>
            Powiedz czego potrzebujesz i ile — pokażemy gminy z dostępną uprawą, od najbliższej.
          </p>
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
    return (
      <div style={{ minHeight: "100dvh", background: T.bg, display: "flex", flexDirection: "column", color: T.text }}>
        <div style={{ background: T.card, borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: "1rem", padding: "1rem 1.25rem" }}>
          <button onClick={() => setAct(1)} style={{ background: "none", border: "none", cursor: "pointer", color: T.muted, fontSize: "1.5rem", padding: 0, lineHeight: 1 }}>←</button>
          <div><div style={{ fontWeight: 900, fontSize: "1rem", color: T.accentHi }}>Czego potrzebujesz</div><div style={{ fontSize: "0.7rem", color: T.subtle }}>Produkt, ilość i miejsce dostawy</div></div>
          <div style={{ marginLeft: "auto" }}><OnlineBadge isOnline={isOnline} /></div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem", maxWidth: "520px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <section>
            <Label>Jaki produkt</Label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.5rem" }}>
              {CROPS.map((c) => {
                const active = crop === c;
                return (
                  <button key={c} type="button" onClick={() => setCrop(c)} style={{ padding: "0.75rem 0.4rem", borderRadius: "0.875rem", border: `2px solid ${active ? T.accent : T.border}`, background: active ? "#f0faeb" : T.surface, cursor: "pointer" }}>
                    <span style={{ fontSize: "0.8rem", fontWeight: active ? 800 : 600, color: active ? T.accent : T.text }}>{c}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <Label>Ile palet potrzebujesz</Label>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <CounterBtn onClick={() => setNeeded((p) => Math.max(5, p - 5))} disabled={needed <= 5}>−</CounterBtn>
              <div style={{ flex: 1, textAlign: "center" }}>
                <div style={{ fontSize: "3.5rem", fontWeight: 900, color: T.accent, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{needed}</div>
                <div style={{ fontSize: "0.7rem", color: T.subtle, marginTop: "0.2rem" }}>palet</div>
              </div>
              <CounterBtn onClick={() => setNeeded((p) => Math.min(100, p + 5))} disabled={needed >= 100}>+</CounterBtn>
            </div>
          </section>

          <section>
            <Label>Miejsce dostawy</Label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.5rem" }}>
              {TERYT_COMMUNES.map((c) => {
                const active = near.code === c.code;
                return (
                  <button key={c.code} type="button" onClick={() => setNear(c)} style={{ padding: "0.75rem 0.4rem", borderRadius: "0.875rem", border: `2px solid ${active ? T.accent : T.border}`, background: active ? "#f0faeb" : T.surface, cursor: "pointer" }}>
                    <span style={{ fontSize: "0.8rem", fontWeight: active ? 800 : 600, color: active ? T.accent : T.text }}>{c.name}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <Label>Firma (opcjonalnie)</Label>
            <input type="text" placeholder="np. Hurtownia Kaszuby" value={name} onChange={(e) => setName(e.target.value)} style={inputBase} />
          </section>

          <button type="button" onClick={handleSubmit} disabled={loading} style={{ background: T.accent, color: "#fff", border: "none", borderRadius: "1.25rem", padding: "1.2rem", fontSize: "1.1rem", fontWeight: 900, cursor: loading ? "wait" : "pointer", width: "100%", boxShadow: `0 6px 20px ${T.accent}44`, opacity: loading ? 0.7 : 1 }}>
            {loading ? "Szukam dostawców…" : "Znajdź dostawców"}
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
        <button onClick={() => setAct(2)} style={{ background: "none", border: "none", cursor: "pointer", color: T.muted, fontSize: "1.5rem", padding: 0, lineHeight: 1 }}>←</button>
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
            Brak „{r.crop}" w regionie na teraz. Spróbuj innego produktu.
          </div>
        ) : (
          <>
            <div style={{ fontSize: "0.65rem", fontWeight: 700, color: T.subtle, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.5rem" }}>
              Dostawcy w regionie ({r.matches.length} gmin)
            </div>
            {r.matches.map((m) => (
              <div key={m.terytCode} style={{ display: "flex", alignItems: "center", padding: "0.6rem 0", borderBottom: `1px solid ${T.border}`, gap: "0.7rem" }}>
                <div style={{ width: "30px", height: "30px", borderRadius: "50%", background: T.surface, border: `1.5px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "0.8rem" }}>📍</div>
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
                <StatBox label="Szac. wartość" value={`${r.estValuePln.toLocaleString("pl-PL")} zł`} />
                <StatBox label="Pokrycie" value={`${r.fillPct}%`} />
              </div>
            </div>
          </>
        )}

        <div style={{ padding: "1rem 0 1.5rem", display: "flex", gap: "0.625rem" }}>
          <button onClick={() => setAct(2)} style={{ flex: 1, padding: "0.75rem", borderRadius: "0.875rem", border: `1.5px solid ${T.border}`, background: T.surface, color: T.muted, fontWeight: 700, fontSize: "0.85rem", cursor: "pointer" }}>+ Nowe zapytanie</button>
          <button onClick={() => setAct(1)} style={{ flex: 1, padding: "0.75rem", borderRadius: "0.875rem", border: "none", background: T.accent, color: "#fff", fontWeight: 900, fontSize: "0.85rem", cursor: "pointer" }}>Start</button>
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

function CounterBtn({ onClick, disabled, children }: { onClick: () => void; disabled: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} style={{ width: "68px", height: "68px", borderRadius: "1rem", background: T.surface, border: `2px solid ${T.border}`, color: disabled ? T.subtle : T.text, fontSize: "2rem", fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", cursor: disabled ? "not-allowed" : "pointer", flexShrink: 0 }}>
      {children}
    </button>
  );
}

function OnlineBadge({ isOnline }: { isOnline: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", padding: "0.3rem 0.7rem", borderRadius: "999px", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", background: isOnline ? "rgba(240,250,235,0.9)" : "rgba(253,240,235,0.9)", border: `1.5px solid ${isOnline ? T.accent : "#c87050"}`, color: isOnline ? T.accent : "#7a2808" }}>
      <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: isOnline ? T.accent : "#c87050" }} />
      {isOnline ? "Online" : "Offline"}
    </span>
  );
}
