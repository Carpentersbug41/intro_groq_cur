---
description:
globs:
alwaysApply: false
---

# LLM-in-the-Loop Iteration & Handoff Procedure

## Who is the LLM? ("The Twin")

**The LLM ("the twin") is a dedicated language model agent used for grading and improving prompts.**

- The twin is **not** your production chatbot.
- The twin is **not** a human reviewer.
- The twin is a separate, trusted LLM (such as GPT-4, Claude, or another advanced model) that acts as an expert grader and improver in the prompt improvement loop.
- All grading, suggestions, and rationale are provided by the twin, and every decision is logged for auditability.

---

## Overview
This document describes the collaboration between the app/module (executor) and the LLM (the twin, grader/improver) during the prompt improvement process. All steps are logged for auditability and review.

---

## Roles
- **App/Module (Executor):**
  - Orchestrates the improvement loop
  - Runs prompts through the chatbot
  - Collects outputs, desired outputs, and context
  - Sends all relevant data to the twin for grading and improvement
  - Applies the twin's suggestions and logs all steps
  - Flags prompts for manual review if needed

- **LLM (The Twin, Grader/Improver):**
  - Receives prompt, model output, desired output, grading rubric, and context
  - Grades the output according to the rubric
  - Logs the grading rationale and scores
  - Suggests improvements to the prompt if output does not pass
  - Explains all changes and decisions for traceability

---

## Handoff Procedure

1. **App/Module Prepares Data**
   - For each prompt, collect:
     - Prompt text (current version)
     - Model output
     - Desired output (from `desired_outputs/all_desired_outputs.md`)
     - Grading rubric (from `grading_criteria.md`)
     - Any relevant context (e.g., previous iterations, logs)

2. **Send to the Twin**
   - Package all data and send to the twin for grading and improvement.

3. **The Twin Grades and Suggests Improvements**
   - Grade the output using the rubric
   - Log the grading rationale, scores, and any critical failures
   - If the output does not pass, suggest a revised prompt and explain the changes
   - If the output passes, log the pass and rationale

4. **App/Module Applies Suggestions**
   - If improvements are suggested, update the prompt and repeat the loop
   - If the prompt cannot be improved, flag for manual review
   - Log all steps, decisions, and twin responses in `conversation_history/`

5. **Review and Approval**
   - After all prompts pass, review logs and improved prompts
   - Only merge into production after human approval

---

## Logging and Auditability
- All handoffs, twin responses, and decisions are logged in `conversation_history/`
- Logs include:
  - Prompt text (before/after)
  - Model output
  - Desired output
  - Grading rubric and scores
  - Twin suggestions and rationale
  - Timestamps and iteration number
- Summary reports are written to `grading_report.md`

---

## Notes
- The twin is the "superior model" for grading and improvement; the app/module is the executor and logger.
- All steps are designed for transparency, auditability, and safe review before production.
