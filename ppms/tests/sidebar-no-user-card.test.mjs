import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("sidebar does not render a duplicate user card at the bottom", async () => {
  const layout = await readFile(
    new URL("../src/app/(workspace)/layout.tsx", import.meta.url),
    "utf8",
  );
  const sidebar = layout.slice(layout.indexOf("<aside"), layout.indexOf("</aside>"));

  assert.doesNotMatch(sidebar, /\{\/\* User Info \*\/\}/);
  assert.doesNotMatch(sidebar, /user\.name/);
  assert.doesNotMatch(sidebar, /user\.role/);
});
