"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { detectCommune, type CommuneResult } from "@/utils/geoLookup";
import type { OptimizeRouteResponse } from "@/app/api/optimize-route/route";
import type { Farmer } from "@/app/api/data/mockData";

const Map = dynamic(() => import("@/components/Map"), { ssr: false });

const T = {
  bg:       "#faf7f0",
  card:     "#fffdf7",
  surface:  "#f5f0e4",
  border:   "#ddd4b8",
  accent:   "#2d5a1b",
  accentHi: "#3a7a22",
  gold:     "#c8781a",
  text:     "#2a1a08",
  muted:    "#7a6a48",
  subtle:   "#9a8a60",
};

const TRUCK_CAPACITY = 24; // pallets
const PENDING_KEY = "agropool_pending_requests";

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function nextThursday(): string {
  const d = new Date();
  const day = d.getDay(); // 0=Sun … 4=Thu
  const daysUntil = (4 - day + 7) % 7 || 7;
  d.setDate(d.getDate() + daysUntil);
  return d.toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "short" });
}

type Act = 1 | 2 | 3;
type GpsState = "idle" | "loading" | "done" | "error";

export default function App() {
  const { isOnline, enqueue } = useOfflineSync();
  const [hydrated, setHydrated]         = useState(false);
  const [act, setAct]                   = useState<Act>(1);
  const [isMobile, setIsMobile]         = useState(true);

  // Act 2
  const [gpsState, setGpsState]         = useState<GpsState>("idle");
  const [gpsError, setGpsError]         = useState<string | null>(null);
  const [commune, setCommune]           = useState<CommuneResult | null>(null);
  const [selectedCrop, setSelectedCrop] = useState("");
  const [pallets, setPallets]           = useState(3);
  const [farmerName, setFarmerName]     = useState("");

  // Act 3
  const [userFarmer, setUserFarmer]     = useState<Farmer | null>(null);
  const [routeData, setRouteData]       = useState<OptimizeRouteResponse | null>(null);
  const [showPanel, setShowPanel]       = useState(false);
  const [countedFarmers, setCountedFarmers] = useState(0);
  const [animStep, setAnimStep]         = useState(0);

  useEffect(() => {
    setHydrated(true);
    const check = () => setIsMobile(window.innerWidth < 900);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const fetchRoute = useCallback(async () => {
    try {
      const res = await fetch("/api/optimize-route");
      setRouteData(await res.json());
    } catch { /* offline */ }
  }, []);

  useEffect(() => { fetchRoute(); }, [fetchRoute]);

  // Stagger dots → route → panel
  useEffect(() => {
    if (act !== 3) return;
    const total = routeData?.farmers.length ?? 0;
    if (total === 0) { setAnimStep(2); setShowPanel(true); return; }
    let i = 0;
    const t = setInterval(() => {
      i++;
      setCountedFarmers(i);
      if (i >= total) {
        clearInterval(t);
        setTimeout(() => setAnimStep(1), 500);
        setTimeout(() => { setAnimStep(2); setShowPanel(true); }, 1200);
      }
    }, 320);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [act]);

  async function handleGPS() {
    setGpsState("loading");
    setGpsError(null);
    setSelectedCrop("");
    try {
      const result = await detectCommune();
      setCommune(result);
      setGpsState("done");
    } catch (e) {
      setGpsError(e instanceof Error ? e.message : "Błąd GPS.");
      setGpsState("error");
    }
  }

  function handleSubmit() {
    if (!commune || !selectedCrop) return;
    const farmer: Farmer = {
      id: `reg-${Date.now()}`,
      name: farmerName.trim() || "Rolnik",
      phone: "",
      lat: (commune.commune.latMin + commune.commune.latMax) / 2,
      lng: (commune.commune.lngMin + commune.commune.lngMax) / 2,
      crop: selectedCrop,
      pallets,
      village: commune.commune.name,
    };
    enqueue(farmer);
    setUserFarmer(farmer);
    setCountedFarmers(0);
    setAnimStep(0);
    setShowPanel(false);
    setAct(3);
  }

  function resetForm() {
    setGpsState("idle"); setSelectedCrop(""); setPallets(3);
    setFarmerName(""); setCommune(null); setGpsError(null);
  }

  // Check if a pool for this commune already has declarations
  function poolStatus(teryt: number): "creating" | "joining" {
    try {
      const existing = JSON.parse(localStorage.getItem(PENDING_KEY) ?? "[]");
      const inPool = existing.filter((e: { terytCode: number }) => e.terytCode === teryt).length;
      return inPool > 0 ? "joining" : "creating";
    } catch { return "creating"; }
  }

  const allFarmers = routeData?.farmers ?? [];
  const visibleFarmers = allFarmers.slice(0, countedFarmers);
  const mapPoints = [
    ...visibleFarmers.map((f, i) => ({ lat: f.lat, lng: f.lng, name: f.name, isHub: i === 0, isUser: false })),
    ...(userFarmer ? [{ lat: userFarmer.lat, lng: userFarmer.lng, name: `${userFarmer.name} (Ty)`, isUser: true, isHub: false }] : []),
  ];

  const metrics = routeData?.metrics;
  const poolPallets = (visibleFarmers.reduce((s, f) => s + f.pallets, 0)) + (userFarmer?.pallets ?? 0);
  const poolPct = Math.min(100, Math.round((poolPallets / TRUCK_CAPACITY) * 100));

  if (!hydrated) return <BootScreen />;

  // ── ACT 1 ─────────────────────────────────────────────────────────────────
  if (act === 1) {
    return (
      <div style={{ minHeight: "100dvh", background: T.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative" }}>
        <div style={{ position: "absolute", inset: 0 }}><FieldBg /></div>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(250,247,240,0.1) 0%, rgba(250,247,240,0.88) 50%, rgba(250,247,240,1) 100%)" }} />

        <div style={{ position: "relative", zIndex: 2, maxWidth: "440px", width: "100%", padding: "1.5rem", textAlign: "center", marginTop: "auto" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", background: T.card, border: `1px solid ${T.border}`, borderRadius: "999px", padding: "0.3rem 0.9rem", marginBottom: "1.5rem" }}>
            <span style={{ fontSize: "1rem" }}>🌾</span>
            <span style={{ fontWeight: 800, fontSize: "0.85rem", color: T.accentHi }}>AgroPool</span>
            <span style={{ fontSize: "0.65rem", color: T.subtle }}>· Powiat Kartuski</span>
          </div>

          <h1 style={{ fontSize: "clamp(1.6rem, 6vw, 2.2rem)", fontWeight: 900, color: T.text, lineHeight: 1.2, letterSpacing: "-0.02em", margin: "0 0 1rem" }}>
            Masz 3 palety kapusty.<br />
            <span style={{ color: "#b84030" }}>Nikt nie przyjedzie po tak mało.</span>
          </h1>
          <p style={{ color: T.muted, fontSize: "1rem", lineHeight: 1.6, margin: "0 0 0.75rem" }}>
            Transport do Gdańska kosztuje więcej niż zarobisz. Towar gnije na polu.
          </p>
          <p style={{ color: T.accentHi, fontSize: "0.95rem", fontWeight: 700, margin: "0 0 2rem" }}>
            AgroPool łączy rolników z tej samej gminy i wysyła jedną ciężarówkę.
          </p>

          <button onClick={() => setAct(2)} style={{ background: T.accent, color: "#fff", border: "none", borderRadius: "1.25rem", padding: "1.1rem 2.5rem", fontSize: "1.15rem", fontWeight: 900, cursor: "pointer", width: "100%", boxShadow: `0 6px 20px ${T.accent}55`, touchAction: "manipulation" }}>
            Jestem rolnikiem
          </button>
          <p style={{ color: T.subtle, fontSize: "0.7rem", marginTop: "1rem" }}>Offline-first · Działa bez zasięgu · Powiat Kartuski</p>
        </div>
        <div style={{ height: "10dvh" }} />
      </div>
    );
  }

  // ── ACT 2 ─────────────────────────────────────────────────────────────────
  if (act === 2) {
    const canSubmit = commune !== null && selectedCrop !== "";
    const status = commune ? poolStatus(commune.commune.code) : null;
    const inputBase: React.CSSProperties = {
      background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: "0.875rem",
      color: T.text, width: "100%", padding: "0.875rem 1rem", fontSize: "1rem", outline: "none", boxSizing: "border-box",
    };

    return (
      <div style={{ minHeight: "100dvh", background: T.bg, display: "flex", flexDirection: "column", color: T.text }}>
        <div style={{ background: T.card, borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: "1rem", padding: "1rem 1.25rem", flexShrink: 0 }}>
          <button onClick={() => setAct(1)} style={{ background: "none", border: "none", cursor: "pointer", color: T.muted, fontSize: "1.5rem", padding: 0, lineHeight: 1 }}>←</button>
          <div>
            <div style={{ fontWeight: 900, fontSize: "1rem", color: T.accentHi }}>
              {status === "joining" ? "Dołącz do puli" : status === "creating" ? "Załóż pulę" : "Zgłoś towar"}
            </div>
            <div style={{ fontSize: "0.7rem", color: T.subtle }}>
              {status === "joining" ? `Rolnicy z ${commune!.commune.name} już czekają` : "Pierwszy w gminie tej puli?"}
            </div>
          </div>
          <div style={{ marginLeft: "auto" }}><OnlineBadge isOnline={isOnline} /></div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem", maxWidth: "520px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "1.25rem" }}>

          {/* GPS */}
          <section>
            <Label>Twoja lokalizacja</Label>
            <button type="button" onClick={handleGPS} disabled={gpsState === "loading"} style={{ width: "100%", padding: "1.1rem", borderRadius: "1rem", border: `2px solid ${gpsState === "done" ? T.accent : gpsState === "error" ? "#c87050" : T.border}`, background: gpsState === "done" ? "#f0faeb" : gpsState === "error" ? "#fdf0eb" : T.surface, color: gpsState === "done" ? T.accent : gpsState === "error" ? "#b84030" : T.text, fontSize: "1rem", fontWeight: 700, cursor: gpsState === "loading" ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", touchAction: "manipulation" }}>
              {gpsState === "loading" && <><SpinIcon /> Szukam GPS…</>}
              {gpsState === "done" && commune && <>✓ {commune.commune.name}{commune.source === "fallback" && <span style={{ color: T.gold, fontSize: "0.8rem" }}> (fallback)</span>}</>}
              {gpsState === "error" && <>Błąd — spróbuj ponownie</>}
              {gpsState === "idle" && <>Pobierz lokalizację z pola</>}
            </button>
            {gpsError && <p style={{ color: "#b84030", fontSize: "0.75rem", marginTop: "0.4rem" }}>{gpsError}</p>}
            {gpsState === "done" && commune && (
              <p style={{ color: T.subtle, fontSize: "0.72rem", marginTop: "0.4rem", textAlign: "center" }}>
                TERYT {commune.commune.code} · {commune.availableCrops.length} upraw w ARiMR
              </p>
            )}
          </section>

          {/* Crop grid */}
          {commune && commune.availableCrops.length > 0 && (
            <section>
              <Label>Co zbierasz?</Label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.5rem", maxHeight: "320px", overflowY: "auto" }}>
                {commune.availableCrops.map((crop) => {
                  const active = selectedCrop === crop;
                  return (
                    <button key={crop} type="button" onClick={() => setSelectedCrop(crop)} style={{ padding: "0.75rem 0.4rem", borderRadius: "0.875rem", border: `2px solid ${active ? T.accent : T.border}`, background: active ? "#f0faeb" : T.surface, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", touchAction: "manipulation", transition: "border-color 0.12s, background 0.12s" }}>
                      <span style={{ fontSize: "0.8rem", fontWeight: active ? 800 : 600, color: active ? T.accent : T.text, textAlign: "center", lineHeight: 1.3 }}>{capitalize(crop)}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Pallet counter */}
          {selectedCrop && (
            <section>
              <Label>Ile palet?</Label>
              <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                <CounterBtn onClick={() => setPallets(p => Math.max(1, p - 1))} disabled={pallets <= 1}>−</CounterBtn>
                <div style={{ flex: 1, textAlign: "center" }}>
                  <div style={{ fontSize: "3.5rem", fontWeight: 900, color: T.accent, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{pallets}</div>
                  <div style={{ fontSize: "0.7rem", color: T.subtle, marginTop: "0.2rem" }}>≈ {(pallets * 600).toLocaleString("pl-PL")} kg</div>
                </div>
                <CounterBtn onClick={() => setPallets(p => Math.min(12, p + 1))} disabled={pallets >= 12}>+</CounterBtn>
              </div>
            </section>
          )}

          {/* Name */}
          {selectedCrop && (
            <section>
              <Label>Imię (opcjonalnie)</Label>
              <input type="text" placeholder="Jan" value={farmerName} onChange={e => setFarmerName(e.target.value)} style={inputBase} />
            </section>
          )}

          <button type="button" disabled={!canSubmit} onClick={handleSubmit} style={{ background: canSubmit ? T.accent : T.surface, color: canSubmit ? "#fff" : T.subtle, border: `2px solid ${canSubmit ? T.accent : T.border}`, borderRadius: "1.25rem", padding: "1.2rem", fontSize: "1.1rem", fontWeight: 900, cursor: canSubmit ? "pointer" : "not-allowed", width: "100%", boxShadow: canSubmit ? `0 6px 20px ${T.accent}44` : "none", transition: "all 0.2s", touchAction: "manipulation" }}>
            {status === "joining" ? "Dołącz do puli" : "Załóż pulę"}
          </button>

          <div style={{ height: "1rem" }} />
        </div>
      </div>
    );
  }

  // ── ACT 3 ─────────────────────────────────────────────────────────────────
  const panelContent = (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflowY: "auto" }}>
      {/* Pool header */}
      <div style={{ padding: "1.25rem 1.25rem 0.75rem", borderBottom: `1px solid ${T.border}` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.25rem" }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: "1rem", color: T.text }}>
              Pula · {userFarmer?.village ?? "Kartuzy"}
            </div>
            <div style={{ fontSize: "0.72rem", color: T.subtle, marginTop: "0.1rem" }}>
              Zamknięcie: {nextThursday()}, 23:59
            </div>
          </div>
          <OnlineBadge isOnline={isOnline} />
        </div>

        {/* Truck capacity bar */}
        <div style={{ marginTop: "0.875rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: T.muted, marginBottom: "0.3rem" }}>
            <span>{poolPallets} / {TRUCK_CAPACITY} palet</span>
            <span style={{ color: poolPct >= 100 ? T.accent : T.subtle }}>{poolPct >= 100 ? "Ciężarówka gotowa!" : `Brakuje ${TRUCK_CAPACITY - poolPallets} palet`}</span>
          </div>
          <div style={{ height: "8px", background: T.surface, borderRadius: "999px", overflow: "hidden", border: `1px solid ${T.border}` }}>
            <div style={{ height: "100%", width: `${poolPct}%`, background: poolPct >= 100 ? T.accent : T.accentHi, borderRadius: "999px", transition: "width 0.6s ease" }} />
          </div>
        </div>
      </div>

      {/* Farmer list */}
      <div style={{ padding: "0.75rem 1.25rem", borderBottom: `1px solid ${T.border}`, flex: 1 }}>
        <div style={{ fontSize: "0.65rem", fontWeight: 700, color: T.subtle, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.625rem" }}>
          W puli ({visibleFarmers.length + (userFarmer ? 1 : 0)} rolników)
        </div>

        {userFarmer && (
          <FarmerRow name={userFarmer.name} crop={userFarmer.crop} pallets={userFarmer.pallets} isUser />
        )}
        {visibleFarmers.map(f => (
          <FarmerRow key={f.id} name={f.name} crop={f.crop} pallets={f.pallets} />
        ))}
      </div>

      {/* Metrics */}
      {animStep >= 2 && metrics && (
        <div style={{ padding: "0.75rem 1.25rem", borderBottom: `1px solid ${T.border}` }}>
          <div style={{ background: "#f0faeb", border: `1px solid #b0d88a`, borderRadius: "0.875rem", padding: "0.875rem" }}>
            <div style={{ fontSize: "0.8rem", fontWeight: 800, color: T.accent, marginBottom: "0.625rem" }}>
              1 ciężarówka zamiast {allFarmers.length} vanów
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
              <StatBox label="CO₂" value={`${metrics.co2SavedKg} kg`} />
              <StatBox label="Oszczędność" value={`${metrics.costSavedPln.toFixed(0)} zł`} />
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ padding: "0.875rem 1.25rem", display: "flex", gap: "0.625rem" }}>
        <button onClick={() => { setAct(2); resetForm(); }} style={{ flex: 1, padding: "0.75rem", borderRadius: "0.875rem", border: `1.5px solid ${T.border}`, background: T.surface, color: T.muted, fontWeight: 700, fontSize: "0.85rem", cursor: "pointer" }}>
          + Nowe zgłoszenie
        </button>
        <button onClick={() => setAct(1)} style={{ flex: 1, padding: "0.75rem", borderRadius: "0.875rem", border: "none", background: T.accent, color: "#fff", fontWeight: 900, fontSize: "0.85rem", cursor: "pointer" }}>
          Start
        </button>
      </div>
    </div>
  );

  // Desktop: side panel | Mobile: bottom sheet
  if (!isMobile) {
    return (
      <div style={{ height: "100vh", display: "flex", overflow: "hidden" }}>
        {/* Map */}
        <div style={{ flex: 1, position: "relative" }}>
          <Map points={mapPoints} isOnline={isOnline} focusPoint={userFarmer ? { lat: userFarmer.lat, lng: userFarmer.lng } : null} />
          {/* Top-left logo */}
          <div style={{ position: "absolute", top: "1rem", left: "1rem", zIndex: 500, background: "rgba(255,253,247,0.92)", border: `1px solid ${T.border}`, borderRadius: "999px", padding: "0.4rem 0.875rem", display: "flex", alignItems: "center", gap: "0.4rem", backdropFilter: "blur(6px)" }}>
            <span>🌾</span>
            <span style={{ fontWeight: 900, fontSize: "0.9rem", color: T.accentHi }}>AgroPool</span>
          </div>
        </div>

        {/* Side panel */}
        <div style={{ width: "340px", flexShrink: 0, background: T.card, borderLeft: `1px solid ${T.border}`, display: "flex", flexDirection: "column", transform: showPanel ? "translateX(0)" : "translateX(100%)", transition: "transform 0.5s cubic-bezier(0.34,1.2,0.64,1)" }}>
          {panelContent}
        </div>
      </div>
    );
  }

  // Mobile: full-screen map + bottom sheet
  return (
    <div style={{ height: "100dvh", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0 }}>
        <Map points={mapPoints} isOnline={isOnline} focusPoint={userFarmer ? { lat: userFarmer.lat, lng: userFarmer.lng } : null} />
      </div>

      {/* Top bar */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 500, padding: "0.875rem 1rem", display: "flex", alignItems: "center", justifyContent: "space-between", background: "linear-gradient(to bottom, rgba(26,46,10,0.8) 0%, transparent 100%)" }}>
        <span style={{ fontWeight: 900, fontSize: "1rem", color: "#e8f0d8" }}>🌾 AgroPool</span>
        <OnlineBadge isOnline={isOnline} />
      </div>

      {/* Bottom sheet */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 500, transform: showPanel ? "translateY(0)" : "translateY(110%)", transition: "transform 0.5s cubic-bezier(0.34,1.4,0.64,1)", maxHeight: "65dvh", display: "flex", flexDirection: "column" }}>
        <div style={{ background: T.card, borderRadius: "1.5rem 1.5rem 0 0", boxShadow: "0 -8px 40px rgba(0,0,0,0.25)", border: `1px solid ${T.border}`, flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ width: "40px", height: "4px", background: T.border, borderRadius: "999px", margin: "0.875rem auto 0" }} />
          {panelContent}
        </div>
      </div>
    </div>
  );
}

// ── Micro-components ──────────────────────────────────────────────────────────

function FarmerRow({ name, crop, pallets, isUser }: { name: string; crop: string; pallets: number; isUser?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", padding: "0.5rem 0", borderBottom: `1px solid ${T.border}`, gap: "0.625rem" }}>
      <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: isUser ? "#fffae8" : T.surface, border: `1.5px solid ${isUser ? T.gold : T.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <span style={{ fontSize: "0.65rem", fontWeight: 800, color: isUser ? T.gold : T.muted }}>{isUser ? "TY" : name.charAt(0)}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: "0.85rem", color: isUser ? T.gold : T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {isUser ? "Ty" : name.split(" ")[0]}
        </div>
        <div style={{ fontSize: "0.72rem", color: T.subtle }}>{capitalize(crop)}</div>
      </div>
      <div style={{ flexShrink: 0, textAlign: "right" }}>
        <div style={{ fontWeight: 900, fontSize: "0.95rem", color: T.accent, fontVariantNumeric: "tabular-nums" }}>{pallets}</div>
        <div style={{ fontSize: "0.6rem", color: T.subtle }}>pal.</div>
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
    <button type="button" onClick={onClick} disabled={disabled} style={{ width: "68px", height: "68px", borderRadius: "1rem", background: T.surface, border: `2px solid ${T.border}`, color: disabled ? T.subtle : T.text, fontSize: "2rem", fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", cursor: disabled ? "not-allowed" : "pointer", flexShrink: 0, touchAction: "manipulation" }}>
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

function SpinIcon() {
  return <span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>⏳</span>;
}

function BootScreen() {
  return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ fontSize: "2.5rem" }}>🌾</span>
    </div>
  );
}

function FieldBg() {
  return (
    <svg viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice" style={{ width: "100%", height: "100%" }} xmlns="http://www.w3.org/2000/svg">
      <rect width="800" height="600" fill="#c8e8a8" />
      <rect width="800" height="340" fill="#b8e0a0" />
      <circle cx="660" cy="80" r="52" fill="#f5c842" opacity="0.7" />
      <circle cx="660" cy="80" r="38" fill="#fde68a" opacity="0.85" />
      <path d="M0,280 Q100,240 200,265 Q300,240 400,260 Q500,238 600,258 Q700,238 800,255 L800,600 L0,600 Z" fill="#90c860" />
      <path d="M0,310 Q150,290 300,308 Q450,288 600,305 Q700,295 800,308 L800,600 L0,600 Z" fill="#78b848" />
      <path d="M0,350 Q200,335 400,355 Q600,370 800,345 L800,600 L0,600 Z" fill="#68a838" />
      {[0,1,2,3,4,5,6,7].map(i => <path key={i} d={`M${i*100},600 L${350+i*14},360`} stroke="#5a9428" strokeWidth="1.5" opacity="0.4" />)}
      {[40,60,80,100,120].map((x,i) => <g key={x}><line x1={x} y1="440" x2={x+(i%2===0?-5:5)} y2={390-i*5} stroke="#9a8028" strokeWidth="2"/><ellipse cx={x+(i%2===0?-5:5)} cy={386-i*5} rx="5" ry="10" fill="#c8a030" opacity="0.85"/></g>)}
      <rect x="250" y="280" width="160" height="100" fill="#8a3a1a" />
      <polygon points="238,280 422,280 400,230 260,230" fill="#6a2810" />
      <rect x="300" y="320" width="50" height="60" fill="#3a1a08" />
      <rect x="270" y="290" width="30" height="24" rx="3" fill="#f5c842" opacity="0.2" />
      <rect x="370" y="290" width="30" height="24" rx="3" fill="#f5c842" opacity="0.2" />
      <rect x="430" y="240" width="44" height="140" rx="6" fill="#b0a080" />
      <ellipse cx="452" cy="240" rx="22" ry="9" fill="#d4c8a0" />
      {[260,285,310,335].map(y => <line key={y} x1="430" y1={y} x2="474" y2={y} stroke="#9a8860" strokeWidth="1.5" opacity="0.6"/>)}
      <line x1="570" y1="400" x2="570" y2="240" stroke="#8a7a50" strokeWidth="5" />
      <circle cx="570" cy="300" r="12" fill="#4a7c2f" />
      <line x1="540" y1="300" x2="600" y2="300" stroke="#4a7c2f" strokeWidth="4" />
      <line x1="570" y1="270" x2="570" y2="330" stroke="#4a7c2f" strokeWidth="4" />
      <polygon points="540,300 547,294 547,306" fill="#3a6a22" />
      <polygon points="600,300 593,294 593,306" fill="#3a6a22" />
      <polygon points="570,270 564,277 576,277" fill="#3a6a22" />
      <polygon points="570,330 564,323 576,323" fill="#3a6a22" />
      {[650,670,690,710,730].map((x,i) => <g key={x}><line x1={x} y1="430" x2={x+(i%2===0?4:-4)} y2={385-i*4} stroke="#9a8028" strokeWidth="2"/><ellipse cx={x+(i%2===0?4:-4)} cy={381-i*4} rx="5" ry="10" fill="#c8a030" opacity="0.85"/></g>)}
    </svg>
  );
}
