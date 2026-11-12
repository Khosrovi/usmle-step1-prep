# Product Requirements Document (PRD)
## USMLE Step 1 Prep Platform

### 1. Problem Statement
USMLE Step 1 prep resources (UWorld, Amboss) are expensive ($400–600).
The user needs a free alternative that provides high-quality clinical 
vignette questions with detailed explanations.

### 2. Target User
- Medical student preparing for USMLE Step 1
- Budget-conscious (goal: $0 cost)
- Needs self-paced study with immediate feedback

### 3. Core Features (MVP)
1. **Question Browser** — filter by topic (Pharm, Biochem, Path, Micro, Immuno)
2. **Question View** — clinical vignette + 5 options (A–E)
3. **Answer Logic** — on selection, show:
   - ✅ Correct answer with explanation
   - ❌ Why each wrong option is incorrect
   - 📚 Educational Objective (1-sentence takeaway)
4. **Progress Tracking** — mark questions as done / review later
5. **Random Quiz Mode** — 10–20 random questions, score at the end

### 4. Question Format (JSON Schema)
```json
{
  "id": "pharm-001",
  "topic": "pharmacology",
  "subtopic": "autonomic",
  "difficulty": "medium",
  "vignette": "A 54-year-old man with hypertension presents...",
  "question": "Which of the following drugs is most appropriate?",
  "options": [
    {"id": "A", "text": "Lisinopril", "isCorrect": true},
    {"id": "B", "text": "Propranolol", "isCorrect": false}
  ],
  "explanations": {
    "A": "ACE inhibitor, first-line for HTN with diabetes...",
    "B": "Beta-blocker, not first-line unless specific indication..."
  },
  "educationalObjective": "ACE inhibitors are first-line for HTN in diabetic patients.",
  "source": "Generated from 5. Pharmacology.pdf, ch. 3"
}