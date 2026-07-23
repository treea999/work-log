import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("dashboard colors are sourced from semantic design tokens", async () => {
  const source = await readFile(
    new URL("../src/app/(workspace)/dashboard/page.tsx", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(
    source,
    /(?:text|bg|border|fill|stroke)-(?:red|orange|amber|yellow|green|emerald|blue|cyan|indigo|purple|violet|pink|rose|zinc|gray|slate)-\d+/,
  );
  assert.doesNotMatch(source, /#[0-9a-f]{3,8}/i);
  assert.match(source, /const PIE_COLORS = \["var\(--/);
  assert.match(source, /const DEPT_COLORS = \["var\(--/);
});

