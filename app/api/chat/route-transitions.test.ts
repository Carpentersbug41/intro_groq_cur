import { POST } from './route';
import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import * as sessionLib from '@/lib/session';
import * as openAIUtils from './openaiApiUtils';
import * as promptUtils from './promptUtils';
import * as memoryUtils from './memoryUtils';
import * as bufferUtils from './bufferUtils';
import * as autoTransitionUtils from './autoTransitionUtils';
import * as dbHelpers from '@/utils/databaseHelpers'; // Needed for one test


// --- Mocks ---
jest.mock('next/headers', () => ({ cookies: jest.fn() }));
jest.mock('@/lib/session');
jest.mock('./openaiApiUtils');
jest.mock('./promptUtils');
jest.mock('./memoryUtils');
jest.mock('./bufferUtils');
jest.mock('./autoTransitionUtils');
jest.mock('@/utils/databaseHelpers'); // Mock for the one test using it
jest.mock('./prompts', () => ({ __esModule: true, default: [] }));
import PROMPT_LIST_MODULE from './prompts';

// --- Type Aliases ---
const mockedCookies = cookies as jest.Mock;
const mockGetSessionCookieData = sessionLib.getSessionCookieData as jest.Mock;
const mockUpdateSessionCookieData = sessionLib.updateSessionCookieData as jest.Mock;
const mockValidateInput = openAIUtils.validateInput as jest.Mock;
const mockFetchApiResponseWithRetry = openAIUtils.fetchApiResponseWithRetry as jest.Mock;
const mockHandleAutoTransitionVisible = autoTransitionUtils.handleAutoTransitionVisible as jest.Mock;
const mockHandleAutoTransitionHidden = autoTransitionUtils.handleAutoTransitionHidden as jest.Mock;
const mockHandleDatabaseStorageIfNeeded = dbHelpers.handleDatabaseStorageIfNeeded as jest.Mock; // Alias for DB mock
// Other utils if needed by route logic paths
(memoryUtils.injectNamedMemory as jest.Mock).mockImplementation((text, _mem) => text);
(bufferUtils.manageBuffer as jest.Mock).mockImplementation((hist, _size) => hist);
(promptUtils.getModelForCurrentPrompt as jest.Mock).mockReturnValue('mock-default-model');
(openAIUtils.cleanLlmResponse as jest.Mock).mockImplementation(text => text);
(memoryUtils.processAssistantResponseMemory as jest.Mock).mockImplementation((text, _prompt, _mem, _idx) => text);
(memoryUtils.updateDynamicBufferMemory as jest.Mock).mockImplementation((_prompt, size) => size);

// --- Test Data ---
const defaultInitialSession: sessionLib.SessionCookieData = { currentIndex: 0, namedMemory: {}, currentBufferSize: 8, promptIndexThatAskedLastQuestion: null };
// Define prompts relevant to transitions
const testPrompts = [
    { prompt_text: 'Prompt 0: Dish?', validation: true }, // index 0
    { prompt_text: 'Prompt 1: Planet?' },                  // index 1
    { prompt_text: 'Prompt 2: Number?', validation: true, fallbackIndex: 1 }, // index 2
    { prompt_text: 'Prompt 3: Animal?' }, // index 3
    { prompt_text: 'Prompt 4: Book?', autoTransitionVisible: true }, // index 4
    { prompt_text: 'Prompt 5: Star?', autoTransitionVisible: true }, // index 5
    { prompt_text: 'Prompt 6: Color?'},                   // index 6
    { prompt_text: 'Prompt 7: VisTrigger', autoTransitionVisible: true}, // index 7
    { prompt_text: 'Prompt 8: VisTarget1', autoTransitionVisible: true}, // index 8
    { prompt_text: 'Prompt 9: HiddenTarget', autoTransitionHidden: true}, // index 9
    { prompt_text: 'Prompt 10: Normal After Hidden'}, // index 10
    { prompt_text: 'Prompt 11: HiddenTrigger at End', autoTransitionHidden: true}, // index 11
];


describe('API Route: /api/chat - Transitions', () => {
    let mockRequest: NextRequest;
    let mockCookieStore: any;

     beforeEach(() => {
        jest.clearAllMocks();
        mockCookieStore = { get: jest.fn(), set: jest.fn(), delete: jest.fn() };
        mockedCookies.mockReturnValue(mockCookieStore);
        mockGetSessionCookieData.mockResolvedValue(JSON.parse(JSON.stringify(defaultInitialSession)));
        mockUpdateSessionCookieData.mockResolvedValue(undefined);
        mockValidateInput.mockResolvedValue(true);
        mockFetchApiResponseWithRetry.mockResolvedValue("Default API Response");
        (PROMPT_LIST_MODULE as any).default = JSON.parse(JSON.stringify(testPrompts));

        mockRequest = { json: jest.fn().mockResolvedValue({ messages: [{ role: 'user', content: 'Test input' }] }) } as unknown as NextRequest;

        // Reset transition mocks specifically
        mockHandleAutoTransitionVisible.mockClear().mockResolvedValue({
            response: "Mocked Visible Response",
            updatedIndex: (idx: number) => idx + 1, // Simplistic default for non-focused tests
            updatedNamedMemory: {}, updatedBufferSize: 8, conversationHistory: []
        });
        mockHandleAutoTransitionHidden.mockClear().mockResolvedValue({
            response: "Mocked Hidden Response",
            updatedIndex: (idx: number) => idx + 1, // Simplistic default
            updatedNamedMemory: {}, updatedBufferSize: 8, conversationHistory: []
        });
    });

     // Test originally named: 'should handle a single autoTransitionVisible step correctly'
     // This test needs significant review of mocks and expected calls/state
     it.skip('should handle a single visible transition', async () => {
        const initialPromptIdx = 4; // Prompt 4 triggers visible transition
        const transitionPromptIdx = 5; // Prompt 5 is the target
        const finalPromptIdx = 6; // Prompt 6 runs after transition

        const initialSession = { currentIndex: initialPromptIdx, namedMemory: {}, currentBufferSize: 8, promptIndexThatAskedLastQuestion: 3 };
        mockGetSessionCookieData.mockResolvedValue(JSON.parse(JSON.stringify(initialSession)));
        mockValidateInput.mockResolvedValue(true); // Validation for prompt 3 passes

        const initialResponse = "Response P4 (Book)";
        const transitionResponse = "Response P5 (Star)";
        const finalResponse = "Response P6 (Color)";

        // Setup mock sequence
        mockFetchApiResponseWithRetry
            .mockResolvedValueOnce(initialResponse) // For initial prompt 4
            .mockResolvedValueOnce(finalResponse); // For final prompt 6

        // Mock the transition handler to return expected values
        mockHandleAutoTransitionVisible.mockResolvedValueOnce({
            response: transitionResponse,
            updatedIndex: transitionPromptIdx + 1, // Moves past prompt 5
            updatedNamedMemory: {},
            updatedBufferSize: 8,
            conversationHistory: [{role: "assistant", content: transitionResponse}] // Mock history output
        });

        const response = await POST(mockRequest);
        const responseBody = await response.text();

        // Assertions need review
        expect(mockFetchApiResponseWithRetry).toHaveBeenCalledTimes(2); // Called for P4 and P6? Maybe more in handler?
        expect(mockHandleAutoTransitionVisible).toHaveBeenCalledTimes(1); // Called for P5
        expect(responseBody).toBe(`${initialResponse}\n\n${transitionResponse}\n\n${finalResponse}`); // Check combined content
        expect(mockUpdateSessionCookieData).toHaveBeenCalledWith(
            mockCookieStore,
            expect.objectContaining({
                currentIndex: finalPromptIdx + 1, // Incremented past P6
                promptIndexThatAskedLastQuestion: finalPromptIdx, // P6 generated final part
            })
        );
    });

    // Test originally named: 'should handle a single autoTransitionHidden step correctly'
    // Needs setup and assertions reviewed
     it.skip('should handle a single hidden transition', async () => {
        // Setup: Start before hidden trigger (e.g., index 8)
        const initialPromptIdx = 8;
        const hiddenPromptIdx = 9;
        const finalPromptIdx = 10;

        const initialSession = { currentIndex: initialPromptIdx, namedMemory: {}, currentBufferSize: 8, promptIndexThatAskedLastQuestion: 7 };
        mockGetSessionCookieData.mockResolvedValue(JSON.parse(JSON.stringify(initialSession)));
        mockValidateInput.mockResolvedValue(true); // Validation for prompt 7 passes

        const hiddenResponse = "Hidden P9 Response";
        const finalResponse = "Normal P10 Response";

        // Setup mock sequence
        mockFetchApiResponseWithRetry.mockResolvedValue(finalResponse); // Only final normal prompt 10 should call fetch
        mockHandleAutoTransitionHidden.mockResolvedValueOnce({
             response: hiddenResponse,
             updatedIndex: hiddenPromptIdx + 1, // Moves past prompt 9
             updatedNamedMemory: {}, updatedBufferSize: 8, conversationHistory: []
         });

        const response = await POST(mockRequest);
        const responseBody = await response.text();

         // Assertions need review
        expect(mockFetchApiResponseWithRetry).toHaveBeenCalledTimes(1); // Only for final P10?
        expect(mockHandleAutoTransitionHidden).toHaveBeenCalledTimes(1); // For P9
        expect(responseBody).toBe(finalResponse); // Hidden response should be overwritten
        expect(mockUpdateSessionCookieData).toHaveBeenCalledWith(
             mockCookieStore,
             expect.objectContaining({
                 currentIndex: finalPromptIdx + 1,
                 promptIndexThatAskedLastQuestion: finalPromptIdx,
             })
         );
     });

    // Test originally named: 'should handle mixed autoTransition steps (Vis->Vis->Hidden)'
     it.skip('should handle mixed transitions Vis-Vis-Hidden', async () => {
         // Setup: Start before VisTrigger (index 7)
         const initialPromptIdx = 7;
         const visTarget1Idx = 8;
         const hiddenTargetIdx = 9; // Corrected based on new testPrompts
         const finalNormalIdx = 10;

         const initialSession = { currentIndex: initialPromptIdx, namedMemory: {}, currentBufferSize: 8, promptIndexThatAskedLastQuestion: 6 };
         mockGetSessionCookieData.mockResolvedValue(JSON.parse(JSON.stringify(initialSession)));
         mockValidateInput.mockResolvedValue(true); // Validation for prompt 6 passes

         const visResponse7 = "Vis P7 Resp";
         const visResponse8 = "Vis P8 Resp";
         const hiddenResponse9 = "Hidden P9 Resp";
         const finalResponse10 = "Final P10 Resp";

         // Mock sequence
         mockFetchApiResponseWithRetry
            .mockResolvedValueOnce(visResponse7) // For initial P7
            .mockResolvedValueOnce(finalResponse10); // For final P10

         mockHandleAutoTransitionVisible
             .mockResolvedValueOnce({ response: visResponse8, updatedIndex: 9, updatedNamedMemory: {}, updatedBufferSize: 8, conversationHistory: [] }); // For P8

         mockHandleAutoTransitionHidden
            .mockResolvedValueOnce({ response: hiddenResponse9, updatedIndex: 10, updatedNamedMemory: {}, updatedBufferSize: 8, conversationHistory: [] }); // For P9


         const response = await POST(mockRequest);
         const responseBody = await response.text();

         // Assertions need review
         expect(mockFetchApiResponseWithRetry).toHaveBeenCalledTimes(2); // P7 and P10?
         expect(mockHandleAutoTransitionVisible).toHaveBeenCalledTimes(1); // For P8
         expect(mockHandleAutoTransitionHidden).toHaveBeenCalledTimes(1); // For P9
         expect(responseBody).toBe(finalResponse10); // Only final normal prompt response
         expect(mockUpdateSessionCookieData).toHaveBeenCalledWith(
             mockCookieStore,
             expect.objectContaining({
                 currentIndex: finalNormalIdx + 1,
                 promptIndexThatAskedLastQuestion: finalNormalIdx,
             })
         );
     });

    // Test originally named: 'should handle autoTransition at the end of the prompt list gracefully'
    it.skip('should handle transition at end of list', async () => {
         // Setup: Start before hidden trigger at end (index 11)
         const initialPromptIdx = 11;

         const initialSession = { currentIndex: initialPromptIdx, namedMemory: {}, currentBufferSize: 8, promptIndexThatAskedLastQuestion: 10 };
         mockGetSessionCookieData.mockResolvedValue(JSON.parse(JSON.stringify(initialSession)));
         mockValidateInput.mockResolvedValue(true); // Validation for prompt 10 passes

         const hiddenResponse11 = "Hidden P11 Resp (End)";

          // Mock hidden handler
          mockHandleAutoTransitionHidden.mockResolvedValueOnce({
             response: hiddenResponse11,
             updatedIndex: 12, // Goes out of bounds
             updatedNamedMemory: {}, updatedBufferSize: 8, conversationHistory: []
         });

         const response = await POST(mockRequest);
         const responseBody = await response.text();

         // Assertions need review
         expect(mockFetchApiResponseWithRetry).not.toHaveBeenCalled(); // No normal prompt call
         expect(mockHandleAutoTransitionHidden).toHaveBeenCalledTimes(1); // P11 is processed
         expect(responseBody).toBe(hiddenResponse11); // Hidden response is returned
         expect(mockUpdateSessionCookieData).toHaveBeenCalledWith(
             mockCookieStore,
             expect.objectContaining({
                 currentIndex: 12, // Saves the out-of-bounds index
                 promptIndexThatAskedLastQuestion: 11, // P11 was last generator
             })
         );
     });


}); 