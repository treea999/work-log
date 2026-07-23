import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("production authentication has no fallback secret or anonymous admin bypass", async () => {
  const auth = await readFile(
    new URL("../src/lib/auth-server.ts", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(auth, /ppm-secret-key-change-in-production/);
  assert.doesNotMatch(auth, /bypass-admin/);
  assert.match(auth, /JWT_SECRET must be configured/);
});
