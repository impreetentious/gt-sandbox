export type GlossaryTermId =
  | "best-response"
  | "continuation-probability"
  | "degenerate"
  | "dominant-strategy"
  | "focal-point"
  | "mixed-strategy"
  | "nash-equilibrium"
  | "pareto-efficient"
  | "replicator-dynamics"
  | "risk-dominant"
  | "zero-sum";

export interface GlossaryTermDefinition {
  readonly label: string;
  readonly definition: string;
}

/** Canonical in-product definitions, kept concise and consistent across routes. */
export const glossary: Readonly<
  Record<GlossaryTermId, GlossaryTermDefinition>
> = {
  "best-response": {
    label: "best response",
    definition:
      "An action that gives a player their highest payoff against the other player's chosen action or strategy.",
  },
  "continuation-probability": {
    label: "continuation probability",
    definition:
      "The probability that an iterated interaction continues for one more round.",
  },
  degenerate: {
    label: "degenerate",
    definition:
      "A game with tied best responses that can create more best responses than a mixed-strategy support predicts.",
  },
  "dominant-strategy": {
    label: "dominant strategy",
    definition:
      "An action that gives a player a higher payoff than another action against every possible opposing action.",
  },
  "focal-point": {
    label: "focal point",
    definition:
      "A solution people tend to select because it is especially salient, even without communication.",
  },
  "mixed-strategy": {
    label: "mixed strategy",
    definition: "A probability distribution over a player's available actions.",
  },
  "nash-equilibrium": {
    label: "Nash equilibrium",
    definition:
      "A profile of strategies in which no player can gain by changing their own strategy alone.",
  },
  "pareto-efficient": {
    label: "Pareto efficient",
    definition:
      "An outcome for which no other available outcome makes one player better off without making the other worse off.",
  },
  "replicator-dynamics": {
    label: "replicator dynamics",
    definition:
      "A population update rule under which strategies that earn more than average become more common.",
  },
  "risk-dominant": {
    label: "risk dominant",
    definition:
      "Among competing equilibria, the one with the larger product of players' losses from unilateral deviation.",
  },
  "zero-sum": {
    label: "zero-sum",
    definition:
      "A game in which the players' payoffs always add to the same total, so one player's gain is the other's loss.",
  },
};
