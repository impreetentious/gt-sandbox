import { rational, subtract, ZERO, type Rational } from "@/engine/rational";

/**
 * Exact demonstration that bidding your valuation is weakly dominant in a
 * sealed-bid second-price auction. The check is finite: over the whole grid it
 * verifies that truthful bidding never does worse than any alternative bid
 * against any rival bid, and records a witness where it does strictly better.
 */
export interface SecondPriceWitness {
  readonly value: number;
  readonly alternativeBid: number;
  readonly rivalBid: number;
  readonly truthfulPayoff: Rational;
  readonly alternativePayoff: Rational;
}

export interface SecondPriceDominance {
  readonly weaklyDominant: boolean;
  readonly overbidWitness: SecondPriceWitness | null;
  readonly underbidWitness: SecondPriceWitness | null;
}

/** Payoff of bidding `bid` at valuation `value` against `rivalBid`; ties won. */
export function secondPricePayoff(
  bid: number,
  value: number,
  rivalBid: number,
): Rational {
  if (bid < rivalBid) {
    return ZERO; // lose, earn nothing
  }
  // Win (including ties): pay the rival's bid, the second price.
  return subtract(rational(BigInt(value)), rational(BigInt(rivalBid)));
}

export function analyzeSecondPriceDominance(
  maxValue: number,
): SecondPriceDominance {
  if (!Number.isSafeInteger(maxValue) || maxValue < 1) {
    throw new RangeError("maxValue must be an integer of at least 1.");
  }

  let weaklyDominant = true;
  let overbidWitness: SecondPriceWitness | null = null;
  let underbidWitness: SecondPriceWitness | null = null;

  for (let value = 0; value <= maxValue; value += 1) {
    for (let bid = 0; bid <= maxValue; bid += 1) {
      if (bid === value) {
        continue;
      }
      for (let rivalBid = 0; rivalBid <= maxValue; rivalBid += 1) {
        const truthful = secondPricePayoff(value, value, rivalBid);
        const alternative = secondPricePayoff(bid, value, rivalBid);
        const comparison =
          truthful.numerator * alternative.denominator -
          alternative.numerator * truthful.denominator;

        if (comparison < 0n) {
          weaklyDominant = false;
        }

        if (comparison > 0n) {
          const witness: SecondPriceWitness = {
            value,
            alternativeBid: bid,
            rivalBid,
            truthfulPayoff: truthful,
            alternativePayoff: alternative,
          };
          if (bid > value && overbidWitness === null) {
            overbidWitness = witness;
          }
          if (bid < value && underbidWitness === null) {
            underbidWitness = witness;
          }
        }
      }
    }
  }

  return { weaklyDominant, overbidWitness, underbidWitness };
}
