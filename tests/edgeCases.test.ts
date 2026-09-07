import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFile, chmod } from "node:fs/promises";
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

test("edge case: spaces in file names", async () => {
  const repo = await createTempRepo();
  try {
    await writeFile(path.join(repo.path, "my file.txt"), "one\n");
    await git(repo.path, ["add", "-A"]);
    await git(repo.path, ["commit", "-m", "base"]);
    const before = await createCheckpoint(repo.path, "before task");

    await writeFile(path.join(repo.path, "my file.txt"), "two\n");
    const after = await createCheckpoint(repo.path, "after task");

    const comparison = buildComparison(before, after, await diffCommits(repo.path, before.commitSha, after.commitSha));
    assert.equal(comparison.files.length, 1);
    assert.equal(comparison.files[0]!.path, "my file.txt");
  } finally {
    await repo.cleanup();
  }
});

test("edge case: Unicode file names", async () => {
  const repo = await createTempRepo();
  try {
    await writeFile(path.join(repo.path, "文件.txt"), "one\n");
    await git(repo.path, ["add", "-A"]);
    await git(repo.path, ["commit", "-m", "base"]);
    const before = await createCheckpoint(repo.path, "before task");

    await writeFile(path.join(repo.path, "文件.txt"), "two\n");
    const after = await createCheckpoint(repo.path, "after task");

    const comparison = buildComparison(before, after, await diffCommits(repo.path, before.commitSha, after.commitSha));
    assert.equal(comparison.files.length, 1);
    assert.equal(comparison.files[0]!.path, "文件.txt");
  } finally {
    await repo.cleanup();
  }
});

test("edge case: empty file becoming non-empty", async () => {
  const repo = await createTempRepo();
  try {
    await writeFile(path.join(repo.path, "empty.txt"), "");
    await git(repo.path, ["add", "-A"]);
    await git(repo.path, ["commit", "-m", "base"]);
    const before = await createCheckpoint(repo.path, "before task");

    await writeFile(path.join(repo.path, "empty.txt"), "now has content\n");
    const after = await createCheckpoint(repo.path, "after task");

    const comparison = buildComparison(before, after, await diffCommits(repo.path, before.commitSha, after.commitSha));
    const entry = comparison.files.find((f) => f.path === "empty.txt")!;
    assert.equal(entry.status, "modified");
    assert.equal(entry.additions, 1);
    assert.equal(entry.deletions, 0);
  } finally {
    await repo.cleanup();
  }
});

test("edge case: CRLF vs LF line endings are reported as a real content change", async () => {
  const repo = await createTempRepo();
  try {
    await writeFile(path.join(repo.path, "crlf.txt"), "line1\nline2\n");
    await git(repo.path, ["add", "-A"]);
    await git(repo.path, ["commit", "-m", "base"]);
    const before = await createCheckpoint(repo.path, "before task");

    await writeFile(path.join(repo.path, "crlf.txt"), "line1\r\nline2\r\n");
    const after = await createCheckpoint(repo.path, "after task");

    const comparison = buildComparison(before, after, await diffCommits(repo.path, before.commitSha, after.commitSha));
    const entry = comparison.files.find((f) => f.path === "crlf.txt")!;
    assert.equal(entry.status, "modified");
    assert.ok((entry.additions ?? 0) > 0);
  } finally {
    await repo.cleanup();
  }
});

test("edge case: mode/chmod-only change is reported as modified with zero line changes", async () => {
  const repo = await createTempRepo();
  try {
    await writeFile(path.join(repo.path, "script.sh"), "echo hi\n");
    await git(repo.path, ["add", "-A"]);
    await git(repo.path, ["commit", "-m", "base"]);
    const before = await createCheckpoint(repo.path, "before task");

    await chmod(path.join(repo.path, "script.sh"), 0o755);
    const after = await createCheckpoint(repo.path, "after task");

    const comparison = buildComparison(before, after, await diffCommits(repo.path, before.commitSha, after.commitSha));
    const entry = comparison.files.find((f) => f.path === "script.sh")!;
    assert.equal(entry.status, "modified");
    assert.equal(entry.additions, 0);
    assert.equal(entry.deletions, 0);
    assert.match(entry.patch ?? "", /old mode 100644/);
    assert.match(entry.patch ?? "", /new mode 100755/);
  } finally {
    await repo.cleanup();
  }
});

test("edge case: repository with no commits at all", async () => {
  const repo = await createTempRepo();
  try {
    await writeFile(path.join(repo.path, "new.txt"), "first ever content\n");
    const before = await createCheckpoint(repo.path, "before task");
    assert.equal(before.parentCheckpointId, undefined);

    await writeFile(path.join(repo.path, "new.txt"), "changed content\n");
    const after = await createCheckpoint(repo.path, "after task");

    const comparison = buildComparison(before, after, await diffCommits(repo.path, before.commitSha, after.commitSha));
    assert.equal(comparison.files[0]!.status, "modified");
  } finally {
    await repo.cleanup();
  }
});

test("edge case: dirty working tree drift after a checkpoint doesn't retroactively change it", async () => {
  const repo = await createTempRepo();
  try {
    await writeFile(path.join(repo.path, "a.txt"), "one\n");
    await git(repo.path, ["add", "-A"]);
    await git(repo.path, ["commit", "-m", "base"]);

    await writeFile(path.join(repo.path, "a.txt"), "two\n");
    const checkpoint = await createCheckpoint(repo.path, "snapshot");

    // Further, unrelated drift in the working tree after the checkpoint was taken.
    await writeFile(path.join(repo.path, "a.txt"), "three\n");
    await writeFile(path.join(repo.path, "b.txt"), "unrelated\n");

    const contentAtCheckpoint = await git(repo.path, ["show", `${checkpoint.commitSha}:a.txt`]);
    assert.equal(contentAtCheckpoint, "two\n");
  } finally {
    await repo.cleanup();
  }
});
