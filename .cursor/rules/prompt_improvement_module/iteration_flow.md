---
description:
globs:
alwaysApply: false
---

# Prompt Improvement Module: Iteration Flow

## Who is the LLM? ("The Twin")

**The LLM ("the twin") is a dedicated language model agent used for grading and improving prompts.**

- The twin is **not** your production chatbot.
- The twin is **not** a human reviewer.
- The twin is a separate, trusted LLM (such as GPT-4, Claude, or another advanced model) that acts as an expert grader and improver in the prompt improvement loop.
- All grading, suggestions, and rationale are provided by the twin, and every decision is logged for auditability.

---

## Overview
This document describes the step-by-step process for running the prompt improvement loop, including LLM-in-the-loop grading and improvement, logging, and review.

---

## Iteration Steps

1. **Select Prompt**
   - Choose the next prompt from `intro_groq_cur/app/api/chat/prompts/opinionMbpPrompts.ts`.

2. **Run Prompt**
   - Execute the prompt using the chatbot (API or controlled interface).
   - Capture the model output.

3. **Compare Output**
   - Retrieve the gold-standard output for this prompt from `desired_outputs/all_desired_outputs.md`.

4. **Grade Output (LLM-in-the-Loop, The Twin)**
   - Send the prompt, model output, desired output, grading rubric, and context to the twin.
   - The twin grades the output, logs the result, and suggests improvements if needed.
   - See `llm_iteration_handoff.md` for the detailed twin handoff procedure.

5. **Log Iteration**
   - Save all inputs, outputs, grading, and twin suggestions to `conversation_history/`.
   - Include timestamps, iteration number, and rationale for any changes.

6. **Apply Improvements**
   - If the output does not pass, update the prompt as suggested by the twin.
   - Repeat steps 2–6 until the prompt passes or max iterations are reached.

7. **Flag for Manual Review (if needed)**
   - If the prompt cannot be improved automatically, add it to `flagged_for_manual_review.md` with the reason and last attempted improvement.

8. **Review and Approve**
   - After all prompts pass, review improved prompts and logs.
   - Only merge improved prompts into production after human approval.

---

## LLM-in-the-Loop (The Twin)
- The LLM (the twin) is responsible for grading, logging, and suggesting improvements. The app/module orchestrates execution and handles the improvement loop, sending logs and outputs to the twin as needed.
- See `llm_iteration_handoff.md` for the detailed handoff and iteration procedure.

---

## Logging and Auditability
- All steps, decisions, and outputs are logged for traceability.
- Logs are written to `conversation_history/` and summarized in `grading_report.md`.

---

Next: See `llm_iteration_handoff.md` for the twin handoff and collaboration details.
