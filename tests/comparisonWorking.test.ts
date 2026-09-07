import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createTempRepo } from "./fixtures/tempRepo.ts";
import { createCheckpoint } from "../src/checkpoint.ts";
import { compareAgainstWorking } from "../src/comparison.ts";

const execFileAsync = promisify(execFile);

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", ["-C", cwd, ...args]);
  return stdout;
}

test("compareAgainstWorking reflects live staged, unstaged, and untracked changes", async () => {
  const repo = await createTempRepo();
  try {
    await writeFile(path.join(repo.path, "tracked.txt"), "one\n");
    await git(repo.path, ["add", "-A"]);
    await git(repo.path, ["commit", "-m", "base"]);
    const checkpoint = await createCheckpoint(repo.path, "before task");

    // Unstaged modification.
    await writeFile(path.join(repo.path, "tracked.txt"), "two\n");
    // Staged new file.
    await writeFile(path.join(repo.path, "staged.txt"), "staged\n");
    await git(repo.path, ["add", "staged.txt"]);
    // Untracked file, never git-added.
    await writeFile(path.join(repo.path, "untracked.txt"), "untracked\n");

    const comparison = await compareAgainstWorking(repo.path, true, checkpoint);
    const paths = comparison.files.map((f) => f.path).sort();

    assert.deepEqual(paths, ["staged.txt", "tracked.txt", "untracked.txt"]);
    assert.equal(comparison.to.id, "working");
  } finally {
    await repo.cleanup();
  }
});
