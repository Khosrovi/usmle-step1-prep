#!/usr/bin/env node
/**
 * Sync the local JSON question bank (questions-bank/**) into Supabase.
 *
 * The app reads questions from the `questions` table, and the anon key is
 * read-only (row level security). This script therefore needs the service role
 * key, which must NOT be committed:
 *
 *   PowerShell:
 *     $env:SUPABASE_SERVICE_ROLE_KEY = "eyJ..."
 *     node scripts/import-questions.mjs
 *
 *   Dry run (validate + report, no writes):
 *     node scripts/import-questions.mjs --dry-run
 *
 * What it does:
 *   1. Validates every question in the bank and refuses to write anything if
 *      there are schema errors.
 *   2. Inserts only questions missing from the database (dedupe by
 *      vignette + question text), so the script is safe to re-run.
 *   3. Recalculates topic_coverage.questions_generated / status for every
 *      subject present in the bank.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd(), "questions-bank");
const DRY_RUN = process.argv.includes("--dry-run");
const SUBJECT_FILTER =
  process.argv.find((arg) => arg.startsWith("--subject="))?.split("=")[1] ?? null;
const BATCH_SIZE = 40;

const DIFFICULTIES = new Set(["easy", "medium", "hard"]);
const REQUIRED = [
  "id",
  "subject",
  "major_topic",
  "subtopic",
  "vignette",
  "question",
  "explanation_correct",
  "difficulty",
];

function loadEnvFile() {
  const file = path.resolve(process.cwd(), ".env.local");
  const values = {};
  if (!fs.existsSync(file)) return values;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match) values[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  return values;
}

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.isFile() && entry.name.endsWith(".json") ? [full] : [];
  });
}

function readBank() {
  const questions = [];
  const errors = [];
  const seenIds = new Set();
  for (const file of walk(ROOT)) {
    const rel = path.relative(process.cwd(), file);
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
    } catch (error) {
      errors.push(`${rel}: invalid JSON (${error.message})`);
      continue;
    }
    const batch = Array.isArray(parsed) ? parsed : [parsed];
    for (const q of batch) {
      const where = `${rel}${q?.id ? ` [${q.id}]` : ""}`;
      for (const field of REQUIRED) {
        if (typeof q?.[field] !== "string" || !q[field].trim()) {
          errors.push(`${where}: missing "${field}"`);
        }
      }
      if (!DIFFICULTIES.has(q?.difficulty)) errors.push(`${where}: bad difficulty`);
      if (!Array.isArray(q?.options) || q.options.length !== 5) {
        errors.push(`${where}: expected 5 options`);
      } else {
        const ids = q.options.map((o) => o?.id);
        if (new Set(ids).size !== 5) errors.push(`${where}: duplicate option ids`);
        if (!ids.includes(q.correct_answer)) errors.push(`${where}: correct_answer not an option`);
        const wrong = ids.filter((id) => id !== q.correct_answer);
        const exp = q.explanation_incorrect ?? {};
        for (const id of wrong) {
          if (typeof exp[id] !== "string" || !exp[id].trim()) {
            errors.push(`${where}: missing explanation for ${id}`);
          }
        }
      }
      if (seenIds.has(q?.id)) errors.push(`${where}: duplicate id`);
      else if (q?.id) seenIds.add(q.id);
      if (!errors.length || !errors[errors.length - 1].startsWith(where)) {
        questions.push(q);
      }
    }
  }
  return { questions, errors };
}

const env = loadEnvFile();
const url = (process.env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
if (!url || !key) {
  console.error("Set SUPABASE_SERVICE_ROLE_KEY (and NEXT_PUBLIC_SUPABASE_URL in .env.local).");
  process.exit(1);
}
const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

const { questions: allQuestions, errors } = readBank();
if (errors.length > 0) {
  console.error(`Bank validation failed with ${errors.length} problem(s):`);
  for (const message of errors.slice(0, 40)) console.error(`  - ${message}`);
  process.exit(1);
}
const questions = SUBJECT_FILTER
  ? allQuestions.filter((q) => q.subject === SUBJECT_FILTER)
  : allQuestions;
console.log(
  `Bank: ${questions.length} question(s) from ${walk(ROOT).length} file(s)` +
    (SUBJECT_FILTER ? ` (subject filter: ${SUBJECT_FILTER})` : "") +
    "."
);

const existingResponse = await fetch(
  `${url}/rest/v1/questions?select=id,subject,vignette,question&limit=10000`,
  { headers }
);
if (!existingResponse.ok) {
  console.error("Failed to read existing questions:", existingResponse.status, await existingResponse.text());
  process.exit(1);
}
const existing = await existingResponse.json();
const existingKeys = new Set(existing.map((q) => `${q.vignette}\u0000${q.question}`));
console.log(`Database already has ${existing.length} question(s).`);

const toInsert = questions.filter((q) => !existingKeys.has(`${q.vignette}\u0000${q.question}`));
console.log(`${toInsert.length} new question(s) to insert.${DRY_RUN ? " (dry run)" : ""}`);

const perSubtopic = new Map();
for (const q of questions) {
  const k = `${q.subject}\u0000${q.major_topic}\u0000${q.subtopic}`;
  perSubtopic.set(k, (perSubtopic.get(k) ?? 0) + 1);
}

if (!DRY_RUN) {
  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    const batch = toInsert.slice(i, i + BATCH_SIZE);
    const rows = batch.map((q) => ({
      subject: q.subject,
      major_topic: q.major_topic,
      subtopic: q.subtopic,
      vignette: q.vignette,
      question: q.question,
      options: q.options,
      correct_answer: q.correct_answer,
      explanation_correct: q.explanation_correct,
      explanation_incorrect: q.explanation_incorrect,
      difficulty: q.difficulty,
    }));
    const response = await fetch(`${url}/rest/v1/questions`, {
      method: "POST",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify(rows),
    });
    if (!response.ok) {
      console.error(`Insert failed (${response.status}):`, await response.text());
      process.exit(1);
    }
    console.log(`Inserted ${Math.min(i + BATCH_SIZE, toInsert.length)}/${toInsert.length}`);
  }

  const topicsResponse = await fetch(`${url}/rest/v1/topic_coverage?select=*&limit=1000`, { headers });
  const topics = topicsResponse.ok ? await topicsResponse.json() : [];

  // A subject whose plan rows do not exist yet (Microbiology, for example) is
  // created from .cache/topic-coverage-<subject>.json, so the dashboard can
  // show planned vs generated coverage without a manual SQL step.
  const subjectsInBank = new Set(questions.map((q) => q.subject));
  for (const subject of subjectsInBank) {
    if (topics.some((t) => t.subject === subject)) continue;
    const planFile = path.resolve(
      process.cwd(),
      `.cache/topic-coverage-${subject.toLowerCase()}.json`
    );
    if (!fs.existsSync(planFile)) {
      console.warn(`  ${subject}: no coverage rows and no plan file ${planFile} — skipping coverage bootstrap.`);
      continue;
    }
    const plan = JSON.parse(fs.readFileSync(planFile, "utf8"));
    const rows = plan.map((row) => ({
      subject: row.subject ?? subject,
      major_topic: row.major_topic,
      subtopic: row.subtopic,
      questions_planned: row.questions_planned ?? 0,
      questions_generated: 0,
      status: "pending",
    }));
    const created = await fetch(`${url}/rest/v1/topic_coverage`, {
      method: "POST",
      headers: { ...headers, Prefer: "return=representation" },
      body: JSON.stringify(rows),
    });
    if (!created.ok) {
      console.error(`topic_coverage bootstrap failed for ${subject}:`, await created.text());
      process.exit(1);
    }
    const createdRows = await created.json();
    topics.push(...createdRows);
    console.log(`Created ${createdRows.length} topic_coverage row(s) for ${subject}.`);
  }

  let updated = 0;
  for (const topic of topics) {
    if (SUBJECT_FILTER && topic.subject !== SUBJECT_FILTER) continue;
    const count = perSubtopic.get(`${topic.subject}\u0000${topic.major_topic}\u0000${topic.subtopic}`) ?? 0;
    const status = count >= (topic.questions_planned ?? 0) ? "completed" : "pending";
    if (topic.questions_generated === count && topic.status === status) continue;
    const patch = await fetch(`${url}/rest/v1/topic_coverage?id=eq.${topic.id}`, {
      method: "PATCH",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify({ questions_generated: count, status }),
    });
    if (!patch.ok) {
      console.error(`topic_coverage update failed for ${topic.id}:`, await patch.text());
      process.exit(1);
    }
    updated++;
  }
  console.log(`Updated ${updated} topic_coverage row(s).`);
}

const bySubject = new Map();
for (const q of questions) bySubject.set(q.subject, (bySubject.get(q.subject) ?? 0) + 1);
for (const [subject, count] of bySubject) console.log(`  ${subject}: ${count} question(s)`);

console.log(DRY_RUN ? "Dry run finished." : "Sync finished.");
