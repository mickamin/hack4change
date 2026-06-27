"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { haversineKm, type EmptyRunResult, type GeoPoint, type DistributorMatch } from "@/utils/emptyRuns";

const Map = dynamic(() => import("@/components/Map"), { ssr: false });

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

const TRUCK_CAPACITY = 24;

type Act = "form" | "result";

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
}

interface PlaceSelection {
  label: string;
  lat: number;
  lng: number;
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

function useNominatim() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selected, setSelected] = useState<PlaceSelection | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback((q: string) => {
    setQuery(q);
    setSelected(null);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (q.trim().length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }
    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&countrycodes=pl&limit=5&q=${encodeURIComponent(q)}`,
        );
        const data = (await res.json()) as NominatimResult[];
        setSuggestions(data);
        setShowDropdown(data.length > 0);
      } catch {
        setSuggestions([]);
        setShowDropdown(false);
      }
    }, 350);
  }, []);

  const pick = useCallback((item: NominatimResult) => {
    const short = item.display_name.split(",").slice(0, 2).join(",").trim();
    setQuery(short);
    setSelected({ label: short, lat: parseFloat(item.lat), lng: parseFloat(item.lon) });
    setShowDropdown(false);
    setSuggestions([]);
  }, []);

  const blur = useCallback(() => {
    setTimeout(() => setShowDropdown(false), 200);
  }, []);

  return { query, suggestions, showDropdown, selected, search, pick, blur };
}

export default function PrzewoznikPage() {
  const { isOnline } = useOfflineSync();
  const [hydrated, setHydrated] = useState(false);
  const [act, setAct] = useState<Act>("form");

  const fromField = useNominatim();
  const toField = useNominatim();

  const [carrierName, setCarrierName] = useState("");
  const [date, setDate] = useState("");
  const [capacity, setCapacity] = useState(12);
  const [pricePerPallet, setPricePerPallet] = useState(50);
  const [pricePerKg, setPricePerKg] = useState(0.15);

  type Unit = "palety" | "kg";
  interface SelectedCrop { name: string; qty: number; unit: Unit }
  const [allCrops, setAllCrops] = useState<string[]>([]);
  const [cropsLoading, setCropsLoading] = useState(false);
  const [cropSearch, setCropSearch] = useState("");
  const [selectedCrops, setSelectedCrops] = useState<SelectedCrop[]>([]);

  const [result, setResult] = useState<EmptyRunResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [booked, setBooked] = useState(false);
  const [bookingCode] = useState(() => `AP-2026-${Math.random().toString(36).slice(2,5).toUpperCase()}`);

  useEffect(() => {
    setHydrated(true);
    setDate(isoPlusDays(2));

    setCropsLoading(true);
    fetch("/api/crops/all")
      .then((r) => r.json())
      .then((json) => {
        const list: string[] = json.availableCrops ?? [];
        setAllCrops(list);
      })
      .catch(() => setAllCrops([]))
      .finally(() => setCropsLoading(false));
  }, []);

  const filteredCrops = cropSearch.trim()
    ? allCrops.filter((c) => c.toLowerCase().includes(cropSearch.toLowerCase()))
    : allCrops;

  function addCrop(crop: string) {
    if (!selectedCrops.find((s) => s.name === crop)) {
      setSelectedCrops((prev) => [...prev, { name: crop, qty: 5, unit: "palety" as Unit }]);
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
    if (!fromField.selected || !toField.selected) return;
    setLoading(true);
    const from = { lat: fromField.selected.lat, lng: fromField.selected.lng };
    try {
      const res = await fetch("/api/empty-runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carrierName,
          from,
          to: { lat: toField.selected.lat, lng: toField.selected.lng },
          toLabel: toField.selected.label,
          date,
          capacityPallets: capacity,
        }),
      });
      const raw = (await res.json()) as Partial<EmptyRunResult>;
      setResult({
        matches: Array.isArray(raw.matches) ? raw.matches : [],
        distributorMatches: Array.isArray(raw.distributorMatches) ? raw.distributorMatches : [],
        takenPallets: raw.takenPallets ?? 0,
        capacityPallets: raw.capacityPallets ?? capacity,
        fillPct: raw.fillPct ?? 0,
        co2SavedKg: raw.co2SavedKg ?? 0,
        cargoValuePln: raw.cargoValuePln ?? 0,
        date: raw.date ?? date,
        toLabel: raw.toLabel ?? toField.selected.label,
      });
      setAct("result");
    } catch {
      setResult({
        matches: [],
        distributorMatches: [],
        takenPallets: 0,
        capacityPallets: capacity,
        fillPct: 0,
        co2SavedKg: 0,
        cargoValuePln: 0,
        date,
        toLabel: toField.selected.label,
      });
      setAct("result");
    } finally {
      setLoading(false);
    }
  }

  if (!hydrated) {
    return (
      <div style={{ minHeight: "100dvh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: "1.2rem", color: T.muted, fontWeight: 700 }}>Ladowanie...</span>
      </div>
    );
  }

  const inputBase: React.CSSProperties = {
    background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: "0.875rem",
    color: T.text, width: "100%", padding: "0.875rem 1rem", fontSize: "1rem", outline: "none", boxSizing: "border-box",
  };

  const canSubmit = fromField.selected && toField.selected && !loading;

  if (act === "form") {
    return (
      <div style={{ minHeight: "100dvh", background: T.bg, display: "flex", flexDirection: "column", color: T.text }}>
        <div style={{ background: T.card, borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: "1rem", padding: "1rem 1.25rem" }}>
          <a href="/" style={{ background: "none", border: "none", cursor: "pointer", color: T.muted, fontSize: "1.5rem", padding: 0, lineHeight: 1, textDecoration: "none" }}>&#8592;</a>
          <div>
            <div style={{ fontWeight: 900, fontSize: "1rem", color: T.accentHi }}>Zglos pusty kurs</div>
            <div style={{ fontSize: "0.7rem", color: T.subtle }}>Trasa, termin i wolna zaladownosc</div>
          </div>
          <div style={{ marginLeft: "auto" }}><OnlineBadge isOnline={isOnline} /></div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem", maxWidth: "520px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <section style={{ position: "relative" }}>
            <Label>Skad jedziesz</Label>
            <input
              type="text"
              placeholder="np. Sierakowice, Kartuzy..."
              value={fromField.query}
              onChange={(e) => fromField.search(e.target.value)}
              onBlur={fromField.blur}
              onFocus={() => { if (fromField.suggestions.length > 0) fromField.search(fromField.query); }}
              style={{ ...inputBase, borderColor: fromField.selected ? T.accent : T.border }}
            />
            {fromField.showDropdown && <Dropdown items={fromField.suggestions} onPick={fromField.pick} />}
          </section>

          <section style={{ position: "relative" }}>
            <Label>Dokad (cel kursu)</Label>
            <input
              type="text"
              placeholder="np. Gdansk, Warszawa..."
              value={toField.query}
              onChange={(e) => toField.search(e.target.value)}
              onBlur={toField.blur}
              onFocus={() => { if (toField.suggestions.length > 0) toField.search(toField.query); }}
              style={{ ...inputBase, borderColor: toField.selected ? T.accent : T.border }}
            />
            {toField.showDropdown && <Dropdown items={toField.suggestions} onPick={toField.pick} />}
          </section>

          <section>
            <Label>Kiedy mozesz przyjechac</Label>
            <input type="date" value={date} min={isoPlusDays(0)} onChange={(e) => setDate(e.target.value)} style={inputBase} />
          </section>

          <section>
            <Label>Wolna zaladownosc</Label>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <CounterBtn onClick={() => setCapacity((p) => Math.max(1, p - 1))} disabled={capacity <= 1}>-</CounterBtn>
              <div style={{ flex: 1, textAlign: "center" }}>
                <div style={{ fontSize: "3.5rem", fontWeight: 900, color: T.accent, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{capacity}</div>
                <div style={{ fontSize: "0.7rem", color: T.subtle, marginTop: "0.2rem" }}>wolnych palet (max ciezarowka ~ {TRUCK_CAPACITY})</div>
              </div>
              <CounterBtn onClick={() => setCapacity((p) => Math.min(TRUCK_CAPACITY, p + 1))} disabled={capacity >= TRUCK_CAPACITY}>+</CounterBtn>
            </div>
          </section>

          <section>
            <Label>Cennik przewozu</Label>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "0.7rem", color: T.muted, marginBottom: "0.3rem" }}>Za palete (zl)</div>
                <input type="number" value={pricePerPallet} min={0} step={5}
                  onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v) && v >= 0) setPricePerPallet(v); }}
                  style={{ ...inputBase, textAlign: "center", fontSize: "1.1rem", fontWeight: 700 }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "0.7rem", color: T.muted, marginBottom: "0.3rem" }}>Za kg (zl)</div>
                <input type="number" value={pricePerKg} min={0} step={0.01}
                  onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v) && v >= 0) setPricePerKg(v); }}
                  style={{ ...inputBase, textAlign: "center", fontSize: "1.1rem", fontWeight: 700 }} />
              </div>
            </div>
          </section>

          {/* Crop picker */}
          <section>
            <Label>Co moge zabrac</Label>
            <input
              type="text"
              placeholder={cropsLoading ? "Ladowanie upraw..." : "Szukaj uprawy..."}
              value={cropSearch}
              onChange={(e) => setCropSearch(e.target.value)}
              disabled={cropsLoading}
              style={{ ...inputBase, marginBottom: "0.625rem" }}
            />
            {cropsLoading ? (
              <div style={{ textAlign: "center", padding: "1rem", color: T.subtle, fontSize: "0.85rem" }}>
                Ladowanie...
              </div>
            ) : cropSearch.trim() && filteredCrops.length === 0 ? (
              <p style={{ color: T.subtle, fontSize: "0.85rem", margin: 0 }}>Brak wynikow.</p>
            ) : cropSearch.trim() ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", maxHeight: "200px", overflowY: "auto" }}>
                {filteredCrops.slice(0, 12).map((crop) => {
                  const added = selectedCrops.some((s) => s.name === crop);
                  return (
                    <button key={crop} type="button" onClick={() => addCrop(crop)}
                      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.625rem 0.875rem", borderRadius: "0.75rem", border: `1.5px solid ${added ? T.accent : T.border}`, background: added ? "#f0faeb" : T.surface, cursor: "pointer", touchAction: "manipulation" }}>
                      <span style={{ fontSize: "0.9rem", fontWeight: 600, color: added ? T.accent : T.text }}>{capitalize(crop)}</span>
                      <span style={{ fontSize: "1rem", color: added ? T.accent : T.subtle }}>{added ? "v" : "+"}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </section>

          {selectedCrops.length > 0 && (
            <section>
              <Label>Moje ladunki</Label>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {selectedCrops.map((sc) => (
                  <div key={sc.name} style={{ padding: "0.875rem", background: T.card, border: `1.5px solid ${T.accent}55`, borderRadius: "0.875rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.625rem" }}>
                      <div style={{ flex: 1, fontWeight: 700, fontSize: "0.9rem", color: T.text }}>{capitalize(sc.name)}</div>
                      <button type="button" onClick={() => removeCrop(sc.name)}
                        style={{ width: "28px", height: "28px", borderRadius: "50%", border: `1.5px solid ${T.border}`, background: T.surface, color: T.muted, fontSize: "0.9rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, touchAction: "manipulation" }}>x</button>
                    </div>
                    <div style={{ display: "flex", gap: "0.375rem", marginBottom: "0.625rem" }}>
                      {(["palety", "kg"] as Unit[]).map((u) => (
                        <button key={u} type="button" onClick={() => updateCrop(sc.name, { unit: u, qty: u === "palety" ? 5 : 1000 })}
                          style={{ flex: 1, padding: "0.5rem", borderRadius: "0.625rem", border: `1.5px solid ${sc.unit === u ? T.accent : T.border}`, background: sc.unit === u ? "#f0faeb" : T.surface, color: sc.unit === u ? T.accent : T.muted, fontSize: "0.8rem", fontWeight: 700, cursor: "pointer", touchAction: "manipulation" }}>
                          {u === "palety" ? "Palety" : "Kilogramy"}
                        </button>
                      ))}
                    </div>
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

          <section>
            <Label>Imie / firma (opcjonalnie)</Label>
            <input type="text" placeholder="np. Trans-Kaszuby" value={carrierName} onChange={(e) => setCarrierName(e.target.value)} style={inputBase} />
          </section>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{
              background: canSubmit ? T.accent : T.subtle,
              color: "#fff", border: "none", borderRadius: "1.25rem", padding: "1.2rem",
              fontSize: "1.1rem", fontWeight: 900,
              cursor: canSubmit ? "pointer" : "not-allowed",
              width: "100%",
              boxShadow: canSubmit ? `0 6px 20px ${T.accent}44` : "none",
              opacity: loading ? 0.7 : 1,
              touchAction: "manipulation",
            }}
          >
            {loading ? "Szukam towaru..." : "Szukaj towaru po drodze"}
          </button>
          <div style={{ height: "1rem" }} />
        </div>
      </div>
    );
  }

  // ── WYNIK ───────────────────────────────────────────────────────────────
  const r = result!;
  const from = { lat: fromField.selected!.lat, lng: fromField.selected!.lng };

  const selectedSet = new Set(selectedCrops.map((s) => s.name));
  const filteredMatches = selectedSet.size > 0 ? r.matches.filter((m) => selectedSet.has(m.farmer.crop)) : r.matches;
  const filteredPallets = filteredMatches.reduce((sum, m) => sum + m.farmer.pallets, 0);
  const filteredFillPct = r.capacityPallets > 0 ? Math.min(100, Math.round((filteredPallets / r.capacityPallets) * 100)) : 0;

  const orderedPickups = [...filteredMatches].sort(
    (a, b) => haversineKm(from, a.farmer) - haversineKm(from, b.farmer),
  );
  const mapPoints = [
    { lat: from.lat, lng: from.lng, name: `Start: ${fromField.selected!.label}`, isUser: true, isHub: false },
    ...orderedPickups.map((m) => ({ lat: m.farmer.lat, lng: m.farmer.lng, name: `${m.farmer.village} - ${m.farmer.pallets} pal.`, isUser: false, isHub: false })),
    { lat: toField.selected!.lat, lng: toField.selected!.lng, name: `Cel: ${r.toLabel}`, isHub: true, isUser: false },
  ];
  const routePts = [from, ...orderedPickups.map((m) => ({ lat: m.farmer.lat, lng: m.farmer.lng })), { lat: toField.selected!.lat, lng: toField.selected!.lng }];

  return (
    <div style={{ minHeight: "100dvh", background: T.bg, display: "flex", flexDirection: "column", color: T.text }}>
      <div style={{ background: T.card, borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: "1rem", padding: "0.875rem 1.25rem" }}>
        <button onClick={() => setAct("form")} style={{ background: "none", border: "none", cursor: "pointer", color: T.muted, fontSize: "1.5rem", padding: 0, lineHeight: 1 }}>&#8592;</button>
        <div>
          <div style={{ fontWeight: 900, fontSize: "1rem", color: T.accentHi }}>{fromField.selected!.label} &#8594; {r.toLabel}</div>
          <div style={{ fontSize: "0.7rem", color: T.subtle }}>{capitalize(formatPlDate(r.date))}</div>
        </div>
        <div style={{ marginLeft: "auto" }}><OnlineBadge isOnline={isOnline} /></div>
      </div>

      <div style={{ height: "44dvh", minHeight: "260px", position: "relative" }}>
        <Map points={mapPoints} isOnline={isOnline} route={routePts} focusPoint={from} />
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "1rem 1.25rem", maxWidth: "560px", width: "100%", margin: "0 auto" }}>
        <div style={{ marginBottom: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: T.muted, marginBottom: "0.3rem" }}>
            <span>{filteredPallets} / {r.capacityPallets} palet zapelnione</span>
            <span style={{ color: filteredFillPct >= 100 ? T.accent : T.subtle }}>{filteredFillPct}%</span>
          </div>
          <div style={{ height: "8px", background: T.surface, borderRadius: "999px", overflow: "hidden", border: `1px solid ${T.border}` }}>
            <div style={{ height: "100%", width: `${filteredFillPct}%`, background: filteredFillPct >= 100 ? T.accent : T.accentHi, borderRadius: "999px", transition: "width 0.6s ease" }} />
          </div>
        </div>

        {filteredMatches.length === 0 ? (
          <div style={{ background: "#fdf4e6", border: `1px solid ${T.gold}`, borderRadius: "0.875rem", padding: "1rem", color: T.text, fontSize: "0.9rem" }}>
            Brak nadwyzek w korytarzu tej trasy dla wybranych typow ladunku. Sprobuj innego celu, zwieksz zaladownosc lub zmien filtr ladunku.
          </div>
        ) : (
          <>
            <div style={{ fontSize: "0.65rem", fontWeight: 700, color: T.subtle, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.5rem" }}>
              Do zabrania po drodze ({filteredMatches.length})
            </div>
            {orderedPickups.map((m) => (
              <div key={m.farmer.id} style={{ display: "flex", alignItems: "center", padding: "0.6rem 0", borderBottom: `1px solid ${T.border}`, gap: "0.7rem" }}>
                <div style={{ width: "30px", height: "30px", borderRadius: "50%", background: T.surface, border: `1.5px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "0.7rem", fontWeight: 800, color: T.accent }}>P</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: "0.9rem", color: T.text }}>{m.farmer.village}</div>
                  <div style={{ fontSize: "0.72rem", color: T.subtle }}>{m.farmer.crop} - +{m.detourKm} km od trasy</div>
                </div>
                <div style={{ flexShrink: 0, textAlign: "right" }}>
                  <div style={{ fontWeight: 900, fontSize: "0.95rem", color: T.accent, fontVariantNumeric: "tabular-nums" }}>{m.farmer.pallets} pal.</div>
                  <div style={{ fontSize: "0.7rem", color: T.gold, fontWeight: 700 }}>{(m.farmer.pallets * pricePerPallet).toLocaleString("pl-PL")} zl</div>
                </div>
              </div>
            ))}

            <div style={{ marginTop: "1rem", background: "#f0faeb", border: "1px solid #b0d88a", borderRadius: "0.875rem", padding: "0.875rem" }}>
              <div style={{ fontSize: "0.8rem", fontWeight: 800, color: T.accent, marginBottom: "0.625rem" }}>
                Pusty kurs zamieniony w {filteredPallets} palet ladunku
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem" }}>
                <StatBox label="Twoj zarobek" value={`${(filteredPallets * pricePerPallet).toLocaleString("pl-PL")} zl`} />
                <StatBox label="CO2 zaoszczedzone" value={`${r.co2SavedKg} kg`} />
                <StatBox label="Wartosc ladunku" value={`${r.cargoValuePln.toLocaleString("pl-PL")} zl`} />
              </div>
            </div>
          </>
        )}

        {/* Dystrybutorzy szukajacy towaru */}
        {r.distributorMatches.length > 0 && (
          <div style={{ marginTop: "1.25rem" }}>
            <div style={{ fontSize: "0.65rem", fontWeight: 700, color: T.gold, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.5rem" }}>
              Dystrybutorzy szukajacy towaru ({r.distributorMatches.length})
            </div>
            {r.distributorMatches.map((dm) => (
              <div key={dm.distributor.id} style={{ display: "flex", alignItems: "center", padding: "0.6rem 0", borderBottom: `1px solid ${T.border}`, gap: "0.7rem" }}>
                <div style={{ width: "30px", height: "30px", borderRadius: "50%", background: "#fdf4e6", border: `1.5px solid ${T.gold}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "0.7rem", fontWeight: 800, color: T.gold }}>D</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: "0.9rem", color: T.text }}>{dm.distributor.name}</div>
                  <div style={{ fontSize: "0.72rem", color: T.subtle }}>
                    Potrzebuje: {dm.distributor.qty} {dm.distributor.unit === "palety" ? "pal." : "kg"} {dm.distributor.crop.toLowerCase()}
                  </div>
                  <div style={{ fontSize: "0.68rem", color: T.muted }}>
                    Odbiór: {dm.distributor.location} · +{dm.detourKm} km od trasy
                  </div>
                </div>
              </div>
            ))}
          </div>
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
                  const content = `CYFROWY LIST PRZEWOZOWY (CMR)\nKod: ${bookingCode}\nData: ${r.date}\nTrasa: ${fromField.selected!.label} → ${r.toLabel}\nPalety: ${r.takenPallets}\nPrzewożnik: ${carrierName || "Trans-AgroPool"}\n\nWygenerowano przez AgroPool`;
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
          <button onClick={() => { setAct("form"); setBooked(false); }} style={{ flex: 1, padding: "0.75rem", borderRadius: "0.875rem", border: `1.5px solid ${T.border}`, background: T.surface, color: T.muted, fontWeight: 700, fontSize: "0.85rem", cursor: "pointer" }}>
            + Nowy kurs
          </button>
          <a href="/" style={{ flex: 1, padding: "0.75rem", borderRadius: "0.875rem", border: "none", background: T.accent, color: "#fff", fontWeight: 900, fontSize: "0.85rem", cursor: "pointer", textAlign: "center", textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
            Start
          </a>
        </div>
      </div>
    </div>
  );
}

// ── Mikro-komponenty ──────────────────────────────────────────────────────────

function Dropdown({ items, onPick }: { items: NominatimResult[]; onPick: (item: NominatimResult) => void }) {
  return (
    <div style={{
      position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50,
      background: T.card, border: `1.5px solid ${T.border}`, borderRadius: "0.75rem",
      marginTop: "0.25rem", boxShadow: "0 4px 16px rgba(0,0,0,0.08)", overflow: "hidden",
    }}>
      {items.map((item, i) => (
        <button
          key={`${item.lat}-${item.lon}-${i}`}
          type="button"
          onMouseDown={(e) => { e.preventDefault(); onPick(item); }}
          style={{
            display: "block", width: "100%", textAlign: "left", padding: "0.7rem 1rem",
            border: "none", borderBottom: i < items.length - 1 ? `1px solid ${T.border}` : "none",
            background: "transparent", cursor: "pointer", fontSize: "0.85rem", color: T.text,
          }}
        >
          {item.display_name}
        </button>
      ))}
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
