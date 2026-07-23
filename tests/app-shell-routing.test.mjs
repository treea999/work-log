import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("workspace route group mounts one persistent app shell for every workspace route", async () => {
  const workspaceLayout = await readFile(
    new URL("../src/app/(workspace)/layout.tsx", import.meta.url),
    "utf8",
  );

  for (const path of ["/dashboard", "/projects", "/mywork", "/approvals", "/reports", "/settings"]) {
    assert.match(workspaceLayout, new RegExp(`path: "${path.replace("/", "\\/")}"`));
  }
});


