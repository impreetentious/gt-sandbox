# Game Theory Sandbox

**Status: v0.10.2 — P9's Build surface and reusable exact Analysis drawer are committed locally. P0–P8 remain unpushed.** Live URL: not deployed yet.

## The idea

Game theory is usually taught statically: a payoff matrix in a PDF, an equilibrium circled, a definition memorized. Intuition doesn't form that way. It forms in a loop — **act, observe, and only then let the theory reveal what just happened.**

This project is an interactive sandbox built around that loop. You make a strategic choice with stakes on the board. The outcome lands. Then the analysis layer shows you what you just lived through: which choices were dominant, where the equilibria sit, what you left on the table, and why unpredictability can be the only rational play.

Built for strategy-curious professionals and students who want to _feel_ how incentives play out — price wars, standards adoption, brinkmanship, audits — rather than memorize equilibria.

## What v1 will ship

- **Play** — six canonical games (Prisoner's Dilemma, Stag Hunt, Battle of the Sexes, Chicken, Matching Pennies, and the Iterated Prisoner's Dilemma) against precisely specified opponents, each game framed by a real business scenario, each ending in a full analytical reveal.
- **Evolve** — the Axelrod tournament and evolutionary dynamics over classic strategies: watch cooperation emerge, collapse under noise, and hinge on the shadow of the future.
- **Build** — the bounded 2×2–4×4 Game Workbench now has its own surface, exact Analysis drawer, responsive payoff matrix, and reproducible links; Play-route integration follows in this phase.

## The v1 correctness commitment

This is the part that can't be faked, so the v1 implementation will be held to these targets:

- The solver uses **exact rational arithmetic** (no floating point in any correctness path) and finds **all** equilibria of nondegenerate games up to 4×4 — pure and mixed, reported as exact fractions.
- Every game-theoretic claim shown on screen is **computed by the engine and covered by tests** against hand-derived results _and_ independently generated oracles (Gambit / nashpy).
- Every simulation is **seeded and exactly reproducible** — share a URL, get the same run, bit for bit.
- Degenerate games are disclosed as degenerate rather than silently mishandled, and the analysis never calls a move a mistake when it was the best response to the opponent you actually faced.

## Principles

Fully static and private: no backend, no accounts, no analytics, no third-party requests. Three runtime dependencies. Accessible: keyboard-complete, screen-reader narrated, reduced-motion parity. A focused product, not an encyclopedia.

## Stack

Next.js (static export) · React · TypeScript (strict) · Tailwind — with Vitest, fast-check, and Playwright doing the heavy lifting.

## License

MIT © Sidakpreet Singh — see [LICENSE](LICENSE).

## AI Agent Instructions

Never commit or push unless the owner explicitly asks. Before any authorized
commit, use the owner-assigned release version and update the Version Control
string below with the real current commit time in IST (`Asia/Kolkata`). Align
that version in `package.json`, `pnpm-lock.yaml` when it records root metadata,
and the active version surfaces in the same commit. Historical timestamps are
owner-directed metadata; do not rewrite pushed history.

- **Base Format Version:** 0.10.2
- **Portfolio Version:** v0.10.2_2025-09-02_02:43:09 (IST)
