# Prompt Improvement Module: Output Specifications

## Who is the LLM? ("The Twin")

**The LLM ("the twin") is a dedicated language model agent used for grading and improving prompts.**

- The twin is **not** your production chatbot.
- The twin is **not** a human reviewer.
- The twin is a separate, trusted LLM (such as GPT-4, Claude, or another advanced model) that acts as an expert grader and improver in the prompt improvement loop.
- All grading, suggestions, and rationale are provided by the twin, and every decision is logged for auditability.

---

## Overview
This document describes all files and data produced by the module. Outputs are designed for auditability, review, and easy integration into production after approval.

---

## Required Outputs

### 1. Improved Prompts File
- **File:** `intro_groq_cur/app/api/chat/prompts/opinionMbpPrompts.ts`
- **Description:** The improved prompt definitions, ready for review and (after approval) for production use.
- **Format:** TypeScript file, same structure as input.
- **Notes:** Only updated after passing all rubric criteria and review.

### 2. Iteration Logs
- **Folder:** `conversation_history/`
- **Description:** Log of each prompt run, including input, output, grading, and improvement steps.
- **Format:** One `.json` or `.md` file per prompt (e.g., `prompt_0.json`).
- **Notes:** Each log includes:
  - Prompt text (before and after improvement)
  - Model output
  - Desired output
  - Grading rubric and scores
  - Twin suggestions and rationale
  - Timestamps and iteration number

### 3. Grading Reports
- **File:** `grading_report.md` or per-prompt report in `conversation_history/`
- **Description:** Summary of grading results for all prompts, including pass/fail status and improvement history.
- **Format:** Markdown or JSON.
- **Notes:** Used for audit and review.

### 4. Flagged Prompts
- **File:** `flagged_for_manual_review.md`
- **Description:** List of prompts that could not be improved automatically and require human intervention.
- **Format:** Markdown.
- **Notes:** Includes reason for flagging and last attempted improvement.

---

## LLM-in-the-Loop (The Twin)
- The LLM (the twin) is responsible for grading, logging, and suggesting improvements. The app/module orchestrates execution and handles the improvement loop, sending logs and outputs to the twin as needed.
- See `llm_iteration_handoff.md` for the detailed handoff and iteration procedure.

---

## General Notes
- All outputs are written to a staging area, never directly to production.
- All steps and decisions are logged for traceability.
- Output formats are designed for easy review and integration.

---

Next: See `iteration_flow.md` for the step-by-step process.
