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

## 🔧 One-time setup: enable saving of study progress

**Symptom if this step is skipped:** quizzes work, but answered / correct /
accuracy stay at 0 and the Stats page shows the yellow banner *"Showing progress
saved in this browser."*

**Cause:** the app has no login, so every request reaches Supabase as the `anon`
role. Row level security is enabled on `user_progress` with no policy allowing
`anon` to insert, so every progress write is rejected:

```
401  {"code":"42501","message":"new row violates row-level security policy for table \"user_progress\""}
```

Reads still work, which is why the UI appears healthy while nothing accumulates.
Exactly the same block applies to inserting questions into `questions` and plan
rows into `topic_coverage`.

**Fix (2 minutes, once):**

1. Open <https://supabase.com/dashboard> and select the project
   (`fkuqohcosijdbgatdqjm`).
2. Left sidebar → **SQL Editor** → **New query**.
3. Open the file
   [`supabase/migrations/0002_disable_rls_for_anonymous_app.sql`](supabase/migrations/0002_disable_rls_for_anonymous_app.sql),
   copy **everything**, paste it into the editor.
4. Press **Run** (or Ctrl+Enter). It should report success; the script is
   idempotent, so running it twice is harmless.
5. Reload the app. The yellow banner disappears and the numbers move.

The script disables row level security (and drops the leftover policies) on
`user_progress`, `bookmarks`, `questions` and `topic_coverage`.

> ⚠️ **What that trade-off means.** With RLS off, anyone holding the anon key —
> which ships inside the browser bundle and is therefore effectively public —
> can read *and modify* every row in those tables. Questions and the coverage
> plan are public content, so that part is harmless. For `user_progress` and
> `bookmarks` it means a visitor could read or wipe the study history. That is
> fine for a personal study tool on a private URL; it is **not** fine once the
> site is shared publicly or accounts are added. At that point re-enable RLS and
> use the per-user policy variant documented at the bottom of the same file.

**Verify it worked** — run in the SQL editor:

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('user_progress','bookmarks','questions','topic_coverage');
-- rowsecurity must be false for all four
```

Until this step is done the app is still fully usable: progress is stored in the
browser (`localStorage`, keys `usmle:progress:v1` and `usmle:flags:v1`) and every
page reads from that local copy first, so nothing is lost — it simply does not
leave the device.

## 📚 Loading a question bank into the database

The bank in `questions-bank/` is the source of truth. Two ways to push it into
Supabase; use whichever key you have.

**Option A — service role key (no dashboard needed):**

```powershell
$env:SUPABASE_SERVICE_ROLE_KEY = "eyJ..."   # Project settings → API → service_role
node scripts/import-questions.mjs            # add --dry-run to only report
node scripts/import-questions.mjs --subject=Microbiology
```

**Option B — SQL editor (no service key needed):**

1. Generate the file: `node scripts/export-microbiology-sql.mjs`
2. SQL Editor → New query → paste
   [`supabase/migrations/0003_seed_microbiology.sql`](supabase/migrations/0003_seed_microbiology.sql)
   → Run.

Both options are idempotent: questions are matched on vignette + question text
and coverage rows on `(subject, major_topic, subtopic)`, so re-running after
adding questions only inserts the new ones. Both also recalculate
`topic_coverage.questions_generated` and flip each row to `completed` once its
planned count is reached.

After loading, the dashboard picks up the new subject automatically — subject
cards are built from live question counts, so no code change is needed.

## 🚩 Difficult-question review

After answering a question you can press **Mark as hard**. Marked questions are
collected on the **Review** page (`/review`, reachable from the dashboard), where
each one can be expanded to read the vignette, the option-by-option
explanations and to keep a free-text note for later discussion. The page also
offers *Practise these topics again*, which starts a quiz limited to the
subtopics behind the flagged questions.

Finishing a session (the **Finish session and see summary** button, available
whenever at least one question has been answered) shows a summary with the
answered / correct / accuracy / time breakdown, a per-major-topic performance
list and the questions you missed, each of which can be pushed straight onto the
review list.

