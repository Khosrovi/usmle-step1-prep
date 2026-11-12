# USMLE Step 1 Prep Platform

## 🎯 Project Goal
A free, self-hosted web platform for USMLE Step 1 preparation.
The app presents clinical vignette-style questions (similar to UWorld format)
with multiple-choice answers and detailed explanations for each option.

## 🧠 Context for AI Agents
If you are an AI agent reading this file, here is what you need to know:
- **User goal:** Pass USMLE Step 1 with minimal financial cost.
- **Content source:** Questions are generated from 5 reference PDFs:
  - `1. Biochemistry.pdf`
  - `2. Immunology.pdf`
  - `3. Microbiology.pdf`
  - `4. Pathology.pdf`
  - `5. Pharmacology.pdf`
- **Question format:** Clinical vignette → 5 answer options (A–E) → 
  Explanation of why each option is correct/incorrect.
- **Stack:** Static site (Next.js + JSON question bank). No backend needed for MVP.
- **Language:** Questions in English (USMLE is in English), UI can be bilingual.

## 📁 Repository Structure