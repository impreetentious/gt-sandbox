import { readFileSync } from "node:fs";

const requiredDirectives = [
  "default-src 'self'",
  "base-uri 'self'",
  "connect-src 'self'",
  "font-src 'self'",
  "form-action 'self'",
  "frame-src 'none'",
  "img-src 'self' data:",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  // V2-P9 — the offline worker and the manifest are same-origin and must stay
  // that way; pinning both directives here stops a future edit from widening
  // them without the check noticing.
  "manifest-src 'self'",
  "worker-src 'self'",
];

// V2-P13 — `/embed/*` is chromeless and exists to be framed by a third-party
// page, so it is the one path that may relax `frame-ancestors`. Every other
// route stays unframeable. Blocks are keyed by role rather than by the
// host-specific `source` string, because `serve` matches globs and Vercel
// matches regexes; the policies must still be identical between the files.
const blockRoles = [
  { role: "default", serve: "**", vercel: "/(.*)", frameAncestors: "frame-ancestors 'none'" },
  {
    role: "embed",
    serve: "/embed/**",
    vercel: "/embed/(.*)",
    // `'self'` keeps the same-origin e2e harness working over http; `https:` is
    // what lets a real blog post frame it. Never widen this to `*`.
    frameAncestors: "frame-ancestors 'self' https:",
  },
];

function readConfig(filename) {
  return JSON.parse(readFileSync(filename, "utf8"));
}

function policiesFromConfig(filename, sourceKey) {
  const config = readConfig(filename);
  const policies = new Map();

  for (const entry of config.headers ?? []) {
    const header = (entry.headers ?? []).find((item) => item.key === "Content-Security-Policy");
    if (!header) continue;
    if (policies.has(entry.source)) {
      throw new Error(`${filename} defines two CSP blocks for source ${entry.source}.`);
    }
    policies.set(entry.source, header.value);
  }

  const byRole = new Map();
  for (const block of blockRoles) {
    const source = block[sourceKey];
    const value = policies.get(source);
    if (!value) {
      throw new Error(`${filename} does not define a Content-Security-Policy for "${source}".`);
    }
    byRole.set(block.role, value);
    policies.delete(source);
  }

  if (policies.size > 0) {
    throw new Error(
      `${filename} defines an ungated CSP block for: ${[...policies.keys()].join(", ")}. ` +
        "Add it to blockRoles in scripts/check-csp.mjs.",
    );
  }

  return byRole;
}

// Both hosts apply every matching block and the last write to a header key
// wins, so a trailing default block would silently re-lock /embed/.
for (const [filename, sourceKey] of [
  ["vercel.json", "vercel"],
  ["serve.json", "serve"],
]) {
  const order = (readConfig(filename).headers ?? []).map((entry) => entry.source);
  const expected = blockRoles.map((block) => block[sourceKey]);
  if (order.join("|") !== expected.join("|")) {
    throw new Error(
      `${filename} header blocks must be ordered ${expected.join(", ")} — found ${order.join(", ")}.`,
    );
  }
}

const vercelPolicies = policiesFromConfig("vercel.json", "vercel");
const localPolicies = policiesFromConfig("serve.json", "serve");

for (const block of blockRoles) {
  const vercelPolicy = vercelPolicies.get(block.role);
  const localPolicy = localPolicies.get(block.role);

  if (vercelPolicy !== localPolicy) {
    throw new Error(`vercel.json and serve.json must ship the same ${block.role} CSP.`);
  }

  for (const directive of requiredDirectives) {
    if (!vercelPolicy.includes(directive)) {
      throw new Error(`${block.role} CSP is missing required directive: ${directive}`);
    }
  }

  if (!vercelPolicy.includes(block.frameAncestors)) {
    throw new Error(`${block.role} CSP must set ${block.frameAncestors}.`);
  }

  if (/\*/.test(vercelPolicy)) {
    throw new Error(`${block.role} CSP may not permit wildcard sources.`);
  }

  if (/'unsafe-eval'|'unsafe-hashes'/.test(vercelPolicy)) {
    throw new Error(`${block.role} CSP may not permit unsafe execution tokens.`);
  }

  // Everything except the embed block's own `frame-ancestors` stays same-origin.
  if (/https?:/.test(vercelPolicy.replace(block.frameAncestors, ""))) {
    throw new Error(`${block.role} CSP may not permit off-origin sources outside frame-ancestors.`);
  }
}

console.log("CSP configuration is complete and consistent.");
