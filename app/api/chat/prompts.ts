// AFTER: Each prompt has a unique docId + storing only the LLM's response
import {
  customValidationInstructionForQuestion,
  customValidationInstructionForOption, customValidationInstructionForintroduction,
} from "./validationInstructions";
type PromptType = {
  prompt_text: string;
  validation?: boolean | string;
  important_memory?: boolean;
  autoTransitionHidden?: boolean;
  autoTransitionVisible?: boolean;
  chaining?: boolean;
  temperature?: number;
  buffer_memory?: number;
  wait_time?:number;
  addToDatabase?: boolean;
  model?: string;          // Optional custom model for this prompt
  fallbackIndex?: number;  // Optional rollback steps if validation fails
  saveUserInputAs?: string; // <-- New key for user input
  saveAssistantOutputAs?: string; // <-- New key for assistant output
  dbOptions?: {
    collectionName: string;
    documentId?: string;
    fields?: {
      // We'll store ONLY the LLM response here...
      result?: string;
      // ...and store the user input here when validation passes.
      userresult?: string;
      [key: string]: string | undefined;
    };
    timestamp?: boolean;
  };
};

// D:\vercel\intro_groq m6\app\api\chat\prompts.ts
export const PROMPT_LIST: PromptType[] = [



  {
    prompt_text: `#System message:
Ask the user what their favorite dish is.

`,
    // model: "gpt-4o",
    // autoTransitionHidden: true
// validation: true,

  },

  {
    prompt_text: `#System message:
   Ask the user what their favorite planet is.
   Never, NEVER! ask anything else!
   `,
  //  important_memory: true,
   },

   {
    prompt_text: `#System message:\n Ask the user to input a number. 
    Never,NEVER! ask anything else!`,
   validation: true,
    fallbackIndex: 2,
    
   },
   


  {
    prompt_text: `#System message:  You are an expert in following instructions EXACTLY.
-Always Ask the user what their favorite animal is.
-Never ask anything else!
`,
  },

{
 prompt_text: `#System message:  You are an expert in following instructions EXACTLY.
- Ask the user what their favorite book is.
-Never ask anything else!
`,
autoTransitionVisible: true,
temperature: 0.9
},
{
 prompt_text: `#System message: You are an expert in following instructions EXACTLY.
 - Ask the user what their favorite star is.
 - Never ask anything else!`,
autoTransitionVisible: true,
}, 

 
{
 prompt_text: `#System message:
Ask the user what their favorite color is.
-Never ask anything else!
`,
buffer_memory: 4,
saveAssistantOutputAs: "assistantColorResponse"
},
{
 prompt_text: `#System message:
Ask the user what their favorite dish is.`,
 saveUserInputAs: "favoriteDish"
},



{
 prompt_text: "#System message:\n Ask the user to input a number. ",
validation: true,
 fallbackIndex: 0
},

// Add dummy prompt at index 8
{
  prompt_text: "#System message:\n This is prompt 8. Ask for favorite programming language.",
  // No validation or special flags needed for the test
}





];


export default PROMPT_LIST;



 