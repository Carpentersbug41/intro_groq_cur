# Chat UI: Enter Key and Send Button Behavior

## Summary

All chat UI components have been updated so that:

- The chat input is a `<textarea>` (multi-line).
- **Pressing Enter inserts a new line** in the chat input (default behavior).
- **Pressing Ctrl+Enter (Windows/Linux) or Cmd+Enter (Mac) sends the message.**
- The Send button also sends the message.
- This change applies to:
  - `components/ChatWindow.tsx`
  - `components/ChatWindow2.tsx`
  - `app/api/chat/old_stuff/chatwindow.tsx`

## Reason

This change was made to:
- Allow users to write multi-paragraph messages easily (for tasks like writing two paragraphs).
- Provide a convenient keyboard shortcut (Ctrl+Enter or Cmd+Enter) to send, matching common chat app UX.
- Support both keyboard and mouse users.

## Implementation Notes
- The `<textarea>` has an `onKeyDown` handler:
  - **Enter** (alone) inserts a new line.
  - **Ctrl+Enter** (or **Cmd+Enter** on Mac) submits the form (sends the message).
- The Send button also submits the form.

## How to Revert
- **To Enter = send, Shift+Enter = new line:**
  - Change the `onKeyDown` handler to submit on Enter (without Shift), and allow Shift+Enter for new lines.
- **To Enter = new line, only Send button submits:**
  - Remove the `onKeyDown` handler from the `<textarea>`. Only the Send button will send.

---
*Documented by AI, 2024-06-09 (updated for Ctrl+Enter/Cmd+Enter to send)* 