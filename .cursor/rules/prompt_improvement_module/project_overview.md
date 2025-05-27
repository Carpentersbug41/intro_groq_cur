# Prompt Improvement Module: Project Overview

## Who is the LLM? ("The Twin")

**The LLM ("the twin") is a dedicated language model agent used for grading and improving prompts.**

- The twin is **not** your production chatbot.
- The twin is **not** a human reviewer.
- The twin is a separate, trusted LLM (such as GPT-4, Claude, or another advanced model) that acts as an expert grader and improver in the prompt improvement loop.
- All grading, suggestions, and rationale are provided by the twin, and every decision is logged for auditability.

---

## Purpose
To automatically and iteratively improve chatbot prompt definitions using a transparent, auditable, and LLM-assisted process—without ever interfering with the live chatbot. All improvements are staged for review before being merged into production.

---

## Key Principles
- **Parallel Operation:** The module runs in parallel with the main chatbot and never modifies live code or state until improvements are approved.
- **LLM-in-the-Loop:** The twin is the grader and improver; the app/module is the executor and logger.
- **Auditability:** Every iteration, decision, and twin suggestion is logged and reviewable.
- **Modularity:** The module is portable and can be reused or integrated into other projects.

---

## High-Level Workflow
1. **Setup:** Load planning docs, prompt definitions, gold-standard outputs, and grading rubric.
2. **Iterative Loop (per prompt):**
   - Run the prompt through the chatbot and capture output.
   - Compare output to the gold-standard.
   - Send all data to the twin for grading and improvement suggestions.
   - Apply the twin's suggestions and repeat until the prompt passes or is flagged for manual review.
   - Log every step and decision.
3. **Review & Approve:** Human reviews improved prompts and logs. Only after approval are prompts merged into production.

---

## Artifacts Produced
- Improved prompt definitions (staged, not live)
- Iteration logs (per prompt, per run)
- Grading reports (summaries, pass/fail, rationale)
- Flagged prompts for manual review

---

For more details, see the other documentation files in this folder.
