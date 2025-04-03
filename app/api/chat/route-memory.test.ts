import { POST } from './route';
import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import * as sessionLib from '@/lib/session';
import * as openAIUtils from './openaiApiUtils';
import * as promptUtils from './promptUtils';
import * as memoryUtils from './memoryUtils';
import * as bufferUtils from './bufferUtils';
import * as autoTransitionUtils from './autoTransitionUtils';


// --- Mocks ---
jest.mock('next/headers', () => ({ cookies: jest.fn() }));
jest.mock('@/lib/session');
jest.mock('./openaiApiUtils');
jest.mock('./promptUtils');
jest.mock('./memoryUtils');
jest.mock('./bufferUtils');
jest.mock('./autoTransitionUtils');
jest.mock('./prompts', () => ({ __esModule: true, default: [] }));
import PROMPT_LIST_MODULE from './prompts';

// --- Type Aliases ---
const mockedCookies = cookies as jest.Mock;
const mockGetSessionCookieData = sessionLib.getSessionCookieData as jest.Mock;
const mockUpdateSessionCookieData = sessionLib.updateSessionCookieData as jest.Mock;
const mockValidateInput = openAIUtils.validateInput as jest.Mock;
const mockFetchApiResponseWithRetry = openAIUtils.fetchApiResponseWithRetry as jest.Mock;
const mockSaveUserInputToMemoryIfNeeded = memoryUtils.saveUserInputToMemoryIfNeeded as jest.Mock;
const mockProcessAssistantResponseMemory = memoryUtils.processAssistantResponseMemory as jest.Mock;
const mockUpdateDynamicBufferMemory = memoryUtils.updateDynamicBufferMemory as jest.Mock;
const mockHandleAutoTransitionVisible = autoTransitionUtils.handleAutoTransitionVisible as jest.Mock;

// Basic mock implementations
(memoryUtils.injectNamedMemory as jest.Mock).mockImplementation((text, _mem) => text);
(bufferUtils.manageBuffer as jest.Mock).mockImplementation((hist, _size) => hist);
(promptUtils.getModelForCurrentPrompt as jest.Mock).mockReturnValue('mock-default-model');
(openAIUtils.cleanLlmResponse as jest.Mock).mockImplementation(text => text);
mockHandleAutoTransitionVisible.mockResolvedValue({ response: "Mocked Vis", updatedIndex: (idx: number) => idx + 1, updatedNamedMemory: {}, updatedBufferSize: 8, conversationHistory: [] });

// --- Test Data ---
const defaultInitialSession: sessionLib.SessionCookieData = { currentIndex: 0, namedMemory: {}, currentBufferSize: 8, promptIndexThatAskedLastQuestion: null };
const testPrompts = [
    { prompt_text: 'Prompt 0' }, // index 0
    { prompt_text: 'Prompt 1' }, // index 1
    { prompt_text: 'Prompt 2' }, // index 2
    { prompt_text: 'Prompt 3' }, // index 3
    { prompt_text: 'Prompt 4: Book?', saveUserInputAs: "favBook" }, // index 4
    { prompt_text: 'Prompt 5: Star?' }, // index 5
    { prompt_text: 'Prompt 6: Color?', saveAssistantOutputAs: "assistantColorResponse", buffer_memory: 4 }, // index 6
];

describe('API Route: /api/chat - Memory & Buffer', () => {
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
        (memoryUtils.updateDynamicBufferMemory as jest.Mock).mockImplementation((_prompt, size) => size); // Default no change
         // Mock memory processing to simulate saving for relevant tests
        mockProcessAssistantResponseMemory.mockImplementation((text, prompt, memory, _idx) => {
            if (prompt.saveAssistantOutputAs && memory) { // Add null check for memory
                memory[prompt.saveAssistantOutputAs] = text;
            }
            return text;
        });
         // Mock user input saving
         mockSaveUserInputToMemoryIfNeeded.mockImplementation((input, prompt, memory) => {
             if (prompt.saveUserInputAs && memory) { // Add null check for memory
                 memory[prompt.saveUserInputAs] = input;
             }
         });
        (PROMPT_LIST_MODULE as any).default = JSON.parse(JSON.stringify(testPrompts));

        mockRequest = { json: jest.fn().mockResolvedValue({ messages: [{ role: 'user', content: 'Test input' }] }) } as unknown as NextRequest;
    });

     it('should update buffer size and save correct session state', async () => {
        // Arrange
        const promptIdx = 6;
        const initialSession = { currentIndex: promptIdx, namedMemory: { previous: 'value' }, currentBufferSize: 8, promptIndexThatAskedLastQuestion: 5 };
        mockGetSessionCookieData.mockResolvedValue(JSON.parse(JSON.stringify(initialSession)));
        const llmResponse = "Blue";
        mockFetchApiResponseWithRetry.mockResolvedValue(llmResponse);
        // Make buffer util actually return the new size
        (memoryUtils.updateDynamicBufferMemory as jest.Mock).mockImplementation((prompt, _size) => prompt.buffer_memory ?? _size);

        mockRequest.json.mockResolvedValue({ messages: [{ role: 'user', content: 'User input for prompt 6' }] });

        // Act
        await POST(mockRequest);

        // Assert
        expect(mockUpdateDynamicBufferMemory).toHaveBeenCalledWith( expect.objectContaining({ buffer_memory: 4 }), 8 );
        expect(mockProcessAssistantResponseMemory).toHaveBeenCalledWith( llmResponse, expect.objectContaining({ saveAssistantOutputAs: "assistantColorResponse" }), expect.objectContaining({ previous: 'value' }), promptIdx );
        expect(mockUpdateSessionCookieData).toHaveBeenCalledWith(
            mockCookieStore,
            {
                currentIndex: promptIdx + 1,
                promptIndexThatAskedLastQuestion: promptIdx,
                namedMemory: { previous: 'value', assistantColorResponse: llmResponse },
                currentBufferSize: 4, // Expect updated size
            }
        );
    });

    it('should save user input to memory when configured and validation passes', async () => {
        // Arrange
        const promptIdx = 4; // Prompt 4 saves user input
        const initialSession = { currentIndex: promptIdx, namedMemory: {}, currentBufferSize: 8, promptIndexThatAskedLastQuestion: 3 }; // Processing prompt 4 now
        mockGetSessionCookieData.mockResolvedValue(JSON.parse(JSON.stringify(initialSession)));
        mockValidateInput.mockResolvedValue(true); // Assume validation for prompt 3 passes
        mockSaveUserInputToMemoryIfNeeded.mockClear(); // Clear just in case

        const userInput = "Dune";
        mockRequest.json.mockResolvedValue({ messages: [{ role: 'user', content: userInput }] });
        mockFetchApiResponseWithRetry.mockResolvedValue("Response for Prompt 4 (Book)"); // Need response for prompt 4

        // Act
        await POST(mockRequest);

        // Assert
        expect(mockValidateInput).toHaveBeenCalledTimes(1); // Validation checked for prompt 3

        // Check user input was saved based on prompt 4's config (this actually happens in next turn's validation step)
        // Let's adjust: Check it's called during the validation step of the *next* request implicitly
        // OR check memory state *before* the main call of *this* request?
        // --> The current code calls saveUserInputToMemoryIfNeeded *after* successful validation of the *previous* prompt.
        // So for this test, we check it was called for prompt 3's input (if any was configured)
        // Let's refine the test: Start at index 5, answering prompt 4
        const promptAnsweringIdx = 4;
        const currentProcessingIdx = 5;
        const refinedInitialSession = { currentIndex: currentProcessingIdx, namedMemory: {}, currentBufferSize: 8, promptIndexThatAskedLastQuestion: promptAnsweringIdx };
        mockGetSessionCookieData.mockResolvedValue(JSON.parse(JSON.stringify(refinedInitialSession)));
        mockRequest.json.mockResolvedValue({ messages: [{ role: 'user', content: userInput }] }); // User answers prompt 4 with "Dune"
        mockFetchApiResponseWithRetry.mockResolvedValue("Response for Prompt 5 (Star)"); // Main call is for prompt 5


        await POST(mockRequest); // Run again with refined setup

        // Validation passes for prompt 4 (no validation needed)
        expect(mockValidateInput).not.toHaveBeenCalled();
        // User input should be saved for prompt 4
        expect(mockSaveUserInputToMemoryIfNeeded).toHaveBeenCalledTimes(1);
        expect(mockSaveUserInputToMemoryIfNeeded).toHaveBeenCalledWith( userInput, expect.objectContaining({ saveUserInputAs: 'favBook' }), {} ); // Called with prompt 4 config

        // Main fetch is for prompt 5
         expect(mockFetchApiResponseWithRetry).toHaveBeenCalledTimes(1);
         expect(mockFetchApiResponseWithRetry).toHaveBeenCalledWith(expect.objectContaining({
             messages: expect.arrayContaining([ expect.objectContaining({ role: 'system', content: expect.stringContaining('Star?') }) ])
         }));

        // Final state includes saved memory
        expect(mockUpdateSessionCookieData).toHaveBeenCalledWith(
            mockCookieStore,
            expect.objectContaining({
                currentIndex: 6,
                promptIndexThatAskedLastQuestion: 5,
                namedMemory: { favBook: userInput }, // Check memory
            })
        );
    });

     it('should save assistant output using saveAssistantOutputAs', async () => {
         // Arrange
         const promptIdx = 6; // Prompt 6 saves assistant output
         const initialSession = { currentIndex: promptIdx, namedMemory: {}, currentBufferSize: 8, promptIndexThatAskedLastQuestion: 5 };
         mockGetSessionCookieData.mockResolvedValue(JSON.parse(JSON.stringify(initialSession)));
         mockValidateInput.mockResolvedValue(true); // Assume validation for prompt 5 passes
         const assistantResponse = "Purple";
         mockFetchApiResponseWithRetry.mockResolvedValue(assistantResponse);

         // Act
         await POST(mockRequest);

         // Assert
         expect(mockProcessAssistantResponseMemory).toHaveBeenCalledWith(
             assistantResponse,
             expect.objectContaining({ saveAssistantOutputAs: "assistantColorResponse" }),
             {}, // Initial memory
             promptIdx
         );
         expect(mockUpdateSessionCookieData).toHaveBeenCalledWith(
             mockCookieStore,
             expect.objectContaining({
                 namedMemory: { assistantColorResponse: assistantResponse }
             })
         );
     });

}); 