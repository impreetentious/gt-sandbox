import { describe, expect, it } from "vitest";
import {
  centipede,
  extensiveCatalog,
  extensiveCatalogBySlug,
} from "@/engine/catalog/extensive";
import {
  backwardInduction,
  inductionTrace,
  verifySubgamePerfect,
} from "@/engine/extensive";
import { formatRational } from "@/engine/rational";

describe("centipede catalog oracle", () => {
  it("is registered under its slug and appears in the catalog list", () => {
    expect(extensiveCatalog).toContain(centipede);
    expect(extensiveCatalogBySlug.centipede).toBe(centipede);
    expect(centipede.slug).toBe("centipede");
  });

  it("has a 4-node take/pass tree alternating between the two players", () => {
    const { game } = centipede;
    expect(game.players).toEqual(["Player 1", "Player 2"]);
    if (game.root.kind !== "decision")
      throw new Error("expected decision root");
    expect(game.root.id).toBe("node-1");
    expect(game.root.actions).toEqual(["Take", "Pass"]);
  });

  it("SPNE takes at node-1 for on-path payoffs (1, 1)", () => {
    const { game, oracle } = centipede;
    const spne = backwardInduction(game);
    expect(spne.strategy.get("node-1")).toBe(0);
    expect(spne.strategy.get("node-2")).toBe(0);
    expect(spne.strategy.get("node-3")).toBe(0);
    expect(spne.strategy.get("node-4")).toBe(0);
    expect(spne.payoffs.map(formatRational)).toEqual(["1", "1"]);
    expect(spne.path).toEqual(["node-1", "term-take-1"]);

    const verdict = verifySubgamePerfect(game, oracle.spne.strategy);
    expect(verdict).toEqual({ isSubgamePerfect: true, violation: null });
  });

  it("emits a post-order induction trace that unravels from node-4 back to node-1", () => {
    const trace = inductionTrace(centipede.game);
    expect(trace.map((step) => step.nodeId)).toEqual([
      "node-4",
      "node-3",
      "node-2",
      "node-1",
    ]);
    for (const step of trace) {
      expect(step.chosenAction).toBe("Take");
    }
  });

  it("carries no listed non-SP Nash equilibria (the empirical failure is descriptive)", () => {
    expect(centipede.oracle.nonSubgamePerfectNash).toEqual([]);
  });
});
