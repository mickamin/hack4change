import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

export const metadata: Metadata = {
  title: "AgroPool — Wspólna logistyka dla rolników",
  description:
    "Cyfrowa spółdzielnia logistyczna dla rolników z Powiatu Kartuskiego. Optymalizacja tras, mniejszy ślad CO₂, mniej marnowania żywności.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "AgroPool",
  },
};

export const viewport: Viewport = {
  themeColor: "#16a34a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pl" className={`${geist.variable} h-full`}>
      <body className="h-full bg-gray-950 antialiased">{children}</body>
    </html>
  );
}
