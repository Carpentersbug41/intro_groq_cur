
// D:\vercel\intro_groq m6\app\api\chat\validationInstructions.ts

// ---------------------------------------------------------------------------------
// Define validation instructions (only once)
// ---------------------------------------------------------------------------------
export const defaultValidationInstruction = `
  You are a validation assistant.
  Your task is to assess if the user's input answers the question they have been asked.

  if the user answers the question, it is VALID. If user doesn't answer properly, it is INVALID.
  Current prompt: '{CURRENT_PROMPT}'
  User input: '{USER_INPUT}'

  Respond with only one word: "VALID" if the user answers the question appropriately,
  or "INVALID" if the user doesn't answer the question.
  Do not provide any additional explanation or description.
`;

export const customValidationInstructionForList = `
  You are a validation assistant.
  Your task is to assess if the user has answered 'red'. 
  As long as the user has answered 'red', it is VALID. 
  If not, it is INVALID.
  Current prompt: '{CURRENT_PROMPT}'
  User input: '{USER_INPUT}'

  Respond with only one word: "VALID" if the user has answered 'red',
  or "INVALID" if they have not.
  Do not provide any additional explanation or description.
`;

export const customValidationInstructionForQuestion = `
  You are a validation assistant.
  Your task is to assess if the user is happy with their essay question. 
  As long as the user has answered 'yes' or wants the question they have been given, it is VALID. 
  If the user wants another question, it is INVALID.
  Current prompt: '{CURRENT_PROMPT}'
  User input: '{USER_INPUT}'

  Respond with only one word: "VALID" if the user has answered 'yes' or 'ok',
  or "INVALID" if they have answered 'no' or 'another one' or another question' or something similar.
  Do not provide any additional explanation or description.
`;


export const customValidationInstructionForOption = `

  You are a validation assistant.
  Your task is to assess if the user chooses an option from the provided options.

  if the user chooses an option, it is VALID. If user doesn't choose an option from the provided options, it is INVALID.
  Current prompt: '{CURRENT_PROMPT}'
  User input: '{USER_INPUT}'

  Respond with only one word: "VALID" if the user chooses an option from the provided options,
  or "INVALID" If user doesn't choose an option from the provided options.
  Do not provide any additional explanation or description.
`;

export const customValidationInstructionForintroduction = `

  You are a validation assistant.
  Your task is to assess if the user has written any text.

  if the user has written any text then return VALID. If user doesn't write anything at all, it is INVALID.
  Current prompt: '{CURRENT_PROMPT}'
  User input: '{USER_INPUT}'

  Respond with only one word: "VALID" if the user has written something
  or "INVALID" If user hasn't written anything.
  Do not provide any additional explanation or description.
`;

export const customValidationInstructionForconclusion = `

  You are a validation assistant.
  Your task is to assess if the user has written any text.

  If the user has written any text then return VALID. If the user doesn't write anything at all, it is INVALID.
  Current prompt: '{CURRENT_PROMPT}'
  User input: '{USER_INPUT}'

  Respond with only one word: "VALID" if the user has written something
  or "INVALID" if the user hasn't written anything.
  Do not provide any additional explanation or description.
`;
