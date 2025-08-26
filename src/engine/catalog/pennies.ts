import { createNormalFormGame } from "@/engine/game";
import type { CatalogGame } from "@/engine/catalog/types";

export const pennies: CatalogGame = {
  slug: "pennies",
  concept: "mixed strategies",
  game: createNormalFormGame({
    id: "pennies",
    title: "Matching Pennies",
    rowActions: ["Heads", "Tails"],
    columnActions: ["Heads", "Tails"],
    payoffs: [
      [
        [1, -1],
        [-1, 1],
      ],
      [
        [-1, 1],
        [1, -1],
      ],
    ],
  }),
  oracle: {
    pureNash: [],
    strictlyDominated: { row: [], column: [] },
    paretoEfficient: [
      { row: 0, column: 0 },
      { row: 0, column: 1 },
      { row: 1, column: 0 },
      { row: 1, column: 1 },
    ],
    zeroSum: true,
    classification: "cycle",
    riskDominance: { kind: "not-applicable" },
    payoffDominance: { kind: "not-applicable" },
    mixedNash: [{ row: ["1/2", "1/2"], column: ["1/2", "1/2"] }],
    degenerate: false,
  },
};
