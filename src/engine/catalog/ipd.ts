import { createNormalFormGame } from "@/engine/game";
import type { CatalogGame } from "@/engine/catalog/types";

/** The iterated game uses this Prisoner's Dilemma as its stage game. */
export const ipd: CatalogGame = {
  slug: "ipd",
  concept: "the shadow of the future",
  game: createNormalFormGame({
    id: "ipd",
    title: "Iterated Prisoner's Dilemma",
    rowActions: ["Cooperate", "Defect"],
    columnActions: ["Cooperate", "Defect"],
    payoffs: [
      [
        [3, 3],
        [0, 5],
      ],
      [
        [5, 0],
        [1, 1],
      ],
    ],
  }),
  oracle: {
    pureNash: [{ row: 1, column: 1 }],
    strictlyDominated: { row: [0], column: [0] },
    paretoEfficient: [
      { row: 0, column: 0 },
      { row: 0, column: 1 },
      { row: 1, column: 0 },
    ],
    zeroSum: false,
    classification: "dilemma",
    riskDominance: { kind: "not-applicable" },
    payoffDominance: { kind: "not-applicable" },
    mixedNash: [],
    degenerate: false,
  },
};
