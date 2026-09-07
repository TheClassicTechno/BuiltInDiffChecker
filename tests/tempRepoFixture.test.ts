import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createTempRepo } from "./fixtures/tempRepo.ts";

const execFileAsync = promisify(execFile);

test("createTempRepo creates an isolated git repo with fixed local identity, and cleanup removes it", async () => {
  const repo = await createTempRepo();

  assert.equal(existsSync(path.join(repo.path, ".git")), true);

  const { stdout: name } = await execFileAsync("git", ["-C", repo.path, "config", "user.name"]);
  const { stdout: email } = await execFileAsync("git", ["-C", repo.path, "config", "user.email"]);
  assert.equal(name.trim(), "diffcheck-test");
  assert.equal(email.trim(), "diffcheck-test@example.invalid");

  await repo.cleanup();

  assert.equal(existsSync(repo.path), false);
});
