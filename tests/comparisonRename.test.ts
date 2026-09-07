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

test("a rename with mostly unchanged content is reported as renamed with a similarity score", async () => {
  const repo = await createTempRepo();
  try {
    const content = Array.from({ length: 20 }, (_, i) => `line${i}`).join("\n") + "\n";
    await writeFile(path.join(repo.path, "old.txt"), content);
    await git(repo.path, ["add", "-A"]);
    await git(repo.path, ["commit", "-m", "base"]);
    const before = await createCheckpoint(repo.path, "before task");

    await rm(path.join(repo.path, "old.txt"));
    await writeFile(path.join(repo.path, "new.txt"), content + "one more line\n");
    const after = await createCheckpoint(repo.path, "after task");

    const raw = await diffCommits(repo.path, before.commitSha, after.commitSha);
    const comparison = buildComparison(before, after, raw);

    assert.equal(comparison.files.length, 1);
    const entry = comparison.files[0]!;
    assert.equal(entry.status, "renamed");
    assert.equal(entry.path, "new.txt");
    assert.equal(entry.oldPath, "old.txt");
    assert.ok(entry.renameSimilarity !== undefined && entry.renameSimilarity >= 50);
  } finally {
    await repo.cleanup();
  }
});

test("a rename with almost entirely rewritten content is reported as delete+add, not renamed", async () => {
  const repo = await createTempRepo();
  try {
    await writeFile(path.join(repo.path, "old.txt"), "short original content\n");
    await git(repo.path, ["add", "-A"]);
    await git(repo.path, ["commit", "-m", "base"]);
    const before = await createCheckpoint(repo.path, "before task");

    await rm(path.join(repo.path, "old.txt"));
    const rewritten = Array.from({ length: 30 }, (_, i) => `totally different line ${i}`).join("\n") + "\n";
    await writeFile(path.join(repo.path, "new.txt"), rewritten);
    const after = await createCheckpoint(repo.path, "after task");

    const raw = await diffCommits(repo.path, before.commitSha, after.commitSha);
    const comparison = buildComparison(before, after, raw);

    assert.equal(comparison.files.length, 2);
    const statuses = comparison.files.map((f) => f.status).sort();
    assert.deepEqual(statuses, ["added", "deleted"]);
  } finally {
    await repo.cleanup();
  }
});
