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
  // Two-pass layout: compute subtree widths, then assign x coordinates.
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

function playAgainstRival(
  root: GameNode,
  entrantChoice: number,
  rivalStrategy: ReadonlyMap<string, number>,
): { path: string[]; terminal: GameNode } {
  const path: string[] = [];
  let current: GameNode = root;
  let entrantMoved = false;
  while (current.kind !== "terminal") {
    path.push(current.id);
    const chosen = entrantMoved
      ? (rivalStrategy.get(current.id) ?? 0)
      : entrantChoice;
    entrantMoved = true;
    current = current.children[chosen];
  }
  path.push(current.id);
  return { path, terminal: current };
}

export function ExtensivePlayExperience({ slug }: Props) {
  const entry = extensiveCatalogBySlug[slug];
  const content = extensiveContent[slug];
  const game = entry.game;

  const [rivalId, setRivalId] = useState(content.rivals[0].id);
  const [entrantChoice, setEntrantChoice] = useState<number | null>(null);

  const rival =
    content.rivals.find((r) => r.id === rivalId) ?? content.rivals[0];

  const layout = useMemo(() => layoutTree(game.root), [game.root]);
  const spne = useMemo(() => backwardInduction(game), [game]);
  const entrantNode = game.root as DecisionNode;

  const outcome =
    entrantChoice === null
      ? null
      : playAgainstRival(game.root, entrantChoice, rival.strategy);
  const spnePath = new Set(spne.path);
  const currentPath = new Set(outcome?.path ?? []);
  const terminalPayoffs =
    outcome && outcome.terminal.kind === "terminal"
      ? outcome.terminal.payoffs
      : null;

  const unitWidth = Math.max(layout.width, 1);
  const unitHeight = Math.max(layout.height, 1);
  const svgWidth = 320;
  const svgHeight = 220;
  const px = (units: number) => 16 + (units / unitWidth) * (svgWidth - 32);
  const py = (units: number) => 24 + (units / unitHeight) * (svgHeight - 48);

  function handleEntrantChoice(index: number) {
    setEntrantChoice(index);
  }
  function reset() {
    setEntrantChoice(null);
  }

  return (
    <section
      aria-labelledby="extensive-title"
      className="extensive-session"
      data-round={entrantChoice === null ? 0 : 1}
      data-slug={slug}
    >
      <header className="extensive-session__header">
        <p className="eyebrow">Extensive form / {entry.concept}</p>
        <h1 className="display" id="extensive-title">
          {game.title}
        </h1>
        <p className="lede">{content.framing}</p>
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
              pair at each terminal is (Entrant, Incumbent).
            </p>
          </div>
          <svg
            aria-label={`Game tree for ${game.title} — decision nodes are circles labelled with the player who chooses; terminals are squares with the payoff pair.`}
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
                      {node.player[0]}
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
          <table className="extensive-session__terminals">
            <caption>
              Every terminal of the tree, with its exact payoff pair.
            </caption>
            <thead>
              <tr>
                <th scope="col">Terminal</th>
                <th scope="col">Entrant</th>
                <th scope="col">Incumbent</th>
              </tr>
            </thead>
            <tbody>
              {layout.nodes
                .filter((layoutNode) => layoutNode.node.kind === "terminal")
                .map((layoutNode) => {
                  const node = layoutNode.node as GameNode & {
                    kind: "terminal";
                  };
                  const parentEdge = layout.edges.find(
                    (edge) => edge.to.node.id === node.id,
                  );
                  const grandparentEdge = parentEdge
                    ? layout.edges.find(
                        (edge) => edge.to.node.id === parentEdge.from.node.id,
                      )
                    : undefined;
                  const label = grandparentEdge
                    ? `${grandparentEdge.label} → ${parentEdge!.label}`
                    : (parentEdge?.label ?? node.id);
                  return (
                    <tr key={node.id}>
                      <th scope="row">{label}</th>
                      <td>{formatRational(node.payoffs[0])}</td>
                      <td>{formatRational(node.payoffs[1])}</td>
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
          <h2 id="extensive-controls-title">Play as the Entrant</h2>
          <fieldset className="extensive-session__rival">
            <legend>Incumbent policy</legend>
            {content.rivals.map((option) => (
              <label key={option.id}>
                <input
                  checked={rivalId === option.id}
                  name="incumbent-policy"
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

          <div className="extensive-session__buttons">
            {entrantNode.actions.map((action, index) => (
              <button
                aria-pressed={entrantChoice === index}
                className="extensive-session__choice"
                disabled={entrantChoice !== null}
                key={action}
                onClick={() => handleEntrantChoice(index)}
                type="button"
              >
                {action}
              </button>
            ))}
          </div>

          <p aria-live="polite" className="extensive-session__narration">
            {outcome && terminalPayoffs
              ? `You played ${entrantNode.actions[entrantChoice!]}. Outcome: Entrant ${formatRational(terminalPayoffs[0])}, Incumbent ${formatRational(terminalPayoffs[1])}.`
              : "Choose to enter the market or stay out."}
          </p>

          {outcome ? (
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
