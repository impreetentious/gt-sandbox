import { gzipSync } from "node:zlib";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const budgetBytes = 250 * 1024;
const exportDirectory = "out";

function filesUnder(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

const htmlFiles = filesUnder(exportDirectory).filter((file) =>
  file.endsWith(".html"),
);
const compressedSizes = new Map();

function compressedSize(file) {
  if (!compressedSizes.has(file)) {
    compressedSizes.set(file, gzipSync(readFileSync(file)).byteLength);
  }

  return compressedSizes.get(file);
}

function referencedJavascript(htmlFile) {
  const html = readFileSync(htmlFile, "utf8");
  const references = html.matchAll(
    /(?:src|href)="([^"?#]+\.js)(?:[?#][^"]*)?"/g,
  );

  return new Set(
    [...references]
      .map((match) => match[1])
      .map((reference) =>
        reference.startsWith("/")
          ? join(exportDirectory, reference.slice(1))
          : resolve(dirname(htmlFile), reference),
      )
      .filter(existsSync),
  );
}

const routeSizes = htmlFiles
  .map((htmlFile) => {
    const javascriptFiles = referencedJavascript(htmlFile);
    const bytes = [...javascriptFiles].reduce(
      (total, file) => total + compressedSize(file),
      0,
    );

    return {
      route: relative(exportDirectory, htmlFile),
      bytes,
      files: javascriptFiles.size,
    };
  })
  .sort((left, right) => right.bytes - left.bytes);

if (routeSizes.length === 0) {
  throw new Error("Bundle-budget check found no exported HTML routes.");
}

const largestRoute = routeSizes[0];
const oversizedRoutes = routeSizes.filter(({ bytes }) => bytes > budgetBytes);

console.log(
  `Largest initial route JavaScript: ${(largestRoute.bytes / 1024).toFixed(1)} KiB gzip across ${largestRoute.files} files for ${largestRoute.route} (budget: 250 KiB per route; ${routeSizes.length} routes checked).`,
);

if (oversizedRoutes.length > 0) {
  console.warn(
    `Bundle-budget warning: ${oversizedRoutes.length} route${oversizedRoutes.length === 1 ? "" : "s"} exceed${oversizedRoutes.length === 1 ? "s" : ""} the route budget. This is not a CI gate.`,
  );

  for (const route of oversizedRoutes) {
    console.warn(
      `- ${route.route}: ${(route.bytes / 1024).toFixed(1)} KiB gzip`,
    );
  }
}
