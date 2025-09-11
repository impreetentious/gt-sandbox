import { rational, type Rational } from "@/engine/rational";

export interface FinitePopulationPreset {
  readonly id: string;
  readonly label: string;
  /** Display names for the two competing strategies. */
  readonly strategyA: string;
  readonly strategyB: string;
  readonly description: string;
  readonly payoffs: {
    readonly a: Rational;
    readonly b: Rational;
    readonly c: Rational;
    readonly d: Rational;
  };
}

function payoffs(a: number, b: number, c: number, d: number) {
  return {
    a: rational(BigInt(a)),
    b: rational(BigInt(b)),
    c: rational(BigInt(c)),
    d: rational(BigInt(d)),
  };
}

export const finitePopulationPresets: readonly FinitePopulationPreset[] = [
  {
    id: "prisoners-dilemma",
    label: "Prisoner's Dilemma",
    strategyA: "Cooperate",
    strategyB: "Defect",
    description:
      "Defect strictly dominates. Both the ESS test and the finite-population test should agree, at every size.",
    payoffs: payoffs(3, 0, 5, 1),
  },
  {
    id: "stag-hunt",
    label: "Stag Hunt",
    strategyA: "Stag",
    strategyB: "Hare",
    description:
      "Two stable conventions. Stag pays more; Hare risks less. Watch the two tests disagree at small sizes and re-converge as the population grows.",
    payoffs: payoffs(4, 0, 3, 2),
  },
  {
    id: "hawk-dove",
    label: "Hawk–Dove",
    strategyA: "Hawk",
    strategyB: "Dove",
    description:
      "Neither pure strategy resists the other, so the stable outcome is an exact mixture — here a value of 2 contested at a cost of 4.",
    payoffs: payoffs(-1, 2, 0, 1),
  },
  {
    id: "neutral",
    label: "Neutral drift",
    strategyA: "Red",
    strategyB: "Blue",
    description:
      "Identical payoffs. Selection does nothing, so fixation falls back to pure drift and must land on exactly 1/N.",
    payoffs: payoffs(1, 1, 1, 1),
  },
];

export const finitePopulationContent = {
  framing:
    "Replicator dynamics assume an infinite population, where a strategy earning above average always grows. Real populations are finite, and a lone mutant can be wiped out by luck before selection ever gets a say — or drift its way to fixation despite being worse.",
  fixationExplainer:
    "The Moran process replaces one individual per step: somebody reproduces with probability proportional to fitness, somebody else dies at random. Fixation probability is the chance a single mutant eventually takes over the whole population.",
  neutralRule:
    "The benchmark is 1/N. A mutant with no fitness advantage at all still fixes that often, purely by drift — so a strategy is only genuinely favoured by selection when it beats 1/N.",
  disagreement:
    "ESS is an infinite-population idea: it asks whether a resident strategy resists an infinitesimal invasion. The 1/N rule asks whether one mutant among N can take over. In bistable games these come apart — drift can push a risk-dominant mutant across a basin boundary that a deterministic replicator flow would never cross, and the gap closes only as N grows.",
  exactness:
    "The fixation probability is a ratio of sums of products of N−1 fitness ratios. In floating point those products overflow or underflow well before N reaches a hundred, silently reporting 0 or 1. Every number here is an exact rational, so a disfavoured strategy stays visibly, precisely small rather than collapsing to zero.",
} as const;
