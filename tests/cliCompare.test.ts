import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
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

test("`diffcheck compare <from> <to>` prints file status and unified diff", async () => {
  const repo = await createTempRepo();
  try {
    await writeFile(path.join(repo.path, "a.txt"), "one\n");
    await git(repo.path, ["add", "-A"]);
    await git(repo.path, ["commit", "-m", "initial"]);

    const before = (await runCli(repo.path, ["checkpoint", "before task"])).stdout.trim();
    await writeFile(path.join(repo.path, "a.txt"), "two\n");
    const after = (await runCli(repo.path, ["checkpoint", "after task"])).stdout.trim();

    const result = await runCli(repo.path, ["compare", before, after]);
    assert.equal(result.code, 0);
    assert.match(result.stdout, /modified\s+a\.txt/);
    assert.match(result.stdout, /-one/);
    assert.match(result.stdout, /\+two/);
  } finally {
    await repo.cleanup();
  }
});

test("`diffcheck compare` with an unknown reference exits 1 and points to `list`", async () => {
  const repo = await createTempRepo();
  try {
    await writeFile(path.join(repo.path, "a.txt"), "one\n");
    await git(repo.path, ["add", "-A"]);
    await git(repo.path, ["commit", "-m", "initial"]);
    const before = (await runCli(repo.path, ["checkpoint", "before task"])).stdout.trim();

    const result = await runCli(repo.path, ["compare", before, "does-not-exist"]);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /list/);
  } finally {
    await repo.cleanup();
  }
});

test("running the CLI outside a git repository exits 2", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "diffcheck-notrepo-"));
  try {
    const result = await runCli(dir, ["list"]);
    assert.equal(result.code, 2);
  } finally {
    const { rm } = await import("node:fs/promises");
    await rm(dir, { recursive: true, force: true });
  }
});
