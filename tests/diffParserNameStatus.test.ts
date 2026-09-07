import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createTempRepo } from "./fixtures/tempRepo.ts";
import { parseNameStatus } from "../src/diffParser.ts";

const execFileAsync = promisify(execFile);

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", ["-C", cwd, ...args]);
  return stdout;
}

test("parseNameStatus parses real git -z --name-status output: added, modified, renamed", async () => {
  const repo = await createTempRepo();
  try {
    await writeFile(path.join(repo.path, "modified.txt"), "a\nb\n");
    await writeFile(path.join(repo.path, "toRename.txt"), "line1\nline2\nline3\nline4\nline5\n");
    await git(repo.path, ["add", "-A"]);
    await git(repo.path, ["commit", "-m", "base"]);

    await writeFile(path.join(repo.path, "modified.txt"), "a\nb\nc\n");
    await git(repo.path, ["mv", "toRename.txt", "renamed.txt"]);
    await writeFile(path.join(repo.path, "added.txt"), "new\n");
    await git(repo.path, ["add", "-A"]);
    await git(repo.path, ["commit", "-m", "changes"]);

    const raw = await git(repo.path, ["diff", "--no-color", "-M", "-z", "--name-status", "HEAD~1", "HEAD"]);
    const parsed = parseNameStatus(raw);

    assert.deepEqual(
      parsed.find((p) => p.path === "added.txt"),
      { status: "added", path: "added.txt" },
    );
    assert.deepEqual(
      parsed.find((p) => p.path === "modified.txt"),
      { status: "modified", path: "modified.txt" },
    );
    const renamed = parsed.find((p) => p.path === "renamed.txt");
    assert.equal(renamed?.status, "renamed");
    assert.equal(renamed?.oldPath, "toRename.txt");
    assert.equal(renamed?.similarity, 100);
  } finally {
    await repo.cleanup();
  }
});
