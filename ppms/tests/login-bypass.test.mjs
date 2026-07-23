import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("login bypass is opt-in for development and denied in production", async () => {
  const [route, page] = await Promise.all([
    readFile(new URL("../src/app/api/auth/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/login/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(route, /action === "bypass"/);
  assert.match(route, /process\.env\.NODE_ENV !== "production"/);
  assert.match(route, /process\.env\.AUTH_BYPASS_ENABLED === "true"/);
  assert.match(page, /action: "bypass"/);
  assert.match(page, /router\.replace\("\/dashboard"\)/);
});
