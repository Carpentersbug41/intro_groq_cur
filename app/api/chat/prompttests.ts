// // ,    {
// //     prompt_text: `#System message:
// //   Ask the user what their favorite animal is.`,
    
// //     important_memory: true,
// //     validation: customValidationInstructionForQuestion,
    
// //     fallbackIndex: 2,
// //   },
// //   {
// //     prompt_text: `#System message:
// //   Ask the user what their favorite hobby is.`,
// //   fallbackIndex: 2,
// //     // No autoTransition or important_memory for this prompt
// //   },
  
// //   {
// //     prompt_text: `#System message:
// //   Ask the user what their favorite book is.`,
   
// //     // No important_memory for this prompt
// //   },
// //   {
// //     prompt_text: "#System message:\n Ask the user to input a number. ",
// //     // chaining: true, // Enable chaining
// //   },
  
// //   {
// //     prompt_text: "#System message:\n Add 2 to the number. ",
// //     chaining: true, // Enable chaining
// //   },
// //   {
// //     prompt_text: "#System message:\n Take the result of the last operation and multiply it by 3. ",
// //     chaining: true, // Enable chaining
// //   },
// //   {
// //     prompt_text: "#System message:\n Convert the result into cats.  For example 'there are 5 cats.'",
// //     chaining: true, // Enable chaining
// //   },
// //   {
// //     prompt_text: "#System message:\n Add a colour to the cats.  Give them all the samer colour. For example 'There are 5 red cats.'",
// //     chaining: true, // Enable chaining
// //     autoTransitionVisible: true,
// //   },
  
// //   {
// //     prompt_text: `#System message:
// //   Ask the user what their favorite color is.`,
// //     // No autoTransition or important_memory for this prompt
// //   },
// //   {
// //     prompt_text: `#System message:
// //   Ask the user what their favorite dish is.`,
// //   autoTransitionVisible: true,
  
// //   //  chaining: true
// //   },
// //   {
// //     prompt_text: `#System message:
// //   Ask the user what their favorite type of music is.`,
    
// //     important_memory: true,
// //   },
// //   {
// //     prompt_text: `#System message:
// //   Ask the user what their favorite animal is.`,
    
// //     important_memory: true,
// //   },
// //   {
// //     prompt_text: `#System message:
// //   Ask the user what their favorite hobby is.`,
  
// //     // No autoTransition or important_memory for this prompt
// //   },
  
// //   {
// //     prompt_text: `#System message:
// //   Ask the user what their favorite book is.`,
   
// //     // No important_memory for this prompt
// //   },
// //   {
// //     prompt_text: `#System message:
// //   Ask the user what their dream vacation destination is.`,
  
// //     // No autoTransition or important_memory for this prompt
// //   },
// //   {
// //     prompt_text: `#System message:
// //   Ask the user what their favorite football team is is.`,
  
// //     // No autoTransition or important_memory for this prompt
    
// //   },
  
// //   {
// //     prompt_text: `#System message:
// //   Ask the user what their favorite colour is.
  
// //   Always follow these steps:
  
// //   Step 1: Only sask the user what their favourite colour is.
// //   Step 2:  Never ask anything else or add extra information`,
// //     // autoTransition: true,
// //     validation: true,
// //     fallbackIndex: 3,
// //   },
  
  
// //   {
// //     // index 0
// //     prompt_text: `#System message:
// //         Ask the user for their first name.`,
// //     important_memory: true,
// //     validation: true,
// //     addToDatabase: true,   // <--- must be true
// //     dbOptions: {
// //       collectionName: "userResponses",
// //       documentId: "userNameDoc",  // <--- must be set
// //       fields: {
// //         result: "userName",         // Stores the assistant response
// //         userresult: "userNameInput",// NEW: Stores the user's input
// //       },
// //       timestamp: true,
// //     },
// //   },
// //   {
// //     // Prompt #2
// //     prompt_text: `#System message:
// //        Ask the user what their favorite type of music is.`,
// //     important_memory: true,
// //     addToDatabase: true,
// //     dbOptions: {
// //       collectionName: "userResponses",
// //       documentId: "favoriteMusicDoc", // <--- unique doc for the second prompt
// //       fields: {
// //         result: "favoriteMusic",       // Stores the assistant response
// //         userresult: "favoriteMusicInput", // NEW: Stores the user's input
// //       },
// //       timestamp: true,
// //     },
// //   },
  
// //   {
// //     prompt_text: `#System message:
// //   Ask the user what their favorite meal is.`,
// //     // autoTransition: true,
// //     important_memory: true,
// //   },
  
  
// //   {
// //     prompt_text: `#System message:
// //   Ask the user what their favorite animal is.`,
    
// //     important_memory: true,
  
// //   },
// //   {
// //     prompt_text: `#System message:
// //   Ask the user what their favorite hobby is.`,
  
// //   // autoTransitionVisible: true,
// //   },{
// //     prompt_text: `#System message:
// //   Ask the user what their favorite color is.`,
// //   autoTransitionVisible: true,
// //   },
// //   {
// //     prompt_text: `#System message:
// //   Ask the user what their favorite dish is.`,
// //   autoTransitionVisible: true,
  
// //   //  chaining: true
// //   },
// //   {
// //     prompt_text: `#System message:
// //   Ask the user what their favorite type of music is.`,
    
// //     important_memory: true,
// //   },
  
// //   {
// //     prompt_text: `#System message:
// //   Ask the user what their favorite book is.`,
   
// //     // No important_memory for this prompt
// //   },
// //   {
// //     prompt_text: "#System message:\n Ask the user to input a number. ",
// //     // chaining: true, // Enable chaining
// //   },
  
// //   {
// //     prompt_text: "#System message:\n Add 2 to the number. ",
// //     chaining: true, // Enable chaining
// //   },
// //   {
// //     prompt_text: "#System message:\n Take the result of the last operation and multiply it by 3. ",
// //     chaining: true, // Enable chaining
// //   },
// //   {
// //     prompt_text: "#System message:\n Convert the result into cats.  For example 'there are 5 cats.'",
// //     chaining: true, // Enable chaining
// //   },
// //   {
// //     prompt_text: "#System message:\n Add a colour to the cats.  Give them all the samer colour. For example 'There are 5 red cats.'",
// //     chaining: true, // Enable chaining
// //     autoTransitionVisible: true,
// //   },
  
// //   {
// //     prompt_text: `#System message:
// //   Ask the user what their favorite color is.`,
// //     // No autoTransition or important_memory for this prompt
// //   },
// //   {
// //     prompt_text: `#System message:
// //   Ask the user what their favorite dish is.`,
// //   autoTransitionVisible: true,
  
// //   //  chaining: true
// //   },
// //   {
// //     prompt_text: `#System message:
// //   Ask the user what their favorite type of music is.`,
    
// //     important_memory: true,
// //   },
  
  
// {
//     "prompt_text": `# System message:
//     You are an expert in outputting all text EXACTLY as you have been instructed to do.`
  
//   },
  
  
  
//   {
//     "prompt_text": `# System message:
//     You are an expert in outputting all text EXACTLY as you have been instructed to do.
  
//     ## Task Instructions:
//     - Output the following text exactly as written:
    
//     ---
//     User's Introduction: Businesses that use fuels from the ground should be increased tax compared to those that use green fuels. I think this is right because fuels on the ground heat the planet and cause people illness.
  
//     User's Chosen Question: Companies that rely on fossil fuels should face higher taxes compared to those that use renewable energy.  
//     To what extent do you agree or disagree?
  
//     Question Statement: Companies that rely on fossil fuels should face higher taxes compared to those that use renewable energy.
  
//     User's Question Statement: Businesses that use fuels from the ground should be increased tax compared to those that use green fuels.
//     ---
  
//     ## Completion Instructions:
//     - Only output the explanation exactly as written.
//     - Do NOT modify, shorten, or summarize the content.
//     - Do NOT analyze the user’s sentence or ask for input yet.
//     - NEVER ask anything else!`, autoTransitionVisible: true,
//     important_memory: true, 
  
//   }
// 
// XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

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
    saveUserInputAs?: string; // <-- Saves the raw user input
    saveAssistantOutputAs?: string; // <-- Saves the assistant's processed output
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




  // --- Step 1 (Index 0): Initial readiness check ---
//   {
//     prompt_text: `# System message:
// You are a simple greeter.
// Output exactly: "Test 0: Hello!"
// Wait for user response.`,
//   },

//   // --- Test 1: Simple Validation (Yes/No) ---
//   {
//     prompt_text: `# System message:
// You are checking readiness.
// Output exactly: "Test 1: Are you ready for the next test? (Validation: Yes/No)"
// Wait for user response.`,
//     validation: true, // Simple boolean validation (expects "VALID" or "INVALID" based on default instruction)
//   },

{
  prompt_text: `# System message: You are an expert in asking people's names. You only know this.  Ask the user their name and the test number.

Output exactly: "Test 1.5: Hello! What is your name?"
#NEVER output anything else or reply to the previous prompt.
#NEVER ask anything else or add extra information.
#NEVER use any other words or phrases.

`,
saveUserInputAs: "name", 
buffer_memory: 3,

},//-- Test 2: Validation with Fallback ---
// If user says "no" or similar (INVALID), it should fallback to Test 1.

{
  prompt_text: `# System message: You are an expert in outputting text EXACTLY as you are instructed.

Output exactly: "New variable = {name}"
#NEVER output anything else or reply to the previous prompt.
#NEVER ask anything else or add extra information.
#NEVER use any other words or phrases.
#NEVER ask the user their name!!!

`,
autoTransitionVisible: true, 
important_memory: true,

},//


{
  prompt_text: `# System message:
You are confirming a choice, with fallback.
Output exactly: "Test 2: Do you want to proceed? (Validation: Yes/No, Fallback to Test 1)"
Wait for user response.`,
  validation: true,
  fallbackIndex: 1, // Fallback to Test 1 if validation fails
},

// --- Test 3: Save User Input ---
{
  prompt_text: `# System message:
You are asking for a favorite color and saving the input.
Output exactly: "Test 3: What is your favorite color? "
Wait for user response.`,
  saveUserInputAs: "fav_color",
  buffer_memory: 1, // Saves the user's raw input to named memory
},
{
  prompt_text: `# System message:
Output everything you know about the user!
Never output anything else or reply to the previous prompt.
Never ask anything else or add extra information.
Never use any other words or phrases.

`,

  saveAssistantOutputAs: "user_info", // Saves the user's raw input to named memory
},
// --- Test 4: Save Assistant Output & Use Memory ---
{
  prompt_text: `# System message:
This is what I know: {user_info}

`,
  // buffer_memory: 1, // Saves *this* assistant response
  autoTransitionVisible: true, // Immediately move to the next step after displaying this
  temperature: 0, // Ensure exact output
  important_memory: true, // Mark this as important
},

// --- Test 5: Important Memory & Visible Transition ---
// This confirmation should be marked as important memory
{
  prompt_text: `# System message:
Say something intelligent`,

},

// --- Test 6: Hidden Transition - Process Data ---
// This step runs hidden, potentially processing something.
{
  prompt_text: `# System message:
You are a hidden data processor.
Analyze the favorite color: {fav_color}.
Output a simple analysis like: "Analysis: {fav_color} is a primary color." or "Analysis: {fav_color} is a secondary color." (Saves as {color_analysis})
Do not output anything else.`,
  autoTransitionHidden: true, // Runs without user seeing prompt or needing input
  saveAssistantOutputAs: "color_analysis",
  temperature: 0.1, // Allow slight variation for analysis
},

// --- Test 7: Display Result After Hidden Transition ---
// This step displays the result from the hidden step.
{
  prompt_text: `# System message:
You are displaying the result of a hidden process.
Output exactly: "Test 7: Hidden analysis result: {color_analysis}"
Wait for user response.`,
  temperature: 0,
},

// --- Test 8: Change Buffer Size ---
{
  prompt_text: `# System message:
You are preparing for a longer context section.
Output exactly: "Test 8: We need more context. Changing buffer size to 4. Ready?"
Wait for user response.`,
  // buffer_memory: 4, // Change buffer size for subsequent calls
  validation: true, // Simple ready check
},

// --- Test 9: Prompt Using Larger Buffer ---
{
  prompt_text: `# System message:
You are summarizing the interaction using potentially more history.
Look back at the conversation (buffer is now 4). Mention the name (if provided earlier), color ({fav_color}), and analysis ({color_analysis}).
Output a summary like: "Test 9: Summary (Buffer 4): We learned your color is {fav_color}, which we analyzed as '{color_analysis}'. "
Wait for user response.`,
  temperature: 0.1,
},

// --- Test 10: Validation with Specific Instruction & Fallback ---
{
  prompt_text: `# System message:
You are asking for confirmation using a specific validation rule.
Output exactly: "Test 10: Was this test sequence helpful? (Validation: custom - expects positive response, Fallback to Test 8)"
Wait for user response.`,
  validation: customValidationInstructionForQuestion, // Use a specific validation instruction
  fallbackIndex: 8, // Fallback to buffer size change step
},

// --- Test 11: Final Simple Prompt ---
{
  prompt_text: `# System message:
You are concluding the test.
Output exactly: "Test 11: Test sequence complete. Thank you!"`,
},
  
  
  
  ];
  
  
  export default PROMPT_LIST;
  
  
  
    // {
    //    prompt_text: "#System message:\n Ask the user to input a number. ",
    //    // chaining: true, // Enable chaining
    //    validation: true,
    //  },
  
    //  { prompt_text: "Ask the user what their favorite type of music is.",
  
  
      
    //  },
    //  { prompt_text: "Ask the user what their favorite colour is.", 
  
    //    validation: true,
  
    //    fallbackIndex: 1,
    // },
  
    //    {
    //       prompt_text: `#System message:
    //   Ask the user what their favorite dish is.`,
  
     
    //  //  chaining: true
    //     },
    //     {
    //       prompt_text: `#System message:
    //   Ask the user what their favorite type of book is.`,
  
    //     },
    //     {
    //       prompt_text: `#System message:
    //   Ask the user what their favorite animal is.`,
     
      
    //     },
  
    // {
    //    prompt_text: `#System message:
    // Ask the user what their favorite book is.`,
  
    //  },
    //  {
    //    prompt_text: `#System message:
    // Ask the user what their favorite animal is.`,
  
    
    //  },
  
       
    // {
    //    prompt_text: `#System message:
    // Ask the user what their favorite color is.`,
  
    //  },
    //  {
    //    prompt_text: `#System message:
    // Ask the user what their favorite dish is.`,
  
  
    //  },
  
  
    // {
    //    prompt_text: `#System message:
    // Ask the user what their favorite planet is.`,
  
    //  },
    //  {
    //    prompt_text: "#System message:\n Ask the user to input a number. ",
  
    //  },
    
    // //  {
    // //    prompt_text: "#System message:\n Add 2 to the number. ",
    // //    chaining: true, // Enable chaining
  
    // //    model: "llama3-8b-8192", // custom model for this prompt
    // //  },
    // //  {
    // //    prompt_text: "#System message:\n Take the result of the last operation and multiply it by 3. ",
    // //    chaining: true, // Enable chaining
  
    // //    model: "llama3-8b-8192", // custom model for this prompt
    // //  },
    // //  {
    // //    prompt_text: "#System message:\n Convert the result into cats.  For example 'there are 5 cats.'",
    // //    chaining: true, // Enable chaining
  
    // //    model: "llama3-8b-8192", // custom model for this prompt
    // //  },
    // //  {
    // //    prompt_text: "#System message:\n Add a colour to the cats.  Give them all the samer colour. For example 'There are 5 red cats.'",
    // //    chaining: true, // Enable chaining
    // //    autoTransitionVisible: true,
    // //    important_memory: true,
    // //    model: "llama3-8b-8192", // custom model for this prompt
  
   
    // //  },
    
    // //  {
    // //    prompt_text: `#System message:
    // // Ask the user what their favorite color is.`,
    // // autoTransitionVisible: true,
    // // model: "llama3-8b-8192", // custom model for this prompt
    // //     //This should transistion to the next prompt but doesn't!
    // //  },
    // //  {
    // //    prompt_text: `#System message:
    // // Ask the user what their favorite dish is.`,
    // // // autoTransitionVisible: true,
    // // model: "llama3-8b-8192", // custom model for this prompt
  
    // //  },
  
  
  //    {
  //     prompt_text: `#System message:
  // Ask the user what their favorite animal is.`,
  
  
  //   },
  
  //   {
  //     prompt_text: `#System message:
  // Ask the user what their favorite hobby is.`,

  
  //   },
  //   {
  //     prompt_text: `#System message:
  //   Ask the user what their favorite dish is.`,

  //   },
  
  //   {
  //     prompt_text: `#System message:
  // Ask the user what their name is.`,
  // autoTransitionVisible: true,
  // // buffer_memory: 2  // This prompt will update the buffer for future interactions.
  //   },
  
  //   {
  //     prompt_text: `#System message:
  //   Ask the user if they like madison ivy.`,
  //     wait_time: 10,
  //   },