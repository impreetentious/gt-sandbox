import { createNormalFormGame } from "@/engine/game";
import type { CatalogGame } from "@/engine/catalog/types";

export const chicken: CatalogGame = {
  slug: "chicken",
  concept: "anti-coordination",
  game: createNormalFormGame({
    id: "chicken",
    title: "Chicken",
    rowActions: ["Swerve", "Straight"],
    columnActions: ["Swerve", "Straight"],
    payoffs: [
      [
        [0, 0],
        [-1, 1],
      ],
      [
        [1, -1],
        [-10, -10],
      ],
    ],
  }),
  oracle: {
    pureNash: [
      { row: 0, column: 1 },
      { row: 1, column: 0 },
    ],
    strictlyDominated: { row: [], column: [] },
    paretoEfficient: [
      { row: 0, column: 0 },
      { row: 0, column: 1 },
      { row: 1, column: 0 },
    ],
    zeroSum: false,
    classification: "anti-coordination",
    riskDominance: { kind: "tie" },
    payoffDominance: { kind: "tie" },
  },
};
