import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createTempRepo } from "./fixtures/tempRepo.ts";
import { createCheckpoint } from "../src/checkpoint.ts";
import { diffCommits } from "../src/gitWrapper.ts";
import { buildComparison } from "../src/comparison.ts";

const execFileAsync = promisify(execFile);

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", ["-C", cwd, ...args]);
  return stdout;
}

test("a file present in the first checkpoint and removed before the second is reported as deleted", async () => {
  const repo = await createTempRepo();
  try {
    await writeFile(path.join(repo.path, "gone.txt"), "will be removed\n");
    await writeFile(path.join(repo.path, "keep.txt"), "keep\n");
    await git(repo.path, ["add", "-A"]);
    await git(repo.path, ["commit", "-m", "base"]);
    const before = await createCheckpoint(repo.path, "before task");

    await rm(path.join(repo.path, "gone.txt"));
    const after = await createCheckpoint(repo.path, "after task");

    const raw = await diffCommits(repo.path, before.commitSha, after.commitSha);
    const comparison = buildComparison(before, after, raw);

    const entry = comparison.files.find((f) => f.path === "gone.txt")!;
    assert.equal(entry.status, "deleted");
  } finally {
    await repo.cleanup();
  }
});
