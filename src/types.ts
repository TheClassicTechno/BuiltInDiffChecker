export interface Checkpoint {
  id: string;
  name: string;
  note?: string;
  createdAt: string;
  commitSha: string;
  parentCheckpointId?: string;
}

export type FileStatus = "added" | "modified" | "deleted" | "renamed";

export interface FileChange {
  status: FileStatus;
  path: string;
  oldPath?: string;
  renameSimilarity?: number;
  binary: boolean;
  additions: number | null;
  deletions: number | null;
  patch: string | null;
}

export interface Comparison {
  from: Checkpoint;
  to: Checkpoint;
  files: FileChange[];
  totalAdditions: number;
  totalDeletions: number;
  rawDiff: string;
}
