import { createExtensiveGame } from "@/engine/extensive";
import { rational } from "@/engine/rational";
import type { GameNode } from "@/engine/extensive";
import type { ExtensiveCatalogGame } from "@/engine/catalog/extensive/types";

/**
 * Ultimatum — the canonical one-shot bargaining game.
 *
 * Proposer offers an integer share k ∈ {0, 1, …, 10} of a 10-unit pie. The
 * Responder then Accepts (payoffs (10 − k, k)) or Rejects (both get 0). A
 * discrete offer grid keeps every payoff an exact rational.
 *
 * Subgame-perfect equilibrium under our lowest-index tie-break: at every
 * responder subgame with a strictly positive offer, Accept dominates Reject;
 * at the k = 0 subgame the Responder is indifferent between two zeroes, so
 * tie-breaks to Reject (index 0). Given that continuation, the Proposer
 * maximises 10 − k over the offers the Responder accepts, i.e. k ∈ {1, …, 10},
 * choosing k = 1 for a payoff of 9. On-path: (9, 1).
 *
 * The famous non-subgame-perfect Nash: "Proposer offers 5, Responder rejects
 * anything below 5". This is a Nash equilibrium — any Proposer deviation to a
 * smaller offer is punished — but the Responder's threat is not credible.
 * After actually seeing an offer of, say, 1, Rejecting gives 0 and Accepting
 * gives 1; subgame perfection is exactly the refinement that rules out this
 * threat.
 */
const RESPONDER_ACTIONS = ["Reject", "Accept"] as const;

function responderNode(offer: number): GameNode {
  const proposerShare = rational(BigInt(10 - offer));
  const responderShare = rational(BigInt(offer));
  return {
    kind: "decision",
    id: `responder-after-offer-${offer}`,
    player: "Responder",
    actions: [...RESPONDER_ACTIONS],
    informationSet: `responder-after-offer-${offer}`,
    children: [
      {
        kind: "terminal",
        id: `term-reject-${offer}`,
        payoffs: [rational(0n), rational(0n)],
      },
      {
        kind: "terminal",
        id: `term-accept-${offer}`,
        payoffs: [proposerShare, responderShare],
      },
    ],
  };
}

const OFFERS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

const ultimatumGame = createExtensiveGame({
  id: "ultimatum",
  title: "Ultimatum",
  players: ["Proposer", "Responder"],
  root: {
    kind: "decision",
    id: "proposer-move",
    player: "Proposer",
    actions: OFFERS.map((offer) => String(offer)),
    informationSet: "proposer-move",
    children: OFFERS.map(responderNode),
  },
});

const spneStrategy = new Map<string, number>([["proposer-move", 1]]);
for (const offer of OFFERS) {
  spneStrategy.set(
    `responder-after-offer-${offer}`,
    offer === 0 ? 0 /* Reject when indifferent */ : 1 /* Accept */,
  );
}

const equalSplitThreatStrategy = new Map<string, number>([
  ["proposer-move", 5],
]);
for (const offer of OFFERS) {
  equalSplitThreatStrategy.set(
    `responder-after-offer-${offer}`,
    offer < 5 ? 0 : 1,
  );
}

export const ultimatum: ExtensiveCatalogGame = {
  slug: "ultimatum",
  concept: "credibility on take-it-or-leave-it offers",
  game: ultimatumGame,
  oracle: {
    spne: {
      label: "Offer 1; accept every strictly positive offer",
      strategy: spneStrategy,
      payoffs: [9, 1],
    },
    nonSubgamePerfectNash: [
      {
        label: "Offer 5; reject anything below 5",
        strategy: equalSplitThreatStrategy,
        payoffs: [5, 5],
      },
    ],
  },
};
