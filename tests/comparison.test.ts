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

test("buildComparison combines parsed parts into a Comparison with correct totals", async () => {
  const repo = await createTempRepo();
  try {
    await writeFile(path.join(repo.path, "modified.txt"), "a\nb\n");
    await git(repo.path, ["add", "-A"]);
    await git(repo.path, ["commit", "-m", "base"]);
    const before = await createCheckpoint(repo.path, "before task");

    await writeFile(path.join(repo.path, "modified.txt"), "a\nb\nc\n");
    await writeFile(path.join(repo.path, "added.txt"), "one\ntwo\n");
    const after = await createCheckpoint(repo.path, "after task");

    const raw = await diffCommits(repo.path, before.commitSha, after.commitSha);
    const comparison = buildComparison(before, after, raw);

    assert.equal(comparison.from, before);
    assert.equal(comparison.to, after);
    assert.equal(comparison.rawDiff, raw.fullDiffRaw);
    assert.equal(comparison.files.length, 2);

    const modified = comparison.files.find((f) => f.path === "modified.txt")!;
    assert.equal(modified.status, "modified");
    assert.equal(modified.additions, 1);
    assert.equal(modified.deletions, 0);
    assert.ok(modified.patch!.includes("+c"));

    const added = comparison.files.find((f) => f.path === "added.txt")!;
    assert.equal(added.status, "added");
    assert.equal(added.additions, 2);
    assert.equal(added.deletions, 0);

    assert.equal(comparison.totalAdditions, 3);
    assert.equal(comparison.totalDeletions, 0);
  } finally {
    await repo.cleanup();
  }
});
