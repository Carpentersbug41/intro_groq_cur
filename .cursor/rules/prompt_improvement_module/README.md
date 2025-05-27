# Prompt Improvement Module

## Who is the LLM? ("The Twin")

**The LLM (also called "the twin") is a dedicated language model agent used for grading and improving prompts.**

- The twin is **not** your production chatbot.
- The twin is **not** a human reviewer.
- The twin is a separate, trusted LLM (like GPT-4, Claude, or another advanced model) that acts as an expert grader and improver in the prompt improvement loop.
- All grading, suggestions, and rationale are provided by the twin, and every decision is logged for auditability.

---

## Overview
This module provides a complete, auditable workflow for iteratively improving prompt definitions (e.g., in `prompts.ts`) using automated execution, grading, and LLM-assisted refinement. It is designed to be portable and reusable across projects.

> **Note:**
> This module is intended to run **in parallel** with your main chatbot, not as a replacement or modification of the live system. All improvements are staged for review before being merged into production, ensuring no disruption to live user sessions.

---

## Contents
- `global_rules.mdc` — Implementation rules and session guidelines
- `project_overview.mdc` — High-level project description and goals
- `input_spec.mdc` — Required input files and formats
- `output_spec.mdc` — Expected outputs and formats
- `iteration_flow.mdc` — Step-by-step process for prompt improvement
- `llm_iteration_handoff.mdc` — LLM-in-the-loop iteration and handoff procedure
- `implementation_instructions.mdc` — Guidance for building the module
- (Add your `src/` or `code/` folder for implementation code)

---

## Usage Instructions
1. **Review the Planning Docs:**
   - Read all `.mdc` files to understand the requirements and flow.
2. **Set Up Inputs:**
   - **Prompt definitions file:**
     - Absolute path: `D:\vercel\intro_groq_cur\app\api\chat\prompts\opinionMbpPrompts.ts`
     - Relative path (from project root): `intro_groq_cur/app/api/chat/prompts/opinionMbpPrompts.ts`
     - This is the file the module will check and improve.
   - Prepare your desired outputs, grading rubrics, and any required config/history files as described in `input_spec.mdc`.
3. **Implement the Module:**
   - Follow `implementation_instructions.mdc`, `iteration_flow.mdc`, and `llm_iteration_handoff.mdc` to build the improvement loop.
4. **Run and Log:**
   - Execute the module, log all iterations, and generate reports as described in `output_spec.mdc`.
5. **Integrate or Reuse:**
   - This module can be integrated into other projects or run as a standalone tool.

> **LLM-in-the-Loop (The Twin):**
> The LLM (the twin) is responsible for grading, logging, and suggesting improvements. The app/module orchestrates execution and handles the improvement loop, sending logs and outputs to the twin as needed.

---

## Integration Notes
- All planning and spec files are Markdown Concept (`.mdc`) files for clarity and portability.
- Keep code and planning docs separate for maintainability.
- Update the README and specs as the module evolves.

---

## Questions?
If anything is unclear, consult the `.mdc` files or ask for clarification before proceeding. 