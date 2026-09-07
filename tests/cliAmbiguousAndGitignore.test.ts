import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createTempRepo } from "./fixtures/tempRepo.ts";
import { runCli } from "./helpers/runCli.ts";

const execFileAsync = promisify(execFile);

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", ["-C", cwd, ...args]);
  return stdout;
}

test("comparing by a name shared by two checkpoints exits 1 and lists both ids", async () => {
  const repo = await createTempRepo();
  try {
    await writeFile(path.join(repo.path, "a.txt"), "one\n");
    await git(repo.path, ["add", "-A"]);
    await git(repo.path, ["commit", "-m", "initial"]);

    const first = (await runCli(repo.path, ["checkpoint", "checkpoint"])).stdout.trim();
    const second = (await runCli(repo.path, ["checkpoint", "checkpoint"])).stdout.trim();

    const result = await runCli(repo.path, ["compare", "checkpoint", "checkpoint"]);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /ambiguous/i);
    assert.ok(result.stderr.includes(first));
    assert.ok(result.stderr.includes(second));
  } finally {
    await repo.cleanup();
  }
});

test("the first checkpoint in a repo without a .gitignore entry for .diffcheck/ prints a one-time suggestion", async () => {
  const repo = await createTempRepo();
  try {
    await writeFile(path.join(repo.path, "a.txt"), "one\n");
    await git(repo.path, ["add", "-A"]);
    await git(repo.path, ["commit", "-m", "initial"]);

    const first = await runCli(repo.path, ["checkpoint", "before task"]);
    assert.match(first.stderr, /gitignore/i);

    const second = await runCli(repo.path, ["checkpoint", "after task"]);
    assert.equal(second.stderr, "");
  } finally {
    await repo.cleanup();
  }
});

test("no suggestion is printed when .gitignore already covers .diffcheck/", async () => {
  const repo = await createTempRepo();
  try {
    await writeFile(path.join(repo.path, ".gitignore"), "node_modules/\n.diffcheck/\n");
    await writeFile(path.join(repo.path, "a.txt"), "one\n");
    await git(repo.path, ["add", "-A"]);
    await git(repo.path, ["commit", "-m", "initial"]);

    const result = await runCli(repo.path, ["checkpoint", "before task"]);
    assert.equal(result.stderr, "");
  } finally {
    await repo.cleanup();
  }
});
