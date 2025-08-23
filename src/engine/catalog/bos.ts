import { createNormalFormGame } from "@/engine/game";
import type { CatalogGame } from "@/engine/catalog/types";

export const bos: CatalogGame = {
  slug: "bos",
  concept: "conflicting-interest coordination",
  game: createNormalFormGame({
    id: "bos",
    title: "Battle of the Sexes",
    rowActions: ["Yours", "Theirs"],
    columnActions: ["Yours", "Theirs"],
    payoffs: [
      [
        [2, 1],
        [0, 0],
      ],
      [
        [0, 0],
        [1, 2],
      ],
    ],
  }),
  oracle: {
    pureNash: [
      { row: 0, column: 0 },
      { row: 1, column: 1 },
    ],
    strictlyDominated: { row: [], column: [] },
    paretoEfficient: [
      { row: 0, column: 0 },
      { row: 1, column: 1 },
    ],
    zeroSum: false,
    classification: "battle",
    riskDominance: { kind: "tie" },
    payoffDominance: { kind: "tie" },
  },
};
