import type { Metadata } from "next";
import Link from "next/link";
import { OnboardingHint } from "@/components/onboarding-hint";

export const metadata: Metadata = {
  title: { absolute: "Game Theory Sandbox | Feel the Incentives Move" },
  description:
    "Play canonical games, inspect exact equilibria, evolve repeated strategies, and build shareable payoff matrices.",
};

const path = [
  {
    href: "/play/pd/",
    title: "Prisoner’s Dilemma",
    concept: "Dominance",
    description:
      "A price war where individually sensible choices destroy shared value.",
  },
  {
    href: "/play/stag-hunt/",
    title: "Stag Hunt",
    concept: "Trust and safety",
    description:
      "A standards bet with one ambitious equilibrium and one dependable refuge.",
  },
  {
    href: "/play/battle-of-the-sexes/",
    title: "Battle of the Sexes",
    concept: "Commitment",
    description:
      "A merger needs one platform, but each side prefers a different winner.",
  },
  {
    href: "/play/chicken/",
    title: "Chicken",
    concept: "Brinkmanship",
    description:
      "A capacity war where somebody must back down and nobody can safely volunteer.",
  },
  {
    href: "/play/matching-pennies/",
    title: "Matching Pennies",
    concept: "Unpredictability",
    description:
      "An exploiter turns a visible pattern into evidence for mixed strategy.",
  },
  {
    href: "/play/iterated-pd/",
    title: "Iterated Prisoner’s Dilemma",
    concept: "The future",
    description:
      "A seeded match where today’s move changes what a rival does tomorrow.",
  },
  {
    href: "/evolve/",
    title: "Tournament and Evolution",
    concept: "Population dynamics",
    description:
      "Compare eight repeatable strategies, then move through a frozen evolutionary run.",
  },
  {
    href: "/build/",
    title: "Build a Game",
    concept: "Structure",
    description:
      "Edit a bounded matrix and watch exact equilibria and the game’s strategic species change.",
  },
  {
    href: "/repeat/",
    title: "Repeat Any Game",
    concept: "The folk theorem",
    description:
      "Iterate a 2×2 with the full roster and read the exact discount threshold that sustains cooperation.",
  },
  {
    href: "/hot-seat/pd/",
    title: "Hot-seat",
    concept: "Two humans",
    description:
      "Pass one device between two people with commit-and-conceal simultaneity — no backend needed.",
  },
  {
    href: "/auctions/second-price/",
    title: "Auctions",
    concept: "Incomplete information",
    description:
      "Bid under private values and noisy signals: shading, truthful dominance, and the winner’s curse.",
  },
  {
    href: "/classroom/",
    title: "Classroom Kit",
    concept: "Teach with it",
    description:
      "Pin an exercise as a share link, then aggregate the sessions students download — all on-device.",
  },
  {
    href: "/extensive/entry-deterrence/",
    title: "Entry Deterrence",
    concept: "Sequential moves",
    description:
      "Enter the market or stay out, watch the incumbent's response, and see backward induction extract the subgame-perfect equilibrium.",
  },
  {
    href: "/extensive/ultimatum/",
    title: "Ultimatum",
    concept: "Credible threats",
    description:
      "Offer a share of the pie to a responder and see why backward induction predicts a minimal offer that experiments almost never sustain.",
  },
  {
    href: "/extensive/centipede/",
    title: "Centipede",
    concept: "Unraveling cooperation",
    description:
      "Alternate take-or-pass turns and watch backward induction wipe out the Pareto-superior long game.",
  },
  {
    href: "/nplayer/public-goods/",
    title: "Public Goods",
    concept: "Groups, not pairs",
    description:
      "Move the group size and the per-capita return to find the exact window where giving is individually irrational and collectively necessary.",
  },
] as const;

export default function HomePage() {
  return (
    <>
      <section aria-labelledby="home-title" className="home-hero">
        <p className="eyebrow">Act. Observe. Reveal.</p>
        <h1 className="display" id="home-title">
          Learn strategy by feeling the incentives move.
        </h1>
        <p className="lede">
          Make a choice with something at stake. Watch the outcome land. Then
          let an exact analytical engine explain what just happened.
        </p>
        <div className="home-hero__actions">
          <Link className="home-primary-link" href="/play/pd/">
            Start with the price war
          </Link>
          <Link href="/methods/">Read how the answers are verified</Link>
        </div>
      </section>

      <OnboardingHint />

      <section aria-labelledby="loop-title" className="home-loop">
        <div className="home-section-heading">
          <p className="eyebrow">The learning loop</p>
          <h2 id="loop-title">Theory arrives after the evidence.</h2>
        </div>
        <ol>
          <li>
            <span>01</span>
            <strong>Act</strong>
            <p>Choose before a definition tells you what to notice.</p>
          </li>
          <li>
            <span>02</span>
            <strong>Observe</strong>
            <p>See scores, patterns, and counterfactuals accumulate.</p>
          </li>
          <li>
            <span>03</span>
            <strong>Reveal</strong>
            <p>Open the analysis to inspect best responses and equilibria.</p>
          </li>
        </ol>
      </section>

      <section aria-labelledby="path-title" className="home-path">
        <div className="home-section-heading">
          <p className="eyebrow">Suggested path</p>
          <h2 id="path-title">The current path. No gates.</h2>
          <p>Follow the arc or enter wherever the incentives look familiar.</p>
        </div>
        <ol className="home-path__grid">
          {path.map((stop, index) => (
            <li key={stop.href}>
              <article>
                <span aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <p>{stop.concept}</p>
                <h3>{stop.title}</h3>
                <p>{stop.description}</p>
                <Link href={stop.href}>Open {stop.title}</Link>
              </article>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="proof-title" className="home-proof">
        <p className="eyebrow">The proof underneath</p>
        <h2 id="proof-title">
          Exact where correctness matters. Seeded where simulation begins.
        </h2>
        <p>
          Payoffs and equilibrium probabilities use rational arithmetic. Random
          opponents, tournaments, and population runs use explicit seeds. A
          shared link is enough to reproduce a bounded custom game.
        </p>
        <Link href="/methods/">Inspect the verification layers</Link>
      </section>
    </>
  );
}
