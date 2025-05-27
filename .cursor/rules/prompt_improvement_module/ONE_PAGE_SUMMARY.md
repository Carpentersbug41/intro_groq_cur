# Prompt Improvement Module — One-Page Summary

---

## What is this?
A safe, auditable, LLM-powered system for automatically improving chatbot prompts—using a dedicated "twin" LLM agent for grading and suggestions, never touching production until human approval.

---

## Key Roles
- **The Twin (LLM):**  
  A dedicated, trusted language model agent (not the chatbot, not a human) that grades and suggests improvements for prompts.
- **App/Module:**  
  Orchestrates the process, runs prompts, applies the twin's suggestions, and logs everything.
- **Chatbot:**  
  The live system that uses the prompts for real user conversations (never directly modified by the module).
- **(Optional) Human Reviewer:**  
  Reviews flagged prompts or approves final improvements before they go live.

---

## How It Works (Step-by-Step)
1. **Setup:**  
   Load planning docs, prompt definitions, gold-standard outputs, and grading rubric.
2. **Iterative Loop (per prompt):**  
   - Run the prompt through the chatbot and capture output.
   - Compare output to the gold-standard.
   - Send all data to the twin for grading and improvement suggestions.
   - Apply the twin's suggestions and repeat until the prompt passes or is flagged for manual review.
   - Log every step and decision.
3. **Review & Approve:**  
   Human reviews improved prompts and logs. Only after approval are prompts merged into production.

---

## Key Principles
- **Parallel Operation:**  
  Never touches live chatbot or production prompts until approval.
- **LLM-in-the-Loop:**  
  The twin is the grader/improver; the app/module is the executor/logger.
- **Auditability:**  
  Every iteration, decision, and twin suggestion is logged and reviewable.

---

## Outputs
- Improved prompt definitions (staged, not live)
- Iteration logs (per prompt, per run)
- Grading reports (summaries, pass/fail, rationale)
- Flagged prompts for manual review

---

## Summary Table

| Step                | Who/What Does It?         | Output/Result                        |
|---------------------|--------------------------|--------------------------------------|
| Run prompt          | App/Module + Chatbot     | Model output                         |
| Grade & improve     | The Twin (LLM)           | Grade, rationale, improved prompt    |
| Apply improvement   | App/Module               | Updated prompt, log                  |
| Manual review (if needed) | Human             | Final decision                       |
| Approve & merge     | Human                    | Prompts go live                      |

---

**For details, see the full documentation in this folder.** 