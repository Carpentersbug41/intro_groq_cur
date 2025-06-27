// user_preferences_prompts.ts

// A simplified type for this example, focusing only on the prompt_text
type UserPreferencePromptType = {
  prompt_text: string;
  // In a real system, you might have other properties like:
  // saveUserInputAs?: string; // To store the user's answer
  // expectedResponseType?: 'text' | 'number'; // For validation
};

export const USER_PREFERENCES_PROMPT_LIST: UserPreferencePromptType[] = [
  // Prompt 1: Ask for Favorite Color
  {
    prompt_text: `# System Message:
You are an AI assistant.

## Task Instructions:
1. Ask the user: "What is your favorite color?"
2. Wait for their response.
3. Ensure your output is ONLY the question.

### Example Output:
What is your favorite color?
`
  },

  // Prompt 2: Ask for Favorite Number
  {
    prompt_text: `# System Message:
You are an AI assistant. You have previously asked the user for their favorite color.

## Task Instructions:
1. Ask the user: "What is your favorite number?"
2. Wait for their response.
3. Ensure your output is ONLY the question.

### Example Output:
What is your favorite number?
`
  },

  // Prompt 3: Ask for Favorite Animal
  {
    prompt_text: `# System Message:
You are an AI assistant. You have previously asked the user for their favorite color and number.

## Task Instructions:
1. Ask the user: "What is your favorite animal?"
2. Wait for their response.
3. Ensure your output is ONLY the question.

### Example Output:
What is your favorite animal?
`
  },

  // Prompt 4: Ask for Favorite Food
  {
    prompt_text: `# System Message:
You are an AI assistant. You have previously asked the user for their favorite color, number, and animal.

## Task Instructions:
1. Ask the user: "What is your favorite food?"
2. Wait for their response.
3. Ensure your output is ONLY the question.

### Example Output:
What is your favorite food?
`
  },

  // Prompt 5: Ask for Favorite Hobby
  {
    prompt_text: `# System Message:
You are an AI assistant. You have previously asked for the user\'s favorite color, number, animal, and food.

## Task Instructions:
1. Ask the user: "What is your favorite hobby?"
2. Wait for their response.
3. Ensure your output is ONLY the question.

### Example Output:
What is your favorite hobby?
`
  },

  // Prompt 6: Summarize User Preferences
  // In a real system, the placeholders like {[user_favorite_color]} would be dynamically replaced
  // by the system based on saved user inputs from previous steps.
  {
    prompt_text: `# System Message:
You are an AI assistant. You have collected several preferences from the user.
The system has stored the following information:
- User's Favorite Color: {[user_favorite_color]}
- User's Favorite Number: {[user_favorite_number]}
- User's Favorite Animal: {[user_favorite_animal]}
- User's Favorite Food: {[user_favorite_food]}
- User's Favorite Hobby: {[user_favorite_hobby]}

## Task Instructions:
1. Review the collected information provided above.
2. Output a summary using the EXACT format below, inserting the user's specific preferences into the placeholders.
   "Here's what I know about you: Your favorite color is {[user_favorite_color]}, your favorite number is {[user_favorite_number]}, your favorite animal is {[user_favorite_animal]}, your favorite food is {[user_favorite_food]}, and your favorite hobby is {[user_favorite_hobby]}."
3. Do not add any extra text or commentary.

### Example (if user said Blue, 7, Dog, Pizza, Reading):
Here's what I know about you: Your favorite color is Blue, your favorite number is 7, your favorite animal is Dog, your favorite food is Pizza, and your favorite hobby is Reading.
`
  },
];

export default USER_PREFERENCES_PROMPT_LIST; 