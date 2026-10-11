import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/components/auth-provider";
import "./globals.css";
const sans = Geist({ subsets: ["latin"], variable: "--font-sans" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });
export const metadata: Metadata = {
  title: "TraceReason — Your codebase remembers why.",
  description:
    "Connected project memory for technical decisions, bugs, fixes, and the evidence behind them.",
};
export const viewport: Viewport = { themeColor: "#111113" };
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <nav aria-label="Skip navigation">
          <a className="skip-link" href="#main">
            Skip to content
          </a>
        </nav>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
