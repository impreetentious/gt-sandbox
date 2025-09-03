import Link from "next/link";

export default function NotFound() {
  return (
    <section aria-labelledby="not-found-title" className="not-found">
      <p className="eyebrow">404 / Outside the strategy set</p>
      <h1 className="display" id="not-found-title">
        This payoff does not exist.
      </h1>
      <p className="lede">
        The requested path is not part of the static game. Choose a known move
        and the analysis can continue.
      </p>
      <div className="not-found__actions">
        <Link className="home-primary-link" href="/">
          Return to the path
        </Link>
        <Link href="/build/">Build the game you expected</Link>
      </div>
    </section>
  );
}
