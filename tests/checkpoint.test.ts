import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createTempRepo } from "./fixtures/tempRepo.ts";
import { createCheckpoint } from "../src/checkpoint.ts";
import { readCheckpoint } from "../src/storage.ts";

const execFileAsync = promisify(execFile);

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", ["-C", cwd, ...args]);
  return stdout;
}

test("createCheckpoint creates, persists, and pins a checkpoint", async () => {
  const repo = await createTempRepo();
  try {
    await writeFile(path.join(repo.path, "a.txt"), "one\n");
    await git(repo.path, ["add", "a.txt"]);
    await git(repo.path, ["commit", "-m", "initial"]);

    const checkpoint = await createCheckpoint(repo.path, "before task", "trying a refactor");

    assert.equal(checkpoint.name, "before task");
    assert.equal(checkpoint.note, "trying a refactor");
    assert.match(checkpoint.id, /^[0-9a-f-]{36}$/);
    assert.match(checkpoint.commitSha, /^[0-9a-f]{40}$/);

    const persisted = await readCheckpoint(repo.path, checkpoint.id);
    assert.deepEqual(persisted, checkpoint);

    const showRef = await git(repo.path, ["show-ref"]);
    assert.match(showRef, new RegExp(`${checkpoint.commitSha} refs/diffcheck/checkpoints/${checkpoint.id}`));
  } finally {
    await repo.cleanup();
  }
});

test("creating a second checkpoint after a modification produces a distinct id/commit reflecting the change", async () => {
  const repo = await createTempRepo();
  try {
    await writeFile(path.join(repo.path, "a.txt"), "one\n");
    await git(repo.path, ["add", "a.txt"]);
    await git(repo.path, ["commit", "-m", "initial"]);

    const before = await createCheckpoint(repo.path, "before task");

    await writeFile(path.join(repo.path, "a.txt"), "two\n");
    const after = await createCheckpoint(repo.path, "after task");

    assert.notEqual(before.id, after.id);
    assert.notEqual(before.commitSha, after.commitSha);
    assert.equal(after.parentCheckpointId, before.id);

    const afterContent = await git(repo.path, ["show", `${after.commitSha}:a.txt`]);
    assert.equal(afterContent, "two\n");
    const beforeContent = await git(repo.path, ["show", `${before.commitSha}:a.txt`]);
    assert.equal(beforeContent, "one\n");
  } finally {
    await repo.cleanup();
  }
});
