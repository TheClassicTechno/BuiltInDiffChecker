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

test("buildTree includes untracked non-ignored files but always excludes .diffcheck/", async () => {
  const repo = await createTempRepo();
  try {
    await writeFile(path.join(repo.path, "tracked.txt"), "tracked\n");
    await git(repo.path, ["add", "tracked.txt"]);
    await git(repo.path, ["commit", "-m", "initial"]);

    await writeFile(path.join(repo.path, "untracked.txt"), "untracked\n");

    // No .gitignore entry for .diffcheck/ exists — the exclusion must still hold.
    await mkdir(path.join(repo.path, ".diffcheck", "checkpoints"), { recursive: true });
    await writeFile(path.join(repo.path, ".diffcheck", "checkpoints", "some-id.json"), "{}");

    const treeSha = await buildTree(repo.path, true);
    const lsTree = await git(repo.path, ["ls-tree", "-r", "--name-only", treeSha]);
    const paths = lsTree.trim().split("\n");

    assert.ok(paths.includes("untracked.txt"));
    assert.ok(!paths.some((p) => p.startsWith(".diffcheck")));
  } finally {
    await repo.cleanup();
  }
});
