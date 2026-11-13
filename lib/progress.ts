"use client";

/**
 * Persistent study progress.
 *
 * Why not just write to Supabase? Progress writes go to `user_progress`, whose
 * row-level security has no INSERT policy for the `anon` role. Until that policy
 * exists (see supabase/migrations/0001_anonymous_progress_policies.sql), every
 * insert is rejected with 42501. Rather than lose the user's work, progress is
 * written to localStorage first and treated as the source of truth for the
 * browser, then mirrored to Supabase when the database accepts it.
 *
 * The local store is deliberately simple: one record per answered question keyed
 * by question id, plus a flag recording the last time the mirror failed so the
 * UI can explain why cloud statistics are empty.
 */

const PROGRESS_KEY = "usmle:progress:v1";
const FLAGS_KEY = "usmle:flags:v1";

export interface ProgressRecord {
  questionId: number;
  isCorrect: boolean;
  selectedAnswer: string;
  examId: string | null;
  answeredAt: string;
  /** true when the row was rejected by the database and only lives locally. */
  pending: boolean;
}

function canUseStorage(): boolean {
  try {
    const probe = "__usmle_probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    // Private mode / disabled storage: everything still works in memory.
    return false;
  }
}

export function readProgress(): Record<string, ProgressRecord> {
  if (typeof window === "undefined" || !canUseStorage()) return {};
  try {
    const raw = window.localStorage.getItem(PROGRESS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, ProgressRecord>) : {};
  } catch {
    return {};
  }
}

function writeProgress(map: Record<string, ProgressRecord>): void {
  if (typeof window === "undefined" || !canUseStorage()) return;
  try {
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(map));
  } catch {
    // Quota exceeded: the session still works, it just will not persist.
  }
}

/** Records one answered question locally. Returns nothing; never throws. */
export function saveProgressLocally(record: ProgressRecord): void {
  const map = readProgress();
  // Keep the first answer for a question unless the new one corrects a miss,
  // so reviewing a question does not rewrite history.
  const existing = map[String(record.questionId)];
  if (existing && existing.isCorrect && !record.isCorrect) return;
  map[String(record.questionId)] = record;
  writeProgress(map);
}

/** Marks a locally stored record as successfully mirrored to the database. */
export function markSynced(questionIds: number[]): void {
  if (questionIds.length === 0) return;
  const map = readProgress();
  for (const id of questionIds) {
    const rec = map[String(id)];
    if (rec && rec.pending) rec.pending = false;
  }
  writeProgress(map);
}

export function getLocalStats(): {
  answered: number;
  correct: number;
  pending: number;
} {
  const map = readProgress();
  const records = Object.values(map);
  return {
    answered: records.length,
    correct: records.filter((r) => r.isCorrect).length,
    pending: records.filter((r) => r.pending).length,
  };
}

export function getLocalProgressFor(questionIds: number[]): Map<number, ProgressRecord> {
  const map = readProgress();
  const out = new Map<number, ProgressRecord>();
  for (const id of questionIds) {
    const rec = map[String(id)];
    if (rec) out.set(id, rec);
  }
  return out;
}

export function clearLocalProgress(): void {
  if (typeof window === "undefined" || !canUseStorage()) return;
  window.localStorage.removeItem(PROGRESS_KEY);
}

// ---------------------------------------------------------------------------
// "Difficult question" flags - questions the user wants to revisit and discuss.
// ---------------------------------------------------------------------------

export interface FlagRecord {
  questionId: number;
  subject: string;
  majorTopic: string;
  subtopic: string;
  questionText: string;
  /** The option the user picked, when they flagged after answering. */
  selectedAnswer: string | null;
  note: string;
  flaggedAt: string;
}

export function readFlags(): FlagRecord[] {
  if (typeof window === "undefined" || !canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(FLAGS_KEY);
    const list = raw ? (JSON.parse(raw) as FlagRecord[]) : [];
    return list.sort((a, b) => b.flaggedAt.localeCompare(a.flaggedAt));
  } catch {
    return [];
  }
}

function writeFlags(list: FlagRecord[]): void {
  if (typeof window === "undefined" || !canUseStorage()) return;
  try {
    window.localStorage.setItem(FLAGS_KEY, JSON.stringify(list));
  } catch {
    // Ignore: the flag simply will not survive a reload.
  }
}

export function isFlagged(questionId: number): boolean {
  return readFlags().some((f) => f.questionId === questionId);
}

export function toggleFlag(record: FlagRecord): boolean {
  const list = readFlags();
  const existing = list.findIndex((f) => f.questionId === record.questionId);
  if (existing >= 0) {
    list.splice(existing, 1);
    writeFlags(list);
    return false;
  }
  list.push(record);
  writeFlags(list);
  return true;
}

export function updateFlagNote(questionId: number, note: string): void {
  const list = readFlags();
  const target = list.find((f) => f.questionId === questionId);
  if (!target) return;
  target.note = note;
  writeFlags(list);
}

export function removeFlag(questionId: number): void {
  writeFlags(readFlags().filter((f) => f.questionId !== questionId));
}
