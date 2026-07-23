import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("workspace shell keeps the sidebar fixed while page content scrolls", async () => {
  const layout = await readFile(
    new URL("../src/app/(workspace)/layout.tsx", import.meta.url),
    "utf8",
  );

  assert.match(layout, /className="h-screen overflow-hidden flex"/);
  assert.match(layout, /<aside className="h-full overflow-hidden/);
  assert.match(layout, /<main className="flex-1 min-h-0[^"]*overflow-y-auto"/);
});
