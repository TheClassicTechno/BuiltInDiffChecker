import { test } from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { createTempRepo } from "./fixtures/tempRepo.ts";
import { writeCheckpoint } from "../src/storage.ts";
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
