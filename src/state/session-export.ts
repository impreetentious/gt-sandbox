import { formatRational, parseRational, rational, ZERO, type Rational } from "@/engine/rational";

export const SESSION_FILE_BYTE_LIMIT = 2 * 1024 * 1024;
export const SESSION_ROUND_LIMIT = 10_000;
export const SESSION_RATIONAL_CHARACTER_LIMIT = 256;
export const SESSION_VALUE_BIT_LIMIT = 16_384;
const INTERMEDIATE_BIT_LIMIT = 32_769;

function bits(value: bigint): number {
  return (value < 0n ? -value : value).toString(2).length;
}

function gcd(a: bigint, b: bigint): bigint {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

export function boundedSessionValue(value: Rational): Rational {
  if (
    bits(value.numerator) > SESSION_VALUE_BIT_LIMIT ||
    bits(value.denominator) > SESSION_VALUE_BIT_LIMIT
  ) {
    throw new RangeError("Exact arithmetic exceeds the 16,384-bit intake limit.");
  }
  return value;
}

function product(a: bigint, b: bigint): bigint {
  if (a !== 0n && b !== 0n && bits(a) + bits(b) > INTERMEDIATE_BIT_LIMIT) {
    throw new RangeError("Exact arithmetic exceeds the intermediate workload limit.");
  }
  return a * b;
}

/** Cross-cancel before allocation, reduce immediately, then cap the stored value. */
export function boundedSessionAdd(left: Rational, right: Rational): Rational {
  boundedSessionValue(left);
  boundedSessionValue(right);
  const common = gcd(left.denominator, right.denominator);
  const a = product(left.numerator, right.denominator / common);
  const b = product(right.numerator, left.denominator / common);
  if (Math.max(bits(a), bits(b)) + 1 > INTERMEDIATE_BIT_LIMIT) {
    throw new RangeError("Exact arithmetic exceeds the intermediate workload limit.");
  }
  return boundedSessionValue(
    rational(a + b, product(left.denominator, right.denominator / common)),
  );
}

export function boundedSessionDivide(value: Rational, count: number): Rational {
  boundedSessionValue(value);
  if (!Number.isSafeInteger(count) || count <= 0)
    throw new RangeError("Invalid aggregate divisor.");
  const divisor = BigInt(count);
  const common = gcd(value.numerator, divisor);
  return boundedSessionValue(
    rational(value.numerator / common, product(value.denominator, divisor / common)),
  );
}

/**
 * A versioned, JSON-serializable transcript of one completed session. This is
 * the single artifact the classroom aggregator ingests, so it is a pure,
 * deterministic value: no timestamps, no environment, no I/O. Payoffs are
 * exact rational strings (`formatRational`) so a total never drifts to a float.
 */
export const SESSION_EXPORT_SCHEMA = "gt-sandbox/session";
export const SESSION_EXPORT_VERSION = 1;

export type SessionExportKind = "one-shot" | "hot-seat" | "ipd" | "iterated" | "auction";

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

interface SessionExportInput {
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

type ParseSessionExportResult =
  | { readonly ok: true; readonly session: SessionExport }
  | { readonly ok: false; readonly notice: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const KINDS: readonly SessionExportKind[] = ["one-shot", "hot-seat", "ipd", "iterated", "auction"];

/**
 * Exactly what `formatRational` emits: a signed integer, optionally over a
 * positive denominator. Consumers parse these fields straight back into exact
 * rationals, so a merely-a-string check would let `"abc"` or `"1/0"` through the
 * boundary and throw later, inside the aggregator that promises to skip bad
 * files rather than fail.
 */
const EXACT_RATIONAL = /^-?\d+(?:\/[1-9]\d*)?$/;

function isExactRational(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= SESSION_RATIONAL_CHARACTER_LIMIT &&
    EXACT_RATIONAL.test(value)
  );
}

function parseRoundArray(value: unknown): SessionRoundExport[] | null {
  if (!Array.isArray(value) || value.length > SESSION_ROUND_LIMIT) {
    return null;
  }

  const rounds: SessionRoundExport[] = [];
  for (const entry of value) {
    if (
      !isRecord(entry) ||
      typeof entry.round !== "number" ||
      !Number.isSafeInteger(entry.round) ||
      entry.round !== rounds.length + 1 ||
      typeof entry.rowAction !== "string" ||
      typeof entry.columnAction !== "string" ||
      !isExactRational(entry.rowPayoff) ||
      !isExactRational(entry.columnPayoff)
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
  if (new TextEncoder().encode(text).byteLength > SESSION_FILE_BYTE_LIMIT) {
    return { ok: false, notice: "This file exceeds the 2 MiB intake limit." };
  }
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

  if (!isExactRational(value.rowTotal) || !isExactRational(value.columnTotal)) {
    return { ok: false, notice: "This session has a total that is not an exact rational." };
  }

  const rounds = parseRoundArray(value.rounds);
  if (rounds === null) {
    return { ok: false, notice: "This session has a malformed round list." };
  }

  const seed =
    value.seed === undefined
      ? undefined
      : typeof value.seed === "number" &&
          Number.isInteger(value.seed) &&
          value.seed >= 0 &&
          value.seed <= 0xffff_ffff
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
      if (
        (typeof entry !== "string" && typeof entry !== "number") ||
        (typeof entry === "number" && !Number.isFinite(entry))
      ) {
        return { ok: false, notice: "Session metadata must be flat." };
      }
      meta[key] = entry;
    }
  }

  try {
    let rowSum = ZERO;
    let columnSum = ZERO;
    for (const round of rounds) {
      rowSum = boundedSessionAdd(rowSum, parseRational(round.rowPayoff));
      columnSum = boundedSessionAdd(columnSum, parseRational(round.columnPayoff));
    }
    if (
      formatRational(rowSum) !== formatRational(parseRational(value.rowTotal)) ||
      formatRational(columnSum) !== formatRational(parseRational(value.columnTotal))
    ) {
      return { ok: false, notice: "Declared totals do not equal the exact round payoff sums." };
    }
  } catch (error) {
    return {
      ok: false,
      notice: error instanceof Error ? error.message : "Exact arithmetic unavailable.",
    };
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
