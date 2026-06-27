"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { TERYT_COMMUNES, type TerytCommune } from "@/app/api/data/mockData";
import { haversineKm, type EmptyRunResult, type GeoPoint } from "@/utils/emptyRuns";

const Map = dynamic(() => import("@/components/Map"), { ssr: false });

// Paleta spójna z app/page.tsx (AgroPool)
const T = {
  bg: "#faf7f0",
  card: "#fffdf7",
  surface: "#f5f0e4",
  border: "#ddd4b8",
  accent: "#2d5a1b",
  accentHi: "#3a7a22",
  gold: "#c8781a",
  text: "#2a1a08",
  muted: "#7a6a48",
  subtle: "#9a8a60",
};

const TRUCK_CAPACITY = 24; // palet

interface Destination extends GeoPoint {
  name: string;
}

const DESTINATIONS: Destination[] = [
  { name: "Gdańsk", lat: 54.352, lng: 18.646 },
  { name: "Gdynia", lat: 54.519, lng: 18.532 },
  { name: "Bytów", lat: 54.171, lng: 17.491 },
  { name: "Starogard Gd.", lat: 53.966, lng: 18.529 },
];

type Act = 1 | 2 | 3;

function communeCentroid(c: TerytCommune): GeoPoint {
  return { lat: (c.latMin + c.latMax) / 2, lng: (c.lngMin + c.lngMax) / 2 };
}

function isoPlusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatPlDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long" });
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const COMMUNES = TERYT_COMMUNES.filter((c) => c.powiat !== "Gdańsk");

export default function PrzewoznikPage() {
  const { isOnline } = useOfflineSync();
  const [hydrated, setHydrated] = useState(false);
  const [act, setAct] = useState<Act>(2);

  const [carrierName, setCarrierName] = useState("");
  const [fromCommune, setFromCommune] = useState<TerytCommune>(
    COMMUNES.find((c) => c.name === "Sierakowice") ?? COMMUNES[0],
  );
  const [dest, setDest] = useState<Destination>(DESTINATIONS[0]);
  const [date, setDate] = useState("");
  const [capacity, setCapacity] = useState(12);

  const [result, setResult] = useState<EmptyRunResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [booked, setBooked] = useState(false);
  const [bookingCode] = useState(() => `AP-2026-${Math.random().toString(36).slice(2,5).toUpperCase()}`);

  useEffect(() => {
    setHydrated(true);
    setDate(isoPlusDays(2));
  }, []);

  async function handleSubmit() {
    setLoading(true);
    const from = communeCentroid(fromCommune);
    try {
      const res = await fetch("/api/empty-runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carrierName,
          from,
          to: { lat: dest.lat, lng: dest.lng },
          toLabel: dest.name,
          date,
          capacityPallets: capacity,
        }),
      });
      const json = (await res.json()) as EmptyRunResult;
      setResult(json);
      setAct(3);
    } catch {
      setResult({
        matches: [],
        takenPallets: 0,
        capacityPallets: capacity,
        fillPct: 0,
        co2SavedKg: 0,
        cargoValuePln: 0,
        date,
        toLabel: dest.name,
      });
      setAct(3);
    } finally {
      setLoading(false);
    }
  }

  if (!hydrated) {
    return (
      <div style={{ minHeight: "100dvh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: "2.5rem" }}>🚚</span>
      </div>
    );
  }

  // ── AKT 1 — hook ────────────────────────────────────────────────────────────
  if (act === 1) {
    return (
      <div style={{ minHeight: "100dvh", background: T.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}>
        <div style={{ maxWidth: "440px", width: "100%", textAlign: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", background: T.card, border: `1px solid ${T.border}`, borderRadius: "999px", padding: "0.3rem 0.9rem", marginBottom: "1.5rem" }}>
            <span>🚚</span>
            <span style={{ fontWeight: 800, fontSize: "0.85rem", color: T.accentHi }}>AgroPool</span>
            <span style={{ fontSize: "0.65rem", color: T.subtle }}>· dla przewoźników</span>
          </div>
          <h1 style={{ fontSize: "clamp(1.6rem, 6vw, 2.2rem)", fontWeight: 900, color: T.text, lineHeight: 1.2, letterSpacing: "-0.02em", margin: "0 0 1rem" }}>
            Wracasz pusty z Trójmiasta?<br />
            <span style={{ color: "#b84030" }}>Spalasz paliwo za nic.</span>
          </h1>
          <p style={{ color: T.muted, fontSize: "1rem", lineHeight: 1.6, margin: "0 0 0.75rem" }}>
            Co trzeci kurs powrotny jedzie pusty. Po drodze gniją nadwyżki, których nikt nie odbiera.
          </p>
          <p style={{ color: T.accentHi, fontSize: "0.95rem", fontWeight: 700, margin: "0 0 2rem" }}>
            Podaj trasę i wolne palety — pokażemy towar leżący po Twojej drodze.
          </p>
          <button onClick={() => setAct(2)} style={{ background: T.accent, color: "#fff", border: "none", borderRadius: "1.25rem", padding: "1.1rem 2.5rem", fontSize: "1.15rem", fontWeight: 900, cursor: "pointer", width: "100%", boxShadow: `0 6px 20px ${T.accent}55` }}>
            Jestem przewoźnikiem
          </button>
          <p style={{ color: T.subtle, fontSize: "0.7rem", marginTop: "1rem" }}>Backhaul · Powiat Kartuski · mniej pustych kilometrów</p>
        </div>
      </div>
    );
  }

  // ── AKT 2 — formularz ───────────────────────────────────────────────────────
  if (act === 2) {
    const inputBase: React.CSSProperties = {
      background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: "0.875rem",
      color: T.text, width: "100%", padding: "0.875rem 1rem", fontSize: "1rem", outline: "none", boxSizing: "border-box",
    };
    return (
      <div style={{ minHeight: "100dvh", background: T.bg, display: "flex", flexDirection: "column", color: T.text }}>
        <div style={{ background: T.card, borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: "1rem", padding: "1rem 1.25rem" }}>
          <a href="/" style={{ background: "none", border: "none", cursor: "pointer", color: T.muted, fontSize: "1.5rem", padding: 0, lineHeight: 1, textDecoration: "none" }}>←</a>
          <div>
            <div style={{ fontWeight: 900, fontSize: "1rem", color: T.accentHi }}>Zgłoś pusty kurs</div>
            <div style={{ fontSize: "0.7rem", color: T.subtle }}>Trasa, termin i wolna załadowność</div>
          </div>
          <div style={{ marginLeft: "auto" }}><OnlineBadge isOnline={isOnline} /></div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem", maxWidth: "520px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <section>
            <Label>Skąd jedziesz</Label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.5rem" }}>
              {COMMUNES.map((c) => {
                const active = fromCommune.code === c.code;
                return (
                  <button key={c.code} type="button" onClick={() => setFromCommune(c)}
                    style={{ padding: "0.75rem 0.4rem", borderRadius: "0.875rem", border: `2px solid ${active ? T.accent : T.border}`, background: active ? "#f0faeb" : T.surface, cursor: "pointer", touchAction: "manipulation" }}>
                    <span style={{ fontSize: "0.82rem", fontWeight: active ? 800 : 600, color: active ? T.accent : T.text }}>{c.name}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <Label>Dokąd (cel kursu)</Label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.5rem" }}>
              {DESTINATIONS.map((d) => {
                const active = dest.name === d.name;
                return (
                  <button key={d.name} type="button" onClick={() => setDest(d)}
                    style={{ padding: "0.75rem 0.4rem", borderRadius: "0.875rem", border: `2px solid ${active ? T.accent : T.border}`, background: active ? "#f0faeb" : T.surface, cursor: "pointer", touchAction: "manipulation" }}>
                    <span style={{ fontSize: "0.85rem", fontWeight: active ? 800 : 600, color: active ? T.accent : T.text }}>{d.name}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <Label>Kiedy możesz przyjechać</Label>
            <input type="date" value={date} min={isoPlusDays(0)} onChange={(e) => setDate(e.target.value)} style={inputBase} />
          </section>

          <section>
            <Label>Wolna załadowność</Label>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <CounterBtn onClick={() => setCapacity((p) => Math.max(1, p - 1))} disabled={capacity <= 1}>−</CounterBtn>
              <div style={{ flex: 1, textAlign: "center" }}>
                <div style={{ fontSize: "3.5rem", fontWeight: 900, color: T.accent, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{capacity}</div>
                <div style={{ fontSize: "0.7rem", color: T.subtle, marginTop: "0.2rem" }}>wolnych palet (max ciężarówka ≈ {TRUCK_CAPACITY})</div>
              </div>
              <CounterBtn onClick={() => setCapacity((p) => Math.min(TRUCK_CAPACITY, p + 1))} disabled={capacity >= TRUCK_CAPACITY}>+</CounterBtn>
            </div>
          </section>

          <section>
            <Label>Imię / firma (opcjonalnie)</Label>
            <input type="text" placeholder="np. Trans-Kaszuby" value={carrierName} onChange={(e) => setCarrierName(e.target.value)} style={inputBase} />
          </section>

          <button type="button" onClick={handleSubmit} disabled={loading} style={{ background: T.accent, color: "#fff", border: "none", borderRadius: "1.25rem", padding: "1.2rem", fontSize: "1.1rem", fontWeight: 900, cursor: loading ? "wait" : "pointer", width: "100%", boxShadow: `0 6px 20px ${T.accent}44`, opacity: loading ? 0.7 : 1 }}>
            {loading ? "Szukam towaru…" : "Szukaj towaru po drodze"}
          </button>
          <div style={{ height: "1rem" }} />
        </div>
      </div>
    );
  }

  // ── AKT 3 — wynik ───────────────────────────────────────────────────────────
  const r = result!;
  const from = communeCentroid(fromCommune);
  const orderedPickups = [...r.matches].sort(
    (a, b) => haversineKm(from, a.farmer) - haversineKm(from, b.farmer),
  );
  const mapPoints = [
    { lat: from.lat, lng: from.lng, name: `Start: ${fromCommune.name}`, isUser: true, isHub: false },
    ...orderedPickups.map((m) => ({ lat: m.farmer.lat, lng: m.farmer.lng, name: `${m.farmer.village} · ${m.farmer.pallets} pal.`, isUser: false, isHub: false })),
    { lat: dest.lat, lng: dest.lng, name: `Cel: ${r.toLabel}`, isHub: true, isUser: false },
  ];
  const routePts = [from, ...orderedPickups.map((m) => ({ lat: m.farmer.lat, lng: m.farmer.lng })), { lat: dest.lat, lng: dest.lng }];

  return (
    <div style={{ minHeight: "100dvh", background: T.bg, display: "flex", flexDirection: "column", color: T.text }}>
      <div style={{ background: T.card, borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: "1rem", padding: "0.875rem 1.25rem" }}>
        <button onClick={() => setAct(2)} style={{ background: "none", border: "none", cursor: "pointer", color: T.muted, fontSize: "1.5rem", padding: 0, lineHeight: 1 }}>←</button>
        <div>
          <div style={{ fontWeight: 900, fontSize: "1rem", color: T.accentHi }}>{fromCommune.name} → {r.toLabel}</div>
          <div style={{ fontSize: "0.7rem", color: T.subtle }}>{capitalize(formatPlDate(r.date))}</div>
        </div>
        <div style={{ marginLeft: "auto" }}><OnlineBadge isOnline={isOnline} /></div>
      </div>

      <div style={{ height: "44dvh", minHeight: "260px", position: "relative" }}>
        <Map points={mapPoints} isOnline={isOnline} route={routePts} focusPoint={from} />
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "1rem 1.25rem", maxWidth: "560px", width: "100%", margin: "0 auto" }}>
        {/* Pasek zapełnienia */}
        <div style={{ marginBottom: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: T.muted, marginBottom: "0.3rem" }}>
            <span>{r.takenPallets} / {r.capacityPallets} palet zapełnione</span>
            <span style={{ color: r.fillPct >= 100 ? T.accent : T.subtle }}>{r.fillPct}%</span>
          </div>
          <div style={{ height: "8px", background: T.surface, borderRadius: "999px", overflow: "hidden", border: `1px solid ${T.border}` }}>
            <div style={{ height: "100%", width: `${r.fillPct}%`, background: r.fillPct >= 100 ? T.accent : T.accentHi, borderRadius: "999px", transition: "width 0.6s ease" }} />
          </div>
        </div>

        {r.matches.length === 0 ? (
          <div style={{ background: "#fdf4e6", border: `1px solid ${T.gold}`, borderRadius: "0.875rem", padding: "1rem", color: T.text, fontSize: "0.9rem" }}>
            Brak nadwyżek w korytarzu tej trasy na teraz. Spróbuj innego celu albo zwiększ załadowność.
          </div>
        ) : (
          <>
            <div style={{ fontSize: "0.65rem", fontWeight: 700, color: T.subtle, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.5rem" }}>
              Do zabrania po drodze ({r.matches.length})
            </div>
            {orderedPickups.map((m) => (
              <div key={m.farmer.id} style={{ display: "flex", alignItems: "center", padding: "0.6rem 0", borderBottom: `1px solid ${T.border}`, gap: "0.7rem" }}>
                <div style={{ width: "30px", height: "30px", borderRadius: "50%", background: T.surface, border: `1.5px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "0.8rem" }}>🥬</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: "0.9rem", color: T.text }}>{m.farmer.village}</div>
                  <div style={{ fontSize: "0.72rem", color: T.subtle }}>{m.farmer.crop} · +{m.detourKm} km od trasy</div>
                </div>
                <div style={{ flexShrink: 0, textAlign: "right" }}>
                  <div style={{ fontWeight: 900, fontSize: "0.95rem", color: T.accent, fontVariantNumeric: "tabular-nums" }}>{m.farmer.pallets}</div>
                  <div style={{ fontSize: "0.6rem", color: T.subtle }}>pal.</div>
                </div>
              </div>
            ))}

            <div style={{ marginTop: "1rem", background: "#f0faeb", border: "1px solid #b0d88a", borderRadius: "0.875rem", padding: "0.875rem" }}>
              <div style={{ fontSize: "0.8rem", fontWeight: 800, color: T.accent, marginBottom: "0.625rem" }}>
                Pusty kurs zamieniony w {r.takenPallets} palet ładunku
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                <StatBox label="CO₂ zaoszczędzone" value={`${r.co2SavedKg} kg`} />
                <StatBox label="Wartość ładunku" value={`${r.cargoValuePln.toLocaleString("pl-PL")} zł`} />
              </div>
            </div>
          </>
        )}

        {/* Booking */}
        {r.matches.length > 0 && (
          booked ? (
            <div style={{ margin: "0.5rem 0 1rem", background: "#f0faeb", border: "1.5px solid #2d5a1b", borderRadius: "1rem", padding: "1rem 1.25rem" }}>
              <div style={{ fontWeight: 900, fontSize: "1rem", color: T.accent, marginBottom: "0.375rem" }}>✅ Kurs zarezerwowany!</div>
              <div style={{ fontSize: "0.8rem", color: T.muted, marginBottom: "0.625rem" }}>
                Kod rezerwacji: <strong style={{ color: T.text, fontFamily: "monospace" }}>{bookingCode}</strong>
              </div>
              <button
                type="button"
                onClick={() => {
                  const content = `CYFROWY LIST PRZEWOZOWY (CMR)\nKod: ${bookingCode}\nData: ${r.date}\nTrasa: ${fromCommune.name} → ${r.toLabel}\nPalety: ${r.takenPallets}\nPrzewożnik: ${carrierName || "Trans-AgroPool"}\n\nWygenerowano przez AgroPool`;
                  const blob = new Blob([content], { type: "text/plain" });
                  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `CMR-${bookingCode}.txt`; a.click();
                }}
                style={{ width: "100%", padding: "0.75rem", borderRadius: "0.875rem", border: `1.5px solid ${T.accent}`, background: T.card, color: T.accent, fontWeight: 700, fontSize: "0.85rem", cursor: "pointer" }}
              >
                📄 Pobierz cyfrowy list przewozowy (CMR) Offline
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setBooked(true)}
              style={{ width: "100%", margin: "0.5rem 0 1rem", padding: "1rem", borderRadius: "1rem", border: "none", background: T.accent, color: "#fff", fontWeight: 900, fontSize: "1rem", cursor: "pointer", boxShadow: `0 6px 20px ${T.accent}44` }}
            >
              ⚡ Zarezerwuj kurs i pobierz CMR
            </button>
          )
        )}

        <div style={{ padding: "0 0 1.5rem", display: "flex", gap: "0.625rem" }}>
          <button onClick={() => { setAct(2); setBooked(false); }} style={{ flex: 1, padding: "0.75rem", borderRadius: "0.875rem", border: `1.5px solid ${T.border}`, background: T.surface, color: T.muted, fontWeight: 700, fontSize: "0.85rem", cursor: "pointer" }}>
            + Nowy kurs
          </button>
          <button onClick={() => setAct(1)} style={{ flex: 1, padding: "0.75rem", borderRadius: "0.875rem", border: "none", background: T.accent, color: "#fff", fontWeight: 900, fontSize: "0.85rem", cursor: "pointer" }}>
            Start
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Mikro-komponenty ──────────────────────────────────────────────────────────

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
