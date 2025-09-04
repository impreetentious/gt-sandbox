# Game Theory Sandbox

**Status: v0.14.1 — hot-seat arena + routes (`/3-F5-O8`). App not yet deployed.**

Game theory is usually taught statically: a payoff matrix in a PDF, an equilibrium circled, a definition memorized. Intuition forms in a loop instead—**act, observe, and only then reveal the theory underneath the outcome.**

Game Theory Sandbox is a static, private interactive tool for strategy-curious professionals and students. It combines canonical games, seeded repeated-play simulations, evolutionary dynamics, and a bounded game builder with an exact analytical engine.

## What is here

- **Play** six games: Prisoner’s Dilemma, Stag Hunt, Battle of the Sexes, Chicken, Matching Pennies, and the Iterated Prisoner’s Dilemma. Each has deterministic opponents, session scoring, and a progressive analytical reveal.
- **Evolve** eight classic repeated-game strategies through a seeded round-robin and five reviewed replicator-dynamics stories.
- **Build** a two-player game from 2×2 through 4×4, enter exact fractions or bounded decimals, and watch best responses, dominance, equilibria, efficiency, degeneracy, and strategic structure update live.
- **Share** a versioned URL containing a bounded custom game and any supplied persona, seed, continuation probability, or action noise. No server stores the state.

## Two-minute tour

1. Open **Matching Pennies**, choose the Shark, and repeat a visible pattern. The reveal connects the exploiter’s prediction accuracy to why an equilibrium mix must be unpredictable.
2. Open **Prisoner’s Dilemma** and scroll to the payoff editor. Change both temptation payoffs from `5` to `2`; the engine changes the verdict from a dilemma to an assurance game and adds the second Nash equilibrium.
3. Open **Evolve → Evolution** and choose **Noise**. Scrub from generation 0 to 100, isolate a population band, then open the table fallback to inspect the same frozen run numerically.

## Correctness boundary

- Payoffs, best responses, dominance, and equilibrium probabilities use exact normalized bigint fractions. Floating point is excluded from solver correctness paths.
- Equal-size support enumeration finds every equilibrium of nondegenerate two-player games within the 4×4 bound. Degenerate games receive a formal exact witness and an explicit limitation: pure equilibria and verified mixed samples are shown, but the sample is not called complete.
- Canonical claims are tested against human-authored theory oracles, an independent verifier, a separate closed-form 2×2 implementation, and a committed Gambit 16.3.0 fixture corpus.
- Every random policy, match, tournament, and evolution fixture is seeded. Event-addressed streams keep match length, policy choices, and action noise comparable across counterfactuals.

The in-product [Methods page](src/app/methods/page.tsx) explains the verification layers, simulation boundary, references, privacy contract, and prior-art credit.

## Static and private

There is no backend, account, analytics, cookie, telemetry, or runtime API. Initial loads and client navigation use same-origin static build artifacts only. The sole local-storage key is `seenOnboarding`, which hides the first-visit hint after dismissal. Share links contain their state in the URL, so inspect labels before sharing sensitive wording.

## Run locally

Requirements: Node 24 and pnpm 10.

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://localhost:3000`. To exercise the exact static files that deploy:

```bash
pnpm build
pnpm serve:export
```

## Verify

```bash
pnpm verify       # invariants, CSP, types, lint, unit/property tests, coverage
pnpm verify:full  # verify + static export + bundle + invariant self-test + Playwright
```

The full suite covers strict TypeScript, engine coverage, static-export routes, deep links and 404s, CSP/no-off-origin requests, keyboard operation, axe, reduced motion, forced colors, narrow reflow, URL restoration, and bundle size.

## Stack

Next.js static export · React · TypeScript strict · Tailwind CSS · Vitest · fast-check · Playwright · axe

Runtime dependencies remain limited to `next`, `react`, and `react-dom`.

## Deployment

`pnpm build` emits a plain `out/` directory. Vercel Git integration is the intended production path, but the output also serves unchanged from a root-mounted static host. Deployment, production smoke testing, and the v1.0.0 tag remain owner actions.

## License

MIT © Sidakpreet Singh — see [LICENSE](LICENSE).

## AI Agent Instructions

Never commit or push unless the owner explicitly asks. Before any authorized
commit, use the owner-assigned release version and update the Version Control
string below with the real current commit time in IST (`Asia/Kolkata`). Align
that version in `package.json`, `pnpm-lock.yaml` when it records root metadata,
and the active version surfaces in the same commit. Historical timestamps are
owner-directed metadata; do not rewrite pushed history.

- **Base Format Version:** 0.14.1
- **Portfolio Version:** v0.14.1_2025-09-05_01:02:36 (IST)
