import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createTempRepo } from "./fixtures/tempRepo.ts";
import { buildTree, commitTree } from "../src/gitWrapper.ts";

const execFileAsync = promisify(execFile);

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", ["-C", cwd, ...args]);
  return stdout;
}

test("commitTree wraps a tree in a commit object without touching HEAD or any branch", async () => {
  const repo = await createTempRepo();
  try {
    await writeFile(path.join(repo.path, "a.txt"), "one\n");
    const treeSha = await buildTree(repo.path, false);

    const commitSha = await commitTree(repo.path, treeSha, "checkpoint: before task");
    assert.match(commitSha, /^[0-9a-f]{40}$/);

    const catFile = await git(repo.path, ["cat-file", "-p", commitSha]);
    assert.match(catFile, new RegExp(`^tree ${treeSha}`));

    await assert.rejects(() => git(repo.path, ["rev-parse", "--verify", "HEAD"]));
    const branches = await git(repo.path, ["branch"]);
    assert.equal(branches.trim(), "");
  } finally {
    await repo.cleanup();
  }
});

test("commitTree accepts a parent commit without moving HEAD", async () => {
  const repo = await createTempRepo();
  try {
    await writeFile(path.join(repo.path, "a.txt"), "one\n");
    await git(repo.path, ["add", "a.txt"]);
    await git(repo.path, ["commit", "-m", "initial"]);
    const headBefore = (await git(repo.path, ["rev-parse", "HEAD"])).trim();

    const treeSha = await buildTree(repo.path, true);
    const commitSha = await commitTree(repo.path, treeSha, "checkpoint: after task", headBefore);

    const catFile = await git(repo.path, ["cat-file", "-p", commitSha]);
    assert.match(catFile, new RegExp(`parent ${headBefore}`));

    const headAfter = (await git(repo.path, ["rev-parse", "HEAD"])).trim();
    assert.equal(headAfter, headBefore);
  } finally {
    await repo.cleanup();
  }
});
