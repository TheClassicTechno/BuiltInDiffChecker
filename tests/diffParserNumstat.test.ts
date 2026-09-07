import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createTempRepo } from "./fixtures/tempRepo.ts";
import { parseNumstat } from "../src/diffParser.ts";

const execFileAsync = promisify(execFile);

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", ["-C", cwd, ...args]);
  return stdout;
}

test("parseNumstat parses real git -z --numstat output: modified, renamed, and binary", async () => {
  const repo = await createTempRepo();
  try {
    await writeFile(path.join(repo.path, "modified.txt"), "a\nb\n");
    await writeFile(path.join(repo.path, "toRename.txt"), "line1\nline2\n");
    await git(repo.path, ["add", "-A"]);
    await git(repo.path, ["commit", "-m", "base"]);

    await writeFile(path.join(repo.path, "modified.txt"), "a\nb\nc\n");
    await git(repo.path, ["mv", "toRename.txt", "renamed.txt"]);
    await writeFile(path.join(repo.path, "renamed.txt"), "line1\nline2\nline3\n");
    await writeFile(path.join(repo.path, "bin.dat"), Buffer.from([0, 1, 2, 0, 3, 4]));
    await git(repo.path, ["add", "-A"]);
    await git(repo.path, ["commit", "-m", "changes"]);

    const raw = await git(repo.path, ["diff", "--no-color", "-M", "-z", "--numstat", "HEAD~1", "HEAD"]);
    const parsed = parseNumstat(raw);

    assert.deepEqual(
      parsed.find((p) => p.path === "modified.txt"),
      { path: "modified.txt", additions: 1, deletions: 0, binary: false },
    );

    const renamed = parsed.find((p) => p.path === "renamed.txt");
    assert.equal(renamed?.additions, 1);
    assert.equal(renamed?.deletions, 0);
    assert.equal(renamed?.binary, false);

    assert.deepEqual(
      parsed.find((p) => p.path === "bin.dat"),
      { path: "bin.dat", additions: null, deletions: null, binary: true },
    );
  } finally {
    await repo.cleanup();
  }
});
