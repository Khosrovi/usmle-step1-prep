#!/usr/bin/env node
/**
 * Validate every question in questions-bank/**\/*.json.
 *
 * Each JSON file may hold either a single question object or an array of them.
 * Rules (from AI-CONTEXT.md / docs/PRD.md):
 *   - 5 options, ids A-E, exactly one correct answer
 *   - an explanation for the correct option and for every wrong option
 *   - required fields and a valid difficulty
 *
 * Usage: node scripts/validate-questions.mjs
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd(), "questions-bank");
const REQUIRED_STRINGS = [
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

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.isFile() && entry.name.endsWith(".json") ? [full] : [];
  });
}

function asQuestions(file) {
  const text = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  const parsed = JSON.parse(text);
  return Array.isArray(parsed) ? parsed : [parsed];
}

const errors = [];
const seen = new Map();
const files = walk(ROOT);

if (files.length === 0) {
  console.error(`No JSON files found under ${ROOT}`);
  process.exit(1);
}

for (const file of files) {
  const rel = path.relative(process.cwd(), file);
  let questions;
  try {
    questions = asQuestions(file);
  } catch (error) {
    errors.push(`${rel}: invalid JSON (${error.message})`);
    continue;
  }

  for (const q of questions) {
    const where = `${rel}${q && q.id ? ` [${q.id}]` : ""}`;
    for (const field of REQUIRED_STRINGS) {
      if (typeof q?.[field] !== "string" || !q[field].trim()) {
        errors.push(`${where}: missing or empty "${field}"`);
      }
    }
    if (!DIFFICULTIES.has(q?.difficulty)) {
      errors.push(`${where}: difficulty must be easy|medium|hard`);
    }
    if (seen.has(q?.id)) {
      errors.push(`${where}: duplicate id (also in ${seen.get(q.id)})`);
    } else if (q?.id) {
      seen.set(q.id, rel);
    }

    const options = Array.isArray(q?.options) ? q.options : [];
    if (options.length !== 5) {
      errors.push(`${where}: expected 5 options, found ${options.length}`);
    }
    const optionIds = options.map((o) => o?.id);
    if (new Set(optionIds).size !== optionIds.length) {
      errors.push(`${where}: duplicate option ids`);
    }
    for (const option of options) {
      if (typeof option?.text !== "string" || !option.text.trim()) {
        errors.push(`${where}: option ${option?.id} has no text`);
      }
    }
    if (!optionIds.includes(q?.correct_answer)) {
      errors.push(`${where}: correct_answer "${q?.correct_answer}" is not an option id`);
    }
    const wrongIds = optionIds.filter((id) => id !== q?.correct_answer);
    const explanations = q?.explanation_incorrect ?? {};
    for (const id of wrongIds) {
      if (typeof explanations[id] !== "string" || !explanations[id].trim()) {
        errors.push(`${where}: missing explanation for wrong option ${id}`);
      }
    }
  }
}

if (errors.length > 0) {
  console.error(`Validation failed with ${errors.length} problem(s):`);
  for (const message of errors) console.error(`  - ${message}`);
  process.exit(1);
}

console.log(`OK: ${seen.size} question(s) across ${files.length} file(s) are valid.`);
