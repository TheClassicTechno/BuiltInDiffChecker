import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFile, readFile } from "node:fs/promises";
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

test("`diffcheck checkpoint <name>` prints the new checkpoint id and persists a record", async () => {
  const repo = await createTempRepo();
  try {
    await writeFile(path.join(repo.path, "a.txt"), "one\n");
    await git(repo.path, ["add", "-A"]);
    await git(repo.path, ["commit", "-m", "initial"]);

    const result = await runCli(repo.path, ["checkpoint", "before task"]);
    assert.equal(result.code, 0);

    const id = result.stdout.trim();
    assert.match(id, /^[0-9a-f-]{36}$/);

    const raw = await readFile(path.join(repo.path, ".diffcheck", "checkpoints", `${id}.json`), "utf8");
    const record = JSON.parse(raw);
    assert.equal(record.name, "before task");
  } finally {
    await repo.cleanup();
  }
});
