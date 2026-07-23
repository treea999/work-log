import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("user menu provides a logout action that clears the session and returns to login", async () => {
  const layout = await readFile(
    new URL("../src/app/(workspace)/layout.tsx", import.meta.url),
    "utf8",
  );

  assert.match(layout, /action: "logout"/);
  assert.match(layout, /router\.replace\("\/login"\)/);
  assert.match(layout, /"Logout"/);
  assert.match(layout, /<LogOut size=\{14\}/);
});
