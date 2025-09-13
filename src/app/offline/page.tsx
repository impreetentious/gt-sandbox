import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Offline",
  description:
    "This page has not been cached yet, and the network is unavailable.",
  robots: { index: false, follow: false },
};

/**
 * V2-P9 — shown when a navigation misses the offline cache and the network is
 * gone.
 *
 * The obvious alternative is to serve the cached home document for any
 * uncached route, which is the usual app-shell trick. It is also a small lie:
 * the address bar would say `/evolve/` while the reader looked at the home
 * page. Naming the situation costs one static page and keeps the product from
 * misrepresenting its own state.
 */
export default function OfflinePage() {
  return (
    <article className="offline">
      <p className="eyebrow">Offline</p>
      <h1 className="display">Not cached yet.</h1>
      <p className="lede">
        The sandbox keeps every page you have already opened, and this one has
        not been opened on this device. Nothing was lost — reconnect and it will
        load, then stay available offline afterwards.
      </p>
      <p>
        <Link className="home-primary-link" href="/">
          Go to the entry point
        </Link>
      </p>
    </article>
  );
}
