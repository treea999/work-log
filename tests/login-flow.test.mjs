import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("login form submits credentials to the auth API before navigating", async () => {
  const login = await readFile(
    new URL("../src/app/login/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(login, /fetch\("\/api\/auth"/);
  assert.match(login, /action: "login"/);
  assert.match(login, /if \(!response\.ok\)/);
  assert.match(login, /router\.replace\("\/dashboard"\)/);
});
