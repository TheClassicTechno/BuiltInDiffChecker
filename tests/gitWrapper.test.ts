import { test } from "node:test";
import assert from "node:assert/strict";
import { realpath, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createTempRepo } from "./fixtures/tempRepo.ts";
import { detectRepo } from "../src/gitWrapper.ts";
import { DiffCheckError } from "../src/errors.ts";

const execFileAsync = promisify(execFile);

test("detectRepo resolves toplevel and reports hasHead:false for a repo with no commits", async () => {
  const repo = await createTempRepo();
  try {
    const info = await detectRepo(repo.path);
    assert.equal(await realpath(info.toplevel), await realpath(repo.path));
    assert.equal(info.hasHead, false);
  } finally {
    await repo.cleanup();
  }
});

test("detectRepo reports hasHead:true once a commit exists", async () => {
  const repo = await createTempRepo();
  try {
    await execFileAsync("git", ["-C", repo.path, "commit", "--allow-empty", "-m", "initial"]);
    const info = await detectRepo(repo.path);
    assert.equal(info.hasHead, true);
  } finally {
    await repo.cleanup();
  }
});

test("detectRepo throws DiffCheckError code 2 outside a git repository", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "diffcheck-notrepo-"));
  try {
    await assert.rejects(
      () => detectRepo(dir),
      (err: unknown) => {
        assert.ok(err instanceof DiffCheckError);
        assert.equal(err.code, 2);
        return true;
      },
    );
  } finally {
    const { rm } = await import("node:fs/promises");
    await rm(dir, { recursive: true, force: true });
  }
});
