"use client";

import { useMemo, useState } from "react";
import { SPNEPanel } from "@/components/analysis/spne-panel";
import { extensiveContent } from "@/content/extensive";
import {
  extensiveCatalogBySlug,
  type ExtensiveSlug,
} from "@/engine/catalog/extensive";
import {
  backwardInduction,
  type DecisionNode,
  type GameNode,
  type TerminalNode,
} from "@/engine/extensive";
import { formatRational, type Rational } from "@/engine/rational";

interface Props {
  readonly slug: ExtensiveSlug;
}

interface NodeLayout {
  readonly node: GameNode;
  readonly x: number;
  readonly y: number;
  readonly depth: number;
}

interface EdgeLayout {
  readonly from: NodeLayout;
  readonly to: NodeLayout;
  readonly label: string;
  readonly actionIndex: number;
}

function layoutTree(root: GameNode): {
  nodes: NodeLayout[];
  edges: EdgeLayout[];
  width: number;
  height: number;
} {
  const widthCache = new Map<string, number>();
  const width = (node: GameNode): number => {
    if (widthCache.has(node.id)) return widthCache.get(node.id)!;
    if (node.kind === "terminal") {
      widthCache.set(node.id, 1);
      return 1;
    }
    const total = node.children.reduce((sum, child) => sum + width(child), 0);
    widthCache.set(node.id, total);
    return total;
  };
  width(root);

  const nodes: NodeLayout[] = [];
  const edges: EdgeLayout[] = [];
  const layoutRec = (
    node: GameNode,
    depth: number,
    leftUnits: number,
  ): NodeLayout => {
    const w = widthCache.get(node.id)!;
    const centerUnits = leftUnits + w / 2;
    const layout: NodeLayout = { node, depth, x: centerUnits, y: depth };
    nodes.push(layout);
    if (node.kind === "decision") {
      let cursor = leftUnits;
      node.children.forEach((child, index) => {
        const childLayout = layoutRec(child, depth + 1, cursor);
        cursor += widthCache.get(child.id)!;
        edges.push({
          from: layout,
          to: childLayout,
          label: node.actions[index],
          actionIndex: index,
        });
      });
    }
    return layout;
  };
  layoutRec(root, 0, 0);

  const maxDepth = Math.max(...nodes.map((node) => node.depth));
  const unitWidth = widthCache.get(root.id)!;

  return {
    nodes,
    edges,
    width: unitWidth,
    height: maxDepth,
  };
}

function payoffLabel(payoffs: readonly Rational[]): string {
  return `(${payoffs.map(formatRational).join(", ")})`;
}

function isDecision(node: GameNode): node is DecisionNode {
  return node.kind === "decision";
}

function isTerminal(node: GameNode): node is TerminalNode {
  return node.kind === "terminal";
}

interface WalkResult {
  readonly path: readonly string[];
  readonly awaitingNode: DecisionNode | null;
  readonly terminal: TerminalNode | null;
}

function walkGame(
  root: GameNode,
  userPlayer: string,
  userChoices: ReadonlyMap<string, number>,
  rivalStrategy: ReadonlyMap<string, number>,
): WalkResult {
  const path: string[] = [];
  let current: GameNode = root;
  while (true) {
    path.push(current.id);
    if (isTerminal(current)) {
      return { path, awaitingNode: null, terminal: current };
    }
    let chosen: number | undefined;
    if (current.player === userPlayer) {
      chosen = userChoices.get(current.id);
      if (chosen === undefined) {
        return { path, awaitingNode: current, terminal: null };
      }
    } else {
      chosen = rivalStrategy.get(current.id) ?? 0;
    }
    current = current.children[chosen];
  }
}

/** Ordered short labels (1-based) — always unique even when player names share a first letter. */
function playerShortLabels(players: readonly string[]): readonly string[] {
  return players.map((_, index) => String(index + 1));
}

export function ExtensivePlayExperience({ slug }: Props) {
  const entry = extensiveCatalogBySlug[slug];
  const content = extensiveContent[slug];
  const game = entry.game;

  const [rivalId, setRivalId] = useState(content.rivals[0].id);
  const [userChoices, setUserChoices] = useState<ReadonlyMap<string, number>>(
    () => new Map(),
  );

  const rival =
    content.rivals.find((r) => r.id === rivalId) ?? content.rivals[0];

  const layout = useMemo(() => layoutTree(game.root), [game.root]);
  const spne = useMemo(() => backwardInduction(game), [game]);
  const shortLabels = useMemo(
    () => playerShortLabels(game.players),
    [game.players],
  );

  const walk = walkGame(
    game.root,
    content.userPlayer,
    userChoices,
    rival.strategy,
  );
  const isComplete = walk.terminal !== null;
  const spnePath = useMemo(() => new Set(spne.path), [spne.path]);
  const currentPath = new Set(walk.path);
  const terminalPayoffs = walk.terminal?.payoffs ?? null;
  const roundCount = userChoices.size;

  const unitWidth = Math.max(layout.width, 1);
  const unitHeight = Math.max(layout.height, 1);
  const svgWidth = Math.max(320, unitWidth * 34);
  const svgHeight = Math.max(220, unitHeight * 60 + 40);
  const px = (units: number) => 16 + (units / unitWidth) * (svgWidth - 32);
  const py = (units: number) => 24 + (units / unitHeight) * (svgHeight - 48);

  function handleChoice(nodeId: string, index: number) {
    setUserChoices((prev) => {
      const next = new Map(prev);
      next.set(nodeId, index);
      return next;
    });
  }
  function reset() {
    setUserChoices(new Map());
  }

  const outcomeSentence = terminalPayoffs
    ? `Outcome: ${game.players
        .map(
          (name, index) => `${name} ${formatRational(terminalPayoffs[index])}`,
        )
        .join(", ")}.`
    : null;
  const promptSentence =
    walk.awaitingNode === null
      ? content.initialPrompt
      : roundCount === 0
        ? content.initialPrompt
        : `Your turn: choose ${walk.awaitingNode.actions.join(" or ")}.`;

  const dataPhase = isComplete
    ? "complete"
    : walk.awaitingNode
      ? "awaiting-user"
      : "in-progress";

  return (
    <section
      aria-labelledby="extensive-title"
      className="extensive-session"
      data-phase={dataPhase}
      data-round={roundCount}
      data-slug={slug}
    >
      <header className="extensive-session__header">
        <p className="eyebrow">Extensive form / {entry.concept}</p>
        <h1 className="display" id="extensive-title">
          {game.title}
        </h1>
        <p className="lede">{content.framing}</p>
        <p className="extensive-session__legend">
          <strong>{content.playerLegend.user}</strong>{" "}
          {content.playerLegend.rival}
        </p>
      </header>

      <div className="extensive-session__layout">
        <section
          aria-labelledby="extensive-tree-title"
          className="extensive-session__tree"
        >
          <div className="extensive-session__tree-heading">
            <h2 id="extensive-tree-title">The game tree</h2>
            <p>
              Every path from the root to a terminal is a possible play. The
              pair at each terminal is {content.payoffPairLabel}.
            </p>
          </div>
          <div className="extensive-session__tree-scroll">
            <svg
              aria-label={`Game tree for ${game.title} — decision nodes are circles labelled with the player number who chooses; terminals are squares with the payoff pair.`}
              className="extensive-tree"
              role="img"
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            >
              {layout.edges.map((edge) => {
                const highlighted =
                  currentPath.has(edge.from.node.id) &&
                  currentPath.has(edge.to.node.id);
                const spneEdge =
                  spnePath.has(edge.from.node.id) &&
                  spnePath.has(edge.to.node.id);
                const midX = (px(edge.from.x) + px(edge.to.x)) / 2;
                const midY = (py(edge.from.y) + py(edge.to.y)) / 2;
                return (
                  <g
                    key={`${edge.from.node.id}-${edge.to.node.id}`}
                    data-highlight={
                      highlighted ? "current" : spneEdge ? "spne" : "none"
                    }
                  >
                    <line
                      className="extensive-tree__edge"
                      x1={px(edge.from.x)}
                      x2={px(edge.to.x)}
                      y1={py(edge.from.y)}
                      y2={py(edge.to.y)}
                    />
                    <text
                      className="extensive-tree__edge-label"
                      dominantBaseline="middle"
                      textAnchor="middle"
                      x={midX}
                      y={midY - 4}
                    >
                      {edge.label}
                    </text>
                  </g>
                );
              })}
              {layout.nodes.map((layoutNode) => {
                const { node } = layoutNode;
                const highlighted = currentPath.has(node.id);
                const onSpne = spnePath.has(node.id);
                const cx = px(layoutNode.x);
                const cy = py(layoutNode.y);
                if (isDecision(node)) {
                  const playerIndex = game.players.indexOf(node.player);
                  return (
                    <g
                      data-highlight={
                        highlighted ? "current" : onSpne ? "spne" : "none"
                      }
                      data-testid={`tree-node-${node.id}`}
                      key={node.id}
                    >
                      <circle
                        className="extensive-tree__decision"
                        cx={cx}
                        cy={cy}
                        r={11}
                      />
                      <text
                        className="extensive-tree__decision-label"
                        dominantBaseline="middle"
                        textAnchor="middle"
                        x={cx}
                        y={cy}
                      >
                        {shortLabels[playerIndex]}
                      </text>
                    </g>
                  );
                }
                return (
                  <g
                    data-highlight={
                      highlighted ? "current" : onSpne ? "spne" : "none"
                    }
                    data-testid={`tree-node-${node.id}`}
                    key={node.id}
                  >
                    <rect
                      className="extensive-tree__terminal"
                      height={16}
                      rx={2}
                      width={44}
                      x={cx - 22}
                      y={cy - 8}
                    />
                    <text
                      className="extensive-tree__terminal-label"
                      dominantBaseline="middle"
                      textAnchor="middle"
                      x={cx}
                      y={cy}
                    >
                      {payoffLabel(node.payoffs)}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
          <table className="extensive-session__terminals">
            <caption>
              Every terminal of the tree, with its exact payoff pair.
            </caption>
            <thead>
              <tr>
                <th scope="col">Terminal</th>
                {game.players.map((name) => (
                  <th key={name} scope="col">
                    {name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {layout.nodes
                .filter((layoutNode) => isTerminal(layoutNode.node))
                .map((layoutNode) => {
                  const node = layoutNode.node as TerminalNode;
                  return (
                    <tr key={node.id}>
                      <th scope="row">{node.id}</th>
                      {node.payoffs.map((value, index) => (
                        <td key={index}>{formatRational(value)}</td>
                      ))}
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </section>

        <section
          aria-labelledby="extensive-controls-title"
          className="extensive-session__controls"
        >
          <h2 id="extensive-controls-title">Play as {content.userPlayer}</h2>
          <fieldset className="extensive-session__rival">
            <legend>{content.rivalLegend}</legend>
            {content.rivals.map((option) => (
              <label key={option.id}>
                <input
                  checked={rivalId === option.id}
                  name="extensive-rival-policy"
                  onChange={() => {
                    setRivalId(option.id);
                    reset();
                  }}
                  type="radio"
                  value={option.id}
                />
                <span>
                  <strong>{option.label}.</strong> {option.description}
                </span>
              </label>
            ))}
          </fieldset>

          {walk.awaitingNode ? (
            <div className="extensive-session__buttons">
              {walk.awaitingNode.actions.map((action, index) => {
                const node = walk.awaitingNode!;
                return (
                  <button
                    aria-pressed={false}
                    className="extensive-session__choice"
                    key={`${node.id}-${action}`}
                    onClick={() => handleChoice(node.id, index)}
                    type="button"
                  >
                    {action}
                  </button>
                );
              })}
            </div>
          ) : null}

          <p aria-live="polite" className="extensive-session__narration">
            {isComplete && outcomeSentence ? outcomeSentence : promptSentence}
          </p>

          {isComplete ? (
            <button
              className="extensive-session__reset"
              onClick={reset}
              type="button"
            >
              Play again
            </button>
          ) : null}

          <details className="analysis-drawer extensive-session__analysis">
            <summary>Analysis / Extensive form</summary>
            <SPNEPanel
              game={game}
              oracle={entry.oracle}
              reveal={content.reveal}
            />
          </details>
        </section>
      </div>
    </section>
  );
}
