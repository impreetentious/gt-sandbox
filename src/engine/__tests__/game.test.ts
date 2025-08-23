import { describe, expect, it } from "vitest";
import {
  allProfiles,
  createNormalFormGame,
  isZeroSum,
  payoffAt,
  payoffFor,
  profileKey,
  sameProfile,
} from "@/engine/game";
import { formatRational } from "@/engine/rational";
import { rational } from "@/engine/rational";

describe("normal-form game helpers", () => {
  it("constructs exact payoff matrices from supported inputs", () => {
    const game = createNormalFormGame({
      id: "exact",
      title: "Exact input",
      rowActions: ["A"],
      columnActions: ["B"],
      payoffs: [[[rational(3n, 2n), 2n]]],
    });

    expect(
      formatRational(payoffFor(game, { row: 0, column: 0 }, "row")).toString(),
    ).toBe("3/2");
    expect(payoffFor(game, { row: 0, column: 0 }, "column")).toEqual({
      numerator: 2n,
      denominator: 1n,
    });
    expect(allProfiles(game)).toEqual([{ row: 0, column: 0 }]);
    expect(profileKey({ row: 1, column: 2 })).toBe("1,2");
    expect(sameProfile({ row: 1, column: 2 }, { row: 1, column: 2 })).toBe(
      true,
    );
    expect(sameProfile({ row: 1, column: 2 }, { row: 2, column: 1 })).toBe(
      false,
    );

    const stringInput = createNormalFormGame({
      id: "string-input",
      title: "String input",
      rowActions: ["A"],
      columnActions: ["B"],
      payoffs: [[["1.5", "2"]]],
    });
    expect(
      formatRational(payoffFor(stringInput, { row: 0, column: 0 }, "row")),
    ).toBe("3/2");
  });

  it("validates game shapes, labels, and profiles", () => {
    const base = {
      id: "test",
      title: "Test",
      rowActions: ["A"],
      columnActions: ["B"],
      payoffs: [[[1, 1]]],
    } as const;

    expect(() => createNormalFormGame({ ...base, id: " " })).toThrow(TypeError);
    expect(() =>
      createNormalFormGame({ ...base, rowActions: [], payoffs: [] }),
    ).toThrow(RangeError);
    expect(() =>
      createNormalFormGame({ ...base, rowActions: ["A", "A"] }),
    ).toThrow(TypeError);
    expect(() =>
      createNormalFormGame({ ...base, columnActions: [" "] }),
    ).toThrow(TypeError);
    expect(() => createNormalFormGame({ ...base, payoffs: [] })).toThrow(
      RangeError,
    );
    expect(() =>
      createNormalFormGame({
        ...base,
        payoffs: [
          [
            [1, 1],
            [2, 2],
          ],
        ],
      }),
    ).toThrow(RangeError);
    expect(() =>
      createNormalFormGame({ ...base, payoffs: [[[1.5, 1]]] }),
    ).toThrow(TypeError);

    const game = createNormalFormGame(base);
    expect(() => payoffAt(game, { row: 2, column: 0 })).toThrow(RangeError);
  });

  it("detects zero-sum games exactly", () => {
    expect(
      isZeroSum(
        createNormalFormGame({
          id: "zero-sum",
          title: "Zero sum",
          rowActions: ["A"],
          columnActions: ["B"],
          payoffs: [[[2, -2]]],
        }),
      ),
    ).toBe(true);
    expect(
      isZeroSum(
        createNormalFormGame({
          id: "constant-sum-not-zero",
          title: "Constant sum",
          rowActions: ["A"],
          columnActions: ["B"],
          payoffs: [[[2, 3]]],
        }),
      ),
    ).toBe(false);
  });
});
