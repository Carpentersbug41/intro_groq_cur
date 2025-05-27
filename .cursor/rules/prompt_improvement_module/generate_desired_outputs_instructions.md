---
description:
globs:
alwaysApply: false
---

# Prompt Improvement Module: Generating Desired Outputs — Instructions

## Who is the LLM? ("The Twin")

**The LLM ("the twin") is a dedicated language model agent used for grading and improving prompts.**

- The twin is **not** your production chatbot.
- The twin is **not** a human reviewer.
- The twin is a separate, trusted LLM (such as GPT-4, Claude, or another advanced model) that acts as an expert grader and improver in the prompt improvement loop.
- All grading, suggestions, and rationale are provided by the twin, and every decision is logged for auditability.

---

## Purpose
This document provides step-by-step instructions for generating, formatting, and reviewing the gold-standard desired outputs for each prompt. These outputs are used by the twin to grade and improve prompts.

---

## Steps to Generate Desired Outputs

1. **Extract Example Outputs**
   - For each prompt in `intro_groq_cur/app/api/chat/prompts/opinionMbpPrompts.ts`, locate the example or ideal output (if present).
   - If no example is present, consult a subject matter expert to define the ideal output.

2. **Format Each Output**
   - Use plain text or Markdown as appropriate for the prompt.
   - Do not add extra commentary, explanations, or metadata—only the desired output itself.
   - Each prompt's output should be preceded by a heading (e.g., `## Prompt 0`) and separated by `---`.
   - Preserve all formatting (Markdown, line breaks, bolding, etc.) as shown in the example.

3. **Compile into a Single File**
   - Add all outputs to `desired_outputs/all_desired_outputs.md`.
   - Ensure each output is clearly labeled and separated.

4. **Review and Approve**
   - Manually review each section in `all_desired_outputs.md` to ensure:
     - The output matches expectations and requirements.
     - Formatting is correct and complete.
     - The output is truly the "gold standard" for that prompt.
   - Make corrections or improvements directly in the file.

---

## LLM-in-the-Loop (The Twin)
- The twin uses these desired outputs as the gold standard for grading and improvement.
- All changes to desired outputs should be logged and reviewed for auditability.

---

For formatting details, see `desired_output_format.mdc`.
