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

test("a binary file addition is reported with binary:true and no line-level diff", async () => {
  const repo = await createTempRepo();
  try {
    await writeFile(path.join(repo.path, "keep.txt"), "keep\n");
    await git(repo.path, ["add", "-A"]);
    await git(repo.path, ["commit", "-m", "base"]);
    const before = await createCheckpoint(repo.path, "before task");

    // A PNG-like byte sequence with embedded NUL bytes, so git's own
    // binary-detection heuristic (not a file-extension guess) classifies it.
    await writeFile(path.join(repo.path, "image.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x0d, 0x0a]));
    const after = await createCheckpoint(repo.path, "after task");

    const raw = await diffCommits(repo.path, before.commitSha, after.commitSha);
    const comparison = buildComparison(before, after, raw);

    const entry = comparison.files.find((f) => f.path === "image.png")!;
    assert.equal(entry.status, "added");
    assert.equal(entry.binary, true);
    assert.equal(entry.additions, null);
    assert.equal(entry.deletions, null);
    assert.equal(entry.patch, null);
  } finally {
    await repo.cleanup();
  }
});
