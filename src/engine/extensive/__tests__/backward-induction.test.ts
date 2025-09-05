import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  backwardInduction,
  createExtensiveGame,
  decisionNodes,
  findNode,
  inductionTrace,
  payoffsUnder,
  terminals,
  verifySubgamePerfect,
  type ExtensiveGame,
  type GameNode,
} from "@/engine/extensive";
import {
  compare,
  equals,
  formatRational,
  rational,
  type Rational,
} from "@/engine/rational";

function payoffsAsInts(payoffs: readonly Rational[]): number[] {
  return payoffs.map(
    (value) => Number(value.numerator) / Number(value.denominator),
  );
}

/**
 * Local hand-constructed entry-deterrence-shaped tree so this engine test does
 * not depend on the catalog. The catalog module ships in a later commit; its
 * oracle assertions live in the catalog test file.
 */
function localEntryDeterrence(): ExtensiveGame {
  return createExtensiveGame({
    id: "local-entry",
    title: "Local Entry",
    players: ["P1", "P2"],
    root: {
      kind: "decision",
      id: "p1-move",
      player: "P1",
      actions: ["In", "Out"],
      informationSet: "p1-move",
      children: [
        {
          kind: "decision",
          id: "p2-move",
          player: "P2",
          actions: ["Fight", "Accommodate"],
          informationSet: "p2-move",
          children: [
            {
              kind: "terminal",
              id: "fight",
              payoffs: [rational(-1n), rational(-1n)],
            },
            {
              kind: "terminal",
              id: "accommodate",
              payoffs: [rational(1n), rational(1n)],
            },
          ],
        },
        {
          kind: "terminal",
          id: "stay-out",
          payoffs: [rational(0n), rational(2n)],
        },
      ],
    },
  });
}

describe("extensive-form tree construction and traversal", () => {
  it("validates a hand-built tree and exposes its decision and terminal nodes", () => {
    const game = localEntryDeterrence();
    expect(game.players).toEqual(["P1", "P2"]);
    expect(decisionNodes(game).map((node) => node.id)).toEqual([
      "p1-move",
      "p2-move",
    ]);
    expect(terminals(game).map((node) => node.id)).toEqual([
      "fight",
      "accommodate",
      "stay-out",
    ]);
    expect(findNode(game, "accommodate").kind).toBe("terminal");
  });

  it("rejects duplicate node ids", () => {
    expect(() =>
      createExtensiveGame({
        id: "dup",
        title: "dup",
        players: ["A"],
        root: {
          kind: "decision",
          id: "node",
          player: "A",
          actions: ["x", "y"],
          informationSet: "node",
          children: [
            { kind: "terminal", id: "leaf", payoffs: [rational(1n)] },
            { kind: "terminal", id: "leaf", payoffs: [rational(0n)] },
          ],
        },
      }),
    ).toThrow(/duplicate node id/i);
  });

  it("rejects a decision node whose action count and child count disagree", () => {
    expect(() =>
      createExtensiveGame({
        id: "mismatch",
        title: "mismatch",
        players: ["A"],
        root: {
          kind: "decision",
          id: "root",
          player: "A",
          actions: ["only"],
          informationSet: "root",
          children: [
            { kind: "terminal", id: "l1", payoffs: [rational(1n)] },
            { kind: "terminal", id: "l2", payoffs: [rational(0n)] },
          ],
        },
      }),
    ).toThrow(/actions but/);
  });

  it("rejects a terminal whose payoff count does not match players", () => {
    expect(() =>
      createExtensiveGame({
        id: "wide",
        title: "wide",
        players: ["A", "B"],
        root: { kind: "terminal", id: "solo", payoffs: [rational(0n)] },
      }),
    ).toThrow(/payoffs/);
  });

  it("rejects a decision node referencing an unknown player", () => {
    expect(() =>
      createExtensiveGame({
        id: "unknown",
        title: "unknown",
        players: ["A"],
        root: {
          kind: "decision",
          id: "root",
          player: "Z",
          actions: ["x"],
          informationSet: "root",
          children: [{ kind: "terminal", id: "l", payoffs: [rational(0n)] }],
        },
      }),
    ).toThrow(/unknown player/i);
  });

  it("rejects games with empty ids or duplicate players", () => {
    expect(() =>
      createExtensiveGame({
        id: "",
        title: "no",
        players: ["A"],
        root: { kind: "terminal", id: "leaf", payoffs: [rational(0n)] },
      }),
    ).toThrow(/non-empty id/i);
    expect(() =>
      createExtensiveGame({
        id: "dupplayer",
        title: "dupplayer",
        players: ["A", "A"],
        root: {
          kind: "terminal",
          id: "leaf",
          payoffs: [rational(0n), rational(0n)],
        },
      }),
    ).toThrow(/unique/i);
  });

  it("rejects a decision node with zero or duplicate action labels", () => {
    expect(() =>
      createExtensiveGame({
        id: "empty-actions",
        title: "empty",
        players: ["A"],
        root: {
          kind: "decision",
          id: "root",
          player: "A",
          actions: [],
          informationSet: "root",
          children: [],
        },
      }),
    ).toThrow(/at least one action/i);
    expect(() =>
      createExtensiveGame({
        id: "dup-actions",
        title: "dup",
        players: ["A"],
        root: {
          kind: "decision",
          id: "root",
          player: "A",
          actions: ["x", "x"],
          informationSet: "root",
          children: [
            { kind: "terminal", id: "l1", payoffs: [rational(0n)] },
            { kind: "terminal", id: "l2", payoffs: [rational(1n)] },
          ],
        },
      }),
    ).toThrow(/unique/i);
  });

  it("findNode throws for a missing id", () => {
    expect(() => findNode(localEntryDeterrence(), "no-such")).toThrow(
      /not found/,
    );
  });
});

describe("backward induction on a hand-built entry-deterrence tree", () => {
  const game = localEntryDeterrence();
  const result = backwardInduction(game);

  it("selects In at the root and Accommodate at the second decision", () => {
    expect(result.strategy.get("p1-move")).toBe(0);
    expect(result.strategy.get("p2-move")).toBe(1);
  });

  it("yields on-path payoffs (1, 1)", () => {
    expect(payoffsAsInts(result.payoffs)).toEqual([1, 1]);
  });

  it("walks the SPNE path root → second decision → accommodate terminal", () => {
    expect(result.path).toEqual(["p1-move", "p2-move", "accommodate"]);
  });

  it("emits a post-order induction trace ending at the root", () => {
    const trace = inductionTrace(game);
    expect(trace.map((step) => step.nodeId)).toEqual(["p2-move", "p1-move"]);
    expect(trace[0].player).toBe("P2");
    expect(trace[0].chosenAction).toBe("Accommodate");
    expect(trace[0].chosenIndex).toBe(1);
    expect(trace[1].player).toBe("P1");
    expect(trace[1].chosenAction).toBe("In");
  });
});

describe("SPNE verifier", () => {
  it("accepts the backward-induction strategy", () => {
    const game = localEntryDeterrence();
    const { strategy } = backwardInduction(game);
    const verdict = verifySubgamePerfect(game, strategy);
    expect(verdict).toEqual({ isSubgamePerfect: true, violation: null });
  });

  it("rejects the (Out, Fight) Nash equilibrium as not subgame-perfect", () => {
    const game = localEntryDeterrence();
    const threat = new Map<string, number>([
      ["p1-move", 1],
      ["p2-move", 0],
    ]);
    const verdict = verifySubgamePerfect(game, threat);
    expect(verdict.isSubgamePerfect).toBe(false);
    expect(verdict.violation).toEqual({
      nodeId: "p2-move",
      player: "P2",
      chosenIndex: 0,
      betterIndex: 1,
    });
  });

  it("payoffsUnder threads the strategy through the tree", () => {
    const game = localEntryDeterrence();
    const threat = new Map<string, number>([
      ["p1-move", 1],
      ["p2-move", 0],
    ]);
    const rationals = payoffsUnder(game, threat);
    expect(rationals.map(formatRational)).toEqual(["0", "2"]);
  });

  it("payoffsUnder throws on an incomplete strategy", () => {
    const game = localEntryDeterrence();
    expect(() => payoffsUnder(game, new Map())).toThrow(/missing node/);
  });

  it("verifier flags a missing action for the reached node", () => {
    const game = localEntryDeterrence();
    const partial = new Map<string, number>([["p1-move", 0]]);
    const verdict = verifySubgamePerfect(game, partial);
    expect(verdict.isSubgamePerfect).toBe(false);
    expect(verdict.violation?.nodeId).toBe("p2-move");
    expect(verdict.violation?.chosenIndex).toBe(-1);
  });

  it("verifier reports the first strict-deviation opportunity even mid-tree", () => {
    const game = localEntryDeterrence();
    const bad = new Map<string, number>([
      ["p1-move", 0],
      ["p2-move", 0],
    ]);
    const verdict = verifySubgamePerfect(game, bad);
    expect(verdict.isSubgamePerfect).toBe(false);
    expect(verdict.violation?.nodeId).toBe("p2-move");
  });
});

// ------------ Property test: BI strategy always verifies -----------------

interface RandomTreeSpec {
  readonly depthLimit: number;
  readonly playerCount: number;
  readonly maxActions: number;
}

type RandomNode =
  | { readonly kind: "terminal"; readonly payoffs: readonly number[] }
  | {
      readonly kind: "decision";
      readonly player: number;
      readonly children: readonly RandomNode[];
    };

function terminalArb(spec: RandomTreeSpec): fc.Arbitrary<RandomNode> {
  return fc
    .array(fc.integer({ min: -8, max: 8 }), {
      minLength: spec.playerCount,
      maxLength: spec.playerCount,
    })
    .map(
      (payoffs) =>
        ({
          kind: "terminal" as const,
          payoffs,
        }) satisfies RandomNode,
    );
}

function nodeArb(
  spec: RandomTreeSpec,
  remainingDepth: number,
): fc.Arbitrary<RandomNode> {
  if (remainingDepth === 0) {
    return terminalArb(spec);
  }
  const decision: fc.Arbitrary<RandomNode> = fc
    .record({
      player: fc.integer({ min: 0, max: spec.playerCount - 1 }),
      actionCount: fc.integer({ min: 2, max: spec.maxActions }),
    })
    .chain(({ player, actionCount }) =>
      fc
        .array(nodeArb(spec, remainingDepth - 1), {
          minLength: actionCount,
          maxLength: actionCount,
        })
        .map(
          (children) =>
            ({
              kind: "decision" as const,
              player,
              children,
            }) satisfies RandomNode,
        ),
    );
  return fc.oneof(
    { arbitrary: terminalArb(spec), weight: 1 },
    { arbitrary: decision, weight: 3 },
  );
}

function makeRandomTree(spec: RandomTreeSpec): fc.Arbitrary<RandomNode> {
  return nodeArb(spec, spec.depthLimit);
}

function materialize(
  node: RandomNode,
  playerNames: readonly string[],
  seed: { next: number },
): GameNode {
  const id = `n${seed.next++}`;
  if (node.kind === "terminal") {
    return {
      kind: "terminal",
      id,
      payoffs: node.payoffs.map((value) => rational(BigInt(value))),
    };
  }
  const children = node.children.map((child) =>
    materialize(child, playerNames, seed),
  );
  const actions = children.map((_, index) => `a${index}`);
  return {
    kind: "decision",
    id,
    player: playerNames[node.player],
    actions,
    informationSet: id,
    children,
  };
}

describe("backward induction: property against the independent verifier", () => {
  it("SPNE strategies produced by BI always pass the verifier (soundness)", () => {
    fc.assert(
      fc.property(
        makeRandomTree({ depthLimit: 3, playerCount: 2, maxActions: 3 }),
        (raw) => {
          const players = ["P1", "P2"];
          const seed = { next: 0 };
          const root = materialize(raw as RandomNode, players, seed);
          const game: ExtensiveGame = createExtensiveGame({
            id: "rand",
            title: "rand",
            players,
            root,
          });
          const { strategy, payoffs } = backwardInduction(game);
          const verdict = verifySubgamePerfect(game, strategy);
          expect(verdict.isSubgamePerfect).toBe(true);
          const under = payoffsUnder(game, strategy);
          expect(under.length).toBe(payoffs.length);
          for (let index = 0; index < under.length; index += 1) {
            expect(equals(under[index], payoffs[index])).toBe(true);
          }
        },
      ),
      { numRuns: 60 },
    );
  });

  it("perturbing any decision-node choice to a strictly worse action fails verification at that node", () => {
    fc.assert(
      fc.property(
        makeRandomTree({ depthLimit: 3, playerCount: 2, maxActions: 3 }),
        fc.integer({ min: 0, max: 15 }),
        (raw, pickSeed) => {
          const players = ["P1", "P2"];
          const seed = { next: 0 };
          const rootNode = materialize(raw as RandomNode, players, seed);
          const game: ExtensiveGame = createExtensiveGame({
            id: "rand2",
            title: "rand2",
            players,
            root: rootNode,
          });
          const { strategy } = backwardInduction(game);
          const nodes = decisionNodes(game);
          if (nodes.length === 0) return;

          const target = nodes[pickSeed % nodes.length];
          const chosen = strategy.get(target.id) ?? 0;
          const playerIndex = game.players.indexOf(target.player);

          const childPayoffs = target.children.map((_, index) => {
            const swapped = new Map(strategy);
            swapped.set(target.id, index);
            return payoffsUnder(game, swapped)[playerIndex];
          });

          let strictlyWorse = -1;
          for (let index = 0; index < childPayoffs.length; index += 1) {
            if (index === chosen) continue;
            if (compare(childPayoffs[index], childPayoffs[chosen]) === -1) {
              strictlyWorse = index;
              break;
            }
          }
          if (strictlyWorse === -1) return;

          const bad = new Map(strategy);
          bad.set(target.id, strictlyWorse);
          const verdict = verifySubgamePerfect(game, bad);
          expect(verdict.isSubgamePerfect).toBe(false);
          expect(verdict.violation?.nodeId).toBe(target.id);
          expect(verdict.violation?.betterIndex).toBeGreaterThanOrEqual(0);
        },
      ),
      { numRuns: 60 },
    );
  });
});
