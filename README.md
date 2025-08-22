# Game Theory Sandbox

**Status: v0.1.2 — plan finalized, build not started.** Live URL: coming with the first build phase.

## The idea

Game theory is usually taught statically: a payoff matrix in a PDF, an equilibrium circled, a definition memorized. Intuition doesn't form that way. It forms in a loop — **act, observe, and only then let the theory reveal what just happened.**

This project is an interactive sandbox built around that loop. You make a strategic choice with stakes on the board. The outcome lands. Then the analysis layer shows you what you just lived through: which choices were dominant, where the equilibria sit, what you left on the table, and why unpredictability can be the only rational play.

Built for strategy-curious professionals and students who want to *feel* how incentives play out — price wars, standards adoption, brinkmanship, audits — rather than memorize equilibria.

## What v1 will ship

- **Play** — six canonical games (Prisoner's Dilemma, Stag Hunt, Battle of the Sexes, Chicken, Matching Pennies, and the Iterated Prisoner's Dilemma) against precisely specified opponents, each game framed by a real business scenario, each ending in a full analytical reveal.
- **Evolve** — the Axelrod tournament and evolutionary dynamics over classic strategies: watch cooperation emerge, collapse under noise, and hinge on the shadow of the future.
- **Build** — edit any payoff, or build your own game up to 4×4. The engine re-solves live, tells you which strategic species your game just became, and gives you a link that reproduces it exactly.

## The v1 correctness commitment

This is the part that can't be faked, so the v1 implementation will be held to these targets:

- The solver will use **exact rational arithmetic** (no floating point in any correctness path) and find **all** equilibria of nondegenerate games up to 4×4 — pure and mixed, reported as exact fractions.
- Every game-theoretic claim shown on screen will be **computed by the engine and covered by tests** against hand-derived results *and* independently generated oracles (Gambit / nashpy).
- Every simulation will be **seeded and exactly reproducible** — share a URL, get the same run, bit for bit.
- Degenerate games will be disclosed as degenerate rather than silently mishandled, and the analysis will not call a move a mistake when it was the best response to the opponent you actually faced.

## Principles

Fully static and private: no backend, no accounts, no analytics, no third-party requests. Three runtime dependencies. Accessible: keyboard-complete, screen-reader narrated, reduced-motion parity. A focused product, not an encyclopedia.

## Stack (planned)

Next.js (static export) · React · TypeScript (strict) · Tailwind — with Vitest, fast-check, and Playwright doing the heavy lifting.

## License

MIT © Sidakpreet Singh — see [LICENSE](LICENSE).
