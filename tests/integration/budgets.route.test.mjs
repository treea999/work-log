import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("budget API route remains a thin HTTP layer", async () => {
  const source = await readFile(new URL("../../src/app/api/budgets/route.ts", import.meta.url), "utf8");
  assert.match(source, /createBudgetSchema\.parse/);
  assert.match(source, /service\.create/);
  assert.doesNotMatch(source, /prisma\./);
});
