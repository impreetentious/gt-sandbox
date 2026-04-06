import { rational, type Rational } from "@/engine/rational";
import type { Boundary, Neighborhood } from "@/engine/spatial";

type SpatialOpening = "single-defector" | "seeded";

interface SpatialPreset {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  /** Temptation payoff b in the weak PD (R = 1, P = S = 0). */
  readonly temptation: Rational;
  readonly size: number;
  readonly neighborhood: Neighborhood;
  readonly boundary: Boundary;
  readonly selfInteraction: boolean;
  readonly opening: SpatialOpening;
  readonly seed: number;
}

/**
 * The four presets are the frozen engine fixtures, deliberately. Anything the
 * page shows on load is a run the test suite pins cell for cell, so a claim
 * made in the copy here cannot quietly drift away from the model.
 */
export const spatialPresets: readonly SpatialPreset[] = [
  {
    id: "coexistence",
    label: "Neither side wins",
    description:
      "One defector in a full cooperator field at b = 1.6. The lattice never settles: cooperators fall to about 60% and keep churning there, generation after generation.",
    temptation: rational(8n, 5n),
    size: 21,
    neighborhood: "moore",
    boundary: "torus",
    selfInteraction: false,
    opening: "single-defector",
    seed: 681568,
  },
  {
    id: "recovery",
    label: "Cooperation recovers",
    description:
      "A random half-and-half scatter at b = 1.2. Cooperation collapses to under a quarter of the lattice in one generation, then climbs back to 93% and stops there.",
    temptation: rational(6n, 5n),
    size: 21,
    neighborhood: "moore",
    boundary: "torus",
    selfInteraction: true,
    opening: "seeded",
    seed: 681568,
  },
  {
    id: "collapse",
    label: "Past the threshold",
    description:
      "The same single defector at b = 1.9. Clusters hold for twenty generations, then fail all at once — cooperation is gone by generation 25.",
    temptation: rational(19n, 10n),
    size: 21,
    neighborhood: "moore",
    boundary: "torus",
    selfInteraction: true,
    opening: "single-defector",
    seed: 681568,
  },
  {
    id: "von-neumann",
    label: "Four neighbours instead of eight",
    description:
      "Same game, orthogonal neighbours only. A smaller neighbourhood means a cluster's interior is protected sooner, and the lattice behaves differently at a temptation the Moore lattice survives.",
    temptation: rational(13n, 10n),
    size: 21,
    neighborhood: "von-neumann",
    boundary: "torus",
    selfInteraction: true,
    opening: "single-defector",
    seed: 681568,
  },
];

export const spatialContent = {
  framing:
    "Every population model so far has been well mixed: any two individuals were equally likely to meet. Drop that one assumption — let each player interact only with the cells beside it — and the Prisoner's Dilemma stops having a foregone conclusion.",
  ruleExplainer:
    "Each generation, every cell plays the game against each of its neighbours, adds up what it earned, and then copies whichever cell in its neighbourhood scored highest. Everything happens at once: scores come from the previous lattice, so no cell sees a neighbour that has already changed.",
  whyItWorks:
    "Cooperators survive here without any memory, reputation, or punishment. A cluster of cooperators shields its own interior — the cells on the boundary lose to the defectors outside, but the cells inside meet only each other and keep earning. That is a fact about geometry, not about strategy.",
  exactness:
    "Every score below is an exact fraction and every cell an integer, so the lattice is bit-for-bit reproducible. That matters more than usual: the update rule turns on comparing two accumulated scores, and near the threshold those comparisons come down to differences that floating-point rounding would decide arbitrarily.",
  tieBreak:
    "When a cell ties with the best of its neighbours it keeps its own strategy. Without that rule a tied cell would flip every generation and the lattice would blink forever — an artefact of the tie-break rather than anything in the model.",
} as const;
