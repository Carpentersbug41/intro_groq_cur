import { POST } from './route'; // Import the POST handler
import { NextRequest } from 'next/server';
import { cookies } from 'next/headers'; // Mocked below
import * as sessionLib from '@/lib/session'; // To mock session functions
// Import other necessary mocks based on what route.ts uses
import * as openAIUtils from './openaiApiUtils';
import * as promptUtils from './promptUtils';
import * as memoryUtils from './memoryUtils';
import * as bufferUtils from './bufferUtils';
import * as autoTransitionUtils from './autoTransitionUtils'; // Keep mocks even if not directly tested here

// ---> Mock prompts at the TOP LEVEL <---
jest.mock('./prompts', () => ({
  __esModule: true,
  default: [], // Start empty, will be populated in beforeEach
}));
import PROMPT_LIST_MODULE from './prompts'; // Import the mocked module reference

// --- Mocks for other modules ---
jest.mock('next/headers', () => ({ cookies: jest.fn() }));
jest.mock('@/lib/session');
jest.mock('./openaiApiUtils');
jest.mock('./promptUtils');
jest.mock('./memoryUtils');
jest.mock('./bufferUtils');
jest.mock('./autoTransitionUtils');

// --- Type Aliases for Mocks ---
const mockedCookies = cookies as jest.Mock;
const mockGetSessionCookieData = sessionLib.getSessionCookieData as jest.Mock;
const mockUpdateSessionCookieData = sessionLib.updateSessionCookieData as jest.Mock;
const mockValidateInput = openAIUtils.validateInput as jest.Mock;
const mockGenerateRetryMessage = openAIUtils.generateRetryMessage as jest.Mock;
const mockFetchApiResponseWithRetry = openAIUtils.fetchApiResponseWithRetry as jest.Mock;
const mockCleanLlmResponse = openAIUtils.cleanLlmResponse as jest.Mock;
const mockRollbackOnValidationFailure = promptUtils.RollbackOnValidationFailure as jest.Mock;
const mockGetModelForCurrentPrompt = promptUtils.getModelForCurrentPrompt as jest.Mock;
const mockInjectNamedMemory = memoryUtils.injectNamedMemory as jest.Mock;
const mockSaveUserInputToMemoryIfNeeded = memoryUtils.saveUserInputToMemoryIfNeeded as jest.Mock;
const mockProcessAssistantResponseMemory = memoryUtils.processAssistantResponseMemory as jest.Mock;
const mockUpdateDynamicBufferMemory = memoryUtils.updateDynamicBufferMemory as jest.Mock;
const mockManageBuffer = bufferUtils.manageBuffer as jest.Mock;
const mockHandleAutoTransitionVisible = autoTransitionUtils.handleAutoTransitionVisible as jest.Mock;
const mockHandleAutoTransitionHidden = autoTransitionUtils.handleAutoTransitionHidden as jest.Mock;

// Basic mock implementations
(memoryUtils.updateDynamicBufferMemory as jest.Mock).mockImplementation((_prompt, size) => size);
(memoryUtils.injectNamedMemory as jest.Mock).mockImplementation((text, _mem) => text);
(memoryUtils.processAssistantResponseMemory as jest.Mock).mockImplementation((text, _prompt, _mem, _idx) => text);
(bufferUtils.manageBuffer as jest.Mock).mockImplementation((hist, _size) => hist);
(promptUtils.getModelForCurrentPrompt as jest.Mock).mockReturnValue('mock-default-model');
(openAIUtils.cleanLlmResponse as jest.Mock).mockImplementation(text => text);
mockHandleAutoTransitionVisible.mockResolvedValue({ response: "Mocked Vis", updatedIndex: (idx: number) => idx + 1, updatedNamedMemory: {}, updatedBufferSize: 8, conversationHistory: [] });
mockHandleAutoTransitionHidden.mockResolvedValue({ response: "Mocked Hide", updatedIndex: (idx: number) => idx + 1, updatedNamedMemory: {}, updatedBufferSize: 8, conversationHistory: [] });

// --- Test Data ---
const defaultInitialSession: sessionLib.SessionCookieData = { currentIndex: 0, namedMemory: {}, currentBufferSize: 8, promptIndexThatAskedLastQuestion: null };
const testPrompts = [
  { prompt_text: 'Prompt 0: Dish?', validation: true, model: 'gpt-custom-for-0' },
  { prompt_text: 'Prompt 1: Planet?', important_memory: true },
  { prompt_text: 'Prompt 2: Number?', validation: true, fallbackIndex: 1 },
  { prompt_text: 'Prompt 3: Animal?', temperature: 0.9 },
];

describe('API Route: /api/chat - Basic Flow & Features', () => {
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

        // ---> Set the mocked prompt list content here <---
        (PROMPT_LIST_MODULE as any).default = JSON.parse(JSON.stringify(testPrompts));

        // ---> Reset dependent mock implementation AFTER list is set <---
        mockGetModelForCurrentPrompt.mockImplementation((index) => {
            // Access the list through the module reference
            const promptList = (PROMPT_LIST_MODULE as any).default;
            // Add safety check for index out of bounds
            if (index >= 0 && index < promptList.length) {
                 const prompt = promptList[index];
                 return prompt?.model ?? 'mock-default-model';
            }
            return 'mock-default-model'; // Default if index is bad
        });

        mockRequest = { json: jest.fn().mockResolvedValue({ messages: [{ role: 'user', content: 'Basic input' }] }) } as unknown as NextRequest;
    });

    it('should process the first prompt (index 0) correctly and use custom model', async () => {
        // Arrange
        const currentTestInitialSession = { ...defaultInitialSession }; // index 0, askedBy=null
        mockGetSessionCookieData.mockResolvedValue(JSON.parse(JSON.stringify(currentTestInitialSession)));
        const mockRequestBody = { messages: [{ role: 'user', content: 'First message' }] };
        mockRequest.json.mockResolvedValue(mockRequestBody);
        mockFetchApiResponseWithRetry.mockResolvedValue("Response for Prompt 0");
        mockGetModelForCurrentPrompt.mockImplementation((index) => {
            if (index === 0) return 'gpt-custom-for-0';
            return 'mock-default-model';
        });

        // Act
        await POST(mockRequest);

        // Assert - Debugging Checks
        expect(mockGetSessionCookieData).toHaveBeenCalledTimes(1);
        expect(mockRequest.json).toHaveBeenCalledTimes(1);
        expect(mockValidateInput).not.toHaveBeenCalled();
        expect(mockGetModelForCurrentPrompt).toHaveBeenCalledWith(0);
        expect(mockInjectNamedMemory).toHaveBeenCalledTimes(1);
        expect(mockManageBuffer).toHaveBeenCalledTimes(1);

        // Assert - Core Logic Checks
        expect(mockFetchApiResponseWithRetry).toHaveBeenCalledTimes(1);
        expect(mockUpdateSessionCookieData).toHaveBeenCalledTimes(1);

        // Assert - Detailed API Call Args
        expect(mockFetchApiResponseWithRetry).toHaveBeenCalledWith(expect.objectContaining({
            model: "gpt-custom-for-0",
            messages: expect.arrayContaining([ expect.objectContaining({ role: 'system', content: expect.stringContaining('Dish?') }) ])
        }));
        // Assert - Detailed Session Update Args
        expect(mockUpdateSessionCookieData).toHaveBeenCalledWith( mockCookieStore, { currentIndex: 1, promptIndexThatAskedLastQuestion: 0, namedMemory: {}, currentBufferSize: 8 } );
    });

    it('should use custom temperature when specified', async () => {
        // Arrange
        const promptIdx = 3; // Current prompt to execute
        const prevPromptIdx = 2; // Previous prompt that asked the question
        const currentTestInitialSession = { currentIndex: promptIdx, namedMemory: {}, currentBufferSize: 8, promptIndexThatAskedLastQuestion: prevPromptIdx };
        mockGetSessionCookieData.mockResolvedValue(JSON.parse(JSON.stringify(currentTestInitialSession)));
        const userInput = 'Input for temp test';
        const mockRequestBody = { messages: [{ role: 'user', content: userInput }] };
        mockRequest.json.mockResolvedValue(mockRequestBody);
        mockValidateInput.mockResolvedValue(true); // Make validation pass
        mockFetchApiResponseWithRetry.mockResolvedValue("Response for Prompt 3");
        mockGetModelForCurrentPrompt.mockReturnValue('mock-default-model');

        // Act
        await POST(mockRequest);

        // Assert - Debugging Checks
        expect(mockGetSessionCookieData).toHaveBeenCalledTimes(1);
        expect(mockRequest.json).toHaveBeenCalledTimes(1);

        // ---> Refined Validation Check <---
        // Check validation was attempted for the *previous* prompt (index 2)
        expect(mockValidateInput).toHaveBeenCalledTimes(1);
        expect(mockValidateInput).toHaveBeenCalledWith(
            userInput,
            // Ensure prompt text from the correct prompt (index 2) is passed
            expect.stringContaining((PROMPT_LIST_MODULE as any).default[prevPromptIdx].prompt_text),
            undefined // Assuming no memory passed to validation here
        );

        // <<< Still expect this to fail first based on previous output? Or will validate pass now?
        expect(mockGetModelForCurrentPrompt).toHaveBeenCalledWith(promptIdx);
        expect(mockInjectNamedMemory).toHaveBeenCalledTimes(1);
        expect(mockManageBuffer).toHaveBeenCalledTimes(1);
        expect(mockFetchApiResponseWithRetry).toHaveBeenCalledTimes(1);
        expect(mockUpdateSessionCookieData).toHaveBeenCalledTimes(1);

        // Assert - Detailed API Call Args
        expect(mockFetchApiResponseWithRetry).toHaveBeenCalledWith(expect.objectContaining({
            temperature: 0.9,
            messages: expect.arrayContaining([ expect.objectContaining({ role: 'system', content: expect.stringContaining('Animal?') }) ])
        }));
        // Assert - Detailed Session Update Args
        expect(mockUpdateSessionCookieData).toHaveBeenCalledWith( mockCookieStore, { currentIndex: 4, promptIndexThatAskedLastQuestion: 3, namedMemory: {}, currentBufferSize: 8 });
    });
}); 