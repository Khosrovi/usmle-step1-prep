# AI Agent Context & Instructions
## USMLE Step 1 Preparation Platform

### 🎯 Project Overview
This is a web platform for medical students preparing for the USMLE Step 1 exam.
The platform provides clinical vignette-style questions (similar to UWorld format)
with multiple-choice answers and detailed explanations for each option.

**Primary User Goal:** Pass USMLE Step 1 with minimal financial cost (free platform).

---

### 🛠️ Tech Stack
- **Framework:** Next.js (React, App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Database:** Supabase (PostgreSQL) — for user progress, bookmarks, stats
- **Hosting:** Vercel (free tier) or Netlify
- **Package Manager:** npm

---

### 📁 Project Structure
usmle-step1-prep/
├── AI-CONTEXT.md # THIS FILE — read first!
├── README.md # Project overview for humans
├── docs/
│ └── PRD.md # Product Requirements Document
├── app/ # Next.js App Router pages
│ ├── page.tsx # Home page
│ ├── dashboard/page.tsx # User dashboard with stats
│ └── ... # Other pages
├── components/ # Reusable React components
│ ├── QuestionCard.tsx # Main question display component
│ └── ... # Other components
├── questions-bank/ # JSON files with questions
│ ├── pharmacology/
│ ├── biochemistry/
│ ├── pathology/
│ ├── microbiology/
│ └── immunology/
├── lib/ # Utility functions, Supabase client
├── public/ # Static assets
├── package.json # Dependencies
├── tsconfig.json # TypeScript config
├── next.config.js # Next.js config
├── .env.local # Environment variables (Supabase keys) — DO NOT COMMIT
└── .gitignore # Ignores node_modules, .next, .env.local

---

### 📚 Content Sources
Questions are generated from 5 reference PDF files (stored locally, NOT in repo):
1. `1. Biochemistry.pdf`
2. `2. Immunology.pdf`
3. `3. Microbiology.pdf`
4. `4. Pathology.pdf`
5. `5. Pharmacology.pdf`

These PDFs contain medical knowledge that should be used as the basis for generating questions.

---

### 📝 Question Format (JSON Schema)
Each question is stored as a JSON file in `questions-bank/{topic}/`.
Example: `questions-bank/pharmacology/pharm-001.json`

```json
{
  "id": "pharm-001",
  "topic": "pharmacology",
  "subtopic": "cardiovascular",
  "difficulty": "medium",
  "vignette": "A 58-year-old man comes to the office...",
  "question": "Which of the following drugs is contraindicated?",
  "options": [
    {"id": "A", "text": "Amlodipine", "isCorrect": false},
    {"id": "B", "text": "Hydrochlorothiazide", "isCorrect": false},
    {"id": "C", "text": "Propranolol", "isCorrect": true},
    {"id": "D", "text": "Losartan", "isCorrect": false},
    {"id": "E", "text": "Lisinopril", "isCorrect": false}
  ],
  "explanations": {
    "A": "Amlodipine is a calcium channel blocker, safe in asthma...",
    "B": "Hydrochlorothiazide is a thiazide diuretic, no contraindications...",
    "C": "Propranolol is a non-selective beta-blocker, blocks beta-2 receptors in lungs, causes bronchoconstriction — CONTRAINDICATED in asthma.",
    "D": "Losartan is an ARB, safe in asthma...",
    "E": "Lisinopril is an ACE inhibitor, can cause cough but not contraindicated..."
  },
  "educationalObjective": "Non-selective beta-blockers are contraindicated in asthma due to beta-2 blockade causing bronchoconstriction.",
  "source": "Generated from 5. Pharmacology.pdf"
}
Key Rules for Questions:
Always 5 options (A–E)
Exactly ONE correct answer
Each option must have an explanation (why correct/incorrect)
Include 1-sentence Educational Objective
Reference the source PDF
✅ What's Already Implemented
✅ Next.js project initialized and working
✅ Basic UI with Tailwind CSS (dashboard, question display)
✅ Supabase connected (database for progress, bookmarks)
✅ QuestionCard component (displays question, options, explanations)
✅ Progress tracking (mark questions as done/review later)
✅ Bookmarks system (save questions for review)
✅ Exam mode with timer
✅ GitHub repository set up and synced
🚧 What Needs to Be Done Next
Populate Question Bank: Generate 100+ questions from the 5 PDF files
Start with Pharmacology (most clinical vignettes)
Then Biochemistry, Pathology, Microbiology, Immunology
Improve Question Display:
Show answer first, then reveal explanation on click
Color-code correct/incorrect options
Add Filtering: Filter questions by topic, subtopic, difficulty
Add Analytics: Show user's weak areas based on wrong answers
Mobile Responsiveness: Ensure works on phones/tablets
🤖 Instructions for AI Agents
When working on this project, follow these rules:
Read this file first before making any changes.
Work step by step. Don't make massive changes at once.
Test locally before committing (npm run dev).
Follow the JSON schema exactly when creating questions.
Use Tailwind CSS for styling (no custom CSS files).
Keep components small and reusable.
When generating questions:
Base them on the PDF content (high-yield USMLE topics)
Use clinical vignettes (patient scenarios)
Make explanations detailed and educational
Include the Educational Objective
🔑 Environment Variables
The .env.local file contains Supabase credentials:
NEXT_PUBLIC_SUPABASE_URL=https://fkuqohcosijdbgatdqjm.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZrdXFvaGNvc2lqZGJnYXRkcWptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQzODU0NTYsImV4cCI6MjEwOTk2MTQ1Nn0.6UTzef8SxpvfQrD1L630TOYehUx3r2i2b96cxR-igMA
Never commit .env.local to GitHub.
📊 Success Metrics
100+ questions across all 5 topics
User can complete a 20-question quiz in < 10 minutes
All explanations reference source PDF content
Platform is free to use (no paid APIs required)
Last Updated: November 12, 2026
Project Owner: khosrovi (GitHub)