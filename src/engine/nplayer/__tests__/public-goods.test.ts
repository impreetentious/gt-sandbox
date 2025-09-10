import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  classifyDilemma,
  cooperationDividend,
  createPublicGoodsConfig,
  deviationSweep,
  evaluateProfile,
  nashEquilibrium,
  payoffFor,
  uniformProfile,
  welfareOptimum,
  type PublicGoodsConfig,
} from "@/engine/nplayer";
import { compare, formatRational, rational } from "@/engine/rational";

/** Canonical classroom setup: 4 players, 10 tokens each, MPCR = 2/5. */
function canonical(): PublicGoodsConfig {
  return createPublicGoodsConfig({
    playerCount: 4,
    endowment: 10,
    mpcr: rational(2n, 5n),
  });
}

describe("public-goods config validation", () => {
  it("rejects fewer than two players", () => {
    expect(() =>
      createPublicGoodsConfig({
        playerCount: 1,
        endowment: 10,
        mpcr: rational(1n, 2n),
      }),
    ).toThrow(/playerCount/);
  });

  it("rejects a non-positive endowment", () => {
    expect(() =>
      createPublicGoodsConfig({
        playerCount: 3,
        endowment: 0,
        mpcr: rational(1n, 2n),
      }),
    ).toThrow(/endowment/);
  });

  it("rejects a non-positive MPCR", () => {
    expect(() =>
      createPublicGoodsConfig({
        playerCount: 3,
        endowment: 5,
        mpcr: rational(0n),
      }),
    ).toThrow(/mpcr/);
  });

  it("rejects contributions off the token grid", () => {
    const config = canonical();
    expect(() => payoffFor(config, -1, 0)).toThrow(/Contribution/);
    expect(() => payoffFor(config, 11, 0)).toThrow(/Contribution/);
    expect(() => evaluateProfile(config, [1, 2, 3])).toThrow(/Expected 4/);
  });
});

describe("exact payoff arithmetic", () => {
  it("computes π = (E − c) + m·Σc exactly", () => {
    const config = canonical();
    // Own contribution 10, everyone contributes 10 → total 40.
    // π = (10 − 10) + (2/5)(40) = 16.
    expect(formatRational(payoffFor(config, 10, 40))).toBe("16");
    // Free-ride while the other three give everything → total 30.
    // π = (10 − 0) + (2/5)(30) = 22.
    expect(formatRational(payoffFor(config, 0, 30))).toBe("22");
    // Universal free-riding → π = 10.
    expect(formatRational(payoffFor(config, 0, 0))).toBe("10");
  });

  it("keeps non-terminating decimals exact as fractions", () => {
    const config = createPublicGoodsConfig({
      playerCount: 3,
      endowment: 10,
      mpcr: rational(1n, 3n),
    });
    // (10 − 1) + (1/3)(7) = 9 + 7/3 = 34/3.
    expect(formatRational(payoffFor(config, 1, 7))).toBe("34/3");
  });

  it("evaluates a full profile with per-player payoffs and welfare", () => {
    const config = canonical();
    const outcome = evaluateProfile(config, [10, 0, 0, 0]);
    expect(outcome.groupTotal).toBe(10);
    // Contributor: (10 − 10) + (2/5)(10) = 4. Free-riders: 10 + 4 = 14.
    expect(outcome.payoffs.map(formatRational)).toEqual([
      "4",
      "14",
      "14",
      "14",
    ]);
    expect(formatRational(outcome.welfare)).toBe("46");
  });
});

describe("dilemma classification", () => {
  it("identifies the social-dilemma window 1/N < m < 1", () => {
    const verdict = classifyDilemma(canonical());
    expect(verdict.freeRidingIsDominant).toBe(true);
    expect(verdict.cooperationIsEfficient).toBe(true);
    expect(verdict.isSocialDilemma).toBe(true);
    // Private return per token: 2/5 − 1 = −3/5. Social: (2/5)(4) − 1 = 3/5.
    expect(formatRational(verdict.privateMarginalReturn)).toBe("-3/5");
    expect(formatRational(verdict.socialMarginalReturn)).toBe("3/5");
  });

  it("below m = 1/N cooperation stops being efficient and the dilemma dissolves", () => {
    const config = createPublicGoodsConfig({
      playerCount: 4,
      endowment: 10,
      mpcr: rational(1n, 5n),
    });
    const verdict = classifyDilemma(config);
    expect(verdict.freeRidingIsDominant).toBe(true);
    expect(verdict.cooperationIsEfficient).toBe(false);
    expect(verdict.isSocialDilemma).toBe(false);
  });

  it("at exactly m = 1/N the social return is zero, not positive", () => {
    const config = createPublicGoodsConfig({
      playerCount: 4,
      endowment: 10,
      mpcr: rational(1n, 4n),
    });
    const verdict = classifyDilemma(config);
    expect(formatRational(verdict.socialMarginalReturn)).toBe("0");
    expect(verdict.cooperationIsEfficient).toBe(false);
  });

  it("above m = 1 contributing is privately profitable and there is no dilemma", () => {
    const config = createPublicGoodsConfig({
      playerCount: 3,
      endowment: 5,
      mpcr: rational(3n, 2n),
    });
    const verdict = classifyDilemma(config);
    expect(verdict.freeRidingIsDominant).toBe(false);
    expect(verdict.isSocialDilemma).toBe(false);
  });
});

describe("analytic Nash equilibrium", () => {
  it("m < 1 gives universal free-riding", () => {
    const verdict = nashEquilibrium(canonical());
    expect(verdict.equilibriumContribution).toBe(0);
    expect(verdict.outcome?.payoffs.map(formatRational)).toEqual([
      "10",
      "10",
      "10",
      "10",
    ]);
    expect(verdict.reason).toMatch(/strictly dominant/);
  });

  it("m > 1 gives universal full contribution", () => {
    const config = createPublicGoodsConfig({
      playerCount: 3,
      endowment: 5,
      mpcr: rational(3n, 2n),
    });
    expect(nashEquilibrium(config).equilibriumContribution).toBe(5);
  });

  it("m = 1 leaves every profile an equilibrium, so none is unique", () => {
    const config = createPublicGoodsConfig({
      playerCount: 3,
      endowment: 5,
      mpcr: rational(1n),
    });
    const verdict = nashEquilibrium(config);
    expect(verdict.equilibriumContribution).toBeNull();
    expect(verdict.outcome).toBeNull();
    expect(verdict.reason).toMatch(/indifferent/);
  });
});

describe("welfare optimum and the cooperation dividend", () => {
  it("puts the optimum at full contribution inside the dilemma window", () => {
    const optimum = welfareOptimum(canonical());
    expect(optimum.contributions).toEqual([10, 10, 10, 10]);
    expect(formatRational(optimum.welfare)).toBe("64");
  });

  it("puts the optimum at zero when the pot shrinks the pie", () => {
    const config = createPublicGoodsConfig({
      playerCount: 4,
      endowment: 10,
      mpcr: rational(1n, 5n),
    });
    expect(welfareOptimum(config).contributions).toEqual([0, 0, 0, 0]);
  });

  it("prices the gap between free-riding and full cooperation exactly", () => {
    // All-cooperate pays 16 each; all-defect pays 10 each. Dividend = 6.
    expect(formatRational(cooperationDividend(canonical()))).toBe("6");
  });
});

describe("deviation sweep", () => {
  it("falls monotonically for the deviator while welfare rises", () => {
    const config = canonical();
    const rows = deviationSweep(config, 10);
    expect(rows).toHaveLength(11);
    for (let index = 1; index < rows.length; index += 1) {
      expect(compare(rows[index].ownPayoff, rows[index - 1].ownPayoff)).toBe(
        -1,
      );
      expect(compare(rows[index].welfare, rows[index - 1].welfare)).toBe(1);
    }
    // Free-riding on three full contributors: 10 + (2/5)(30) = 22.
    expect(formatRational(rows[0].ownPayoff)).toBe("22");
    // Matching them: (10 − 10) + (2/5)(40) = 16.
    expect(formatRational(rows[10].ownPayoff)).toBe("16");
  });

  it("rejects an off-grid holding for the other players", () => {
    expect(() => deviationSweep(canonical(), 11)).toThrow(/Contribution/);
  });
});

// ---- Independent check: brute force over the whole profile space ----------

function allProfiles(playerCount: number, endowment: number): number[][] {
  let profiles: number[][] = [[]];
  for (let player = 0; player < playerCount; player += 1) {
    const next: number[][] = [];
    for (const prefix of profiles) {
      for (let value = 0; value <= endowment; value += 1) {
        next.push([...prefix, value]);
      }
    }
    profiles = next;
  }
  return profiles;
}

/** A profile is Nash iff no single player can strictly raise their own payoff. */
function isNash(
  config: PublicGoodsConfig,
  profile: readonly number[],
): boolean {
  const base = evaluateProfile(config, profile);
  for (let player = 0; player < config.playerCount; player += 1) {
    for (let value = 0; value <= config.endowment; value += 1) {
      if (value === profile[player]) continue;
      const alternative = [...profile];
      alternative[player] = value;
      const deviated = evaluateProfile(config, alternative);
      if (compare(deviated.payoffs[player], base.payoffs[player]) === 1) {
        return false;
      }
    }
  }
  return true;
}

describe("brute-force cross-check of the analytic claims", () => {
  it("finds all-zero to be the one and only Nash profile when m < 1", () => {
    const config = createPublicGoodsConfig({
      playerCount: 3,
      endowment: 4,
      mpcr: rational(2n, 5n),
    });
    const nash = allProfiles(config.playerCount, config.endowment).filter(
      (profile) => isNash(config, profile),
    );
    expect(nash).toEqual([[0, 0, 0]]);
    expect(nashEquilibrium(config).equilibriumContribution).toBe(0);
  });

  it("finds all-max to be the one and only Nash profile when m > 1", () => {
    const config = createPublicGoodsConfig({
      playerCount: 3,
      endowment: 3,
      mpcr: rational(5n, 4n),
    });
    const nash = allProfiles(config.playerCount, config.endowment).filter(
      (profile) => isNash(config, profile),
    );
    expect(nash).toEqual([[3, 3, 3]]);
    expect(nashEquilibrium(config).equilibriumContribution).toBe(3);
  });

  it("finds every profile Nash at m = 1", () => {
    const config = createPublicGoodsConfig({
      playerCount: 2,
      endowment: 3,
      mpcr: rational(1n),
    });
    const profiles = allProfiles(config.playerCount, config.endowment);
    expect(profiles.every((profile) => isNash(config, profile))).toBe(true);
    expect(nashEquilibrium(config).equilibriumContribution).toBeNull();
  });

  it("confirms full contribution Pareto-dominates the equilibrium in the dilemma window", () => {
    const config = canonical();
    const equilibrium = evaluateProfile(config, uniformProfile(config, 0));
    const cooperative = evaluateProfile(
      config,
      uniformProfile(config, config.endowment),
    );
    for (let player = 0; player < config.playerCount; player += 1) {
      expect(
        compare(cooperative.payoffs[player], equilibrium.payoffs[player]),
      ).toBe(1);
    }
  });
});

describe("property: the dominance claim holds across the grid", () => {
  it("zero strictly dominates every positive contribution whenever m < 1", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 10 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 19 }),
        fc.integer({ min: 0, max: 12 }),
        (playerCount, endowment, mpcrNumerator, othersEachRaw) => {
          // mpcr = numerator/20 ∈ (0, 1).
          const config = createPublicGoodsConfig({
            playerCount,
            endowment,
            mpcr: rational(BigInt(mpcrNumerator), 20n),
          });
          const othersEach = othersEachRaw % (endowment + 1);
          const rows = deviationSweep(config, othersEach);
          for (let index = 1; index < rows.length; index += 1) {
            expect(
              compare(rows[index].ownPayoff, rows[index - 1].ownPayoff),
            ).toBe(-1);
          }
        },
      ),
      { numRuns: 80 },
    );
  });

  it("welfare strictly rises with contribution whenever m·N > 1", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 10 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 19 }),
        (playerCount, endowment, mpcrNumerator) => {
          const config = createPublicGoodsConfig({
            playerCount,
            endowment,
            mpcr: rational(BigInt(mpcrNumerator), 20n),
          });
          // Only meaningful inside the efficiency half of the window.
          fc.pre(classifyDilemma(config).cooperationIsEfficient);
          const rows = deviationSweep(config, 0);
          for (let index = 1; index < rows.length; index += 1) {
            expect(compare(rows[index].welfare, rows[index - 1].welfare)).toBe(
              1,
            );
          }
        },
      ),
      { numRuns: 80 },
    );
  });
});
