"use client";

import { ChatWindow } from "@/components/ChatWindow";
import { ChatWindow2 } from "@/components/ChatWindow2"; // ✅ Import the new chatbot

export default function ChatIELTSPage() {
  // Empty state content to show if no messages exist yet
  const InfoCard = (
    <div className="p-4 bg-gray-50 border border-gray-200 rounded-md">
      <h1 className="text-xl font-semibold mb-2">IELTS Introduction Practice</h1>
      <p className="text-gray-700">
        This chatbot helps students practice <strong>IELTS writing introduction Part 2</strong> by providing structured feedback.
      </p>
      <ul className="list-disc list-inside text-gray-700 space-y-2 mt-2">
        <li>Submit your Part 2 introductions for evaluation.</li>
        <li>Receive structured feedback based on IELTS criteria.</li>
        <li>Improve fluency, coherence, and vocabulary.</li>
      </ul>
      <p className="mt-2 text-gray-700">
        Enter your <strong>IELTS writing Part 2</strong> response below to get started.
      </p>
    </div>
  );

  return (
    <div>
      {/* First Chatbot */}
      {/* <ChatWindow
        endpoint="/api/chat" // ✅ This remains the original chatbot
        titleText="IELTS Introduction Assistant"
        placeholder="Enter your IELTS Part 2 introduction..."
        emptyStateComponent={InfoCard}
        videoId="zGM30-iAoZA"
      /> */}

      {/* Second Chatbot */}
      <ChatWindow2
        endpoint="/api/chat_rag" // ✅ The new chatbot connects to `chat_rag`
        titleText="IELTS RAG Chatbot"
        placeholder="Enter your IELTS query..."
        emptyStateComponent={InfoCard}
        videoId="3nATWi4lCO4"
      />
    </div>
  );
}
