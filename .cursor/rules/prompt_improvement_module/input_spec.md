# Prompt Improvement Module: Input Specifications

## Who is the LLM? ("The Twin")

**The LLM ("the twin") is a dedicated language model agent used for grading and improving prompts.**

- The twin is **not** your production chatbot.
- The twin is **not** a human reviewer.
- The twin is a separate, trusted LLM (such as GPT-4, Claude, or another advanced model) that acts as an expert grader and improver in the prompt improvement loop.
- All grading, suggestions, and rationale are provided by the twin, and every decision is logged for auditability.

---

## Overview
This document describes all files and data required for the module to operate. Each input must be present and correctly formatted for the process to run smoothly.

---

## Required Inputs

### 1. Prompt Definitions File
- **Absolute path:** `D:\vercel\intro_groq_cur\app\api\chat\prompts\opinionMbpPrompts.ts`
- **Relative path (from project root):** `intro_groq_cur/app/api/chat/prompts/opinionMbpPrompts.ts`
- **Description:** The file containing all prompt definitions to be improved. This is the file the module will check and improve.
- **Format:** TypeScript file exporting an array of prompt objects (each with at least a `prompt_text` field).
- **Notes:** Must be up to date and match the prompt IDs used elsewhere.

### 2. `prompt-format.md`
- **Description:** The rules and structure for how prompts should be written.
- **Format:** Markdown file.
- **Notes:** Used by the improvement loop to check and enforce prompt structure.

### 3. `grading_criteria.md`
- **Description:** The generic rubric for grading prompt outputs.
- **Format:** Markdown file.
- **Notes:** Used for all prompts unless a custom rubric is specified in the prompt definition.

### 4. `desired_outputs/all_desired_outputs.md`
- **Description:** Single file containing the gold-standard output(s) for all prompts.
- **Format:** Markdown file, with each prompt's output separated and labeled by prompt number (see desired_output_format.md for details).
- **Notes:** Replaces the previous multiple-file format; all outputs are now in one file.

### 5. `conversation_history/`
- **Description:** Folder containing logs of each prompt run and its output.
- **Format:** One `.json` or `.md` file per prompt (e.g., `prompt_0.json`).
- **Notes:** Used for context and traceability during improvement.

### 6. (Optional) `config.json`
- **Description:** Configuration options for the module (e.g., max iterations, model type).
- **Format:** JSON file.
- **Notes:** Optional, but recommended for flexibility.

---

## LLM-in-the-Loop (The Twin)
- The LLM (the twin) is responsible for grading, logging, and suggesting improvements. The app/module orchestrates execution and handles the improvement loop, sending logs and outputs to the twin as needed.
- See `llm_iteration_handoff.md` for the detailed handoff and iteration procedure.

---

## General Notes
- All files should be UTF-8 encoded.
- File/folder structure should be consistent and clearly documented.
- Prompt IDs or indices must be consistent across all files.

---

Next: We will define the output specifications for the module.
