import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

test("every referenced CSS variable is defined in :root", async () => {
  const sourceRoot = new URL("../src/", import.meta.url);
  const files = await sourceFiles(sourceRoot);
  const sources = await Promise.all(files.map((file) => readFile(file, "utf8")));
  const globals = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");
  const rootBlock = globals.match(/:root\s*\{([\s\S]*?)\}/)?.[1] ?? "";
  const references = new Set(sources.flatMap((source) => [...source.matchAll(/var\(--([a-z0-9-]+)\)/gi)].map((match) => match[1])));
  const definitions = new Set([...rootBlock.matchAll(/--([a-z0-9-]+)\s*:/gi)].map((match) => match[1]));
  const missing = [...references].filter((token) => !definitions.has(token)).sort();

  assert.deepEqual(missing, []);
});

async function sourceFiles(directoryUrl) {
  const entries = await readdir(directoryUrl, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const entryUrl = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, directoryUrl);
    if (entry.isDirectory()) return sourceFiles(entryUrl);
    return /\.(?:css|tsx?)$/.test(entry.name) ? [entryUrl] : [];
  }));
  return nested.flat();
}
