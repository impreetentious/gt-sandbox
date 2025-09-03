import { createNormalFormGame, type NormalFormGame } from "@/engine/game";
import {
  formatRational,
  parseRational,
  type Rational,
} from "@/engine/rational";

export const GAME_URL_VERSION = "1";
export const MAX_GAME_URL_BYTES = 8 * 1024;
export const MIN_ACTIONS = 2;
export const MAX_ACTIONS = 4;
export const MAX_LABEL_CODE_POINTS = 40;
export const MAX_TITLE_CODE_POINTS = 80;
export const MAX_RATIONAL_COMPONENT = 1_000_000n;

export interface GameShareExtras {
  readonly persona?: string;
  readonly seed?: number;
  readonly continuationProbability?: number;
  readonly noise?: number;
}

export interface GameShareState {
  readonly game: NormalFormGame;
  readonly extras: GameShareExtras;
}

export interface EditableGameDraft {
  readonly title: string;
  readonly rowActions: readonly string[];
  readonly columnActions: readonly string[];
  readonly payoffs: readonly (readonly (readonly [string, string])[])[];
}

export type DraftGameResult =
  | { readonly ok: true; readonly game: NormalFormGame }
  | { readonly ok: false; readonly notice: string };

export type DecodeGameUrlResult =
  | { readonly kind: "empty" }
  | { readonly kind: "valid"; readonly state: GameShareState }
  | { readonly kind: "invalid"; readonly notice: string };

function absolute(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function codePointLength(value: string): number {
  return Array.from(value).length;
}

function validateLabel(
  value: string,
  kind: "action" | "title" | "persona",
): string | null {
  const trimmed = value.trim();
  const maximum =
    kind === "title" ? MAX_TITLE_CODE_POINTS : MAX_LABEL_CODE_POINTS;

  if (trimmed === "") {
    return `${kind === "action" ? "Action labels" : kind === "title" ? "The game title" : "The persona"} cannot be empty.`;
  }

  if (codePointLength(trimmed) > maximum) {
    return `${kind === "action" ? "Action labels" : kind === "title" ? "The game title" : "The persona"} must be ${maximum} Unicode characters or fewer.`;
  }

  return null;
}

function validateActions(
  actions: readonly string[],
  player: string,
): string | null {
  if (actions.length < MIN_ACTIONS || actions.length > MAX_ACTIONS) {
    return `${player} must have between ${MIN_ACTIONS} and ${MAX_ACTIONS} actions.`;
  }

  for (const action of actions) {
    const error = validateLabel(action, "action");
    if (error) {
      return error;
    }
  }

  const normalized = actions.map((action) => action.trim());
  if (new Set(normalized).size !== normalized.length) {
    return `${player} action labels must be unique.`;
  }

  return null;
}

/**
 * Parses a bounded integer, fraction, or finite decimal. The lexical and digit
 * limits are checked before bigint construction so hostile URL text cannot
 * allocate an unbounded integer.
 */
export function parseBoundedRational(source: string): Rational {
  const value = source.trim();
  const fraction = /^([+-]?\d{1,7})\s*\/\s*([+-]?\d{1,7})$/.exec(value);
  const decimal = /^([+-]?)(\d{1,7})(?:\.(\d{1,6}))?$/.exec(value);

  if (!fraction && !decimal) {
    throw new SyntaxError(
      "Use an integer, a fraction, or a finite decimal with at most 6 decimal places.",
    );
  }

  if (fraction) {
    const numerator = BigInt(fraction[1]);
    const denominator = BigInt(fraction[2]);

    if (denominator === 0n) {
      throw new RangeError("A payoff denominator cannot be zero.");
    }

    if (
      absolute(numerator) > MAX_RATIONAL_COMPONENT ||
      absolute(denominator) > MAX_RATIONAL_COMPONENT
    ) {
      throw new RangeError(
        "Payoff numerators and denominators are limited to 1,000,000.",
      );
    }
  }

  const parsed = parseRational(value);
  if (
    absolute(parsed.numerator) > MAX_RATIONAL_COMPONENT ||
    absolute(parsed.denominator) > MAX_RATIONAL_COMPONENT
  ) {
    throw new RangeError("Reduced payoff components are limited to 1,000,000.");
  }

  return parsed;
}

export function gameToDraft(game: NormalFormGame): EditableGameDraft {
  return {
    title: game.title,
    rowActions: [...game.rowActions],
    columnActions: [...game.columnActions],
    payoffs: game.payoffs.map((row) =>
      row.map(
        ([rowPayoff, columnPayoff]) =>
          [formatRational(rowPayoff), formatRational(columnPayoff)] as const,
      ),
    ),
  };
}

export function draftToGame(
  draft: EditableGameDraft,
  id = "custom",
): DraftGameResult {
  const titleError = validateLabel(draft.title, "title");
  if (titleError) {
    return { ok: false, notice: titleError };
  }

  const rowError = validateActions(draft.rowActions, "The row player");
  if (rowError) {
    return { ok: false, notice: rowError };
  }

  const columnError = validateActions(draft.columnActions, "The column player");
  if (columnError) {
    return { ok: false, notice: columnError };
  }

  if (draft.payoffs.length !== draft.rowActions.length) {
    return {
      ok: false,
      notice: "The payoff matrix needs one row per row action.",
    };
  }

  try {
    const payoffs = draft.payoffs.map((row) => {
      if (row.length !== draft.columnActions.length) {
        throw new RangeError(
          "The payoff matrix needs one cell per action pair.",
        );
      }

      return row.map(
        ([rowPayoff, columnPayoff]) =>
          [
            parseBoundedRational(rowPayoff),
            parseBoundedRational(columnPayoff),
          ] as const,
      );
    });

    return {
      ok: true,
      game: createNormalFormGame({
        id,
        title: draft.title.trim(),
        rowActions: draft.rowActions.map((action) => action.trim()),
        columnActions: draft.columnActions.map((action) => action.trim()),
        payoffs,
      }),
    };
  } catch (error) {
    return {
      ok: false,
      notice:
        error instanceof Error
          ? error.message
          : "The game could not be parsed.",
    };
  }
}

function parseOptionalNumber(
  params: URLSearchParams,
  key: string,
  minimum: number,
  maximum: number,
): number | undefined {
  const source = params.get(key);
  if (source === null) {
    return undefined;
  }

  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(source)) {
    throw new SyntaxError(`Invalid ${key} value.`);
  }

  const value = Number(source);
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new RangeError(`${key} is outside its supported range.`);
  }

  return value;
}

function hasSupportedDecimalPrecision(value: number): boolean {
  return /^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(String(value));
}

function validateExtras(extras: GameShareExtras): void {
  if (extras.persona !== undefined) {
    const error = validateLabel(extras.persona, "persona");
    if (error) {
      throw new RangeError(error);
    }
  }

  if (
    extras.seed !== undefined &&
    (!Number.isSafeInteger(extras.seed) ||
      extras.seed < 0 ||
      extras.seed > 0xffff_ffff)
  ) {
    throw new RangeError("The seed must be an unsigned 32-bit integer.");
  }

  if (
    extras.continuationProbability !== undefined &&
    (!Number.isFinite(extras.continuationProbability) ||
      !hasSupportedDecimalPrecision(extras.continuationProbability) ||
      extras.continuationProbability < 0.5 ||
      extras.continuationProbability > 0.995)
  ) {
    throw new RangeError(
      "Continuation probability must be between 0.5 and 0.995.",
    );
  }

  if (
    extras.noise !== undefined &&
    (!Number.isFinite(extras.noise) ||
      !hasSupportedDecimalPrecision(extras.noise) ||
      extras.noise < 0 ||
      extras.noise > 0.1)
  ) {
    throw new RangeError("Noise must be between 0 and 0.1.");
  }
}

export function encodeGameSearch(state: GameShareState): string {
  const result = draftToGame(gameToDraft(state.game), state.game.id);
  if (!result.ok) {
    throw new RangeError(result.notice);
  }
  validateExtras(state.extras);
  const game = result.game;

  const params = new URLSearchParams();
  params.set("v", GAME_URL_VERSION);
  params.set("title", game.title);
  game.rowActions.forEach((action) => params.append("row", action));
  game.columnActions.forEach((action) => params.append("col", action));
  params.set(
    "p",
    game.payoffs
      .flatMap((row) => row)
      .map(
        ([rowPayoff, columnPayoff]) =>
          `${formatRational(rowPayoff)},${formatRational(columnPayoff)}`,
      )
      .join(";"),
  );

  if (state.extras.persona !== undefined) {
    params.set("persona", state.extras.persona.trim());
  }
  if (state.extras.seed !== undefined) {
    params.set("seed", String(state.extras.seed));
  }
  if (state.extras.continuationProbability !== undefined) {
    params.set("delta", String(state.extras.continuationProbability));
  }
  if (state.extras.noise !== undefined) {
    params.set("epsilon", String(state.extras.noise));
  }

  const search = params.toString();
  if (new TextEncoder().encode(search).length > MAX_GAME_URL_BYTES) {
    throw new RangeError(
      "The encoded game exceeds the 8 KiB share-link limit.",
    );
  }

  return search;
}

export function decodeGameSearch(search: string): DecodeGameUrlResult {
  const query = search.startsWith("?") ? search.slice(1) : search;
  if (query === "") {
    return { kind: "empty" };
  }

  if (new TextEncoder().encode(query).length > MAX_GAME_URL_BYTES) {
    return {
      kind: "invalid",
      notice:
        "This share link exceeds the 8 KiB limit. The default game was loaded instead.",
    };
  }

  try {
    const params = new URLSearchParams(query);
    if (!params.has("v")) {
      return { kind: "empty" };
    }

    if (params.get("v") !== GAME_URL_VERSION) {
      throw new RangeError("This game-link version is not supported.");
    }

    const rowActions = params.getAll("row");
    const columnActions = params.getAll("col");
    const payoffSource = params.get("p");
    if (payoffSource === null) {
      throw new SyntaxError("The shared payoff matrix is missing.");
    }

    const cells = payoffSource.split(";");
    if (cells.length !== rowActions.length * columnActions.length) {
      throw new RangeError(
        "The shared payoff matrix has the wrong dimensions.",
      );
    }

    const payoffs: Array<Array<readonly [string, string]>> = Array.from(
      { length: rowActions.length },
      () => [],
    );
    cells.forEach((cell, index) => {
      const values = cell.split(",");
      if (values.length !== 2) {
        throw new SyntaxError("Every shared cell needs two payoffs.");
      }
      payoffs[Math.floor(index / columnActions.length)].push([
        values[0],
        values[1],
      ]);
    });

    const result = draftToGame(
      {
        title: params.get("title") ?? "Shared game",
        rowActions,
        columnActions,
        payoffs,
      },
      "shared",
    );
    if (!result.ok) {
      throw new RangeError(result.notice);
    }

    const persona = params.get("persona") ?? undefined;
    if (persona !== undefined) {
      const error = validateLabel(persona, "persona");
      if (error) {
        throw new RangeError(error);
      }
    }

    const seed = parseOptionalNumber(params, "seed", 0, 0xffff_ffff);
    if (seed !== undefined && !Number.isInteger(seed)) {
      throw new RangeError("The seed must be an integer.");
    }

    const extras: GameShareExtras = {
      persona,
      seed,
      continuationProbability: parseOptionalNumber(params, "delta", 0.5, 0.995),
      noise: parseOptionalNumber(params, "epsilon", 0, 0.1),
    };

    return { kind: "valid", state: { game: result.game, extras } };
  } catch (error) {
    return {
      kind: "invalid",
      notice: `${error instanceof Error ? error.message : "This share link is malformed."} The default game was loaded instead.`,
    };
  }
}
