/**
 * Defines the structure for configuration objects used to generate
 * tailored prompt lists for different IELTS essay introduction types.
 */
export interface IeltsEssayConfig {
  // --- Basic Info ---
  /** Full name of the essay type (e.g., "Opinion Essay", "Discussion Essay") */
  essayTypeFullName: string;
  /** Shorter name for use in sentences (e.g., "Opinion", "Discussion") */
  essayTypeShortName: string;

  // --- Step 0: Readiness ---
  /** Prompt text asking the user if they are ready to begin. Should include placeholder {essayTypeShortName}. */
  readinessPromptText: string;

  // --- Step 1: Select Question ---
  /** Template for the prompt that asks the LLM to select a question. Should include placeholders {essayTypeFullName} and {questionList}. */
  selectQuestionPromptTextTemplate: string;
  /** Array of sample questions for this essay type. */
  sampleQuestions: string[];

  // --- Step 2: Confirm Question ---
  /** Prompt text asking the user to confirm the chosen question. Should include placeholder {essayTypeShortName}. */
  questionConfirmationPromptText: string;

  // --- Step 4: Ask for Intro ---
  /** Prompt text asking the user to write their introduction. Should include placeholder {essayTypeShortName}. */
  askForIntroductionPromptText: string;

  // --- Analysis Keys & Labels (Used in multiple steps) ---
  /** Memory key used to save/retrieve the original question statement (without instructions). */
  originalStatementMemoryKey: string; // e.g., "[oqs]", "[original_question_statement]"
  /** Label used when displaying the original statement to the user. */
  originalStatementOutputLabel: string; // e.g., "Original Question Statement:", "Original Discussion Question Statement:"
  /** Memory key used to save/retrieve the user's core paraphrased statement(s). */
  userParaphraseMemoryKey: string; // e.g., "[bgs]", "[user_paraphrased_views_statement]"
  /** Label used when displaying the user's paraphrase to the user. */
  userParaphraseOutputLabel: string; // e.g., "User's background Statement:", "User's Paraphrased Views Statement:"
  /** Memory key for the breakdown of the user's introduction structure. */
  introductionBreakdownKey: string; // e.g., "[user_introduction_breakdown]"

  // --- Prompt Text for Complex Analysis/Generation Steps ---
  /** Full prompt text instructing the LLM how to extract the original statement (Index 7). Needs to reference originalStatementMemoryKey. */
  extractOriginalStatementPromptText: string;
  /** Full prompt text instructing the LLM how to extract the user's paraphrase (Index 8). Needs to reference userParaphraseMemoryKey. */
  extractUserParaphrasePromptText: string;
  /** Full prompt text instructing the LLM how to extract the user's supporting ideas/reasons (Index 9). */
  extractUserIdeasPromptText: string;
  /** Full prompt text explaining the structural formula for this essay type (Index 11). */
  formulaExplanationPromptText: string;
  /** Full prompt text instructing the LLM how to break down the user's intro according to the formula (Index 13). Needs to save to introductionBreakdownKey. */
  breakdownAnalysisPromptText: string;
  /** Full prompt text instructing the LLM how to provide a corrected version based on formula analysis (Index 19). */
  provideCorrectionPromptText: string;
  /** Full prompt text explaining the upcoming paraphrasing check (Index 21). */
  paraphraseCheckExplanationText: string;
  /** Full prompt text instructing the LLM how to evaluate the user's paraphrasing quality (Index 25). Needs to reference originalStatementMemoryKey and userParaphraseMemoryKey. */
  evaluateParaphrasingQualityPromptText: string;
  /** Full prompt text instructing the LLM how to suggest an improved paraphrase (Index 26). Needs to reference originalStatementMemoryKey. */
  suggestImprovedParaphrasePromptText: string;

  // --- Formula Component Evaluation Steps (Indices 15-18 equivalent) ---
  // For simplicity initially, we'll provide the full prompt text for each required check step.
  /** Full prompt text for the first formula component check (e.g., Opinion Start Phrase / Disc. S1 Start Phrase). */
  formulaCheckPromptText_Step15: string;
  /** Full prompt text for the second formula component check (e.g., Opinion Paraphrase / Disc. S1 Structure). */
  formulaCheckPromptText_Step16: string;
  /** Full prompt text for the third formula component check (e.g., Opinion Phrase / Disc. S2 Structure). */
  formulaCheckPromptText_Step17: string;
  /** Full prompt text for the fourth formula component check (e.g., Opinion Ideas/Connector / Disc. S2 Comma - if applicable). */
  formulaCheckPromptText_Step18?: string; // Optional step

  // --- General Settings ---
  /** Consistent text for intermediate readiness checks (e.g., "Are you ready to continue?"). */
  readyCheckPromptText: string;
} 