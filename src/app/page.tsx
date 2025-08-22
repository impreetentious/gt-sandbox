const routes = [
  {
    href: "/play/pd/",
    title: "Play",
    description: "Make choices first; inspect the theory after the outcome.",
  },
  {
    href: "/evolve/",
    title: "Evolve",
    description: "Tournament and population dynamics arrive in later phases.",
  },
  {
    href: "/build/",
    title: "Build",
    description: "Edit a game and let the analysis respond live.",
  },
  {
    href: "/methods/",
    title: "Methods",
    description:
      "The correctness and reproducibility contract for the project.",
  },
];

export default function HomePage() {
  return (
    <>
      <section aria-labelledby="home-title">
        <p className="eyebrow">P0 / Walking skeleton</p>
        <h1 className="display" id="home-title">
          Learn strategy by feeling the incentives move.
        </h1>
        <p className="lede">
          Game Theory Sandbox is becoming a private, static space to play,
          observe, and then unpack strategic choices.
        </p>
      </section>
      <section aria-label="Product routes" className="route-grid">
        {routes.map((route) => (
          <article className="route-card" key={route.href}>
            <h2>{route.title}</h2>
            <p>{route.description}</p>
            <Link href={route.href}>Open {route.title}</Link>
          </article>
        ))}
      </section>
    </>
  );
}
import Link from "next/link";
