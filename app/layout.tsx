import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#027B5B",
  width: "device-width",
  initialScale: 1,
  colorScheme: "dark",
};

export const metadata: Metadata = {
  title: "VFL // Virtual Football League & Exchange",
  description:
    "Autonomous European virtual football simulation league with real-time match telemetry and sportsbook exchange markets.",
  applicationName: "Virtual Football League",
  keywords: [
    "Virtual Football",
    "Sportsbook",
    "Betting Exchange",
    "Live Odds",
    "Soccer Simulation",
    "VFL",
  ],
  authors: [{ name: "Virtual Football Team" }],
  openGraph: {
    type: "website",
    locale: "en_GB",
    url: "/",
    siteName: "Virtual Football League (VFL)",
    title: "VFL // Virtual Football League & Sportsbook",
    description:
      "Real-time simulated European league matches, live Poisson-based odds, instant accumulator slips, and virtual ledger.",
  },
  twitter: {
    card: "summary_large_image",
    title: "VFL // Virtual Football League",
    description:
      "Autonomous European virtual football simulation league with real-time match telemetry.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-ink text-bone antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
