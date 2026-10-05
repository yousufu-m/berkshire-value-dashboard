import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import assert from "node:assert/strict";
const root = path.resolve(import.meta.dirname, "..");
const docs = path.join(root, "docs");
const html = fs.readFileSync(path.join(docs, "index.html"), "utf8");
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
assert.equal(new Set(ids).size, ids.length, "HTML contains duplicate IDs");
for (const [, target] of html.matchAll(/\bfor="([^"]+)"/g)) {
  assert(ids.includes(target), `Label has no target: ${target}`);
}
const resources = [
  ...html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)="([^"]+)"/g),
].map((m) => m[1]);
assert.equal(resources.length, 3);
for (const resource of resources) {
  assert(
    resource.startsWith("./assets/"),
    "Assets must work under a GitHub project subpath",
  );
  assert(
    fs.existsSync(path.join(docs, resource)),
    `Missing asset: ${resource}`,
  );
}
for (const file of ["companies.js", "app.js"]) {
  new vm.Script(fs.readFileSync(path.join(docs, "assets", file), "utf8"), {
    filename: file,
  });
}
assert(fs.existsSync(path.join(docs, ".nojekyll")));
assert(!/<script\b[^>]*>\s*[^<\s]/.test(html), "Unexpected inline script");
console.log(
  "PASS: syntax, DOM identifiers, labels, relative assets, static publishing entry.",
);
