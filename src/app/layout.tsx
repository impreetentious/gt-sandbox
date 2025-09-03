import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import packageMetadata from "../../package.json";
import "./globals.css";

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

const navigation = [
  { href: "/play/pd/", label: "Play" },
  { href: "/evolve/", label: "Evolve" },
  { href: "/build/", label: "Build" },
  { href: "/methods/", label: "Methods" },
];

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="shell site-header__inner">
            <Link className="wordmark" href="/">
              Game Theory Sandbox
            </Link>
            <nav aria-label="Primary" className="site-nav">
              {navigation.map((item) => (
                <Link href={item.href} key={item.href}>
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="shell">{children}</main>
        <footer className="shell site-footer">
          <span>Static. Private. Exact where it counts.</span>
          <span className="version">v{packageMetadata.version}</span>
        </footer>
      </body>
    </html>
  );
}
