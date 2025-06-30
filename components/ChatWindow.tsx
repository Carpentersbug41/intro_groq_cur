"use client";

import { useState, useEffect, FormEvent, useRef } from "react"; // <-- Keep useRef
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import ReactMarkdown from "react-markdown";

// --- Define Essay Types ---
type EssayType = "opinion" | "ads_type1" | "discussion" | "opinion_conclusion" | "opinion_mbp" | "action_test"; // <-- Add 'action_test'

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
  const [isLoading, setIsLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [selectedEssayType, setSelectedEssayType] = useState<EssayType>("opinion");

  const messageContainerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (messageContainerRef.current) {
      messageContainerRef.current.scrollTop = messageContainerRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!isLoading && !isResetting && inputRef.current) {
       inputRef.current.focus();
    }
  }, [isLoading, isResetting]);

  const handleNewChat = async () => {
    // This should ideally call a `/api/chat/reset` endpoint
    // which would call `destroySession`. For now, we just reset client-side.
    if (isLoading || isResetting) return;
    setIsResetting(true);
    setMessages([]);
    setInput("");
    
    try {
      await fetch('/api/chat/reset', { method: 'POST' });
      toast.success("New chat started!");
    } catch (error) {
      console.error("Error resetting chat:", error);
      toast.error("Could not start a new chat. Please refresh the page.");
    } finally {
      setIsResetting(false);
    }
  };

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isLoading || isResetting) return;

    let trimmedInput = customTrim(input);
    if (!trimmedInput) {
      toast.warning("Please enter a message.");
      inputRef.current?.focus();
      return;
    }

    setIsLoading(true);
    const userMessage: Message = { role: "user", content: trimmedInput };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");

    try {
      const requestBody = {
        essayType: selectedEssayType,
        messages: newMessages,
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error ${response.status}: ${errorText}`);
      }
      
      if (!response.body) {
        throw new Error("Response body is empty.");
      }

      // Handle the streaming response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantResponse = "";
      
      setMessages(prev => [...prev, { role: 'assistant', content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        assistantResponse += decoder.decode(value, { stream: true });
        setMessages(prev => {
          const updatedMessages = [...prev];
          updatedMessages[updatedMessages.length - 1].content = assistantResponse;
          return updatedMessages;
        });
      }

    } catch (err: any) {
      console.error("Error in handleSubmit:", err);
      toast.error("Error: " + err.message);
      setMessages(messages); // Revert to old messages on error
    } finally {
      setIsLoading(false);
    }
  }

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

    const disableRadios = isLoading || isResetting || messages.length > 0;

    return (
      <div className="mb-3 p-2 border border-gray-200 rounded-md bg-gray-50">
        {/* Test Flows */}
        <label className="block text-sm font-medium text-gray-700 mb-1">Test Flows:</label>
        <div className="flex space-x-4 mb-3">
          <label className="inline-flex items-center text-sm">
            <input
              type="radio"
              name="essayType"
              value="action_test"
              checked={selectedEssayType === "action_test"}
              onChange={() => setSelectedEssayType("action_test")}
              disabled={disableRadios}
              className="form-radio h-4 w-4 text-blue-600 transition duration-150 ease-in-out disabled:opacity-50"
            />
            <span className={`ml-2 ${disableRadios ? "text-gray-400" : "text-gray-800"}`}>Action Test Flow</span>
          </label>
        </div>

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
          className={`bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1 rounded-md text-sm ${isResetting || isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
          disabled={isResetting || isLoading}
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
        
        {isLoading && (
          <div className="p-3 mb-2 text-sm bg-gray-100 text-gray-900 self-start rounded-lg max-w-[80%] break-words">
            <div className="flex items-center space-x-1">
              <span className="dot animate-bounce"></span>
              <span className="dot animate-bounce" style={{ animationDelay: '0.2s' }}></span>
              <span className="dot animate-bounce" style={{ animationDelay: '0.4s' }}></span>
            </div>
            <style jsx>{`
              .dot {
                display: inline-block;
                width: 8px;
                height: 8px;
                background-color: #4b5563;
                border-radius: 50%;
              }
            `}</style>
          </div>
        )}
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex items-center">
        <div className="flex flex-col flex-grow">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if ((e.key === "Enter" && (e.ctrlKey || e.metaKey))) {
                e.preventDefault();
                // Submit the form
                const form = e.currentTarget.form;
                if (form) {
                  form.requestSubmit();
                }
              }
            }}
            placeholder={placeholder}
            className="flex-grow p-2 mr-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-y min-h-[80px] max-h-[240px]"
            disabled={isLoading || isResetting}
            autoFocus
            rows={2}
          />
          <div className="text-xs text-gray-500 mt-1 ml-1">
            {typeof window !== 'undefined' && navigator.platform.includes('Mac')
              ? 'Press ⌘+Enter to send'
              : 'Press Ctrl + Enter to send'}
          </div>
        </div>
        <button
          type="submit"
          className={`bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md transition duration-150 ease-in-out text-sm ${isLoading || isResetting ? "opacity-50 cursor-not-allowed" : ""}`}
          disabled={isLoading || isResetting}
        >
          {isLoading ? "Sending..." : "Send"}
        </button>
      </form>

      <ToastContainer position="bottom-right" autoClose={3000} />
    </div>
  );
}