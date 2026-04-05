# Game Theory Sandbox

Game theory is usually taught statically: a payoff matrix in a PDF, an equilibrium circled, a definition memorized. Intuition forms in a loop instead—**act, observe, and only then reveal the theory underneath the outcome.**

Game Theory Sandbox is a static, privacy-preserving interactive tool for strategy-curious professionals and students. It combines canonical games, seeded repeated-play simulations, evolutionary dynamics, and a bounded game builder with an exact analytical engine.

## What is here

- **Play** six games against deterministic opponents: Prisoner's Dilemma, Stag Hunt, Battle of the Sexes, Chicken, Matching Pennies, and the Iterated Prisoner's Dilemma. Each has session scoring and a progressive analytical reveal.
- **Hot-seat** the same games with two humans at one keyboard.
- **Repeat** any 2×2 — the five catalog games or one you built yourself — with the full strategy roster, and read the folk-theorem region: feasible and individually-rational payoffs, with the exact discount threshold that sustains cooperation. Which outcome counts as cooperative is your designation on a custom game, and the surface says so.
- **Evolve** eight classic repeated-game strategies through a seeded round-robin and five replicator-dynamics stories, plus a spatial variant on a lattice where cooperator clusters survive a game that has no cooperative equilibrium when the population is well mixed.
- **Step through extensive-form games** — entry deterrence, the ultimatum game, and the centipede game — on the game tree.
- **Bid** in first-price, second-price, and common-value auctions.
- **Contribute** to an n-player public-goods game with 2 to 10 players and a movable marginal per capita return, showing exactly why free-riding is dominant while full contribution is efficient.
- **Build** a two-player game from 2×2 through 4×4, enter exact fractions or bounded decimals, and watch best responses, dominance, equilibria, efficiency, degeneracy, and strategic structure update live.
- **Learn** through a ten-stop path ordered so each idea needs the previous one. The ordering is a default, not a lock — one checkbox opens every stop.
- **Browse** all 144 strict ordinal 2×2 structures in a keyboard-operable topology atlas.
- **Quiz** yourself with a deterministic five-question equilibrium round, optionally sourced from a shared 2×2 Build game.
- **Teach** with the classroom kit: build an assignment link that pins one exercise for a whole class, then aggregate the sessions students download — entirely on your device, with nothing uploaded.
- **Share and embed** a versioned URL containing a bounded custom game, annotation, persona, seed, continuation probability, or action noise; each Play surface also emits a chromeless `<iframe>` snippet, and `/embed/*` is the only path any `https:` page may frame. All of it is static — no server.

## Two-minute tour

1. Open **Matching Pennies**, choose the Shark, and repeat a visible pattern. The reveal connects the exploiter's prediction accuracy to why an equilibrium mix must be unpredictable.
2. Open **Prisoner's Dilemma** and scroll to the payoff editor. Change both temptation payoffs from `5` to `2`; the engine changes the verdict from a dilemma to an assurance game and adds the second Nash equilibrium.
3. Open **Evolve → Evolution** and choose **Noise**. Scrub from generation 0 to 100, isolate a population band, then open the table fallback to inspect the same frozen run numerically.

## Correctness boundary

- Payoffs, best responses, dominance, and equilibrium probabilities use exact normalized bigint fractions. Floating point is excluded from solver correctness paths.
- Dominance detection covers strict dominance by mixed strategies, decided by an exact-rational simplex — not only dominance by pure strategies.
- Equal-size support enumeration finds every equilibrium of nondegenerate two-player games within the 4×4 bound. Degenerate games receive a formal exact witness and an explicit limitation: pure equilibria and verified mixed samples are shown, but the sample is not called complete.
- Canonical claims are tested against hand-derived results from the theory, an independent verifier, a separate closed-form 2×2 implementation, and a committed Gambit 16.3.0 fixture corpus.
- Every random policy, match, tournament, and evolution fixture is seeded. Event-addressed streams keep match length, policy choices, and action noise comparable across counterfactuals.

The app's own **Methods** page explains the verification layers, the simulation boundary, references, the privacy contract, and prior-art credit.

## Static and private

There is no backend, account, analytics, cookie, telemetry, or runtime API. Initial loads and client navigation use same-origin static build artifacts only. Three local-storage keys exist: `seenOnboarding` (hides the first-visit hint), `theme` (system / light / dark), and `curriculum` (Learn progress). Share links contain their state in the URL, so inspect labels before sharing sensitive wording.

The app is installable and works offline: a version-keyed service worker precaches the shell, and a real `/offline` route explains what is and is not available when the network is gone.

## Run locally

Requirements: Node 24.10.0 and pnpm 10.32.1 (both are pinned by the repository).

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

The full suite covers strict TypeScript, engine coverage, static-export routes, deep links and 404s, CSP/no-off-origin requests, keyboard operation, axe in both light and dark themes, reduced motion, forced colors, narrow reflow, URL restoration, and bundle size.

## Stack

Next.js static export · React · TypeScript strict · Tailwind CSS · Vitest · fast-check · Playwright · axe

Runtime dependencies remain limited to `next`, `react`, and `react-dom`. The exact-rational simplex, service worker, and manifest are all hand-written.

## Deployment

`pnpm build` emits a plain `out/` directory. Vercel Git integration is the intended production path, but the output also serves unchanged from a root-mounted static host. `vercel.json` and `serve.json` carry the response headers; `pnpm check:csp` fails if the two ever disagree. The GitHub Actions workflow runs the frozen install, full dependency audit, and complete verification suite.

## License

MIT © Sidakpreet Singh — see [LICENSE](LICENSE).

---

**Version:** v0.21.4
