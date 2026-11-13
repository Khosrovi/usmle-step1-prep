#!/usr/bin/env node
/**
 * Validate a directory of microbiology question fragments before ingest.
 *
 * This mirrors the checks in scripts/ingest-generated.mjs so a broken batch is
 * caught by the generating agent rather than at ingest time. It only reads.
 *
 *   node scripts/check-micro-batches.mjs .cache/incoming-microbiology [--plan]
 *
 * With --plan it also checks every (major_topic, subtopic) pair against
 * .cache/topic-coverage-microbiology.json and reports per-subtopic counts
 * against the planned targets.
 */
import fs from "node:fs";
import path from "node:path";

const dir = process.argv[2];
const checkPlan = process.argv.includes("--plan");
if (!dir) {
  console.error("Usage: node scripts/check-micro-batches.mjs <dir> [--plan]");
  process.exit(1);
}

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
const DIFFICULTIES = new Set(["easy", "medium", "hard"]);

function walk(d) {
  if (!fs.existsSync(d)) return [];
  return fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(d, e.name);
    if (e.isDirectory()) return walk(full);
    return e.isFile() && e.name.endsWith(".json") ? [full] : [];
  });
}

let planRows = [];
if (checkPlan) {
  const planFile = path.resolve(process.cwd(), ".cache/topic-coverage-microbiology.json");
  if (fs.existsSync(planFile)) planRows = JSON.parse(fs.readFileSync(planFile, "utf8"));
}
const planPairs = new Set(planRows.map((r) => `${r.major_topic}\u0000${r.subtopic}`));

const errors = [];
const ids = new Set();
const keys = new Set();
const counts = new Map();
const allQuestions = [];
let total = 0;

const files = walk(dir);
if (files.length === 0) {
  console.error(`No JSON fragments under ${dir}`);
  process.exit(1);
}

for (const file of files) {
  const rel = path.relative(process.cwd(), file);
  let batch;
  try {
    batch = JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
  } catch (e) {
    errors.push(`${rel}: invalid JSON (${e.message})`);
    continue;
  }
  if (!Array.isArray(batch)) batch = [batch];

  batch.forEach((q, i) => {
    const where = `${rel}#${i}${q?.id ? ` [${q.id}]` : ""}`;
    total++;
    allQuestions.push(q);
    for (const f of REQUIRED) {
      if (typeof q?.[f] !== "string" || !q[f].trim()) errors.push(`${where}: missing "${f}"`);
    }
    if (!DIFFICULTIES.has(q?.difficulty)) errors.push(`${where}: bad difficulty ${JSON.stringify(q?.difficulty)}`);
    if (q?.subject !== "Microbiology") errors.push(`${where}: subject must be "Microbiology"`);
    if (checkPlan && planPairs.size && !planPairs.has(`${q?.major_topic}\u0000${q?.subtopic}`)) {
      errors.push(`${where}: pair not in plan: ${JSON.stringify(q?.major_topic)} / ${JSON.stringify(q?.subtopic)}`);
    }
    if (q?.id) {
      if (ids.has(q.id)) errors.push(`${where}: duplicate id`);
      ids.add(q.id);
    }
    const key = `${q?.vignette}\u0000${q?.question}`;
    if (q?.vignette && q?.question) {
      if (keys.has(key)) errors.push(`${where}: duplicate vignette+question`);
      keys.add(key);
    }
    const opt = Array.isArray(q?.options) ? q.options : [];
    if (opt.length !== 5) errors.push(`${where}: ${opt.length} options`);
    const optIds = opt.map((o) => o?.id);
    if (optIds.join("") !== "ABCDE") errors.push(`${where}: option ids ${JSON.stringify(optIds)}`);
    for (const o of opt) {
      if (typeof o?.text !== "string" || !o.text.trim()) errors.push(`${where}: option ${o?.id} empty`);
      if (o && "isCorrect" in o) errors.push(`${where}: option ${o?.id} has isCorrect`);
    }
    if (!optIds.includes(q?.correct_answer)) errors.push(`${where}: correct_answer not an option id`);
    const ex = q?.explanation_incorrect ?? {};
    if (typeof ex !== "object" || Array.isArray(ex)) {
      errors.push(`${where}: explanation_incorrect must be an object`);
    } else {
      for (const id of optIds.filter((x) => x !== q?.correct_answer)) {
        if (typeof ex[id] !== "string" || !ex[id].trim()) errors.push(`${where}: no explanation for ${id}`);
      }
      const extra = Object.keys(ex).filter((k) => !optIds.includes(k) || k === q?.correct_answer);
      if (extra.length) errors.push(`${where}: explanation_incorrect extra keys ${extra.join(",")}`);
      const texts = Object.values(ex).map((t) => String(t).trim().toLowerCase());
      if (new Set(texts).size !== texts.length) errors.push(`${where}: duplicate wrong-option explanations`);
    }
    const pk = `${q?.major_topic}\u0000${q?.subtopic}`;
    counts.set(pk, (counts.get(pk) ?? 0) + 1);
  });
}

console.log(`files: ${files.length}  questions: ${total}  errors: ${errors.length}`);
if (errors.length) {
  for (const e of errors.slice(0, 60)) console.log("  ERROR " + e);
  if (errors.length > 60) console.log(`  ... and ${errors.length - 60} more`);
}

// Answer-position balance. A bank where "A" is correct 40% of the time lets a
// student beat the exam by always picking A, so this is a content-quality gate
// rather than a schema check. Expressed as a check so it shows up before ingest.
if (total > 0) {
  const dist = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  for (const q of allQuestions) {
    if (q?.correct_answer in dist) dist[q.correct_answer]++;
  }
  const pct = Object.fromEntries(
    Object.entries(dist).map(([k, v]) => [k, Math.round((v / total) * 100)])
  );
  console.log(`\nanswer distribution: ${JSON.stringify(dist)}  (${JSON.stringify(pct)}%)`);
  const over = Object.entries(dist).filter(([, v]) => v / total > 0.3);
  if (over.length) {
    console.log(
      `  WARN answer-position skew: ${over.map(([k, v]) => `${k}=${v}`).join(", ")} — ` +
        `no letter should exceed 30% of ${total}. Rebalance by permuting options.`
    );
  }
}


if (checkPlan && planRows.length) {
  console.log("\nper subtopic (actual / planned):");
  let missing = 0;
  for (const row of planRows) {
    const pk = `${row.major_topic}\u0000${row.subtopic}`;
    const got = counts.get(pk) ?? 0;
    const flag = got === row.questions_planned ? "ok" : got === 0 ? "MISSING" : "off";
    if (got !== row.questions_planned) missing++;
    if (got !== row.questions_planned) {
      console.log(`  [${flag}] ${row.major_topic} / ${row.subtopic}: ${got}/${row.questions_planned}`);
    }
  }
  console.log(`subtopics not exactly on target: ${missing}/${planRows.length}`);
}

process.exit(errors.length ? 1 : 0);
