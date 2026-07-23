import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("sidebar uses Next Link so the shared layout stays mounted", async () => {
  const layout = await readFile(
    new URL("../src/app/(workspace)/layout.tsx", import.meta.url),
    "utf8",
  );

  assert.match(layout, /import Link from "next\/link"/);
  assert.match(layout, /<Link[\s\S]*?href=\{item\.path\}/);
  assert.doesNotMatch(layout, /<a(?:\s|>)[\s\S]*?href=\{item\.path\}/);
});

