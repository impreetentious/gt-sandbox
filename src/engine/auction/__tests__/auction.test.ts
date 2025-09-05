import { describe, expect, it } from "vitest";
import { compare, formatRational, ZERO } from "@/engine/rational";
import {
  auctionPersonas,
  bestResponseBid,
  expectedPrivateValuePayoff,
  firstPriceBenchmarkBid,
  resolvePrivateValueRound,
} from "@/engine/auction/auction";
import { analyzeCommonValue } from "@/engine/auction/common-value";
import { analyzeSecondPriceDominance } from "@/engine/auction/second-price";

describe("private-value auction resolution", () => {
  it("charges the winning bid in first price and the losing bid in second price", () => {
    const first = resolvePrivateValueRound({
      format: "first-price",
      yourBid: 6,
      rivalBid: 4,
      yourValue: 8,
      rivalValue: 5,
      tieWinner: "you",
    });
    expect(first.youWin).toBe(true);
    expect(formatRational(first.price)).toBe("6");
    expect(formatRational(first.yourPayoff)).toBe("2");

    const second = resolvePrivateValueRound({
      format: "second-price",
      yourBid: 6,
      rivalBid: 4,
      yourValue: 8,
      rivalValue: 5,
      tieWinner: "you",
    });
    expect(formatRational(second.price)).toBe("4");
    expect(formatRational(second.yourPayoff)).toBe("4");
  });

  it("gives the continuous first-price benchmark bid of v/2", () => {
    expect(formatRational(firstPriceBenchmarkBid(7))).toBe("7/2");
    expect(formatRational(firstPriceBenchmarkBid(10))).toBe("5");
  });
});

describe("second-price truthfulness", () => {
  it("proves bidding your valuation is weakly dominant with witnesses", () => {
    const analysis = analyzeSecondPriceDominance(10);
    expect(analysis.weaklyDominant).toBe(true);
    expect(analysis.overbidWitness).not.toBeNull();
    expect(analysis.underbidWitness).not.toBeNull();
    // The overbid witness must show truthful strictly beating the overbid.
    if (analysis.overbidWitness) {
      expect(
        compare(
          analysis.overbidWitness.truthfulPayoff,
          analysis.overbidWitness.alternativePayoff,
        ),
      ).toBe(1);
      // Overbidding can turn strictly negative — the losing-money warning.
      expect(compare(analysis.overbidWitness.alternativePayoff, ZERO)).toBe(-1);
    }
  });

  it("selects truthful bidding as the exact best response to an honest rival", () => {
    const best = bestResponseBid({
      format: "second-price",
      yourValue: 7,
      maxValue: 10,
      rivalBid: auctionPersonas.truthful.bid,
    });
    expect(best.bid).toBe(7);
  });
});

describe("first-price shading", () => {
  it("best-responds below valuation against a shading rival", () => {
    const best = bestResponseBid({
      format: "first-price",
      yourValue: 8,
      maxValue: 10,
      rivalBid: auctionPersonas.shader.bid,
    });
    expect(best.bid).toBeLessThan(8);
    // Truthful bidding earns nothing when you pay your full valuation.
    const truthfulPayoff = expectedPrivateValuePayoff({
      format: "first-price",
      yourBid: 8,
      yourValue: 8,
      maxValue: 10,
      rivalBid: auctionPersonas.shader.bid,
    });
    expect(formatRational(truthfulPayoff)).toBe("0");
  });
});

describe("common-value winner's curse", () => {
  it("shifts the expected value below face value conditional on winning", () => {
    const analysis = analyzeCommonValue(10);
    expect(analysis.curseHolds).toBe(true);
    // Naively bidding your own signal is a money-loser on average.
    expect(compare(analysis.expectedNaiveProfit, ZERO)).toBe(-1);
    // A mid-range signal's winning estimate is strictly below its face value.
    const mid = analysis.rows.find((row) => row.signal === 5);
    expect(mid).toBeDefined();
    if (mid) {
      expect(compare(mid.winningEstimate, mid.naiveEstimate)).toBe(-1);
    }
  });

  it("rejects a degenerate grid", () => {
    expect(() => analyzeCommonValue(1)).toThrow();
  });
});
