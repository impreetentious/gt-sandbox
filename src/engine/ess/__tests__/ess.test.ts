import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { classifyESS, interiorRestPoint } from "@/engine/ess";
import {
  classifySelection,
  createMoranConfig,
  type SymmetricPayoffs,
} from "@/engine/moran";
import { compare, formatRational, rational } from "@/engine/rational";

function payoffs(a: number, b: number, c: number, d: number): SymmetricPayoffs {
  return {
    a: rational(BigInt(a)),
    b: rational(BigInt(b)),
    c: rational(BigInt(c)),
    d: rational(BigInt(d)),
  };
}

describe("pure-strategy ESS checks", () => {
  it("makes Defect the unique ESS of a Prisoner's Dilemma", () => {
    // A = Cooperate, B = Defect.
    const report = classifyESS(payoffs(3, 0, 5, 1));
    expect(report.a.isESS).toBe(false);
    expect(report.a.witness).toMatch(/invades outright/);
    expect(report.b.isESS).toBe(true);
    expect(report.b.clause).toBe("strict-advantage");
    expect(report.b.witness).toBeNull();
    expect(report.regime).toBe("B dominant");
  });

  it("makes both strategies ESS in a Stag Hunt, which is bistability", () => {
    const report = classifyESS(payoffs(4, 0, 3, 2));
    expect(report.a.isESS).toBe(true);
    expect(report.b.isESS).toBe(true);
    expect(report.regime).toBe("bistable");
    // The interior point exists but repels — it is the basin boundary.
    expect(report.mixed).not.toBeNull();
    expect(report.mixed?.isStable).toBe(false);
    expect(formatRational(report.mixed!.shareOfA)).toBe("2/3");
  });

  it("separates neutral stability from evolutionary stability", () => {
    // E(A,A) = E(B,A) = 2 and E(A,B) = E(B,B) = 1: A resists nothing.
    const report = classifyESS(payoffs(2, 1, 2, 1));
    expect(report.a.isESS).toBe(false);
    expect(report.a.witness).toMatch(/neutrally stable but not evolutionarily/);
  });

  it("accepts a strategy that ties on the first clause but wins the second", () => {
    // E(A,A) = E(B,A) = 2, but E(A,B) = 5 > E(B,B) = 1.
    const report = classifyESS(payoffs(2, 5, 2, 1));
    expect(report.a.isESS).toBe(true);
    expect(report.a.clause).toBe("tie-broken-on-mutant");
  });

  it("flags the mutant-favouring tie as an invasion", () => {
    // E(A,A) = E(B,A) = 2, but E(A,B) = 0 < E(B,B) = 1.
    const report = classifyESS(payoffs(2, 0, 2, 1));
    expect(report.a.isESS).toBe(false);
    expect(report.a.witness).toMatch(/strictly worse against B itself/);
  });
});

describe("mixed ESS", () => {
  it("finds the Hawk share V/C in Hawk–Dove", () => {
    // V = 2, C = 4. Hawk/Hawk = (V−C)/2 = −1, Hawk/Dove = 2,
    // Dove/Hawk = 0, Dove/Dove = V/2 = 1.
    const report = classifyESS(payoffs(-1, 2, 0, 1));
    expect(report.a.isESS).toBe(false);
    expect(report.b.isESS).toBe(false);
    expect(report.regime).toBe("mixed");
    expect(report.mixed?.isStable).toBe(true);
    // V/C = 2/4 = 1/2.
    expect(formatRational(report.mixed!.shareOfA)).toBe("1/2");
  });

  it("keeps the mixed share exact when it is not a round fraction", () => {
    // V = 2, C = 7 → Hawk/Hawk = −5/2. Scale by 2 to stay on integers:
    // a = −5, b = 4, c = 0, d = 2. Expected Hawk share V/C = 2/7.
    const report = classifyESS(payoffs(-5, 4, 0, 2));
    expect(formatRational(report.mixed!.shareOfA)).toBe("2/7");
    expect(report.mixed?.isStable).toBe(true);
  });

  it("reports no interior point when one strategy dominates", () => {
    expect(interiorRestPoint(payoffs(3, 0, 5, 1))).toBeNull();
  });

  it("reports no interior point when the payoff difference is constant", () => {
    // (a − c) + (d − b) = 0 makes the denominator vanish.
    expect(interiorRestPoint(payoffs(2, 3, 1, 2))).toBeNull();
  });

  it("calls a fully neutral game neutral, with neither strategy stable", () => {
    const report = classifyESS(payoffs(1, 1, 1, 1));
    expect(report.a.isESS).toBe(false);
    expect(report.b.isESS).toBe(false);
    expect(report.mixed).toBeNull();
    expect(report.regime).toBe("neutral");
  });
});

describe("ESS agrees with finite-population selection", () => {
  it("the dominated strategy of a PD is disfavoured at every population size", () => {
    const report = classifyESS(payoffs(3, 0, 5, 1));
    expect(report.regime).toBe("B dominant");
    for (const populationSize of [4, 10, 25]) {
      const verdict = classifySelection(
        createMoranConfig({
          populationSize,
          payoffs: payoffs(3, 0, 5, 1),
          selectionIntensity: rational(1n, 10n),
        }),
      );
      expect(verdict.favoursA).toBe(false);
      expect(verdict.favoursB).toBe(true);
    }
  });

  it("both strategies invade each other in a Hawk–Dove contest", () => {
    const verdict = classifySelection(
      createMoranConfig({
        populationSize: 20,
        payoffs: payoffs(-1, 2, 0, 1),
        selectionIntensity: rational(1n, 10n),
      }),
    );
    // A stable interior mix means neither pure state resists the other.
    expect(verdict.favoursA).toBe(true);
    expect(verdict.favoursB).toBe(true);
  });

  it("lets the risk-dominant strategy invade a small bistable population", () => {
    // Stag Hunt (4, 0, 3, 2): Stag is payoff-dominant but Hare is risk-dominant,
    // since (d − b) = 2 exceeds (a − c) = 1. ESS calls both stable, yet in a
    // small population drift carries a Hare mutant across the basin boundary
    // often enough to beat the neutral benchmark. Finite N is not just a
    // discretised replicator equation — this is the whole point of the phase.
    const verdict = classifySelection(
      createMoranConfig({
        populationSize: 20,
        payoffs: payoffs(4, 0, 3, 2),
        selectionIntensity: rational(1n, 10n),
      }),
    );
    expect(verdict.favoursA).toBe(false);
    expect(verdict.favoursB).toBe(true);
    expect(verdict.aInvadesMoreEasily).toBe(false);
  });

  it("closes both invasion routes once the bistable population is large", () => {
    // By N = 50 the basin boundary is too wide for drift to cross either way,
    // and the finite-population verdict converges on the ESS one: neither pure
    // state can be invaded.
    const verdict = classifySelection(
      createMoranConfig({
        populationSize: 50,
        payoffs: payoffs(4, 0, 3, 2),
        selectionIntensity: rational(1n, 10n),
      }),
    );
    expect(verdict.favoursA).toBe(false);
    expect(verdict.favoursB).toBe(false);
    expect(classifyESS(payoffs(4, 0, 3, 2)).regime).toBe("bistable");
  });
});

describe("property: ESS implies symmetric Nash", () => {
  it("never certifies a strategy that is beaten outright on the diagonal", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: -6, max: 6 }), {
          minLength: 4,
          maxLength: 4,
        }),
        ([a, b, c, d]) => {
          const matrix = payoffs(a, b, c, d);
          const report = classifyESS(matrix);
          // ESS ⊂ Nash: if A is an ESS then E(A,A) ≥ E(B,A).
          if (report.a.isESS) {
            expect(compare(matrix.a, matrix.c)).not.toBe(-1);
          }
          if (report.b.isESS) {
            expect(compare(matrix.d, matrix.b)).not.toBe(-1);
          }
          // A stable interior point excludes both pure strategies being stable.
          if (report.mixed?.isStable) {
            expect(report.a.isESS).toBe(false);
            expect(report.b.isESS).toBe(false);
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});
