import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("app-shell navigation does not use a sliding animation", async () => {
  const [layout, globals] = await Promise.all([
    readFile(new URL("../src/app/(workspace)/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(layout, /animate-slide-in/);
  assert.doesNotMatch(globals, /@keyframes\s+slideIn|\.animate-slide-in/);
});

