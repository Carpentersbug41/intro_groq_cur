import { POST } from './route';
import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import * as sessionLib from '@/lib/session';
import * as openAIUtils from './openaiApiUtils';
import * as promptUtils from './promptUtils';
// Import other necessary mocks
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
const mockGenerateRetryMessage = openAIUtils.generateRetryMessage as jest.Mock;
const mockFetchApiResponseWithRetry = openAIUtils.fetchApiResponseWithRetry as jest.Mock;
const mockRollbackOnValidationFailure = promptUtils.RollbackOnValidationFailure as jest.Mock;
// Other utils if needed by route logic paths
(memoryUtils.injectNamedMemory as jest.Mock).mockImplementation((text, _mem) => text);
(memoryUtils.processAssistantResponseMemory as jest.Mock).mockImplementation((text, _prompt, _mem, _idx) => text);

// --- Test Data ---
const defaultInitialSession: sessionLib.SessionCookieData = { currentIndex: 0, namedMemory: {}, currentBufferSize: 8, promptIndexThatAskedLastQuestion: null };
// Define prompts relevant to these tests
const testPrompts = [
    { prompt_text: 'Prompt 0: Dish?', validation: true }, // index 0
    { prompt_text: 'Prompt 1: Planet?' },                  // index 1
    { prompt_text: 'Prompt 2: Number?', validation: true, fallbackIndex: 1 }, // index 2
    { prompt_text: 'Prompt 3: Animal?' },                  // index 3
    { prompt_text: 'Prompt 4: Book?' },                    // index 4
    { prompt_text: 'Prompt 5: Star?' },                    // index 5
    { prompt_text: 'Prompt 6: Color?'},                   // index 6
    { prompt_text: 'Prompt 7: Number again?', validation: true, fallbackIndex: 0 }, // index 7
];


describe('API Route: /api/chat - Validation & Rollback', () => {
    let mockRequest: NextRequest;
    let mockCookieStore: any;

    beforeEach(() => {
        jest.clearAllMocks();
        mockCookieStore = { get: jest.fn(), set: jest.fn(), delete: jest.fn() };
        mockedCookies.mockReturnValue(mockCookieStore);
        mockGetSessionCookieData.mockResolvedValue(JSON.parse(JSON.stringify(defaultInitialSession)));
        mockUpdateSessionCookieData.mockResolvedValue(undefined);
        mockValidateInput.mockResolvedValue(true); // Default valid
        mockGenerateRetryMessage.mockResolvedValue('Default retry message.');
        mockRollbackOnValidationFailure.mockImplementation((index) => index); // Default no rollback
        mockFetchApiResponseWithRetry.mockResolvedValue("Default API Response");
        (PROMPT_LIST_MODULE as any).default = JSON.parse(JSON.stringify(testPrompts));

        mockRequest = { json: jest.fn().mockResolvedValue({ messages: [{ role: 'user', content: 'Test input' }] }) } as unknown as NextRequest;
    });

     it('should rollback and save CORRECT next index when validation fails and fallbackIndex > 0', async () => {
        // Arrange
        const initialSession = { currentIndex: 3, namedMemory: {}, currentBufferSize: 8, promptIndexThatAskedLastQuestion: 2 };
        mockGetSessionCookieData.mockResolvedValue(JSON.parse(JSON.stringify(initialSession)));
        mockValidateInput.mockResolvedValue(false); // Fail validation
        mockRollbackOnValidationFailure.mockImplementation((index) => (index === 2 ? 1 : index)); // Rollback 2 -> 1
        const expectedRetryMsg = 'Retry based on planet prompt.';
        mockGenerateRetryMessage.mockResolvedValue(expectedRetryMsg);
        mockRequest.json.mockResolvedValue({ messages: [{ role: 'user', content: 'invalid-number' }] });

        // Act
        const response = await POST(mockRequest);
        const responseBody = await response.text();

        // Assert
        expect(mockValidateInput).toHaveBeenCalledWith('invalid-number', expect.stringContaining('Number?'), undefined);
        expect(mockRollbackOnValidationFailure).toHaveBeenCalledWith(2);
        expect(mockGenerateRetryMessage).toHaveBeenCalledWith('invalid-number', expect.stringContaining('Planet?'), expect.any(Array));
        expect(responseBody).toBe(expectedRetryMsg);
        expect(mockUpdateSessionCookieData).toHaveBeenCalledWith( mockCookieStore, { currentIndex: 2, promptIndexThatAskedLastQuestion: 1, namedMemory: {}, currentBufferSize: 8 });
        expect(mockFetchApiResponseWithRetry).not.toHaveBeenCalled();
    });

    it('should re-ask same question when validation fails and fallbackIndex is 0', async () => {
        // Arrange
        const promptIdx = 7;
        const initialSession = { currentIndex: promptIdx + 1, namedMemory: { some: 'memory' }, currentBufferSize: 8, promptIndexThatAskedLastQuestion: promptIdx };
        const userMessage = 'invalid-input-for-prompt7';
        mockGetSessionCookieData.mockResolvedValue(JSON.parse(JSON.stringify(initialSession)));
        mockRequest.json.mockResolvedValue({ messages: [{ role: 'user', content: userMessage }] });
        mockValidateInput.mockResolvedValue(false); // Fail validation
        mockRollbackOnValidationFailure.mockImplementation((index) => (index === promptIdx ? promptIdx : index)); // Rollback 7 -> 7
        const expectedRetryMsg = 'Retry asked by prompt 7';
        mockGenerateRetryMessage.mockResolvedValue(expectedRetryMsg);

        // Act
        const response = await POST(mockRequest);
        const responseBody = await response.text();

        // Assert
        expect(mockValidateInput).toHaveBeenCalledTimes(1);
        expect(mockValidateInput).toHaveBeenCalledWith( userMessage, expect.stringContaining(testPrompts[promptIdx].prompt_text), undefined );
        expect(mockRollbackOnValidationFailure).toHaveBeenCalledTimes(1);
        expect(mockRollbackOnValidationFailure).toHaveBeenCalledWith(promptIdx);
        expect(mockGenerateRetryMessage).toHaveBeenCalledTimes(1);
        expect(mockGenerateRetryMessage).toHaveBeenCalledWith( userMessage, expect.stringContaining(testPrompts[promptIdx].prompt_text), expect.any(Array) );
        expect(responseBody).toBe(expectedRetryMsg);
        expect(mockUpdateSessionCookieData).toHaveBeenCalledTimes(1);
        expect(mockUpdateSessionCookieData).toHaveBeenCalledWith( mockCookieStore, { currentIndex: initialSession.currentIndex, promptIndexThatAskedLastQuestion: promptIdx, namedMemory: initialSession.namedMemory, currentBufferSize: initialSession.currentBufferSize, } );
        expect(mockFetchApiResponseWithRetry).not.toHaveBeenCalled();
    });

    it('should process prompt 7 with VALID validation', async () => {
        // Arrange - Similar setup but validation passes
         const promptIdx = 7;
         const initialSession = { currentIndex: promptIdx, namedMemory: { prev: 'data'}, currentBufferSize: 8, promptIndexThatAskedLastQuestion: 6 }; // Processing prompt 7 now
         const userMessage = '12345'; // Valid input
         mockGetSessionCookieData.mockResolvedValue(JSON.parse(JSON.stringify(initialSession)));
         mockRequest.json.mockResolvedValue({ messages: [{ role: 'user', content: userMessage }] });
         mockValidateInput.mockResolvedValue(true); // Validation passes
         mockFetchApiResponseWithRetry.mockResolvedValue("Response for Prompt 7"); // LLM Response for prompt 7

        // Act
        await POST(mockRequest);

        // Assert
        expect(mockValidateInput).toHaveBeenCalledTimes(1); // Validation is checked
        expect(mockValidateInput).toHaveBeenCalledWith(userMessage, expect.stringContaining(testPrompts[6].prompt_text), undefined); // Checked against prompt 6 rules
        expect(mockRollbackOnValidationFailure).not.toHaveBeenCalled(); // No rollback
        expect(mockGenerateRetryMessage).not.toHaveBeenCalled(); // No retry message

        // Check main fetch call happened for prompt 7
        expect(mockFetchApiResponseWithRetry).toHaveBeenCalledTimes(1);
        expect(mockFetchApiResponseWithRetry).toHaveBeenCalledWith(expect.objectContaining({
             messages: expect.arrayContaining([ expect.objectContaining({ role: 'system', content: expect.stringContaining(testPrompts[promptIdx].prompt_text) }) ])
         }));

        // Check session update
        expect(mockUpdateSessionCookieData).toHaveBeenCalledWith(
             mockCookieStore,
             { currentIndex: promptIdx + 1, promptIndexThatAskedLastQuestion: promptIdx, namedMemory: { prev: 'data'}, currentBufferSize: 8 } // Expect memory to be preserved if not modified
         );
     });


}); 