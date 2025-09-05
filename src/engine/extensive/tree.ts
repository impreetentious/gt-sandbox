import type { Rational } from "@/engine/rational";

/** Immutable player identifier — a display label doubles as the id. */
export type PlayerId = string;

/**
 * Information-set identifier. Unused in V2-P1 (all games are perfect-information;
 * every decision node has its own singleton set) but reserved on the node so an
 * imperfect-information game can land in a later V2 phase without a type change.
 */
export type InformationSetId = string;

export interface DecisionNode {
  readonly kind: "decision";
  readonly id: string;
  readonly player: PlayerId;
  readonly actions: readonly string[];
  readonly children: readonly GameNode[];
  readonly informationSet: InformationSetId;
}

export interface TerminalNode {
  readonly kind: "terminal";
  readonly id: string;
  /** Payoffs indexed to match `ExtensiveGame.players`. */
  readonly payoffs: readonly Rational[];
}

export type GameNode = DecisionNode | TerminalNode;

export interface ExtensiveGame {
  readonly id: string;
  readonly title: string;
  readonly players: readonly PlayerId[];
  readonly root: GameNode;
}

function collectIds(node: GameNode, out: Set<string>): void {
  if (out.has(node.id)) {
    throw new TypeError(`Duplicate node id: ${node.id}`);
  }
  out.add(node.id);
  if (node.kind === "decision") {
    if (node.actions.length !== node.children.length) {
      throw new RangeError(
        `Decision node ${node.id} has ${node.actions.length} actions but ${node.children.length} children.`,
      );
    }
    if (node.actions.length === 0) {
      throw new RangeError(
        `Decision node ${node.id} must have at least one action.`,
      );
    }
    if (new Set(node.actions).size !== node.actions.length) {
      throw new TypeError(
        `Decision node ${node.id} action labels must be unique.`,
      );
    }
    for (const child of node.children) {
      collectIds(child, out);
    }
  }
}

/** Validates an extensive-form game and returns it unchanged if it passes. */
export function createExtensiveGame(input: ExtensiveGame): ExtensiveGame {
  if (input.id.trim() === "" || input.title.trim() === "") {
    throw new TypeError(
      "Extensive-form games require a non-empty id and title.",
    );
  }
  if (input.players.length < 1) {
    throw new RangeError("Extensive-form games require at least one player.");
  }
  if (new Set(input.players).size !== input.players.length) {
    throw new TypeError("Player ids must be unique.");
  }

  const ids = new Set<string>();
  collectIds(input.root, ids);

  const knownPlayers = new Set(input.players);
  validatePlayersAndPayoffs(input.root, knownPlayers, input.players.length);

  return input;
}

function validatePlayersAndPayoffs(
  node: GameNode,
  knownPlayers: Set<PlayerId>,
  playerCount: number,
): void {
  if (node.kind === "terminal") {
    if (node.payoffs.length !== playerCount) {
      throw new RangeError(
        `Terminal ${node.id} has ${node.payoffs.length} payoffs; expected ${playerCount}.`,
      );
    }
    return;
  }
  if (!knownPlayers.has(node.player)) {
    throw new TypeError(
      `Decision node ${node.id} references unknown player ${node.player}.`,
    );
  }
  for (const child of node.children) {
    validatePlayersAndPayoffs(child, knownPlayers, playerCount);
  }
}

export function decisionNodes(game: ExtensiveGame): DecisionNode[] {
  const nodes: DecisionNode[] = [];
  const walk = (node: GameNode): void => {
    if (node.kind === "terminal") return;
    nodes.push(node);
    node.children.forEach(walk);
  };
  walk(game.root);
  return nodes;
}

export function terminals(game: ExtensiveGame): TerminalNode[] {
  const out: TerminalNode[] = [];
  const walk = (node: GameNode): void => {
    if (node.kind === "terminal") {
      out.push(node);
      return;
    }
    node.children.forEach(walk);
  };
  walk(game.root);
  return out;
}

export function findNode(game: ExtensiveGame, id: string): GameNode {
  const walk = (node: GameNode): GameNode | null => {
    if (node.id === id) return node;
    if (node.kind === "terminal") return null;
    for (const child of node.children) {
      const found = walk(child);
      if (found) return found;
    }
    return null;
  };
  const result = walk(game.root);
  if (!result) throw new RangeError(`Node ${id} not found in ${game.id}.`);
  return result;
}
