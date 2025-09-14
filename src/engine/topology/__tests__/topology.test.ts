import { describe, expect, it } from "vitest";

import { filterOrdinalTopology, ordinalTopology } from "@/engine/topology";

describe("ordinal topology atlas", () => {
  it("enumerates the 144 strict ordinal 2×2 games modulo action relabelling", () => {
    expect(ordinalTopology).toHaveLength(144);
    expect(new Set(ordinalTopology.map((entry) => entry.id)).size).toBe(144);
    expect(
      ordinalTopology.every((entry) => entry.game.payoffs.flat().length === 4),
    ).toBe(true);
  });

  it("derives searchable concept labels from the exact classifier", () => {
    expect(filterOrdinalTopology("coordination").length).toBeGreaterThan(0);
    expect(
      filterOrdinalTopology("matching pennies").every(
        (entry) => entry.structure === "cycle",
      ),
    ).toBe(true);
    expect(filterOrdinalTopology("coordn").length).toBeGreaterThan(0);
    expect(
      filterOrdinalTopology("mtch pnies").every(
        (entry) => entry.structure === "cycle",
      ),
    ).toBe(true);
  });
});
