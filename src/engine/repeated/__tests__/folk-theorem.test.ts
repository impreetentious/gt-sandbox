import { describe, expect, it } from "vitest";
import { bos } from "@/engine/catalog/bos";
import { chicken } from "@/engine/catalog/chicken";
import { pd } from "@/engine/catalog/pd";
import { pennies } from "@/engine/catalog/pennies";
import { stag } from "@/engine/catalog/stag";
import { formatRational } from "@/engine/rational";
import { analyzeFolkTheorem } from "@/engine/repeated/folk-theorem";

const cooperate = { row: 0, column: 0 };

describe("folk-theorem analysis", () => {
  it("derives the classic PD discount threshold of 1/2", () => {
    const analysis = analyzeFolkTheorem(pd.game, { cooperate });
    expect(analysis.threshold.kind).toBe("threshold");
    if (analysis.threshold.kind === "threshold") {
      expect(formatRational(analysis.threshold.value)).toBe("1/2");
    }
    expect(formatRational(analysis.rowMinimax)).toBe("1");
    expect(formatRational(analysis.columnMinimax)).toBe("1");
    expect(analysis.cooperativeIsIndividuallyRational).toBe(true);
    // The feasible hull is the full outcome quadrilateral (4 distinct vertices).
    expect(analysis.feasibleHull).toHaveLength(4);
  });

  it("reports Stag Hunt cooperation as sustainable at any discount factor", () => {
    const analysis = analyzeFolkTheorem(stag.game, { cooperate });
    // (Stag, Stag) is itself a stage equilibrium: no deviation temptation.
    expect(analysis.threshold.kind).toBe("always");
    expect(formatRational(analysis.rowMinimax)).toBe("3");
  });

  it("uses the credible minimax punishment for Chicken", () => {
    const analysis = analyzeFolkTheorem(chicken.game, { cooperate });
    expect(analysis.threshold.kind).toBe("threshold");
    if (analysis.threshold.kind === "threshold") {
      expect(formatRational(analysis.threshold.value)).toBe("1/2");
    }
    // The minimax (−1) is stricter than the non-credible mutual-Straight corner.
    expect(formatRational(analysis.rowMinimax)).toBe("-1");
  });

  it("cannot sustain cooperation in strictly competitive Matching Pennies", () => {
    const analysis = analyzeFolkTheorem(pennies.game, { cooperate });
    expect(analysis.threshold.kind).toBe("never");
    // The mixed security value of matching pennies is exactly 0 for both.
    expect(formatRational(analysis.rowMinimax)).toBe("0");
    expect(formatRational(analysis.columnMinimax)).toBe("0");
    expect(analysis.cooperativeIsIndividuallyRational).toBe(false);
  });

  it("treats a stage-equilibrium coordinate as always sustainable in BoS", () => {
    const analysis = analyzeFolkTheorem(bos.game, { cooperate });
    // (A, A) is a pure Nash of Battle of the Sexes, so no discounting is needed.
    expect(analysis.threshold.kind).toBe("always");
  });

  it("rejects non-2×2 games", () => {
    expect(() =>
      analyzeFolkTheorem(
        {
          ...pd.game,
          rowActions: ["a", "b", "c"],
          payoffs: [...pd.game.payoffs, pd.game.payoffs[0]],
        },
        { cooperate },
      ),
    ).toThrow(/2×2/);
  });
});
