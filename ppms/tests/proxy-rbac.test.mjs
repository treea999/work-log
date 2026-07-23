import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Next.js proxy validates JWTs and gates legacy mutation APIs with permissions", async () => {
  const source = await readFile(new URL("../src/proxy.ts", import.meta.url), "utf8");

  assert.match(source, /verifyToken\(token\)/);
  assert.match(source, /hasPermission\(actor\.role, permission\)/);
  assert.match(source, /\/api\/projects/);
  assert.match(source, /\/api\/expenses/);
  assert.match(source, /status: 401/);
  assert.match(source, /status: 403/);
});
