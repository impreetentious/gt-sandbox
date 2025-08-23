import { createNormalFormGame } from "@/engine/game";
import type { CatalogGame } from "@/engine/catalog/types";

export const stag: CatalogGame = {
  slug: "stag",
  concept: "equilibrium selection",
  game: createNormalFormGame({
    id: "stag",
    title: "Stag Hunt",
    rowActions: ["Stag", "Hare"],
    columnActions: ["Stag", "Hare"],
    payoffs: [
      [
        [4, 4],
        [0, 3],
      ],
      [
        [3, 0],
        [3, 3],
      ],
    ],
  }),
  oracle: {
    pureNash: [
      { row: 0, column: 0 },
      { row: 1, column: 1 },
    ],
    strictlyDominated: { row: [], column: [] },
    paretoEfficient: [{ row: 0, column: 0 }],
    zeroSum: false,
    classification: "coordination (assurance)",
    riskDominance: { kind: "equilibrium", profile: { row: 1, column: 1 } },
    payoffDominance: { kind: "equilibrium", profile: { row: 0, column: 0 } },
  },
};
