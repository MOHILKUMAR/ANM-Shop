// The Content-Security-Policy in vercel.json allows index.html's inline theme script by its
// SHA-256 hash. This prints the current hash and, with --check, fails when vercel.json has a
// different one (so a changed script can't ship blocked).
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const vercel = readFileSync(new URL("../vercel.json", import.meta.url), "utf8");
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
const hashes = scripts.map((body) => `'sha256-${createHash("sha256").update(body).digest("base64")}'`);

for (const hash of hashes) console.log(hash);
if (process.argv.includes("--check")) {
  const missing = hashes.filter((hash) => !vercel.includes(hash));
  if (missing.length) {
    console.error(`vercel.json's Content-Security-Policy is missing ${missing.join(", ")}.`);
    console.error("Replace the old sha256 value in script-src with the hash above.");
    process.exit(1);
  }
}
