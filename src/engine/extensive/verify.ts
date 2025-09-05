import { compare, type Rational } from "@/engine/rational";
import type { PureStrategy } from "@/engine/extensive/backward-induction";
import type { ExtensiveGame, GameNode } from "@/engine/extensive/tree";

export interface SPNEVerdict {
  readonly isSubgamePerfect: boolean;
  /** First subgame at which the strategy is not a best response, if any. */
  readonly violation: {
    readonly nodeId: string;
    readonly player: string;
    readonly chosenIndex: number;
    readonly betterIndex: number;
  } | null;
}

/**
 * Independent SPNE checker: at every decision node, verifies that the strategy's
 * chosen action produces the maximum player-payoff over all alternatives, taking
 * the strategy as fixed in every subtree. Perfect-information trees only.
 */
export function verifySubgamePerfect(
  game: ExtensiveGame,
  strategy: PureStrategy,
): SPNEVerdict {
  let violation: SPNEVerdict["violation"] = null;

  const walk = (node: GameNode): readonly Rational[] => {
    if (node.kind === "terminal") return node.payoffs;
    const childPayoffs = node.children.map(walk);

    if (violation) return childPayoffs[strategy.get(node.id) ?? 0];

    const chosen = strategy.get(node.id);
    if (chosen === undefined) {
      violation = {
        nodeId: node.id,
        player: node.player,
        chosenIndex: -1,
        betterIndex: -1,
      };
      return childPayoffs[0];
    }
    const playerIndex = game.players.indexOf(node.player);
    if (playerIndex < 0) {
      throw new TypeError(`Player ${node.player} is not in ${game.id}.`);
    }
    for (let index = 0; index < node.children.length; index += 1) {
      if (index === chosen) continue;
      if (
        compare(
          childPayoffs[index][playerIndex],
          childPayoffs[chosen][playerIndex],
        ) === 1
      ) {
        violation = {
          nodeId: node.id,
          player: node.player,
          chosenIndex: chosen,
          betterIndex: index,
        };
        return childPayoffs[chosen];
      }
    }
    return childPayoffs[chosen];
  };

  walk(game.root);
  return { isSubgamePerfect: violation === null, violation };
}

/** Convenience: full payoff vector at the terminal reached by following `strategy` from the root. */
export function payoffsUnder(
  game: ExtensiveGame,
  strategy: PureStrategy,
): readonly Rational[] {
  const walk = (node: GameNode): readonly Rational[] => {
    if (node.kind === "terminal") return node.payoffs;
    const chosen = strategy.get(node.id);
    if (chosen === undefined) {
      throw new RangeError(`Strategy is missing node ${node.id}.`);
    }
    return walk(node.children[chosen]);
  };
  return walk(game.root);
}
