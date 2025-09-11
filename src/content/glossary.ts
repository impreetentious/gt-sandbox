export type GlossaryTermId =
  | "backward-induction"
  | "best-response"
  | "continuation-probability"
  | "credible-threat"
  | "degenerate"
  | "dominant-strategy"
  | "evolutionarily-stable-strategy"
  | "fixation-probability"
  | "focal-point"
  | "folk-theorem"
  | "free-riding"
  | "individually-rational"
  | "marginal-per-capita-return"
  | "minimax"
  | "mixed-strategy"
  | "nash-equilibrium"
  | "pareto-efficient"
  | "replicator-dynamics"
  | "risk-dominant"
  | "subgame-perfect-equilibrium"
  | "winners-curse"
  | "zero-sum";

export interface GlossaryTermDefinition {
  readonly label: string;
  readonly definition: string;
}

/** Canonical in-product definitions, kept concise and consistent across routes. */
export const glossary: Readonly<
  Record<GlossaryTermId, GlossaryTermDefinition>
> = {
  "backward-induction": {
    label: "backward induction",
    definition:
      "Solving a perfect-information sequential game by starting from the last decision and working back to the first, choosing the payoff-maximizing action at each step.",
  },
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
  "credible-threat": {
    label: "credible threat",
    definition:
      "A threatened action that the threatener would actually want to carry out if the moment came — one that survives subgame perfection.",
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
  "evolutionarily-stable-strategy": {
    label: "evolutionarily stable strategy",
    definition:
      "A strategy that, once common, resists invasion by any rare mutant — it either strictly out-earns the mutant against the resident population, or ties there and strictly out-earns it against the mutant.",
  },
  "fixation-probability": {
    label: "fixation probability",
    definition:
      "The chance that a strategy starting from a given number of individuals eventually takes over the entire finite population.",
  },
  "focal-point": {
    label: "focal point",
    definition:
      "A solution people tend to select because it is especially salient, even without communication.",
  },
  "folk-theorem": {
    label: "folk theorem",
    definition:
      "The result that in a repeated game, any feasible payoff giving each player at least their minimax value can be sustained by an equilibrium when players are patient enough.",
  },
  "free-riding": {
    label: "free-riding",
    definition:
      "Taking the benefit of a shared good without paying toward it — the dominant strategy whenever a contribution returns the contributor less than it costs.",
  },
  "individually-rational": {
    label: "individually rational",
    definition:
      "A payoff at or above a player's minimax value — the most the opponent can hold them below by playing adversarially.",
  },
  "marginal-per-capita-return": {
    label: "marginal per capita return",
    definition:
      "In a public-goods game, the share of one contributed token that flows back to each player, including the contributor. Written MPCR.",
  },
  minimax: {
    label: "minimax",
    definition:
      "The lowest payoff an opponent can force on a player who best-responds; the player's security level in the stage game.",
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
  "subgame-perfect-equilibrium": {
    label: "subgame-perfect equilibrium",
    definition:
      "A Nash equilibrium that remains a Nash equilibrium in every subgame — the refinement that rules out non-credible threats.",
  },
  "winners-curse": {
    label: "winner's curse",
    definition:
      "In a common-value auction, the tendency for the winning bidder to have overestimated the item's value, since winning means bidding more than everyone else.",
  },
  "zero-sum": {
    label: "zero-sum",
    definition:
      "A game in which the players' payoffs always add to the same total, so one player's gain is the other's loss.",
  },
};
