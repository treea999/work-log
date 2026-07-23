import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("auth route supports secure logout and blocks production seeding", async () => {
  const route = await readFile(
    new URL("../src/app/api/auth/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(route, /action === "logout"/);
  assert.match(route, /Max-Age=0/);
  assert.match(route, /process\.env\.NODE_ENV === "production"/);
  assert.match(route, /Secure/);
  assert.doesNotMatch(route, /id: "bypass-admin"/);
});
