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

test("`diffcheck latest` matches `compare <most-recent> working` exactly", async () => {
  const repo = await createTempRepo();
  try {
    await writeFile(path.join(repo.path, "a.txt"), "one\n");
    await git(repo.path, ["add", "-A"]);
    await git(repo.path, ["commit", "-m", "initial"]);
    const id = (await runCli(repo.path, ["checkpoint", "before task"])).stdout.trim();

    await writeFile(path.join(repo.path, "a.txt"), "two\n");

    const latest = await runCli(repo.path, ["latest", "--json"]);
    const compare = await runCli(repo.path, ["compare", id, "working", "--json"]);
    assert.equal(latest.code, 0);

    // Both invocations build their own ephemeral "working tree" checkpoint
    // with a fresh createdAt timestamp, so compare everything else exactly.
    const latestJson = JSON.parse(latest.stdout);
    const compareJson = JSON.parse(compare.stdout);
    delete latestJson.to.createdAt;
    delete compareJson.to.createdAt;
    assert.deepEqual(latestJson, compareJson);
  } finally {
    await repo.cleanup();
  }
});

test("`diffcheck show <id>` prints one checkpoint's metadata", async () => {
  const repo = await createTempRepo();
  try {
    await writeFile(path.join(repo.path, "a.txt"), "one\n");
    await git(repo.path, ["add", "-A"]);
    await git(repo.path, ["commit", "-m", "initial"]);
    const id = (await runCli(repo.path, ["checkpoint", "before task"])).stdout.trim();

    const result = await runCli(repo.path, ["show", id, "--json"]);
    assert.equal(result.code, 0);
    const json = JSON.parse(result.stdout);
    assert.equal(json.id, id);
    assert.equal(json.name, "before task");
  } finally {
    await repo.cleanup();
  }
});

test("`diffcheck show <id1>..<id2>` prints that pair's comparison", async () => {
  const repo = await createTempRepo();
  try {
    await writeFile(path.join(repo.path, "a.txt"), "one\n");
    await git(repo.path, ["add", "-A"]);
    await git(repo.path, ["commit", "-m", "initial"]);
    const before = (await runCli(repo.path, ["checkpoint", "before task"])).stdout.trim();
    await writeFile(path.join(repo.path, "a.txt"), "two\n");
    const after = (await runCli(repo.path, ["checkpoint", "after task"])).stdout.trim();

    const show = await runCli(repo.path, ["show", `${before}..${after}`, "--json"]);
    const compare = await runCli(repo.path, ["compare", before, after, "--json"]);
    assert.equal(show.code, 0);
    assert.equal(show.stdout, compare.stdout);
  } finally {
    await repo.cleanup();
  }
});
