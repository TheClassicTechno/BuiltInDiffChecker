import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
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

test("a file present only in the second checkpoint is reported as added", async () => {
  const repo = await createTempRepo();
  try {
    await writeFile(path.join(repo.path, "keep.txt"), "keep\n");
    await git(repo.path, ["add", "-A"]);
    await git(repo.path, ["commit", "-m", "base"]);
    const before = await createCheckpoint(repo.path, "before task");

    await writeFile(path.join(repo.path, "new.txt"), "brand new\n");
    const after = await createCheckpoint(repo.path, "after task");

    const raw = await diffCommits(repo.path, before.commitSha, after.commitSha);
    const comparison = buildComparison(before, after, raw);

    const entry = comparison.files.find((f) => f.path === "new.txt")!;
    assert.equal(entry.status, "added");
    assert.equal(entry.oldPath, undefined);
  } finally {
    await repo.cleanup();
  }
});
