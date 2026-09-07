import type { FileStatus } from "./types.ts";

export interface NameStatusEntry {
  status: FileStatus;
  path: string;
  oldPath?: string;
  similarity?: number;
}

/**
 * Parses `git diff -z --name-status` output. Verified against real git
 * 2.51.2 output (see tests): non-rename records are `<code>\0<path>\0`;
 * rename/copy records are `<code+score>\0<oldpath>\0<newpath>\0`.
 */
export function parseNameStatus(raw: string): NameStatusEntry[] {
  const tokens = raw.split("\0").filter((token) => token.length > 0);
  const results: NameStatusEntry[] = [];

  let i = 0;
  while (i < tokens.length) {
    const code = tokens[i]!;
    i++;

    if (code[0] === "R" || code[0] === "C") {
      const oldPath = tokens[i]!;
      i++;
      const newPath = tokens[i]!;
      i++;
      const entry: NameStatusEntry = { status: "renamed", path: newPath, oldPath };
      if (code.length > 1) {
        entry.similarity = Number(code.slice(1));
      }
      results.push(entry);
      continue;
    }

    const path = tokens[i]!;
    i++;
    const status: FileStatus = code === "A" ? "added" : code === "D" ? "deleted" : "modified";
    results.push({ status, path });
  }

  return results;
}

export interface NumstatEntry {
  path: string;
  additions: number | null;
  deletions: number | null;
  binary: boolean;
}

/**
 * Parses `git diff -z --numstat` output. Verified against real git 2.51.2
 * output (see tests): non-rename records are `<added>\t<deleted>\t<path>\0`;
 * binary records use `-\t-\t<path>\0`; rename records are
 * `<added>\t<deleted>\t\0<oldpath>\0<newpath>\0` (empty third field before
 * the two NUL-terminated paths).
 */
export function parseNumstat(raw: string): NumstatEntry[] {
  const tokens = raw.split("\0");
  if (tokens.at(-1) === "") {
    tokens.pop();
  }
  const results: NumstatEntry[] = [];

  let i = 0;
  while (i < tokens.length) {
    const record = tokens[i]!;
    i++;
    const [addedRaw, deletedRaw, pathField] = record.split("\t");

    let path: string;
    if (pathField === "") {
      path = tokens[i + 1]!;
      i += 2;
    } else {
      path = pathField!;
    }

    const binary = addedRaw === "-" && deletedRaw === "-";
    results.push({
      path,
      additions: binary ? null : Number(addedRaw),
      deletions: binary ? null : Number(deletedRaw),
      binary,
    });
  }

  return results;
}

/**
 * Splits a full `git diff` (non -z) into one chunk per file, in the same
 * order git printed them — the same order name-status/numstat report, so
 * callers zip by position rather than parsing paths back out of headers
 * (which would need to undo core.quotepath quoting for no benefit).
 * chunks.join("\n") reproduces the input exactly (lossless).
 */
export function splitUnifiedDiffByFile(raw: string): string[] {
  if (raw === "") {
    return [];
  }

  const lines = raw.split("\n");
  const chunks: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (line.startsWith("diff --git ") && current.length > 0) {
      chunks.push(current.join("\n"));
      current = [];
    }
    current.push(line);
  }
  if (current.length > 0) {
    chunks.push(current.join("\n"));
  }

  return chunks;
}
