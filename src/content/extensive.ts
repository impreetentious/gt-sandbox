import type { ExtensiveSlug } from "@/engine/catalog/extensive";

export interface ExtensiveContent {
  /** Player id (matches `game.players`) that the human plays. */
  readonly userPlayer: string;
  /** Short label for the terminal payoff table (`(Row, Column)`). */
  readonly payoffPairLabel: string;
  /** Copy shown above the tree. */
  readonly framing: string;
  /** Legend for who controls each player. */
  readonly playerLegend: {
    readonly user: string;
    readonly rival: string;
  };
  /** Prompt shown before the user has made any move. */
  readonly initialPrompt: string;
  /** Legend for the rival-policy fieldset. */
  readonly rivalLegend: string;
  /**
   * Rival policies the user picks between. Each strategy must cover every
   * decision node the rival owns; user-owned nodes may be omitted.
   */
  readonly rivals: readonly {
    readonly id: string;
    readonly label: string;
    readonly description: string;
    readonly strategy: ReadonlyMap<string, number>;
  }[];
  readonly reveal: {
    readonly headline: string;
    readonly credibleThreat: string;
    readonly whyItMatters: string;
  };
}

export const extensiveContent: Readonly<
  Record<ExtensiveSlug, ExtensiveContent>
> = Object.freeze({
  "entry-deterrence": {
    userPlayer: "Entrant",
    payoffPairLabel: "(Entrant, Incumbent)",
    framing:
      "A challenger is deciding whether to enter a market the incumbent has to itself. The incumbent has already announced it will crush any entrant with a price war. You are the challenger.",
    playerLegend: {
      user: "You play the Entrant.",
      rival: "A policy plays the Incumbent.",
    },
    initialPrompt: "Choose to enter the market or stay out.",
    rivalLegend: "Incumbent policy",
    rivals: [
      {
        id: "spne-rational",
        label: "Rational Incumbent",
        description:
          "Plays whichever move maximizes its own payoff once you have already entered. Threats it made before your decision do not bind it after.",
        strategy: new Map([["incumbent-move", 1]]),
      },
      {
        id: "commits-to-fight",
        label: "Committed Incumbent",
        description:
          "Fights every entrant, even when fighting hurts its own payoff. Real-world equivalents: pre-signed contracts, reputational lock-in, board-mandated retaliation.",
        strategy: new Map([["incumbent-move", 0]]),
      },
    ],
    reveal: {
      headline: "Backward induction predicts entry. Reputation might not.",
      credibleThreat:
        "The Nash equilibrium (Out, Fight-if-entered) is not subgame-perfect: if you actually enter, fighting hurts the Incumbent (−1) more than accommodating (1). Subgame perfection is the refinement that rules out these non-credible threats.",
      whyItMatters:
        "Real incumbents that can credibly pre-commit — through fixed contracts, aggressive-response reputation, or costly capacity — can turn a non-subgame-perfect threat into a binding one. That is the entire theory of strategic entry barriers, and why the equilibrium concept you use matters.",
    },
  },
  ultimatum: {
    userPlayer: "Proposer",
    payoffPairLabel: "(Proposer, Responder)",
    framing:
      "You have 10 units to split. Offer any integer share to a Responder, who can accept — you both keep your parts — or reject, in which case you both walk away with nothing. One shot, no repetition, no negotiation.",
    playerLegend: {
      user: "You play the Proposer.",
      rival: "A policy plays the Responder.",
    },
    initialPrompt: "Offer any integer share from 0 to 10 to the Responder.",
    rivalLegend: "Responder policy",
    rivals: [
      {
        id: "spne-responder",
        label: "Payoff-Maximising Responder",
        description:
          "Accepts every strictly positive offer; rejects at zero. Once the offer is in front of them, any positive share beats walking away.",
        strategy: buildResponderStrategy((offer) => (offer === 0 ? 0 : 1)),
      },
      {
        id: "fair-share-responder",
        label: "Fair-Share Responder",
        description:
          "Rejects anything below 5. Not credible under subgame perfection — but exactly the pattern seen in most experimental play.",
        strategy: buildResponderStrategy((offer) => (offer < 5 ? 0 : 1)),
      },
    ],
    reveal: {
      headline:
        "Backward induction predicts a minimal offer. Experiments predict rebellion.",
      credibleThreat:
        "The Nash where the Proposer offers 5 relies on the Responder threatening to reject anything smaller. That threat is not credible: at an offer of, say, 1, Rejecting gives 0 while Accepting gives 1, and subgame perfection insists you only threaten what you would actually do.",
      whyItMatters:
        "Human subjects reject unfair offers regularly. That means either preferences include something beyond immediate payoff (fairness, spite, reputation), or subgame perfection is too demanding a refinement for one-shot bargaining. Both are worth taking seriously — but the strict theoretical prediction is what you just watched.",
    },
  },
  centipede: {
    userPlayer: "Player 1",
    payoffPairLabel: "(Player 1, Player 2)",
    framing:
      "You and a rival alternate. On each of your turns you can Take — end the game with the split shown at the Take terminal — or Pass, giving the other side a turn at a larger pot. If both of you Pass every time, you reach the (4, 4) terminal that Pareto-dominates every earlier Take. Rational backward induction says you should Take on turn one anyway.",
    playerLegend: {
      user: "You play Player 1 (odd-numbered nodes).",
      rival: "A policy plays Player 2 (even-numbered nodes).",
    },
    initialPrompt:
      "Take now to end the game with (1, 1), or Pass to send the larger pot to Player 2.",
    rivalLegend: "Player 2 policy",
    rivals: [
      {
        id: "spne-taker",
        label: "Payoff-Maximising Player 2",
        description:
          "Applies backward induction and Takes at every opportunity — starting with node 4, where Take (5) beats Pass (4).",
        strategy: new Map([
          ["node-2", 0],
          ["node-4", 0],
        ]),
      },
      {
        id: "always-pass",
        label: "Always-Pass Player 2",
        description:
          "Never Takes. Not a best response — Player 2 would rather Take at node 4 — but useful to feel what long play would earn if both sides sustained cooperation.",
        strategy: new Map([
          ["node-2", 1],
          ["node-4", 1],
        ]),
      },
    ],
    reveal: {
      headline: "Backward induction says: take on turn one. People rarely do.",
      credibleThreat:
        "Nothing about the SPNE relies on a non-credible threat — every mover simply prefers their next Take to whatever continuation offers. The interesting failure is empirical: given more moves, real players earn far more than the SPNE predicts.",
      whyItMatters:
        "Experimental subjects Pass repeatedly, even against strangers, even in one-shot play. That is evidence for other-regarding preferences, for bounded reasoning depth (each player believes the other will Pass one more time than they actually will), or for coordination on the Pareto-efficient continuation. Any of those breaks the assumption that a rational player instantly performs the full backward induction.",
    },
  },
});

function buildResponderStrategy(
  decide: (offer: number) => number,
): ReadonlyMap<string, number> {
  const strategy = new Map<string, number>();
  for (let offer = 0; offer <= 10; offer += 1) {
    strategy.set(`responder-after-offer-${offer}`, decide(offer));
  }
  return strategy;
}
