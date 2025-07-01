import { ActionType } from '@/app/api/chat/flows/types';
import { askUserHandler } from './handlers/askUserHandler';
import { showContentHandler } from './handlers/showContentHandler';
import { getUserInputHandler } from './handlers/getUserInputHandler';
import { llmTransformHandler } from './handlers/llmTransformHandler';
import { branchOnMemoryHandler } from './handlers/branchOnMemoryHandler';
import { saveToMemoryHandler } from './handlers/saveToMemoryHandler';
import { saveToImportantMemoryHandler } from './handlers/saveToImportantMemoryHandler';
import { validateUserInputHandler } from './handlers/validateUserInputHandler';

export const actionHandlers: { [key in ActionType]?: any } = {
  ASK_USER: askUserHandler,
  SHOW_CONTENT: showContentHandler,
  GET_USER_INPUT: getUserInputHandler,
  LLM_TRANSFORM: llmTransformHandler,
  BRANCH_ON_MEMORY: branchOnMemoryHandler,
  SAVE_TO_MEMORY: saveToMemoryHandler,
  VALIDATE_USER_INPUT: validateUserInputHandler,
  SAVE_TO_IMPORTANT_MEMORY: saveToImportantMemoryHandler,
  // ... register other handlers here
}; 