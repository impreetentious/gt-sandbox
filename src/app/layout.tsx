import type { Metadata, Viewport } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { OfflineReady } from "@/components/ui/offline-ready";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import packageMetadata from "../../package.json";
import "./globals.css";

/**
 * V2-P8 — the stored theme has to reach the document before first paint, or a
 * dark-mode reader gets a full-page white flash on every navigation. React can
 * only apply it after hydration, so this runs synchronously in the head.
 *
 * It is inline out of necessity, not convenience: an external file would be a
 * second blocking request for eleven statements. The deployment CSP already
 * carries `script-src 'self' 'unsafe-inline'` for Next.js's own bootstrap
 * (documented under I4), so this adds no new allowance. It touches nothing but
 * one attribute on `<html>`, reads one localStorage key, and swallows its own
 * errors so a blocked storage API degrades to the system preference.
 */
const themeBootstrap = `(function(){try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t)}}catch(e){}})()`;

const deploymentUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(deploymentUrl),
  title: {
    default: "Game Theory Sandbox",
    template: "%s | Game Theory Sandbox",
  },
  description:
    "Play strategic choices first, then inspect exact equilibria, seeded simulations, and live payoff edits.",
  applicationName: "Game Theory Sandbox",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg" },
  openGraph: {
    type: "website",
    siteName: "Game Theory Sandbox",
    title: "Game Theory Sandbox",
    description:
      "Act, observe, and reveal the game theory underneath strategic choices.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Game Theory Sandbox — act, observe, reveal",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Game Theory Sandbox",
    description:
      "Act, observe, and reveal the game theory underneath strategic choices.",
    images: ["/og-image.png"],
  },
  robots: { index: true, follow: true },
};

/**
 * The browser chrome around an installed window follows the palette too, so the
 * theme colour is declared per scheme rather than picked once (V2-P8 + V2-P9).
 */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f5ef" },
    { media: "(prefers-color-scheme: dark)", color: "#14161a" },
  ],
};

const navigation = [
  { href: "/learn/", label: "Learn" },
  { href: "/play/pd/", label: "Play" },
  { href: "/evolve/", label: "Evolve" },
  { href: "/build/", label: "Build" },
  { href: "/methods/", label: "Methods" },
  { href: "/repeat/", label: "Repeat" },
  { href: "/auctions/second-price/", label: "Auctions" },
  { href: "/classroom/", label: "Classroom" },
];

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>
        <header className="site-header">
          <div className="shell site-header__inner">
            <Link className="wordmark" href="/">
              Game Theory Sandbox
            </Link>
            <div className="site-header__controls">
              <nav aria-label="Primary" className="site-nav">
                {navigation.map((item) => (
                  <Link href={item.href} key={item.href}>
                    {item.label}
                  </Link>
                ))}
              </nav>
              <ThemeToggle />
            </div>
          </div>
        </header>
        <main className="shell">{children}</main>
        <footer className="shell site-footer">
          <span>Static. Private. Exact where it counts.</span>
          <span className="site-footer__meta">
            <OfflineReady version={packageMetadata.version} />
            <span className="version">v{packageMetadata.version}</span>
          </span>
        </footer>
      </body>
    </html>
  );
}
