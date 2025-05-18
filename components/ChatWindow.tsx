"use client";

import { useState, useEffect, FormEvent, useRef } from "react"; // <-- Keep useRef
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import ReactMarkdown from "react-markdown";

// --- Define Essay Types ---
type EssayType = "opinion" | "ads_type1" | "discussion" | "opinion_conclusion" | "opinion_mbp"; // <-- Add 'opinion_mbp'

function customTrim(str: string) {
  return str.replace(/^[\s\u00A0\u200B]+|[\s\u00A0\u200B]+$/g, "");
}

type Message = {
  role: "user" | "assistant";
  content: string;
};

export function ChatWindow(props: {
  endpoint: string;
  placeholder?: string;
  titleText?: string;
  emptyStateComponent?: React.ReactNode;
  videoId?: string;
}) {
  const {
    endpoint,
    placeholder = "Type your message...",
    titleText = "Professional Chat",
    emptyStateComponent,
    videoId,
  } = props;

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  // --- ADD STATE FOR ESSAY TYPE ---
  const [selectedEssayType, setSelectedEssayType] = useState<EssayType>("opinion"); // Default to 'opinion'

  const messageContainerRef = useRef<HTMLDivElement | null>(null);
  // --- ADD REF FOR INPUT ---
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Effect to scroll messages down
  useEffect(() => {
    if (messageContainerRef.current) {
      messageContainerRef.current.scrollTop = messageContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // --- ADD EFFECT TO MANAGE INPUT FOCUS ---
  useEffect(() => {
    // Focus on mount
    inputRef.current?.focus();
  }, []); // Empty dependency array means run only once on mount

  useEffect(() => {
    // Refocus after submission or reset completes
    if (!isSubmitting && !isResetting && inputRef.current) {
       console.log("Refocusing input field..."); // Debug log
       inputRef.current.focus();
    }
     // Also log when disabled, for context
     if (isSubmitting || isResetting) {
        console.log("Input field disabled, focus not attempted.");
    }
  }, [isSubmitting, isResetting]); // Re-run when submission/reset state changes

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isSubmitting || isResetting) return;

    let trimmedInput = customTrim(input);

    if (!trimmedInput) {
      toast.warning("Please enter a message.");
      // --- FOCUS BACK IF INPUT WAS EMPTY ---
      inputRef.current?.focus();
      return;
    }

    setIsSubmitting(true);

    const userMessage: Message = { role: "user", content: trimmedInput };
    setMessages((prev) => [...prev, userMessage]);
    setInput(""); // Clear input *before* API call potentially

    try {
      const messagesToSend = [...messages, userMessage];
      const requestBody = {
        // --- PASS essayType to backend ---
        essayType: selectedEssayType,
        messages: messagesToSend, // Keep existing structure if backend expects 'messages' key
        // Alternatively, backend might expect just { message, history, essayType }
        // Adjust this based on your exact backend route's expectations
        // Example if backend expects { message, history, essayType }:
        // message: trimmedInput,
        // history: messages, // Send previous messages if needed
        // essayType: selectedEssayType,
        stream: false, // Assuming you don't want streaming responses based on current code
      };

      console.log("📤 Sending request to backend:", JSON.stringify(requestBody, null, 2));

      // --- Ensure endpoint usage is correct ---
      // If your main chat endpoint is different from '/api/chat', use `endpoint` prop
      const targetEndpoint = endpoint || '/api/chat'; // Use prop or default

      const res = await fetch(targetEndpoint, { // Use targetEndpoint
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) {
        let errorDetails: any;
        try {
          errorDetails = await res.clone().json();
        } catch {
          errorDetails = await res.text();
        }
        console.error("❌ Error response details:", errorDetails);
        const errorMessage = errorDetails?.message || errorDetails || `HTTP error ${res.status}`;
        throw new Error(errorMessage);
      }

      const responseText = await res.text();
      console.log("🤖 Assistant Response (raw text):", responseText);

      const assistantContent = responseText || "Error: No response content.";
      setMessages((prev) => [...prev, { role: "assistant", content: assistantContent }]);

    } catch (err: any) {
      console.error("❌ Caught error in handleSubmit:", err);
      toast.error("Error: " + err.message);
      // Don't clear messages on error
    } finally {
      setIsSubmitting(false);
      // Focus will be handled by the useEffect hook reacting to isSubmitting becoming false
    }
  }

  const handleNewChat = async () => {
    if (isSubmitting || isResetting) return;

    setIsResetting(true);
    console.log("🔄 Resetting chat session...");

    try {
      const response = await fetch('/api/chat/reset', {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to reset chat session');
      }

      const data = await response.json();
      console.log(data.message);
      toast.success("New chat started!");

      setMessages([]);
      setInput("");

    } catch (error: any) {
      console.error("Error resetting chat:", error);
      toast.error("Error starting new chat: " + error.message);
    } finally {
      setIsResetting(false);
      // Focus will be handled by the useEffect hook reacting to isResetting becoming false
    }
  };

  function renderMessage(msg: Message, index: number) {
    const isUser = msg.role === "user";
    const bubbleClasses = isUser
      ? "bg-blue-100 text-blue-900 self-end rounded-lg max-w-[80%]"
      : "bg-gray-100 text-gray-900 self-start rounded-lg max-w-[80%]";

    return (
      <div key={index} className={`p-3 mb-2 text-sm ${bubbleClasses} break-words`}>
        {isUser ? <p>{msg.content}</p> : <ReactMarkdown>{msg.content}</ReactMarkdown>}
      </div>
    );
  }

  // --- Helper to create Radio Buttons ---
  const renderEssayTypeSelector = () => {
    const introEssayTypes: { value: EssayType; label: string }[] = [
      { value: "opinion", label: "Opinion Essay" },
      { value: "ads_type1", label: "Adv/Disadv (Type 1)" },
      { value: "discussion", label: "Discussion Essay" },
    ];

    const conclusionEssayTypes: { value: EssayType; label: string }[] = [
      { value: "opinion_conclusion", label: "Opinion Conclusion" },
      // Add other conclusion types here if needed later
    ];

    const disableRadios = isSubmitting || isResetting || messages.length > 0;

    return (
      <div className="mb-3 p-2 border border-gray-200 rounded-md bg-gray-50">
        {/* Introduction Types */}
        <label className="block text-sm font-medium text-gray-700 mb-1">Select Introduction Essay Type:</label>
        <div className="flex space-x-4 mb-3">
          {introEssayTypes.map((type) => (
            <label key={type.value} className="inline-flex items-center text-sm">
              <input
                type="radio"
                name="essayType"
                value={type.value}
                checked={selectedEssayType === type.value}
                onChange={() => setSelectedEssayType(type.value)}
                disabled={disableRadios}
                className="form-radio h-4 w-4 text-blue-600 transition duration-150 ease-in-out disabled:opacity-50"
              />
              <span className={`ml-2 ${disableRadios ? "text-gray-400" : "text-gray-800"}`}>{type.label}</span>
            </label>
          ))}
        </div>

        {/* Main Body Paragraphs Types */}
        <label className="block text-sm font-medium text-gray-700 mb-1 mt-2">Select Main Body Paragraphs Type:</label>
        <div className="flex space-x-4 mb-3">
          <label className="inline-flex items-center text-sm">
            <input
              type="radio"
              name="essayType"
              value="opinion_mbp"
              checked={selectedEssayType === "opinion_mbp"}
              onChange={() => setSelectedEssayType("opinion_mbp")}
              disabled={disableRadios}
              className="form-radio h-4 w-4 text-blue-600 transition duration-150 ease-in-out disabled:opacity-50"
            />
            <span className={`ml-2 ${disableRadios ? "text-gray-400" : "text-gray-800"}`}>Opinion MBP</span>
          </label>
        </div>

        {/* Conclusion Types */}
        <label className="block text-sm font-medium text-gray-700 mb-1">Select Conclusion Essay Type:</label>
        <div className="flex space-x-4">
          {conclusionEssayTypes.map((type) => (
            <label key={type.value} className="inline-flex items-center text-sm">
              <input
                type="radio"
                name="essayType" // Keep the same name to ensure only one can be selected overall
                value={type.value}
                checked={selectedEssayType === type.value}
                onChange={() => setSelectedEssayType(type.value)}
                disabled={disableRadios}
                className="form-radio h-4 w-4 text-blue-600 transition duration-150 ease-in-out disabled:opacity-50"
              />
              <span className={`ml-2 ${disableRadios ? "text-gray-400" : "text-gray-800"}`}>{type.label}</span>
            </label>
          ))}
        </div>

         {messages.length > 0 && <p className="text-xs text-gray-500 mt-2">Start a new chat to change the essay type.</p>}
      </div>
    );
  };

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col bg-white text-gray-900 p-4 rounded-lg shadow-md">
      {/* Header */}
       <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-200">
        <h2 className="text-lg font-semibold">{titleText}</h2>
        <button
          onClick={handleNewChat}
          className={`bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1 rounded-md text-sm ${isResetting || isSubmitting ? "opacity-50 cursor-not-allowed" : ""}`}
          disabled={isResetting || isSubmitting}
        >
          {isResetting ? "Resetting..." : "New Chat"}
        </button>
      </div>

      {videoId && (
        <div className="mb-3 w-full relative" style={{ paddingTop: "56.25%" }}>
          <iframe
            className="absolute top-0 left-0 w-full h-full rounded"
            src={`https://www.youtube.com/embed/${videoId}`}
            title="YouTube video player"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </div>
      )}

      {/* --- ADD ESSAY TYPE SELECTOR --- */}
      {renderEssayTypeSelector()}

      {/* Message Container */}
      <div
        ref={messageContainerRef}
        className="flex flex-col mb-3 p-3 space-y-3 overflow-y-auto border border-gray-200 rounded-md bg-gray-50"
        style={{ minHeight: "400px", maxHeight: "600px" }}
      >
        {messages.length === 0 && emptyStateComponent
          ? <div className="flex justify-center items-center h-full text-gray-500">{emptyStateComponent}</div>
          : messages.map((m, idx) => renderMessage(m, idx))}
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex items-center">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          className="flex-grow p-2 mr-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          disabled={isSubmitting || isResetting}
          autoFocus
        />
        <button
          type="submit"
          className={`bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md transition duration-150 ease-in-out text-sm ${isSubmitting || isResetting ? "opacity-50 cursor-not-allowed" : ""}`}
          disabled={isSubmitting || isResetting}
        >
          {isSubmitting ? "Sending..." : "Send"}
        </button>
      </form>

      <ToastContainer position="bottom-right" autoClose={3000} />
    </div>
  );
}