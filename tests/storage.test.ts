import { test } from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { createTempRepo } from "./fixtures/tempRepo.ts";
import { writeCheckpoint, listCheckpoints, readCheckpoint } from "../src/storage.ts";
import type { Checkpoint } from "../src/types.ts";

test("writeCheckpoint atomically writes a checkpoint JSON record with no leftover tmp file", async () => {
  const repo = await createTempRepo();
  try {
    const checkpoint: Checkpoint = {
      id: "abc-123",
      name: "before task",
      createdAt: new Date().toISOString(),
      commitSha: "0".repeat(40),
    };

    await writeCheckpoint(repo.path, checkpoint);

    const dir = path.join(repo.path, ".diffcheck", "checkpoints");
    const entries = await readdir(dir);
    assert.deepEqual(entries, ["abc-123.json"]);

    const raw = await readFile(path.join(dir, "abc-123.json"), "utf8");
    assert.deepEqual(JSON.parse(raw), checkpoint);
  } finally {
    await repo.cleanup();
  }
});

test("listCheckpoints returns all persisted checkpoints sorted by createdAt; readCheckpoint reads one by id", async () => {
  const repo = await createTempRepo();
  try {
    const first: Checkpoint = {
      id: "first-id",
      name: "before task",
      createdAt: "2026-01-01T00:00:00.000Z",
      commitSha: "1".repeat(40),
    };
    const second: Checkpoint = {
      id: "second-id",
      name: "after task",
      createdAt: "2026-01-02T00:00:00.000Z",
      commitSha: "2".repeat(40),
    };

    // Write in reverse order to prove listCheckpoints sorts, not just returns insertion order.
    await writeCheckpoint(repo.path, second);
    await writeCheckpoint(repo.path, first);

    const all = await listCheckpoints(repo.path);
    assert.deepEqual(all, [first, second]);

    const read = await readCheckpoint(repo.path, "second-id");
    assert.deepEqual(read, second);
  } finally {
    await repo.cleanup();
  }
});
