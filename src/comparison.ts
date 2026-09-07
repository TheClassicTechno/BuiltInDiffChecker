import { parseNameStatus, parseNumstat, splitUnifiedDiffByFile } from "./diffParser.ts";
import { buildTree, diffCommits, type RawDiff } from "./gitWrapper.ts";
import type { Checkpoint, Comparison, FileChange } from "./types.ts";

/**
 * Combines the three parsed views of one `git diff` invocation into a
 * typed Comparison. name-status, numstat, and the full diff all list
 * files in the same git-determined order, so they're zipped positionally
 * (see diffParser.ts's splitUnifiedDiffByFile note). See DESIGN.md §2/§5.
 */
export function buildComparison(from: Checkpoint, to: Checkpoint, raw: RawDiff): Comparison {
  const nameStatus = parseNameStatus(raw.nameStatusRaw);
  const numstat = parseNumstat(raw.numstatRaw);
  const diffChunks = splitUnifiedDiffByFile(raw.fullDiffRaw);

  const files: FileChange[] = nameStatus.map((entry, i) => {
    const stat = numstat[i];
    const binary = stat?.binary ?? false;

    return {
      status: entry.status,
      path: entry.path,
      ...(entry.oldPath !== undefined ? { oldPath: entry.oldPath } : {}),
      ...(entry.similarity !== undefined ? { renameSimilarity: entry.similarity } : {}),
      binary,
      additions: binary ? null : (stat?.additions ?? null),
      deletions: binary ? null : (stat?.deletions ?? null),
      patch: binary ? null : (diffChunks[i] ?? null),
    };
  });

  const totalAdditions = files.reduce((sum, f) => sum + (f.additions ?? 0), 0);
  const totalDeletions = files.reduce((sum, f) => sum + (f.deletions ?? 0), 0);

  return { from, to, files, totalAdditions, totalDeletions, rawDiff: raw.fullDiffRaw };
}

/**
 * Compares a checkpoint against the current live working tree (staged +
 * unstaged + untracked-non-ignored), by snapshotting the working tree into
 * an ephemeral, unpinned tree object and diffing against that — reusing
 * buildTree rather than a separate "diff vs. working tree" code path.
 * The synthetic "to" checkpoint is not persisted. See DESIGN.md §4/§7
 * ("latest"/"working" mode).
 */
export async function compareAgainstWorking(
  toplevel: string,
  hasHead: boolean,
  from: Checkpoint,
  extraFlags: string[] = [],
): Promise<Comparison> {
  const treeSha = await buildTree(toplevel, hasHead);
  const raw = await diffCommits(toplevel, from.commitSha, treeSha, extraFlags);

  const working: Checkpoint = {
    id: "working",
    name: "(working tree)",
    createdAt: new Date().toISOString(),
    commitSha: treeSha,
  };

  return buildComparison(from, working, raw);
}
