import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("logout temporarily suppresses automatic development bypass", async () => {
  const route = await readFile(new URL("../src/app/api/auth/route.ts", import.meta.url), "utf8");
  assert.match(route, /ppm_skip_bypass=1/);
  assert.match(route, /request\.cookies\.get\("ppm_skip_bypass"\)/);
});
