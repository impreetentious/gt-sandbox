import {
  add,
  compare,
  divide,
  rational,
  subtract,
  ZERO,
  type Rational,
} from "@/engine/rational";

/**
 * Exact two-bidder auction engine. Discretizing valuations, signals, and bids
 * turns a Bayesian auction into a finite object over which every claim can be
 * computed exactly in rationals — no floating point, no backend (I1–I4). Values
 * and bids are non-negative integers on a shared grid `0..maxValue`.
 */
export type PrivateValueFormat = "first-price" | "second-price";
export type AuctionFormat = PrivateValueFormat | "common-value";

export interface AuctionResolution {
  readonly youWin: boolean;
  readonly tie: boolean;
  /** The price the winner pays. Zero when you do not win. */
  readonly price: Rational;
  readonly yourPayoff: Rational;
  readonly rivalPayoff: Rational;
}

export interface PrivateValueRoundInput {
  readonly format: PrivateValueFormat;
  readonly yourBid: number;
  readonly rivalBid: number;
  readonly yourValue: number;
  readonly rivalValue: number;
  /** Seeded tie-break; only consulted when bids are equal. */
  readonly tieWinner: "you" | "rival";
}

function assertGridInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative integer.`);
  }
}

/** Winning payoff `value − price`; the price depends on the format. */
export function resolvePrivateValueRound(
  input: PrivateValueRoundInput,
): AuctionResolution {
  assertGridInteger(input.yourBid, "yourBid");
  assertGridInteger(input.rivalBid, "rivalBid");
  assertGridInteger(input.yourValue, "yourValue");
  assertGridInteger(input.rivalValue, "rivalValue");

  const youBidHigher = input.yourBid > input.rivalBid;
  const tie = input.yourBid === input.rivalBid;
  const youWin = youBidHigher || (tie && input.tieWinner === "you");

  const winnerBid = rational(BigInt(Math.max(input.yourBid, input.rivalBid)));
  const loserBid = rational(BigInt(Math.min(input.yourBid, input.rivalBid)));
  const price = input.format === "first-price" ? winnerBid : loserBid;

  const yourValue = rational(BigInt(input.yourValue));
  const rivalValue = rational(BigInt(input.rivalValue));

  if (youWin) {
    return {
      youWin: true,
      tie,
      price,
      yourPayoff: subtract(yourValue, price),
      rivalPayoff: ZERO,
    };
  }

  return {
    youWin: false,
    tie,
    price: ZERO,
    yourPayoff: ZERO,
    rivalPayoff: subtract(rivalValue, price),
  };
}

export type AuctionPersonaId = "truthful" | "shader" | "overbidder";

export interface AuctionPersona {
  readonly id: AuctionPersonaId;
  readonly name: string;
  readonly description: string;
  /** A deterministic bid as a function of the bidder's own valuation. */
  readonly bid: (value: number, maxValue: number) => number;
}

export const auctionPersonas: Readonly<
  Record<AuctionPersonaId, AuctionPersona>
> = {
  truthful: {
    id: "truthful",
    name: "Honest",
    description: "Bids exactly its valuation — the dominant second-price play.",
    bid: (value) => value,
  },
  shader: {
    id: "shader",
    name: "Shader",
    description:
      "Shades to half its valuation — the risk-neutral first-price benchmark.",
    bid: (value) => Math.floor(value / 2),
  },
  overbidder: {
    id: "overbidder",
    name: "Overbidder",
    description: "Bids above its valuation and courts the winner's curse.",
    bid: (value, maxValue) => Math.min(value + 2, maxValue),
  },
};

/**
 * The risk-neutral symmetric equilibrium bid for a two-bidder first-price
 * auction with valuations uniform on `[0, maxValue]` is `v/2`. This is the
 * continuous benchmark the reveal measures shading against; it is labelled as
 * such rather than presented as the exact discrete-grid equilibrium.
 */
export function firstPriceBenchmarkBid(value: number): Rational {
  return divide(rational(BigInt(value)), rational(2n));
}

/**
 * Exact expected payoff of a fixed `yourBid` in a private-value auction, given
 * your realized valuation and a rival whose bid is a deterministic function of
 * a valuation drawn uniformly from the grid. Ties split the surplus evenly.
 */
export function expectedPrivateValuePayoff(params: {
  readonly format: PrivateValueFormat;
  readonly yourBid: number;
  readonly yourValue: number;
  readonly maxValue: number;
  readonly rivalBid: (value: number, maxValue: number) => number;
}): Rational {
  const outcomes = params.maxValue + 1;
  let total = ZERO;

  for (let rivalValue = 0; rivalValue <= params.maxValue; rivalValue += 1) {
    const rivalBid = params.rivalBid(rivalValue, params.maxValue);
    const win = resolvePrivateValueRound({
      format: params.format,
      yourBid: params.yourBid,
      rivalBid,
      yourValue: params.yourValue,
      rivalValue,
      tieWinner: "you",
    });
    const lose = resolvePrivateValueRound({
      format: params.format,
      yourBid: params.yourBid,
      rivalBid,
      yourValue: params.yourValue,
      rivalValue,
      tieWinner: "rival",
    });
    // Average the two tie-break resolutions so a tie contributes half surplus.
    const roundValue = divide(
      add(win.yourPayoff, lose.yourPayoff),
      rational(2n),
    );
    total = add(total, roundValue);
  }

  return divide(total, rational(BigInt(outcomes)));
}

/** The bid on the grid that maximizes exact expected payoff (lowest on ties). */
export function bestResponseBid(params: {
  readonly format: PrivateValueFormat;
  readonly yourValue: number;
  readonly maxValue: number;
  readonly rivalBid: (value: number, maxValue: number) => number;
}): { readonly bid: number; readonly payoff: Rational } {
  let bestBid = 0;
  let bestPayoff: Rational | undefined;

  for (let bid = 0; bid <= params.maxValue; bid += 1) {
    const payoff = expectedPrivateValuePayoff({ ...params, yourBid: bid });
    if (bestPayoff === undefined || compare(payoff, bestPayoff) === 1) {
      bestBid = bid;
      bestPayoff = payoff;
    }
  }

  return { bid: bestBid, payoff: bestPayoff ?? ZERO };
}

export function averageRational(values: readonly Rational[]): Rational {
  if (values.length === 0) {
    return ZERO;
  }
  return divide(
    values.reduce((sum, value) => add(sum, value), ZERO),
    rational(BigInt(values.length)),
  );
}
