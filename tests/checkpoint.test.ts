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
