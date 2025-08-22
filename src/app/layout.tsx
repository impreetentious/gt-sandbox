import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import packageMetadata from "../../package.json";
import "./globals.css";

export const metadata: Metadata = {
  title: "Game Theory Sandbox",
  description: "An interactive sandbox for learning strategic incentives.",
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
          <span>Static. Private. Under construction.</span>
          <span className="version">v{packageMetadata.version}</span>
        </footer>
      </body>
    </html>
  );
}
