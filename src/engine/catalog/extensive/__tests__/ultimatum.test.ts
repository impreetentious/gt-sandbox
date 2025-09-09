import { describe, expect, it } from "vitest";
import {
  extensiveCatalog,
  extensiveCatalogBySlug,
  ultimatum,
} from "@/engine/catalog/extensive";
import {
  backwardInduction,
  payoffsUnder,
  verifySubgamePerfect,
} from "@/engine/extensive";
import { formatRational } from "@/engine/rational";

describe("ultimatum catalog oracle", () => {
  it("is registered under its slug and appears in the catalog list", () => {
    expect(extensiveCatalog).toContain(ultimatum);
    expect(extensiveCatalogBySlug.ultimatum).toBe(ultimatum);
    expect(ultimatum.slug).toBe("ultimatum");
  });

  it("declares an 11-way proposer root over offers 0..10", () => {
    const { game } = ultimatum;
    expect(game.players).toEqual(["Proposer", "Responder"]);
    if (game.root.kind !== "decision")
      throw new Error("expected decision root");
    expect(game.root.id).toBe("proposer-move");
    expect(game.root.actions).toHaveLength(11);
    expect(game.root.actions[0]).toBe("0");
    expect(game.root.actions[10]).toBe("10");
    expect(game.root.children).toHaveLength(11);
  });

  it("matches backward induction: SPNE offers 1, on-path payoffs (9, 1)", () => {
    const { game, oracle } = ultimatum;
    const spne = backwardInduction(game);
    // Proposer offers index 1 (offer = 1).
    expect(spne.strategy.get("proposer-move")).toBe(1);
    // Responder rejects at 0 (index 0), accepts otherwise (index 1).
    expect(spne.strategy.get("responder-after-offer-0")).toBe(0);
    for (let offer = 1; offer <= 10; offer += 1) {
      expect(spne.strategy.get(`responder-after-offer-${offer}`)).toBe(1);
    }
    expect(spne.payoffs.map(formatRational)).toEqual(["9", "1"]);

    // The oracle matches the engine on every decision node it names.
    for (const [nodeId, actionIndex] of oracle.spne.strategy) {
      expect(spne.strategy.get(nodeId)).toBe(actionIndex);
    }

    const verdict = verifySubgamePerfect(game, oracle.spne.strategy);
    expect(verdict).toEqual({ isSubgamePerfect: true, violation: null });
  });

  it("rejects the 'reject anything below 5' Nash as not subgame-perfect", () => {
    const { game, oracle } = ultimatum;
    expect(oracle.nonSubgamePerfectNash).toHaveLength(1);
    const threat = oracle.nonSubgamePerfectNash[0];

    const verdict = verifySubgamePerfect(game, threat.strategy);
    expect(verdict.isSubgamePerfect).toBe(false);
    // The first strict deviation opportunity is at the lowest-offer responder
    // node where Accept strictly beats Reject — offer = 1.
    expect(verdict.violation?.nodeId).toBe("responder-after-offer-1");
    expect(verdict.violation?.player).toBe("Responder");

    const rationals = payoffsUnder(game, threat.strategy);
    expect(rationals.map(formatRational)).toEqual(
      threat.payoffs.map((value) => String(value)),
    );
  });
});
