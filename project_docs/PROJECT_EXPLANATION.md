# Understanding the IELTS AI Tutor Project

This document provides a comprehensive explanation of the IELTS AI Tutor project, its architecture, and how to work with its conversational flow engine. It assumes no prior knowledge of the system.

## 1. High-Level Overview

As outlined in the `PROJECT_DESCRIPTION.md`, this application is not a generic chatbot. It is a specialized, AI-powered educational tool designed to be an IELTS Writing coach.

The core of the project is its **scripted pedagogical flow**. This is a deterministic, expert-designed diagnostic process that guides a student through a comprehensive, multi-step analysis of their essay writing. The system ensures every student receives the same rigorous, high-quality analysis by following a predefined conversational path, rather than engaging in a free-form chat.

## 2. System Architecture: The Flow Engine

The engine that drives this scripted flow is composed of three main components. This architecture separates the definition of the conversation from the logic that executes it.

```mermaid
graph TD
    A[Flow Definition <br/> (opinion_introduction.yaml)] --> B{Flow Runner <br/> (runner.ts)};
    B --> C{Action Handlers <br/> (e.g., llmTransformHandler.ts)};
    C --> B;
```

1.  **The Flow Definition (`.yaml` file):** This is a human-readable file that defines the "what" and "when" of the conversation. It lays out every step, the action to be taken at that step, and where to go next.
2.  **The Flow Runner (`runner.ts`):** This is the orchestrator. It reads the YAML file, tracks the user's current position in the flow, and executes the appropriate action for each step. It is the heart of the engine.
3.  **Action Handlers (`.ts` files in `app/api/chat/actions/handlers/`):** These are the "how". Each handler is a self-contained module that performs a specific task, such as calling an LLM, getting user input, or saving data. The Runner calls the appropriate handler for the current step.

## 3. How to Construct the YAML Flow

The conversational flow is defined in a YAML file, such as `app/api/chat/flows/opinion_introduction.yaml`. Understanding its structure is key to creating and modifying the user experience.

A flow consists of a `name` and a list of `steps`:

```yaml
name: "Simple LLM Test Flow"
steps:
  - id: 0_start
    action: ASK_USER
    content: "You are now connected to a helpful assistant. How can I help you today?"
    next_step: 1_get_user_input

  - id: 1_get_user_input
    action: GET_USER_INPUT
    next_step: 2_generate_response
  
  # ... more steps
```

Each `step` in the list is an object with the following core properties:

*   `id`: A unique string to identify the step.
*   `action`: The specific `ActionType` to perform (see next section). This determines the behavior of the step.
*   `next_step`: The `id` of the step to proceed to after this one completes.

### Example Walkthrough

Let's trace the first few steps of a user interaction:
1.  **`0_start`**: The flow begins. The `action` is `ASK_USER`, which displays the `content` to the user and then waits for their input. The Runner now pauses the flow.
2.  **User Responds**: The user types a message and sends it.
3.  **`1_get_user_input`**: The Runner resumes the flow at the `next_step` from before, which is `1_get_user_input`. The `GET_USER_INPUT` action processes the message the user just sent, typically saving it to memory. This action is **not** terminal, so the Runner immediately proceeds to `2_generate_response`.
4.  **`2_generate_response`**: This step uses the `LLM_TRANSFORM` action to call a language model and continues the flow automatically.

## 4. Actions & Their Properties

The `action` property in a step determines its behavior and which other properties are relevant for that step. Here are the primary actions, defined in `app/api/chat/flows/types.ts`.

---
### **`ASK_USER`**
*   **What it does:** Displays content to the user and then **stops the flow**, waiting for the user to respond. This is a terminal action.
*   **When to use it:** Use this whenever you need to ask the user a question or present information that requires a user response to continue.
*   **Properties:**
    *   `content`: The text to display to the user. Can include `{{memory.key}}` variables.

---
### **`SHOW_CONTENT`**
*   **What it does:** Displays content to the user and **immediately continues** to the `next_step` without waiting for input. This is how you create auto-transitioning chains of messages.
*   **When to use it:** For presenting a series of analysis points, welcome messages, or any multi-message sequence from the assistant.
*   **Properties:**
    *   `content`: The text to display. Can include `{{memory.key}}` variables.
    *   `wait_time_ms`: An optional delay in milliseconds to wait after showing the message, creating a more natural pacing.

---
### **`GET_USER_INPUT`**
*   **What it does:** Processes the raw text input from the user. Its main job is to save the user's message into memory.
*   **When to use it:** This should be the first step after an `ASK_USER` step to formally consume the user's response.
*   **Properties:**
    *   `save_to_memory_key`: The key under which to save the user's input in `namedMemory`. Defaults to `last_user_input`.

---
### **`LLM_TRANSFORM`**
*   **What it does:** This is the most powerful action. It calls a Large Language Model to perform a task, such as analyzing text, answering a question, or reformatting data.
*   **When to use it:** For any step that requires AI-based generation or analysis. It is non-terminal and will auto-transition.
*   **Properties:**
    *   `prompt_template`: The path to the `.txt` file containing the prompt instructions for the LLM.
    *   `save_to_memory_key`: Saves the LLM's entire output to `namedMemory` under this key. This is the primary way to pass data between steps.
    *   `model`: (Optional) Specify which LLM to use (e.g., `gpt-4o`). Defaults to the system-wide default.
    *   `temperature`: (Optional) The creativity of the LLM response (0.0 for deterministic, 1.0 for creative).

*Mapping from old system:* This single action replaces the need for `autoTransitionHidden` and `autoTransitionVisible` flags. If you want the result shown, the next step should be a `SHOW_CONTENT` that displays the saved memory key. If you want it hidden, simply proceed to the next logical step. `saveAssistantOutputAs` is now `save_to_memory_key`.

## 5. Session Management & Memory

The state of the conversation is managed in the `SessionState` object, which has two forms of memory:

1.  **`conversationHistory`**: A chronological log of all user and assistant messages. This is used to provide conversational context to the LLM.
2.  **`namedMemory`**: A key-value store for saving specific pieces of data, such as the user's essay introduction (`user_introduction`) or the result of an analysis (`extracted_ideas`).

You can access data from `namedMemory` within your `content` or `prompt_template` files using Mustache syntax:

`"Here is the analysis of your introduction: {{memory.user_introduction}}"`

This will be replaced with the actual value from `namedMemory` before being sent to the user or the LLM.

## 6. List of Key Files for Understanding

To get a complete picture of the project, you should review the following files in order:

1.  **`project_docs/PROJECT_DESCRIPTION.md`**: For the high-level vision and purpose.
2.  **`app/api/chat/flows/opinion_introduction.yaml`**: The canonical example of a conversational flow definition.
3.  **`app/api/chat/flows/types.ts`**: The formal data structures. Defines what a `FlowStep` and `ActionType` are.
4.  **`app/api/chat/flows/runner.ts`**: The engine that interprets and executes the YAML flow.
5.  **`app/api/chat/actions/registry.ts`**: The simple mapping between `ActionType` strings and their handler functions.
6.  **`app/api/chat/actions/handlers/` directory**: The actual implementation logic for each individual action (e.g., `llmTransformHandler.ts`). 