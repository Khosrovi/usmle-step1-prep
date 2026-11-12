#!/usr/bin/env node
/**
 * Ingest AI-generated question fragments into questions-bank/<subject>/.
 *
 * Generation happens in many small batches (one fragment per subtopic-ish chunk)
 * so a single malformed batch can never destroy the bank. This script is the
 * gate: every question is checked against the schema and the topic_coverage
 * plan before it is written, and nothing is written at all if a fragment has
 * problems.
 *
 * Usage:
 *   node scripts/ingest-generated.mjs --dir=<incoming dir> --subject=Immunology
 *   node scripts/ingest-generated.mjs --dir=<incoming dir> --subject=Immunology --dry-run
 *
 * Fragment layout: <incoming dir>/*.json, each either a single question or an
 * array of questions.
 *
 * Checks:
 *   - required string fields, valid difficulty
 *   - exactly 5 options with unique ids A-E
 *   - correct_answer is one of the option ids
 *   - explanation_correct present, explanation for every wrong option present
 *   - no duplicate explanation text ("lazy filler" detection)
 *   - subject matches --subject
 *   - (major_topic, subtopic) exists in the topic_coverage plan for the subject
 *   - id is unique in the fragment, the incoming dir, and the existing bank
 *
 * Output file naming: <prefix>-NNN.json, continuing the existing numbering.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd(), "questions-bank");
const DIFFICULTIES = new Set(["easy", "medium", "hard"]);
const REQUIRED = [
  "id",
  "subject",
  "major_topic",
  "subtopic",
  "vignette",
  "question",
  "explanation_correct",
  "educationalObjective",
  "source",
];

const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=") ?? null;
const DRY_RUN = process.argv.includes("--dry-run");
const incomingDir = arg("dir");
const subject = arg("subject");

if (!incomingDir || !subject) {
  console.error("Usage: node scripts/ingest-generated.mjs --dir=<dir> --subject=<Subject> [--dry-run]");
  process.exit(1);
}

const slug = subject.toLowerCase();
const subjectDir = path.join(ROOT, slug);

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.isFile() && entry.name.endsWith(".json") ? [full] : [];
  });
}

function readJson(file) {
  const text = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  const parsed = JSON.parse(text);
  return Array.isArray(parsed) ? parsed : [parsed];
}

// ---------------------------------------------------------------- plan check
// The topic_coverage plan is the authority for (major_topic, subtopic) pairs.
const planFile = path.resolve(process.cwd(), `.cache/topic-coverage-${subject.toLowerCase()}.json`);
let planPairs = null;
if (fs.existsSync(planFile)) {
  const plan = JSON.parse(fs.readFileSync(planFile, "utf8"));
  planPairs = new Set(plan.map((row) => `${row.major_topic}\u0000${row.subtopic}`));
}

// ------------------------------------------------------------- existing bank
const existingIds = new Set();
const existingKeys = new Set();
for (const file of walk(subjectDir)) {
  for (const q of readJson(file)) {
    if (q?.id) existingIds.add(q.id);
    if (q?.vignette && q?.question) existingKeys.add(`${q.vignette}\u0000${q.question}`);
  }
}

// ------------------------------------------------------------------ fragments
const files = walk(path.resolve(incomingDir)).filter((f) => f.endsWith(".json"));
if (files.length === 0) {
  console.error(`No JSON fragments found under ${path.resolve(incomingDir)}`);
  process.exit(1);
}

const errors = [];
const accepted = [];
const seenIncoming = new Set();

for (const file of files) {
  const rel = path.relative(process.cwd(), file);
  let batch;
  try {
    batch = readJson(file);
  } catch (error) {
    errors.push(`${rel}: invalid JSON (${error.message})`);
    continue;
  }

  batch.forEach((q, index) => {
    const where = `${rel}#${index}${q?.id ? ` [${q.id}]` : ""}`;

    for (const field of REQUIRED) {
      if (typeof q?.[field] !== "string" || !q[field].trim()) {
        errors.push(`${where}: missing or empty "${field}"`);
      }
    }
    if (!DIFFICULTIES.has(q?.difficulty)) {
      errors.push(`${where}: difficulty must be easy|medium|hard (got ${JSON.stringify(q?.difficulty)})`);
    }
    if (q?.subject !== subject) {
      errors.push(`${where}: subject must be "${subject}" (got ${JSON.stringify(q?.subject)})`);
    }
    if (planPairs && !planPairs.has(`${q?.major_topic}\u0000${q?.subtopic}`)) {
      errors.push(`${where}: (major_topic, subtopic) not in topic_coverage plan: ${JSON.stringify(q?.major_topic)} / ${JSON.stringify(q?.subtopic)}`);
    }

    if (seenIncoming.has(q?.id)) errors.push(`${where}: duplicate id within this ingest`);
    else if (q?.id) seenIncoming.add(q.id);
    if (existingIds.has(q?.id)) errors.push(`${where}: id already exists in the bank`);

    const key = `${q?.vignette}\u0000${q?.question}`;
    if (q?.vignette && q?.question) {
      if (existingKeys.has(key)) errors.push(`${where}: duplicate vignette+question already in the bank`);
      existingKeys.add(key);
    }

    const options = Array.isArray(q?.options) ? q.options : [];
    if (options.length !== 5) {
      errors.push(`${where}: expected 5 options, found ${options.length}`);
    }
    const ids = options.map((o) => o?.id);
    if (ids.join("") !== "ABCDE") {
      errors.push(`${where}: option ids must be A,B,C,D,E in order (got ${JSON.stringify(ids)})`);
    }
    for (const option of options) {
      if (typeof option?.text !== "string" || !option.text.trim()) {
        errors.push(`${where}: option ${option?.id} has no text`);
      }
      if ("isCorrect" in (option ?? {})) {
        errors.push(`${where}: option ${option?.id} must not carry isCorrect (use correct_answer)`);
      }
    }
    if (!ids.includes(q?.correct_answer)) {
      errors.push(`${where}: correct_answer "${q?.correct_answer}" is not an option id`);
    }

    const explanations = q?.explanation_incorrect ?? {};
    if (typeof explanations !== "object" || Array.isArray(explanations)) {
      errors.push(`${where}: explanation_incorrect must be an object`);
    } else {
      for (const id of ids.filter((x) => x !== q?.correct_answer)) {
        if (typeof explanations[id] !== "string" || !explanations[id].trim()) {
          errors.push(`${where}: missing explanation for wrong option ${id}`);
        }
      }
      const extra = Object.keys(explanations).filter((k) => !ids.includes(k) || k === q?.correct_answer);
      if (extra.length) errors.push(`${where}: explanation_incorrect has unexpected key(s) ${extra.join(",")}`);
      // Lazy filler detection: a wrong-option explanation must say something
      // specific rather than repeat the generic stem.
      const texts = Object.values(explanations).map((t) => String(t).trim().toLowerCase());
      if (new Set(texts).size !== texts.length) {
        errors.push(`${where}: duplicate explanation text among wrong options`);
      }
      for (const id of ids.filter((x) => x !== q?.correct_answer)) {
        if (typeof explanations[id] === "string" && explanations[id].trim().length < 20) {
          errors.push(`${where}: explanation for ${id} is too short (<20 chars)`);
        }
      }
    }
    if (typeof q?.explanation_correct === "string" && q.explanation_correct.trim().length < 40) {
      errors.push(`${where}: explanation_correct is too short (<40 chars)`);
    }

    if (q?.id && !/^[a-z]+-\d+$/.test(q.id)) {
      errors.push(`${where}: id must match <prefix>-<number> (e.g. immuno-001)`);
    }
    if (!errors.some((e) => e.startsWith(where))) accepted.push(q);
  });
}

if (errors.length > 0) {
  console.error(`Ingest rejected: ${errors.length} problem(s). Nothing was written.`);
  for (const message of errors.slice(0, 60)) console.error(`  - ${message}`);
  if (errors.length > 60) console.error(`  ... and ${errors.length - 60} more`);
  process.exit(1);
}

// ------------------------------------------------------------------- writing
// Number output files continuing from the highest existing number.
let maxN = 0;
if (fs.existsSync(subjectDir)) {
  for (const entry of fs.readdirSync(subjectDir)) {
    const m = entry.match(/-(\d+)\.json$/);
    if (m) maxN = Math.max(maxN, Number(m[1]));
  }
}

// Group accepted questions by subtopic so one file holds one coherent subtopic.
const groups = new Map();
for (const q of accepted) {
  const key = `${q.major_topic}\u0000${q.subtopic}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(q);
}

const written = [];
let n = maxN;
for (const [key, questions] of groups) {
  const [majorTopic, subtopic] = key.split("\u0000");
  n += 1;
  const name = `${slug}-${String(n).padStart(3, "0")}.json`;
  const target = path.join(subjectDir, name);
  written.push(`${name}  ${majorTopic} / ${subtopic}  (${questions.length})`);
  if (!DRY_RUN) {
    fs.mkdirSync(subjectDir, { recursive: true });
    // One question per line inside the array keeps diffs readable for review.
    const body = questions.map((q) => JSON.stringify(q, null, 2)).join(",\n");
    fs.writeFileSync(target, `[\n${body}\n]\n`, "utf8");
  }
}

console.log(`${DRY_RUN ? "Would ingest" : "Ingested"} ${accepted.length} question(s) into ${slug}/:`);
for (const line of written) console.log(`  ${line}`);
