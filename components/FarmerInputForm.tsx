"use client";

import { useState, useCallback } from "react";
import { detectCommune, type CommuneResult } from "@/utils/geoLookup";
import type { CropKey, Farmer } from "@/app/api/data/mockData";

const PENDING_KEY = "agropool_pending_requests";

export interface SubmittedEntry {
  id: string;
  farmer: Farmer;
  terytCode: number;
  communeName: string;
  status: "offline_pending" | "submitted";
  submittedAt: string;
}

interface Props {
  isOnline: boolean;
  onSubmit: (farmer: Farmer) => void;
  /** welcome = full-screen onboarding card, sidebar = compact dashboard panel */
  variant?: "welcome" | "sidebar";
}

type GpsState = "idle" | "loading" | "done" | "error";

const MAX_PALLETS = 12;
const MIN_PALLETS = 1;

// ── Design tokens ─────────────────────────────────────────────────────────────
const T = {
  bg:        "#faf7f0",
  card:      "#fffdf7",
  surface:   "#f5f0e4",
  border:    "#d4c8a0",
  borderHi:  "#c8b890",
  accent:    "#2d5a1b",
  accentHi:  "#3a7a22",
  gold:      "#c8781a",
  text:      "#2a1a08",
  muted:     "#7a6a48",
  subtle:    "#9a8a60",
  danger:    "#b84030",
  dangerBg:  "#fdf0eb",
};

export default function FarmerInputForm({ isOnline, onSubmit, variant = "sidebar" }: Props) {
  const [commune, setCommune] = useState<CommuneResult | null>(null);
  const [gpsState, setGpsState] = useState<GpsState>("idle");
  const [gpsError, setGpsError] = useState<string | null>(null);

  const [selectedCrop, setSelectedCrop] = useState<CropKey | "">("");
  const [pallets, setPallets] = useState(2);
  const [farmerName, setFarmerName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitState, setSubmitState] = useState<"idle" | "success_online" | "success_offline">("idle");

  const isBig = variant === "welcome";

  const handleGPS = useCallback(async () => {
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
  }, []);

  function adjustPallets(delta: number) {
    setPallets((p) => Math.min(MAX_PALLETS, Math.max(MIN_PALLETS, p + delta)));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!commune || !selectedCrop) return;

    const farmer: Farmer = {
      id: `reg-${Date.now()}`,
      name: farmerName.trim() || "Rolnik (anonim)",
      phone: phone.trim(),
      lat: (commune.commune.latMin + commune.commune.latMax) / 2,
      lng: (commune.commune.lngMin + commune.commune.lngMax) / 2,
      crop: selectedCrop,
      pallets,
      village: commune.commune.name,
    };

    const entry: SubmittedEntry = {
      id: farmer.id,
      farmer,
      terytCode: commune.commune.code,
      communeName: commune.commune.name,
      status: isOnline ? "submitted" : "offline_pending",
      submittedAt: new Date().toISOString(),
    };

    try {
      const existing: SubmittedEntry[] = JSON.parse(
        localStorage.getItem(PENDING_KEY) ?? "[]"
      );
      existing.push(entry);
      localStorage.setItem(PENDING_KEY, JSON.stringify(existing));
    } catch { /* quota */ }

    onSubmit(farmer);
    setSubmitState(isOnline ? "success_online" : "success_offline");

    setTimeout(() => {
      setSubmitState("idle");
      setSelectedCrop("");
      setPallets(2);
      setFarmerName("");
      setPhone("");
      setCommune(null);
      setGpsState("idle");
    }, 4000);
  }

  const canSubmit = commune !== null && selectedCrop !== "" && submitState === "idle";

  const inputBase: React.CSSProperties = {
    background: T.surface,
    border: `1.5px solid ${T.border}`,
    borderRadius: "0.75rem",
    color: T.text,
    width: "100%",
    padding: "0.75rem 1rem",
    fontSize: isBig ? "1rem" : "0.875rem",
    outline: "none",
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: "flex", flexDirection: "column", gap: "1rem", padding: isBig ? "0" : "1rem" }}
      noValidate
    >
      {variant === "sidebar" && (
        <p style={{ color: T.muted, fontSize: "0.65rem", letterSpacing: "0.08em", fontWeight: 700, textTransform: "uppercase" }}>
          Zgłoś swój towar
        </p>
      )}

      {/* ── GPS Button ──────────────────────────────────────── */}
      <button
        type="button"
        onClick={handleGPS}
        disabled={gpsState === "loading"}
        style={{
          background: gpsState === "done"
            ? "#f0faeb"
            : gpsState === "error"
            ? "#fdf0eb"
            : T.surface,
          border: `2px solid ${gpsState === "done" ? T.accent : gpsState === "error" ? "#c87050" : T.border}`,
          borderRadius: "0.875rem",
          color: gpsState === "done" ? T.accent : gpsState === "error" ? T.danger : T.text,
          padding: isBig ? "1rem 1.25rem" : "0.875rem 1rem",
          fontSize: isBig ? "1rem" : "0.875rem",
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.5rem",
          cursor: gpsState === "loading" ? "wait" : "pointer",
          opacity: gpsState === "loading" ? 0.7 : 1,
          transition: "all 0.2s",
          width: "100%",
        }}
      >
        {gpsState === "loading" ? (
          <><span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>⏳</span> Szukam GPS…</>
        ) : gpsState === "done" && commune ? (
          <><span>✅</span> {commune.commune.name}{commune.source === "fallback" && <span style={{ color: T.gold, fontSize: "0.75rem", marginLeft: "0.25rem" }}>(fallback)</span>}</>
        ) : gpsState === "error" ? (
          <><span>⚠️</span> Błąd GPS — spróbuj ponownie</>
        ) : (
          <><span>📍</span> Pobierz GPS z Pola</>
        )}
      </button>

      {gpsState === "done" && commune && (
        <p style={{ color: T.subtle, fontSize: "0.7rem", textAlign: "center", marginTop: "-0.5rem" }}>
          TERYT {commune.commune.code} · {commune.availableCrops.length} upraw dostępnych
        </p>
      )}
      {gpsError && gpsState === "error" && (
        <p style={{ color: T.danger, fontSize: "0.7rem", textAlign: "center", marginTop: "-0.5rem" }}>{gpsError}</p>
      )}

      {/* ── Crop Dropdown ───────────────────────────────────── */}
      {commune && (
        <div>
          <label style={{ display: "block", color: T.muted, fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "0.375rem" }}>
            Uprawa
          </label>
          {commune.availableCrops.length === 0 ? (
            <p style={{ color: T.gold, fontSize: "0.8rem", padding: "0.5rem 0" }}>Brak upraw dla tej gminy w ARiMR.</p>
          ) : (
            <select
              value={selectedCrop}
              onChange={(e) => setSelectedCrop(e.target.value as CropKey)}
              required
              style={{ ...inputBase, appearance: "none", cursor: "pointer" }}
            >
              <option value="" disabled>— Wybierz uprawę —</option>
              {commune.availableCrops.map((crop) => (
                <option key={crop} value={crop} style={{ background: T.card }}>{crop}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* ── Pallet Counter ──────────────────────────────────── */}
      {selectedCrop && (
        <div>
          <label style={{ display: "block", color: T.muted, fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "0.5rem" }}>
            Liczba palet
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <button
              type="button"
              onClick={() => adjustPallets(-1)}
              disabled={pallets <= MIN_PALLETS}
              aria-label="Zmniejsz"
              style={{
                width: isBig ? "72px" : "60px",
                height: isBig ? "72px" : "60px",
                borderRadius: "0.875rem",
                background: T.surface,
                border: `2px solid ${T.border}`,
                color: pallets <= MIN_PALLETS ? T.subtle : T.text,
                fontSize: "1.75rem",
                fontWeight: 900,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: pallets <= MIN_PALLETS ? "not-allowed" : "pointer",
                flexShrink: 0,
                touchAction: "manipulation",
              }}
            >−</button>

            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
              <span style={{ fontSize: isBig ? "3.5rem" : "3rem", fontWeight: 900, color: T.accent, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                {pallets}
              </span>
              <span style={{ fontSize: "0.7rem", color: T.subtle, marginTop: "0.25rem" }}>
                ≈ {(pallets * 600).toLocaleString("pl-PL")} kg
              </span>
            </div>

            <button
              type="button"
              onClick={() => adjustPallets(1)}
              disabled={pallets >= MAX_PALLETS}
              aria-label="Zwiększ"
              style={{
                width: isBig ? "72px" : "60px",
                height: isBig ? "72px" : "60px",
                borderRadius: "0.875rem",
                background: T.surface,
                border: `2px solid ${T.border}`,
                color: pallets >= MAX_PALLETS ? T.subtle : T.text,
                fontSize: "1.75rem",
                fontWeight: 900,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: pallets >= MAX_PALLETS ? "not-allowed" : "pointer",
                flexShrink: 0,
                touchAction: "manipulation",
              }}
            >+</button>
          </div>
        </div>
      )}

      {/* ── Optional fields ─────────────────────────────────── */}
      {selectedCrop && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <input
            type="text"
            placeholder="Imię i nazwisko (opcjonalnie)"
            value={farmerName}
            onChange={(e) => setFarmerName(e.target.value)}
            style={inputBase}
          />
          <input
            type="tel"
            placeholder="Telefon (opcjonalnie)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={inputBase}
          />
        </div>
      )}

      {/* ── Submit ──────────────────────────────────────────── */}
      {submitState === "idle" ? (
        <button
          type="submit"
          disabled={!canSubmit}
          style={{
            background: canSubmit ? T.accent : T.surface,
            border: `2px solid ${canSubmit ? T.accent : T.border}`,
            borderRadius: "1rem",
            color: canSubmit ? "#ffffff" : T.subtle,
            padding: isBig ? "1.25rem" : "1rem",
            fontSize: isBig ? "1.125rem" : "1rem",
            fontWeight: 900,
            letterSpacing: "0.04em",
            cursor: canSubmit ? "pointer" : "not-allowed",
            width: "100%",
            boxShadow: canSubmit ? `0 4px 12px ${T.accent}44` : "none",
            transition: "all 0.2s",
            touchAction: "manipulation",
          }}
        >
          🚜 ZGŁOŚ TOWAR
        </button>
      ) : (
        <div
          style={{
            background: submitState === "success_online" ? "#f0faeb" : "#fffae8",
            border: `2px solid ${submitState === "success_online" ? T.accent : T.gold}`,
            borderRadius: "1rem",
            color: submitState === "success_online" ? T.accent : T.gold,
            padding: "1rem",
            textAlign: "center",
            fontWeight: 700,
            fontSize: "0.9rem",
          }}
        >
          {submitState === "success_online"
            ? "✅ Zgłoszono i zsynchronizowano!"
            : "📦 Zapisano offline — wyślemy gdy wróci internet."}
        </div>
      )}

      {!isOnline && submitState === "idle" && (
        <p style={{ color: T.gold, fontSize: "0.7rem", textAlign: "center", marginTop: "-0.25rem" }}>
          ⚡ Tryb offline — zgłoszenie zostanie zakolejkowane
        </p>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder { color: #2d7a52; }
        select option { background: #063926; color: #f0fdf4; }
      `}</style>
    </form>
  );
}
