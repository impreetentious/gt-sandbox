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
});
