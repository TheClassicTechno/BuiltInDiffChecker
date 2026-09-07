import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createTempRepo } from "./fixtures/tempRepo.ts";
import { createCheckpoint } from "../src/checkpoint.ts";
import { diffCommits } from "../src/gitWrapper.ts";

const execFileAsync = promisify(execFile);

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", ["-C", cwd, ...args]);
  return stdout;
}

test("diffCommits returns raw name-status, numstat, and full diff matching real git output", async () => {
  const repo = await createTempRepo();
  try {
    await writeFile(path.join(repo.path, "a.txt"), "one\n");
    await git(repo.path, ["add", "a.txt"]);
    await git(repo.path, ["commit", "-m", "initial"]);

    const before = await createCheckpoint(repo.path, "before task");
    await writeFile(path.join(repo.path, "a.txt"), "two\n");
    const after = await createCheckpoint(repo.path, "after task");

    const { nameStatusRaw, numstatRaw, fullDiffRaw } = await diffCommits(
      repo.path,
      before.commitSha,
      after.commitSha,
    );

    const expectedNameStatus = await git(repo.path, [
      "diff", "--no-color", "-M", "-z", "--name-status", before.commitSha, after.commitSha,
    ]);
    const expectedNumstat = await git(repo.path, [
      "diff", "--no-color", "-M", "-z", "--numstat", before.commitSha, after.commitSha,
    ]);
    const expectedFullDiff = await git(repo.path, [
      "diff", "--no-color", "-M", before.commitSha, after.commitSha,
    ]);

    assert.equal(nameStatusRaw, expectedNameStatus);
    assert.equal(numstatRaw, expectedNumstat);
    assert.equal(fullDiffRaw, expectedFullDiff);

    assert.match(nameStatusRaw, /M\0a\.txt\0/);
    assert.match(fullDiffRaw, /diff --git a\/a\.txt b\/a\.txt/);
    assert.match(fullDiffRaw, /-one/);
    assert.match(fullDiffRaw, /\+two/);
  } finally {
    await repo.cleanup();
  }
});
