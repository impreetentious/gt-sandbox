import { formatRational, type Rational } from "@/engine/rational";

/**
 * A versioned, JSON-serializable transcript of one completed session. This is
 * the single artifact the classroom aggregator (§ v2 kit) ingests, so it is a
 * pure, deterministic value: no timestamps, no environment, no I/O. Payoffs are
 * exact rational strings (`formatRational`) so a total never drifts to a float.
 */
export const SESSION_EXPORT_SCHEMA = "gt-sandbox/session";
export const SESSION_EXPORT_VERSION = 1;

export type SessionExportKind =
  "one-shot" | "hot-seat" | "ipd" | "iterated" | "auction";

export interface SessionRoundExport {
  readonly round: number;
  readonly rowAction: string;
  readonly columnAction: string;
  readonly rowPayoff: string;
  readonly columnPayoff: string;
}

export interface SessionExport {
  readonly schema: typeof SESSION_EXPORT_SCHEMA;
  readonly version: number;
  readonly kind: SessionExportKind;
  /** A stable game identifier — a catalog slug or an auction format id. */
  readonly game: string;
  readonly title: string;
  readonly seed?: number;
  readonly rowLabel: string;
  readonly columnLabel: string;
  readonly rounds: readonly SessionRoundExport[];
  readonly rowTotal: string;
  readonly columnTotal: string;
  /** Optional flat, primitive-valued annotations (e.g. persona, format). */
  readonly meta?: Readonly<Record<string, string | number>>;
}

export interface SessionExportInput {
  readonly kind: SessionExportKind;
  readonly game: string;
  readonly title: string;
  readonly seed?: number;
  readonly rowLabel: string;
  readonly columnLabel: string;
  readonly rounds: readonly {
    readonly rowAction: string;
    readonly columnAction: string;
    readonly rowPayoff: Rational;
    readonly columnPayoff: Rational;
  }[];
  readonly rowTotal: Rational;
  readonly columnTotal: Rational;
  readonly meta?: Readonly<Record<string, string | number>>;
}

export function buildSessionExport(input: SessionExportInput): SessionExport {
  return {
    schema: SESSION_EXPORT_SCHEMA,
    version: SESSION_EXPORT_VERSION,
    kind: input.kind,
    game: input.game,
    title: input.title,
    ...(input.seed !== undefined ? { seed: input.seed } : {}),
    rowLabel: input.rowLabel,
    columnLabel: input.columnLabel,
    rounds: input.rounds.map((round, index) => ({
      round: index + 1,
      rowAction: round.rowAction,
      columnAction: round.columnAction,
      rowPayoff: formatRational(round.rowPayoff),
      columnPayoff: formatRational(round.columnPayoff),
    })),
    rowTotal: formatRational(input.rowTotal),
    columnTotal: formatRational(input.columnTotal),
    ...(input.meta ? { meta: input.meta } : {}),
  };
}

export function serializeSessionExport(session: SessionExport): string {
  return JSON.stringify(session, null, 2);
}

export type ParseSessionExportResult =
  | { readonly ok: true; readonly session: SessionExport }
  | { readonly ok: false; readonly notice: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const KINDS: readonly SessionExportKind[] = [
  "one-shot",
  "hot-seat",
  "ipd",
  "iterated",
  "auction",
];

function parseRoundArray(value: unknown): SessionRoundExport[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const rounds: SessionRoundExport[] = [];
  for (const entry of value) {
    if (
      !isRecord(entry) ||
      typeof entry.round !== "number" ||
      typeof entry.rowAction !== "string" ||
      typeof entry.columnAction !== "string" ||
      typeof entry.rowPayoff !== "string" ||
      typeof entry.columnPayoff !== "string"
    ) {
      return null;
    }
    rounds.push({
      round: entry.round,
      rowAction: entry.rowAction,
      columnAction: entry.columnAction,
      rowPayoff: entry.rowPayoff,
      columnPayoff: entry.columnPayoff,
    });
  }

  return rounds;
}

/**
 * Parses untrusted JSON text into a session export. Any structural problem is
 * reported as a notice rather than thrown, so the aggregator can skip a bad
 * file and keep processing the rest of a class's submissions.
 */
export function parseSessionExport(text: string): ParseSessionExportResult {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false, notice: "This file is not valid JSON." };
  }

  if (!isRecord(value)) {
    return { ok: false, notice: "This file is not a session export object." };
  }

  if (value.schema !== SESSION_EXPORT_SCHEMA) {
    return { ok: false, notice: "This file is not a gt-sandbox session." };
  }

  if (value.version !== SESSION_EXPORT_VERSION) {
    return {
      ok: false,
      notice: `Unsupported session version (expected ${SESSION_EXPORT_VERSION}).`,
    };
  }

  if (
    typeof value.kind !== "string" ||
    !KINDS.includes(value.kind as SessionExportKind) ||
    typeof value.game !== "string" ||
    typeof value.title !== "string" ||
    typeof value.rowLabel !== "string" ||
    typeof value.columnLabel !== "string" ||
    typeof value.rowTotal !== "string" ||
    typeof value.columnTotal !== "string"
  ) {
    return { ok: false, notice: "This session is missing required fields." };
  }

  const rounds = parseRoundArray(value.rounds);
  if (rounds === null) {
    return { ok: false, notice: "This session has a malformed round list." };
  }

  const seed =
    value.seed === undefined
      ? undefined
      : typeof value.seed === "number" && Number.isFinite(value.seed)
        ? value.seed
        : null;
  if (seed === null) {
    return { ok: false, notice: "This session has an invalid seed." };
  }

  let meta: Record<string, string | number> | undefined;
  if (value.meta !== undefined) {
    if (!isRecord(value.meta)) {
      return { ok: false, notice: "This session has malformed metadata." };
    }
    meta = {};
    for (const [key, entry] of Object.entries(value.meta)) {
      if (typeof entry !== "string" && typeof entry !== "number") {
        return { ok: false, notice: "Session metadata must be flat." };
      }
      meta[key] = entry;
    }
  }

  return {
    ok: true,
    session: {
      schema: SESSION_EXPORT_SCHEMA,
      version: SESSION_EXPORT_VERSION,
      kind: value.kind as SessionExportKind,
      game: value.game,
      title: value.title,
      ...(seed !== undefined ? { seed } : {}),
      rowLabel: value.rowLabel,
      columnLabel: value.columnLabel,
      rounds,
      rowTotal: value.rowTotal,
      columnTotal: value.columnTotal,
      ...(meta ? { meta } : {}),
    },
  };
}
