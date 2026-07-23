import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const PAGES = ["dashboard", "projects", "mywork", "approvals", "reports", "settings"];
const HEADING_CLASS = "text-2xl font-semibold text-[var(--ink)] tracking-tight";
const SUBTITLE_CLASS = "text-sm text-[var(--mute)] mt-0.5 font-mono";

test("portfolio pages share the documented heading and subtitle patterns", async () => {
  for (const page of PAGES) {
    const source = await readFile(
      new URL(`../src/app/(workspace)/${page}/page.tsx`, import.meta.url),
      "utf8",
    );
    assert.match(source, new RegExp(`<h1 className="${escapeRegExp(HEADING_CLASS)}"`), page);
    assert.match(source, new RegExp(`<p className="${escapeRegExp(SUBTITLE_CLASS)}"`), page);
  }
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

