export interface PublicGoodsRival {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  /**
   * Contribution each other player makes, as a fraction of the endowment.
   * Resolved against the live endowment so the roster survives an N change.
   */
  readonly shareOfEndowment: readonly [numerator: number, denominator: number];
}

export const publicGoodsContent = {
  framing:
    "You and the rest of the group each hold 10 tokens. Keep them and they are yours. Put them in the shared pot and the pot is multiplied, then split evenly across everyone — including whoever kept theirs.",
  actPrompt:
    "Choose how many of your 10 tokens go into the pot. The others have already decided.",
  rivals: [
    {
      id: "all-in",
      label: "Full contributors",
      description:
        "Every other player puts in all 10 tokens. The most generous group you could face.",
      shareOfEndowment: [1, 1],
    },
    {
      id: "half",
      label: "Half contributors",
      description:
        "Every other player puts in half. The typical opening round in classroom play.",
      shareOfEndowment: [1, 2],
    },
    {
      id: "free-riders",
      label: "Free riders",
      description:
        "Every other player keeps everything. What the equilibrium prediction says you should expect.",
      shareOfEndowment: [0, 1],
    },
  ] satisfies readonly PublicGoodsRival[],
  reveal: {
    headline:
      "Your best move never depended on them. That is what makes it a dilemma.",
    dominance:
      "A token you contribute costs you 1 and returns the MPCR to you. While the MPCR is below 1 that trade is a loss no matter what anyone else does — so contributing nothing is strictly dominant, and universal free-riding is the unique Nash equilibrium. Notice there is no anticipation in that argument: you never had to guess the others' choices.",
    efficiency:
      "The same token adds MPCR × N to the group total. While that exceeds 1 the pot grows the pie, so everyone contributing everything maximises welfare and makes every single player better off than the equilibrium does.",
    window:
      "Both conditions hold exactly when 1/N < MPCR < 1. Inside that window the individually rational choice and the collectively rational choice point in opposite directions — and widening the group widens the window, which is why large groups free-ride hardest.",
    whyItMatters:
      "Carbon abatement, open-source maintenance, herd immunity, and paying tax all share this shape. The lesson is not that people are selfish; it is that the payoff structure punishes unilateral generosity. Changing behaviour means changing the structure — matching funds, enforceable pledges, or punishment — not exhorting people to be better.",
  },
} as const;
