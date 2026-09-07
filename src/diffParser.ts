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
