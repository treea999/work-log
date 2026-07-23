import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const EXPECTED_ROLES = ["Admin", "PM", "Finance", "Member", "Approver", "Auditor"];

test("settings uses the auth role source of truth", async () => {
  const [authSource, settingsSource] = await Promise.all([
    readFile(new URL("../src/lib/auth.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/(workspace)/settings/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(
    authSource,
    new RegExp(`export const ROLES = \\[${EXPECTED_ROLES.map((role) => `"${role}"`).join(", ")}\\] as const`),
  );
  assert.match(settingsSource, /import \{ ROLES \} from "@\/lib\/auth"/);
  assert.doesNotMatch(settingsSource, /"Manager"|"Contributor"|"Viewer"/);
  assert.equal(settingsSource.match(/ROLES\.map/g)?.length, 2);
});

test("primary hover is defined in code and the design source of truth", async () => {
  const [globalsSource, designSource] = await Promise.all([
    readFile(new URL("../src/app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../../design.md", import.meta.url), "utf8"),
  ]);

  assert.match(globalsSource, /--primary-hover:\s*#2f2f2f;/i);
  assert.match(designSource, /primary-hover:\s*"#2f2f2f"/i);
  assert.doesNotMatch(
    designSource,
    /Hover-state colors:[\s\S]*precise per-component hover tokens are not captured here/,
  );
});

test("legacy ink-soft references use the documented mute token", async () => {
  const sources = await Promise.all(
    [
      "../src/app/(workspace)/dashboard/page.tsx",
      "../src/app/(workspace)/projects/page.tsx",
      "../src/app/(workspace)/projects/[id]/page.tsx",
      "../src/app/(workspace)/mywork/page.tsx",
      "../src/app/(workspace)/approvals/page.tsx",
      "../src/app/(workspace)/reports/page.tsx",
      "../src/app/(workspace)/settings/page.tsx",
    ].map((path) => readFile(new URL(path, import.meta.url), "utf8")),
  );
  assert.equal(sources.some((source) => source.includes("--ink-soft")), false);
});

test("approvals uses the current card hover border token", async () => {
  const source = await readFile(
    new URL("../src/app/(workspace)/approvals/page.tsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /--navy(?:-[a-z0-9-]+)?/i);
});

