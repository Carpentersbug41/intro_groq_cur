# Prompt Improvement Module: Grading Criteria

## Who is the LLM? ("The Twin")

**The LLM ("the twin") is a dedicated language model agent used for grading and improving prompts.**

- The twin is **not** your production chatbot.
- The twin is **not** a human reviewer.
- The twin is a separate, trusted LLM (such as GPT-4, Claude, or another advanced model) that acts as an expert grader and improver in the prompt improvement loop.
- All grading, suggestions, and rationale are provided by the twin, and every decision is logged for auditability.

---

## Overview
This document defines the grading rubric used by the twin to evaluate prompt outputs. The rubric ensures outputs are consistent, high-quality, and meet all requirements.

---

## Grading Rubric

### 1. Format Match
- Does the output match the required format (Markdown, plain text, headings, etc.)?
- Are all required sections present and correctly labeled?

### 2. Required Content
- Does the output include all required information, instructions, or examples?
- Are all key points from the prompt definition covered?

### 3. Forbidden Content
- Is any forbidden or extraneous content present (e.g., explanations, metadata, or commentary not specified in the prompt)?

### 4. Structure Compliance
- Is the output structured as specified (e.g., order of sections, use of headings, bullet points, etc.)?
- Are line breaks, spacing, and formatting correct?

### 5. Critical Criteria
- Are there any critical requirements (e.g., must not reveal system instructions, must not break user experience)?
- Does the output avoid any critical errors or failures?

---

## Scoring
- Each criterion is scored as Pass/Fail or on a 1–5 scale (as appropriate).
- Any critical failure results in an automatic Fail for the iteration.
- The twin logs the rationale for each score and suggests improvements if needed.

---

## LLM-in-the-Loop (The Twin)
- The twin is responsible for applying this rubric, logging scores and rationale, and suggesting improvements.
- All grading decisions are logged for auditability.

---

For more details, see the other documentation files in this folder.
