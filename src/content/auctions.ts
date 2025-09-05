import type { AuctionFormat } from "@/engine/auction/auction";

export interface AuctionFormatContent {
  readonly format: AuctionFormat;
  readonly slug: string;
  readonly title: string;
  readonly concept: string;
  readonly eyebrow: string;
  readonly framing: string;
  /** What the number you observe each round means. */
  readonly observationLabel: string;
  readonly observationHelp: string;
}

export const auctionFormatContent: Readonly<
  Record<AuctionFormat, AuctionFormatContent>
> = {
  "first-price": {
    format: "first-price",
    slug: "first-price",
    title: "First-price sealed bid",
    concept: "bid shading",
    eyebrow: "Auctions / Procurement",
    framing:
      "You bid for a contract worth a known amount to you. The high bid wins and pays exactly what it bid — so bidding your full value earns nothing. The art is shading.",
    observationLabel: "Your valuation",
    observationHelp:
      "The item is worth this much to you. Win, and your profit is your valuation minus the price you pay.",
  },
  "second-price": {
    format: "second-price",
    slug: "second-price",
    title: "Second-price sealed bid",
    concept: "dominant-strategy truthfulness",
    eyebrow: "Auctions / Spectrum & ad markets",
    framing:
      "The high bid wins but pays the second-highest bid. This one rule makes bidding your true valuation a dominant strategy — the most counterintuitive result you can feel here.",
    observationLabel: "Your valuation",
    observationHelp:
      "The item is worth this much to you. You pay the rival's bid if you win, never your own.",
  },
  "common-value": {
    format: "common-value",
    slug: "common-value",
    title: "Common value",
    concept: "the winner's curse",
    eyebrow: "Auctions / M&A and oil leases",
    framing:
      "The item is worth the same to everyone, but nobody knows that value — each of you sees only a noisy signal. Win by bidding your signal and you have probably overpaid.",
    observationLabel: "Your signal",
    observationHelp:
      "The item's true value is the same for both bidders. Your signal is that value plus noise; winning means your signal was likely the higher, more optimistic one.",
  },
};

export const auctionSlugToFormat: Readonly<Record<string, AuctionFormat>> = {
  "first-price": "first-price",
  "second-price": "second-price",
  "common-value": "common-value",
};
