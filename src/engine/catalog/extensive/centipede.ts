import { createExtensiveGame } from "@/engine/extensive";
import { rational } from "@/engine/rational";
import type { ExtensiveCatalogGame } from "@/engine/catalog/extensive/types";

/**
 * Centipede — the sequential-move game whose backward induction unravels the
 * cooperative outcome that patient play would reach.
 *
 * Two players alternate over four decision nodes. At each node the mover can
 * Take (ending the game with a share tilted toward the taker) or Pass (giving
 * the other player a turn at a strictly larger pot). If both players Pass at
 * every opportunity, they reach the "long game" terminal that Pareto-dominates
 * every Take payoff for both of them.
 *
 * Backward induction from the last node inward:
 *   Node 4 (P2): Take (5) > Pass (4)                → (2, 5)
 *   Node 3 (P1): Take (3) > continuation (2)        → (3, 2)
 *   Node 2 (P2): Take (3) > continuation (2)        → (0, 3)
 *   Node 1 (P1): Take (1) > continuation (0)        → (1, 1)
 * So the SPNE is "everybody takes at their first turn", and the play ends
 * immediately at (1, 1) — despite (4, 4) sitting one full path away.
 *
 * Empirically this prediction fails almost every time humans play the game.
 * We do not list a Nash-but-not-SPNE oracle here because the interesting
 * failure of the SPNE is descriptive, not equilibrium refinement: "both Pass
 * throughout" is not itself a Nash equilibrium (the last mover strictly
 * prefers to Take).
 */
const centipedeGame = createExtensiveGame({
  id: "centipede",
  title: "Centipede",
  players: ["Player 1", "Player 2"],
  root: {
    kind: "decision",
    id: "node-1",
    player: "Player 1",
    actions: ["Take", "Pass"],
    informationSet: "node-1",
    children: [
      {
        kind: "terminal",
        id: "term-take-1",
        payoffs: [rational(1n), rational(1n)],
      },
      {
        kind: "decision",
        id: "node-2",
        player: "Player 2",
        actions: ["Take", "Pass"],
        informationSet: "node-2",
        children: [
          {
            kind: "terminal",
            id: "term-take-2",
            payoffs: [rational(0n), rational(3n)],
          },
          {
            kind: "decision",
            id: "node-3",
            player: "Player 1",
            actions: ["Take", "Pass"],
            informationSet: "node-3",
            children: [
              {
                kind: "terminal",
                id: "term-take-3",
                payoffs: [rational(3n), rational(2n)],
              },
              {
                kind: "decision",
                id: "node-4",
                player: "Player 2",
                actions: ["Take", "Pass"],
                informationSet: "node-4",
                children: [
                  {
                    kind: "terminal",
                    id: "term-take-4",
                    payoffs: [rational(2n), rational(5n)],
                  },
                  {
                    kind: "terminal",
                    id: "term-pass-4",
                    payoffs: [rational(4n), rational(4n)],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
});

const spneStrategy = new Map<string, number>([
  ["node-1", 0],
  ["node-2", 0],
  ["node-3", 0],
  ["node-4", 0],
]);

export const centipede: ExtensiveCatalogGame = {
  slug: "centipede",
  concept: "backward induction that unravels cooperation",
  game: centipedeGame,
  oracle: {
    spne: {
      label: "Take at every opportunity",
      strategy: spneStrategy,
      payoffs: [1, 1],
    },
    nonSubgamePerfectNash: [],
  },
};
