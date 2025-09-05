import { compare, type Rational } from "@/engine/rational";
import type { ExtensiveGame, GameNode } from "@/engine/extensive/tree";

/** A pure strategy: for each decision-node id, the action index the player takes. */
export type PureStrategy = ReadonlyMap<string, number>;

export interface SPNEResult {
  /** Payoffs at the SPNE outcome, indexed to match `game.players`. */
  readonly payoffs: readonly Rational[];
  /** Full pure strategy for every decision node in the tree. */
  readonly strategy: PureStrategy;
  /** Node ids traversed along the SPNE path, root → terminal. */
  readonly path: readonly string[];
}

/**
 * Computes the subgame-perfect equilibrium of a perfect-information extensive-form
 * game by backward induction. Ties in a player's continuation payoff resolve to the
 * lowest action index — the choice is deterministic given the tree.
 */
export function backwardInduction(game: ExtensiveGame): SPNEResult {
  const strategy = new Map<string, number>();
  const rootPayoffs = solve(game.root, game, strategy);
  const path = walkPath(game.root, strategy);
  return { payoffs: rootPayoffs, strategy, path };
}

function solve(
  node: GameNode,
  game: ExtensiveGame,
  strategy: Map<string, number>,
): readonly Rational[] {
  if (node.kind === "terminal") {
    return node.payoffs;
  }
  const childPayoffs = node.children.map((child) =>
    solve(child, game, strategy),
  );
  const playerIndex = game.players.indexOf(node.player);
  if (playerIndex < 0) {
    throw new TypeError(`Player ${node.player} is not in ${game.id}.`);
  }
  let bestIndex = 0;
  for (let index = 1; index < childPayoffs.length; index += 1) {
    const candidate = childPayoffs[index][playerIndex];
    const incumbent = childPayoffs[bestIndex][playerIndex];
    if (compare(candidate, incumbent) === 1) {
      bestIndex = index;
    }
  }
  strategy.set(node.id, bestIndex);
  return childPayoffs[bestIndex];
}

function walkPath(root: GameNode, strategy: PureStrategy): string[] {
  const path: string[] = [];
  let current: GameNode = root;
  while (true) {
    path.push(current.id);
    if (current.kind === "terminal") return path;
    const chosen = strategy.get(current.id);
    if (chosen === undefined) {
      throw new RangeError(`Strategy is missing node ${current.id}.`);
    }
    current = current.children[chosen];
  }
}

/**
 * Records what happens at each decision node when backward induction runs, so
 * the UI can render a discrete step-by-step reveal (like IESDS in the normal-form
 * drawer). Order is post-order: every child is fully explained before its parent.
 */
export interface InductionStep {
  readonly nodeId: string;
  readonly player: string;
  readonly chosenAction: string;
  readonly chosenIndex: number;
  readonly childPayoffs: ReadonlyMap<number, readonly Rational[]>;
}

export function inductionTrace(game: ExtensiveGame): InductionStep[] {
  const steps: InductionStep[] = [];
  const walk = (node: GameNode): readonly Rational[] => {
    if (node.kind === "terminal") return node.payoffs;
    const childPayoffs = new Map<number, readonly Rational[]>();
    node.children.forEach((child, index) => {
      childPayoffs.set(index, walk(child));
    });
    const playerIndex = game.players.indexOf(node.player);
    let bestIndex = 0;
    for (let index = 1; index < node.children.length; index += 1) {
      const candidate = childPayoffs.get(index)![playerIndex];
      const incumbent = childPayoffs.get(bestIndex)![playerIndex];
      if (compare(candidate, incumbent) === 1) {
        bestIndex = index;
      }
    }
    steps.push({
      nodeId: node.id,
      player: node.player,
      chosenAction: node.actions[bestIndex],
      chosenIndex: bestIndex,
      childPayoffs,
    });
    return childPayoffs.get(bestIndex)!;
  };
  walk(game.root);
  return steps;
}
