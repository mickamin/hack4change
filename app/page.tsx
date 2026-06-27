import Link from "next/link";

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

export default function HomePage() {
  return (
    <div style={{ minHeight: "100dvh", background: T.bg, display: "flex", flexDirection: "column", alignItems: "center", padding: "1.5rem", color: T.text }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: "1.5rem", marginBottom: "2rem" }}>
        <div style={{ fontSize: "2.5rem", marginBottom: "0.3rem" }}>🌾</div>
        <span style={{ fontWeight: 900, fontSize: "1.6rem", color: T.accent, letterSpacing: "-0.03em" }}>AgroPool</span>
      </div>
      <div style={{ maxWidth: "440px", width: "100%", textAlign: "center", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <h1 style={{ fontSize: "clamp(1.7rem, 6vw, 2.3rem)", fontWeight: 900, color: T.text, lineHeight: 1.2, letterSpacing: "-0.02em", margin: "0 0 0.75rem" }}>
          Kim jesteś?
        </h1>
        <p style={{ color: T.muted, fontSize: "1rem", lineHeight: 1.6, margin: "0 0 2rem" }}>
          Łączymy nadwyżki z pól z pustymi kursami i odbiorcami. Wybierz, kim jesteś.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <Link href="/rolnik" style={{ textDecoration: "none" }}>
            <div style={{ background: T.accent, color: "#fff", borderRadius: "1.25rem", padding: "1.25rem 1.5rem", display: "flex", alignItems: "center", gap: "1rem", boxShadow: `0 6px 20px ${T.accent}44`, textAlign: "left" }}>
              <span style={{ fontSize: "2rem" }}>🚜</span>
              <span>
                <span style={{ display: "block", fontSize: "1.15rem", fontWeight: 900 }}>Jestem rolnikiem</span>
                <span style={{ display: "block", fontSize: "0.8rem", opacity: 0.9 }}>Mam nadwyżkę plonów do oddania</span>
              </span>
              <span style={{ marginLeft: "auto", fontSize: "1.4rem", opacity: 0.8 }}>→</span>
            </div>
          </Link>

          <Link href="/przewoznik" style={{ textDecoration: "none" }}>
            <div style={{ background: T.card, color: T.text, border: `2px solid ${T.gold}`, borderRadius: "1.25rem", padding: "1.25rem 1.5rem", display: "flex", alignItems: "center", gap: "1rem", textAlign: "left" }}>
              <span style={{ fontSize: "2rem" }}>🚚</span>
              <span>
                <span style={{ display: "block", fontSize: "1.15rem", fontWeight: 900, color: T.gold }}>Jestem przewoźnikiem</span>
                <span style={{ display: "block", fontSize: "0.8rem", color: T.muted }}>Jadę pusty, mam wolne miejsce</span>
              </span>
              <span style={{ marginLeft: "auto", fontSize: "1.4rem", color: T.gold, opacity: 0.8 }}>→</span>
            </div>
          </Link>

          <Link href="/dystrybutor" style={{ textDecoration: "none" }}>
            <div style={{ background: T.card, color: T.text, border: `2px solid ${T.accentHi}`, borderRadius: "1.25rem", padding: "1.25rem 1.5rem", display: "flex", alignItems: "center", gap: "1rem", textAlign: "left" }}>
              <span style={{ fontSize: "2rem" }}>📦</span>
              <span>
                <span style={{ display: "block", fontSize: "1.15rem", fontWeight: 900, color: T.accentHi }}>Jestem dystrybutorem</span>
                <span style={{ display: "block", fontSize: "0.8rem", color: T.muted }}>Chcę odebrać nadwyżki hurtem</span>
              </span>
              <span style={{ marginLeft: "auto", fontSize: "1.4rem", color: T.accentHi, opacity: 0.8 }}>→</span>
            </div>
          </Link>
        </div>

      </div>
    </div>
  );
}
