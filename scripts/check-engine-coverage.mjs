import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const summaryPath = resolve("coverage/coverage-summary.json");
const summary = JSON.parse(readFileSync(summaryPath, "utf8"));
const entries = Object.entries(summary).filter(([file]) => file !== "total");
const engineEntries = entries.filter(([file]) => file.includes("/src/engine/"));
const solveEntries = engineEntries.filter(([file]) =>
  file.includes("/src/engine/solve/"),
);

function lineTotals(entriesToMeasure) {
  return entriesToMeasure.reduce(
    (totals, [, report]) => ({
      covered: totals.covered + report.lines.covered,
      total: totals.total + report.lines.total,
    }),
    { covered: 0, total: 0 },
  );
}

const engineLines = lineTotals(engineEntries);
const enginePercent =
  engineLines.total === 0
    ? 100
    : (engineLines.covered / engineLines.total) * 100;
const failures = [];

if (enginePercent < 95) {
  failures.push(
    `Engine line coverage is ${enginePercent.toFixed(2)}%; P1 requires at least 95%.`,
  );
}

for (const [file, report] of solveEntries) {
  if (report.lines.pct < 100) {
    failures.push(
      `${file} has ${report.lines.pct}% line coverage; P1 requires 100% for solve/.`,
    );
  }
}

if (failures.length > 0) {
  throw new Error(failures.join("\n"));
}

console.log(
  `Engine coverage gate passed: ${enginePercent.toFixed(2)}% lines; solve/ is 100%.`,
);
