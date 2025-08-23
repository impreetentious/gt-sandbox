import { gzipSync } from "node:zlib";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const budgetBytes = 250 * 1024;
const assetsDirectory = "out/_next";

function filesUnder(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

const javascriptFiles = filesUnder(assetsDirectory).filter((file) =>
  file.endsWith(".js"),
);
const compressedBytes = javascriptFiles.reduce(
  (total, file) => total + gzipSync(readFileSync(file)).byteLength,
  0,
);
const kilobytes = (compressedBytes / 1024).toFixed(1);

console.log(
  `Exported JavaScript: ${kilobytes} KiB gzip across ${javascriptFiles.length} files (budget: 250 KiB per route).`,
);

if (compressedBytes > budgetBytes) {
  console.warn(
    "Bundle-budget warning: P0 output exceeds the route budget. This is not a CI gate.",
  );
}
