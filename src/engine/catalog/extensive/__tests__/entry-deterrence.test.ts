import { describe, expect, it } from "vitest";
import {
  entryDeterrence,
  extensiveCatalog,
  extensiveCatalogBySlug,
} from "@/engine/catalog/extensive";
import {
  backwardInduction,
  payoffsUnder,
  verifySubgamePerfect,
} from "@/engine/extensive";
import { formatRational } from "@/engine/rational";

describe("entry-deterrence catalog oracle", () => {
  it("is registered under its slug and appears in the catalog list", () => {
    expect(extensiveCatalog).toContain(entryDeterrence);
    expect(extensiveCatalogBySlug["entry-deterrence"]).toBe(entryDeterrence);
    expect(entryDeterrence.slug).toBe("entry-deterrence");
  });

  it("declares the canonical tree shape: Entrant → Incumbent → three terminals", () => {
    const { game } = entryDeterrence;
    expect(game.players).toEqual(["Entrant", "Incumbent"]);
    expect(game.root.kind).toBe("decision");
    if (game.root.kind !== "decision")
      throw new Error("expected decision root");
    expect(game.root.id).toBe("entrant-move");
    expect(game.root.actions).toEqual(["In", "Out"]);
  });

  it("matches backward induction: SPNE = (In, Accommodate) with payoffs (1, 1)", () => {
    const { game, oracle } = entryDeterrence;
    const spne = backwardInduction(game);

    // Oracle strategy exactly matches the engine's SPNE.
    for (const [nodeId, actionIndex] of oracle.spne.strategy) {
      expect(spne.strategy.get(nodeId)).toBe(actionIndex);
    }
    // Oracle payoffs match too.
    expect(spne.payoffs.map(formatRational)).toEqual(
      oracle.spne.payoffs.map((value) => String(value)),
    );
    // And the independent verifier accepts the oracle SPNE.
    const verdict = verifySubgamePerfect(game, oracle.spne.strategy);
    expect(verdict).toEqual({ isSubgamePerfect: true, violation: null });
  });

  it("rejects the documented non-SP Nash (Stay out; threaten Fight) via the verifier", () => {
    const { game, oracle } = entryDeterrence;
    expect(oracle.nonSubgamePerfectNash).toHaveLength(1);
    const threat = oracle.nonSubgamePerfectNash[0];

    const verdict = verifySubgamePerfect(game, threat.strategy);
    expect(verdict.isSubgamePerfect).toBe(false);
    expect(verdict.violation?.nodeId).toBe("incumbent-move");
    expect(verdict.violation?.player).toBe("Incumbent");

    // On-path payoffs of the non-SP Nash equal what the oracle claims.
    const rationals = payoffsUnder(game, threat.strategy);
    expect(rationals.map(formatRational)).toEqual(
      threat.payoffs.map((value) => String(value)),
    );
  });
});
