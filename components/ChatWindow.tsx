"use client";

import { useState, useEffect, FormEvent, useRef } from "react";
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

// Helper function to process messages with a delay
const processAssistantMessages = async (
  messages: Message[],
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>
) => {
  for (const message of messages) {
    setMessages(prev => [...prev, message]);
    // A small delay to simulate thinking and improve UX
    await new Promise(resolve => setTimeout(resolve, 500)); 
  }
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
  const [selectedEssayType, setSelectedEssayType] = useState<EssayType>("action_test");

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
    if (isLoading || isResetting) return;
    setIsResetting(true);
    
    try {
      const response = await fetch('/api/chat', { method: 'DELETE' });
      if (!response.ok) {
          throw new Error('Server failed to reset session.');
      }
      
      setMessages([]);
      setInput("");
      toast.success("New chat started!");
    } catch (error: any) {
      console.error("Error resetting chat:", error);
      toast.error(`Could not start new chat: ${error.message}`);
    } finally {
      setIsResetting(false);
    }
  };

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isLoading || isResetting) return;

    const trimmedInput = customTrim(input);
    if (!trimmedInput) {
      toast.warning("Please enter a message.");
      inputRef.current?.focus();
      return;
    }

    setIsLoading(true);
    const userMessage: Message = { role: "user", content: trimmedInput };
    const previousMessages = messages;
    setMessages(prev => [...prev, userMessage]);
    setInput("");

    try {
      const requestBody = {
        essayType: selectedEssayType,
        message: trimmedInput,
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}: ${responseData.error || 'Server error'}`);
      }
      
      // **CRITICAL CHANGE**: Handle the array of messages
      if (responseData.messages && Array.isArray(responseData.messages)) {
        await processAssistantMessages(responseData.messages, setMessages);
      } else {
        console.log("Received an empty or invalid messages array. Likely an internal state update.");
      }

    } catch (err: any) {
      console.error("Error in handleSubmit:", err);
      toast.error("Error: " + err.message);
      setMessages(previousMessages);
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
    const essayTypes: { value: EssayType; label: string; group: string }[] = [
        { value: "action_test", label: "Action Test Flow", group: "Test" },
        { value: "opinion_mbp", label: "Opinion MBP", group: "Main Body" },
        { value: "opinion", label: "Opinion Essay", group: "Introduction" },
        { value: "ads_type1", label: "Adv/Disadv (Type 1)", group: "Introduction" },
        { value: "discussion", label: "Discussion Essay", group: "Introduction" },
        { value: "opinion_conclusion", label: "Opinion Conclusion", group: "Conclusion" },
    ];

    const disableRadios = isLoading || isResetting;
    
    const groupedTypes = essayTypes.reduce((acc, type) => {
        (acc[type.group] = acc[type.group] || []).push(type);
        return acc;
    }, {} as Record<string, typeof essayTypes>);

    return (
      <div className="mb-3 p-3 border border-gray-200 rounded-md bg-gray-50 text-sm">
        {Object.entries(groupedTypes).map(([group, types]) => (
            <div key={group} className="mb-2">
                <label className="block font-medium text-gray-700 mb-1">{group} Flows:</label>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {types.map((type) => (
                         <label key={type.value} className="inline-flex items-center">
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
        </div>
        ))}
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
          {isLoading ? "Thinking..." : "Send"}
        </button>
      </form>

      <ToastContainer position="bottom-right" autoClose={3000} />
    </div>
  );
}