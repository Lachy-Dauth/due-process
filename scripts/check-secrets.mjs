import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { execFileSync } from "node:child_process";
const root = process.cwd();
const ignored = new Set([
  ".git",
  "node_modules",
  ".sites-runtime",
  ".wrangler",
  ".vinext",
  ".next",
  "coverage",
]);
const patterns = [
  /\bsk-ant-[A-Za-z0-9_-]{25,}/,
  /\bgh[pousr]_[A-Za-z0-9]{30,}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
];
let exactKey = "";
try {
  exactKey =
    readFileSync(join(root, ".dev.vars"), "utf8")
      .match(/^ANTHROPIC_API_KEY=(.+)$/m)?.[1]
      ?.trim() ?? "";
} catch {}
function suspicious(text) {
  return (
    patterns.some((p) => p.test(text)) ||
    (exactKey.length > 20 && text.includes(exactKey))
  );
}
const bad = [];
let checked = 0;
function walk(folder) {
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    if (
      ignored.has(entry.name) ||
      entry.name.startsWith(".dev.vars") ||
      (entry.name.startsWith(".env") && entry.name !== ".env.example")
    )
      continue;
    const file = join(folder, entry.name);
    if (entry.isDirectory()) {
      walk(file);
      continue;
    }
    if (
      !entry.isFile() ||
      /\.(png|jpg|jpeg|webp|woff2?|ico|gz|zip|pdf)$/i.test(entry.name)
    )
      continue;
    if (statSync(file).size > 12_000_000) continue;
    checked++;
    if (suspicious(readFileSync(file, "utf8"))) bad.push(relative(root, file));
  }
}
walk(root);
try {
  const history = execFileSync("git", ["log", "-p", "--all", "--", "."], {
    encoding: "utf8",
    maxBuffer: 50_000_000,
    stdio: ["ignore", "pipe", "ignore"],
  });
  if (suspicious(history)) bad.push("Git history");
} catch {}
if (bad.length) {
  console.error("Secret audit failed in:", bad.join(", "));
  process.exit(1);
}
console.log(
  `Secret audit passed: ${checked} text files and available Git history. No key values printed.`,
);
