import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createTempRepo } from "./fixtures/tempRepo.ts";
import { buildTree, commitTree, updateCheckpointRef } from "../src/gitWrapper.ts";

const execFileAsync = promisify(execFile);

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", ["-C", cwd, ...args]);
  return stdout;
}

test("updateCheckpointRef pins a checkpoint commit, invisible to branch/tag listings", async () => {
  const repo = await createTempRepo();
  try {
    await writeFile(path.join(repo.path, "a.txt"), "one\n");
    const treeSha = await buildTree(repo.path, false);
    const commitSha = await commitTree(repo.path, treeSha, "checkpoint: before task");

    await updateCheckpointRef(repo.path, "abc-123", commitSha);

    const showRef = await git(repo.path, ["show-ref"]);
    assert.match(showRef, new RegExp(`${commitSha} refs/diffcheck/checkpoints/abc-123`));

    const branches = await git(repo.path, ["branch"]);
    assert.equal(branches.trim(), "");
    const tags = await git(repo.path, ["tag"]);
    assert.equal(tags.trim(), "");
  } finally {
    await repo.cleanup();
  }
});
