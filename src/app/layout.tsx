import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FPL Hub - Squad & Multi-Gameweek Transfer Planner",
  description:
    "Interactive Fantasy Premier League Pitch & Multi-Gameweek Transfer Planner with 2026/27 rules, FDR, and budget customizer.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        {children}
      </body>
    </html>
  );
}
