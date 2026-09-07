import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createTempRepo } from "./fixtures/tempRepo.ts";
import { buildTree } from "../src/gitWrapper.ts";

const execFileAsync = promisify(execFile);

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", ["-C", cwd, ...args]);
  return stdout;
}

test("buildTree seeds from HEAD, stages current modifications, and does not mutate the real index or working tree", async () => {
  const repo = await createTempRepo();
  try {
    await writeFile(path.join(repo.path, "a.txt"), "one\n");
    await git(repo.path, ["add", "a.txt"]);
    await git(repo.path, ["commit", "-m", "initial"]);

    await writeFile(path.join(repo.path, "a.txt"), "two\n");

    const statusBefore = await git(repo.path, ["status", "--porcelain"]);
    const cachedBefore = await git(repo.path, ["diff", "--cached", "--name-only"]);

    const treeSha = await buildTree(repo.path, true);
    assert.match(treeSha, /^[0-9a-f]{40}$/);

    const statusAfter = await git(repo.path, ["status", "--porcelain"]);
    const cachedAfter = await git(repo.path, ["diff", "--cached", "--name-only"]);
    assert.equal(statusAfter, statusBefore);
    assert.equal(cachedAfter, cachedBefore);

    const lsTree = await git(repo.path, ["ls-tree", "-r", treeSha]);
    assert.match(lsTree, /a\.txt/);
    const blobSha = lsTree.split(/\s+/)[2];
    const blobContent = await git(repo.path, ["cat-file", "-p", blobSha!]);
    assert.equal(blobContent, "two\n");
  } finally {
    await repo.cleanup();
  }
});

test("buildTree works on a repository with no commits yet (seeds from empty tree)", async () => {
  const repo = await createTempRepo();
  try {
    await mkdir(path.join(repo.path, "sub"), { recursive: true });
    await writeFile(path.join(repo.path, "sub", "new.txt"), "hello\n");

    const treeSha = await buildTree(repo.path, false);
    const lsTree = await git(repo.path, ["ls-tree", "-r", "--name-only", treeSha]);
    assert.match(lsTree, /sub\/new\.txt/);
  } finally {
    await repo.cleanup();
  }
});
