import { readFileSync } from "node:fs";

const requiredDirectives = [
  "default-src 'self'",
  "base-uri 'self'",
  "connect-src 'self'",
  "font-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "img-src 'self' data:",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
];

function cspFromConfig(filename) {
  const config = JSON.parse(readFileSync(filename, "utf8"));
  const header = config.headers
    .flatMap((entry) => entry.headers)
    .find((entry) => entry.key === "Content-Security-Policy");

  if (!header) {
    throw new Error(
      `${filename} does not define a Content-Security-Policy header.`,
    );
  }

  return header.value;
}

const vercelPolicy = cspFromConfig("vercel.json");
const localPolicy = cspFromConfig("serve.json");

if (vercelPolicy !== localPolicy) {
  throw new Error("vercel.json and serve.json must ship the same CSP.");
}

for (const directive of requiredDirectives) {
  if (!vercelPolicy.includes(directive)) {
    throw new Error(`CSP is missing required directive: ${directive}`);
  }
}

if (/https?:|\*/.test(vercelPolicy)) {
  throw new Error("CSP may not permit off-origin or wildcard sources.");
}

console.log("CSP configuration is complete and consistent.");
