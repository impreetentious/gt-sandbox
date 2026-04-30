import {
  add,
  divide,
  formatRational,
  parseRational,
  rational,
  ZERO,
  type Rational,
} from "@/engine/rational";
import {
  parseSessionExport,
  type SessionExport,
  type SessionExportKind,
} from "@/state/session-export";

/**
 * Pure classroom aggregation. A teacher collects the JSON transcripts students
 * download and drops them in locally; this module folds them into exact summary
 * statistics and a CSV. No network, no upload — the files never leave the
 * device. Totals are parsed back to exact rationals so class means do not
 * drift to floats.
 */
export interface ClassroomSubmission {
  readonly filename: string;
  readonly session: SessionExport;
}

export interface ClassroomRejection {
  readonly filename: string;
  readonly notice: string;
}

interface GameSummary {
  readonly game: string;
  readonly title: string;
  readonly kind: SessionExportKind;
  readonly count: number;
  readonly meanRowTotal: Rational;
  readonly meanColumnTotal: Rational;
  readonly totalRounds: number;
}

interface ClassroomAggregate {
  readonly count: number;
  readonly totalRounds: number;
  readonly byGame: readonly GameSummary[];
}

export function ingestSessionFile(
  filename: string,
  text: string,
):
  | { ok: true; submission: ClassroomSubmission }
  | {
      ok: false;
      rejection: ClassroomRejection;
    } {
  const parsed = parseSessionExport(text);
  if (!parsed.ok) {
    return { ok: false, rejection: { filename, notice: parsed.notice } };
  }
  return { ok: true, submission: { filename, session: parsed.session } };
}

function mean(values: readonly Rational[]): Rational {
  if (values.length === 0) {
    return ZERO;
  }
  return divide(
    values.reduce((sum, value) => add(sum, value), ZERO),
    rational(BigInt(values.length)),
  );
}

export function aggregateSubmissions(
  submissions: readonly ClassroomSubmission[],
): ClassroomAggregate {
  const groups = new Map<string, ClassroomSubmission[]>();
  for (const submission of submissions) {
    const key = `${submission.session.kind}:${submission.session.game}`;
    const existing = groups.get(key);
    if (existing) {
      existing.push(submission);
    } else {
      groups.set(key, [submission]);
    }
  }

  const byGame: GameSummary[] = [...groups.values()].map((entries) => {
    const first = entries[0].session;
    const rowTotals = entries.map((entry) => parseRational(entry.session.rowTotal));
    const columnTotals = entries.map((entry) => parseRational(entry.session.columnTotal));
    return {
      game: first.game,
      title: first.title,
      kind: first.kind,
      count: entries.length,
      meanRowTotal: mean(rowTotals),
      meanColumnTotal: mean(columnTotals),
      totalRounds: entries.reduce((sum, entry) => sum + entry.session.rounds.length, 0),
    };
  });

  byGame.sort((a, b) => a.title.localeCompare(b.title));

  return {
    count: submissions.length,
    totalRounds: submissions.reduce((sum, submission) => sum + submission.session.rounds.length, 0),
    byGame,
  };
}

/**
 * A leading `=`, `+`, `-`, `@`, tab, or carriage return makes Excel and Sheets
 * evaluate a cell instead of displaying it. Filenames, titles, and player labels
 * arrive in files the teacher did not write, so those cells get the standard
 * apostrophe guard. Exact totals are exempted by shape — prefixing `-3` would
 * turn a numeric column into text and defeat the point of the export.
 */
const FORMULA_LEAD = /^[=+\-@\t\r]/;
const EXACT_NUMBER = /^-?\d+(?:\/\d+)?$/;

function csvCell(value: string | number): string {
  const text = String(value);
  const guarded = FORMULA_LEAD.test(text) && !EXACT_NUMBER.test(text) ? `'${text}` : text;

  return /[",\r\n]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

export function submissionsToCsv(submissions: readonly ClassroomSubmission[]): string {
  const header = [
    "file",
    "kind",
    "game",
    "title",
    "rowLabel",
    "columnLabel",
    "rowTotal",
    "columnTotal",
    "rounds",
    "seed",
  ];
  const rows = submissions.map((submission) => {
    const session = submission.session;
    return [
      submission.filename,
      session.kind,
      session.game,
      session.title,
      session.rowLabel,
      session.columnLabel,
      formatRational(parseRational(session.rowTotal)),
      formatRational(parseRational(session.columnTotal)),
      session.rounds.length,
      session.seed ?? "",
    ]
      .map(csvCell)
      .join(",");
  });
  return [header.join(","), ...rows].join("\n");
}
