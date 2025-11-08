import { createNormalFormGame, type NormalFormGame } from "@/engine/game";
import { classifyTwoByTwo, type StrategicStructure } from "@/engine/solve/classify";

export interface OrdinalTopologyGame {
  readonly id: string;
  readonly game: NormalFormGame;
  readonly structure: StrategicStructure;
  /** Search terms are deliberately derived, so filters never drift from the solver. */
  readonly concepts: readonly string[];
}

function permutations(values: readonly number[]): number[][] {
  if (values.length === 0) return [[]];
  return values.flatMap((value, index) =>
    permutations([...values.slice(0, index), ...values.slice(index + 1)]).map((tail) => [
      value,
      ...tail,
    ]),
  );
}

const RANKINGS = permutations([1, 2, 3, 4]);

function transform(ranks: readonly number[], rowSwap: boolean, columnSwap: boolean): number[] {
  const result: number[] = [];
  for (let row = 0; row < 2; row += 1) {
    for (let column = 0; column < 2; column += 1) {
      const sourceRow = rowSwap ? 1 - row : row;
      const sourceColumn = columnSwap ? 1 - column : column;
      result.push(ranks[sourceRow * 2 + sourceColumn]);
    }
  }
  return result;
}

function canonicalKey(rowRanks: readonly number[], columnRanks: readonly number[]): string {
  const variants: string[] = [];
  for (const rowSwap of [false, true]) {
    for (const columnSwap of [false, true]) {
      variants.push(
        `${transform(rowRanks, rowSwap, columnSwap).join("")}|${transform(columnRanks, rowSwap, columnSwap).join("")}`,
      );
    }
  }
  return variants.sort()[0];
}

function gameFor(key: string, id: string): NormalFormGame {
  const [rowText, columnText] = key.split("|");
  const rowRanks = Array.from(rowText, Number);
  const columnRanks = Array.from(columnText, Number);
  return createNormalFormGame({
    id,
    title: `Ordinal 2×2 game ${id.replace("ordinal-", "")}`,
    rowActions: ["Top", "Bottom"],
    columnActions: ["Left", "Right"],
    payoffs: [
      [
        [rowRanks[0], columnRanks[0]],
        [rowRanks[1], columnRanks[1]],
      ],
      [
        [rowRanks[2], columnRanks[2]],
        [rowRanks[3], columnRanks[3]],
      ],
    ],
  });
}

function conceptTerms(structure: StrategicStructure): readonly string[] {
  const terms = structure.replaceAll(/[()]/g, "").split(/\s+/);
  if (structure === "coordination (assurance)") return [...terms, "stag hunt", "coordination"];
  if (structure === "anti-coordination") return [...terms, "chicken"];
  if (structure === "dilemma") return [...terms, "prisoners dilemma"];
  if (structure === "battle") return [...terms, "battle of the sexes"];
  if (structure === "cycle") return [...terms, "matching pennies"];
  return terms;
}

/**
 * The Robinson–Goforth atlas identifies ordinal games up to independent row
 * and column action relabelling. 4! rank orders per player give 576 labelled
 * strict games; quotienting the four row/column swaps leaves exactly 144.
 */
export function enumerateOrdinalTopology(): readonly OrdinalTopologyGame[] {
  const canonical = new Set<string>();
  for (const rowRanks of RANKINGS) {
    for (const columnRanks of RANKINGS) canonical.add(canonicalKey(rowRanks, columnRanks));
  }

  return [...canonical].sort().map((key, index) => {
    const id = `ordinal-${String(index + 1).padStart(3, "0")}`;
    const game = gameFor(key, id);
    const structure = classifyTwoByTwo(game);
    return { id, game, structure, concepts: conceptTerms(structure) };
  });
}

export const ordinalTopology = enumerateOrdinalTopology();

function fuzzyMatch(query: string, candidate: string): boolean {
  if (candidate.includes(query)) return true;
  const needle = query.replaceAll(/\s+/g, "");
  const haystack = candidate.replaceAll(/\s+/g, "");
  let position = 0;
  for (const character of haystack) {
    if (character === needle[position]) position += 1;
    if (position === needle.length) return true;
  }
  return false;
}

export function filterOrdinalTopology(query: string): readonly OrdinalTopologyGame[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (normalized === "") return ordinalTopology;
  return ordinalTopology.filter((entry) => {
    const candidate = [entry.id, entry.structure, ...entry.concepts].join(" ").toLocaleLowerCase();
    return fuzzyMatch(normalized, candidate);
  });
}
