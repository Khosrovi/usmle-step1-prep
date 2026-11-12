# USMLE Step 1 Prep Platform

## 🎯 Project Goal
A free, self-hosted web platform for USMLE Step 1 preparation.
The app presents clinical vignette-style questions (similar to UWorld format)
with multiple-choice answers and detailed explanations for each option.

**Primary user goal:** pass USMLE Step 1 with minimal financial cost.

## 🧠 Context for AI Agents
If you are an AI agent reading this file, here is what you need to know:
- **Content source:** questions are generated from 5 reference PDFs:
  - `1. Biochemistry.pdf`
  - `2. Immunology.pdf`
  - `3. Microbiology.pdf`
  - `4. Pathology.pdf`
  - `5. Pharmacology.pdf`
- **Question format:** clinical vignette → 5 answer options (A–E), exactly one
  correct → explanation of why each option is correct/incorrect.
- **Language:** questions in English (USMLE is in English).
- **Architecture:** Next.js App Router reads questions from **Supabase**
  (`questions` table); the JSON bank in `questions-bank/` is the source of truth
  and is synced by `scripts/import-questions.mjs`. Progress, bookmarks and stats
  also live in Supabase.
- **Work step by step**, keep components small, and validate the bank before
  syncing.

## 📁 Repository Structure
```
usmle-step1-prep/
├── AI-CONTEXT.md          # onboarding + roadmap (read first)
├── README.md              # this file
├── app/                   # Next.js App Router pages
│   ├── dashboard/         # subject → mode → topic picker
│   ├── quiz/              # question runner
│   ├── stats/             # accuracy per topic
│   ├── bookmarks/         # saved questions
│   └── exam-results/      # exam review
├── components/            # UI components (shadcn-style + base-ui)
├── questions-bank/        # JSON question bank (source of truth)
├── scripts/               # validation + Supabase sync tooling
├── docs/PRD.md            # product requirements
└── supabase/              # generated SQL seed (alternative to the script)
```

## 🛠️ Tech Stack
- Next.js 16 (App Router, Turbopack) + React 19 + TypeScript
- Tailwind CSS v4 with light/dark theme tokens (`app/globals.css`)
- Supabase (PostgreSQL) for questions, progress, bookmarks
- Vercel / Netlify for hosting

## 🎨 UI
- Light / dark theme toggle in the header of every page.
- The choice is stored in `localStorage` and falls back to the OS preference;
  an inline script in `app/layout.tsx` applies it before the first paint, so
  there is no theme flash.
- All colors go through semantic tokens (`background`, `foreground`, `card`,
  `muted`, `primary`, …) defined for both themes in `app/globals.css` — prefer
  those classes (`bg-background`, `text-muted-foreground`, …) over raw palette
  colors so text stays readable in both modes.

## 🗂️ Question Bank Workflow
`questions-bank/<subject>/<id>.json` — one question per file:

```json
{
  "id": "biochem-615-01",
  "subject": "Biochemistry",
  "major_topic": "Carbohydrate Metabolism",
  "subtopic": "Glycolysis",
  "difficulty": "medium",
  "vignette": "…",
  "question": "…",
  "options": [{ "id": "A", "text": "…" }],
  "correct_answer": "C",
  "explanation_correct": "…",
  "explanation_incorrect": { "A": "…", "B": "…", "D": "…", "E": "…" },
  "educationalObjective": "…",
  "source": "Generated from 1. Biochemistry.pdf"
}
```

Scripts (see `scripts/`):
- `npm run validate:questions` — checks every bank file (5 options, one correct
  answer, explanation for each option, unique ids).
- `npm run import:questions` — validates the bank, inserts only questions that
  are missing from Supabase (dedupe by vignette + question) and recalculates
  `topic_coverage.questions_generated` / `status`. Needs the **service role
  key** (never commit it):

  ```powershell
  $env:SUPABASE_SERVICE_ROLE_KEY = "eyJ..."
  npm run import:questions            # add --dry-run to only report
  ```

  The anon key used by the app is read-only on `questions` (row level security).
- `npm run export:seed-sql` — alternative path: generates
  `supabase/seed_questions.sql` to paste into the Supabase SQL editor.

## 🔑 Environment Variables
`.env.local` (never commit):

```
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
```

`SUPABASE_SERVICE_ROLE_KEY` is only needed for local import scripts and must be
passed through the shell environment, not stored in the repository.

## ✅ Success Metrics
- 100+ questions across all 5 topics
- User can complete a 20-question quiz in < 10 minutes
- All explanations reference source PDF content
- Platform is free to use (no paid APIs required)
