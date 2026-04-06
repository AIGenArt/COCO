"use client";

import { useState } from "react";
import { Sparkles, Send, Lightbulb, Wrench, Bug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const suggestions = [
  { icon: Lightbulb, label: "Improve UI", prompt: "Can you improve the UI design?" },
  { icon: Wrench, label: "Add feature", prompt: "Add a new feature to this component" },
  { icon: Bug, label: "Fix bug", prompt: "Help me debug this code" },
];

export function AIPanel() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content: "Hi! I'm COCO, your AI coding assistant. What would you like to build today?",
    },
  ]);
  const [input, setInput] = useState("");

  const handleSend = () => {
    if (!input.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
    };

    setMessages([...messages, newMessage]);
    setInput("");

    // Simulate AI response
    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "I'll help you with that! Let me generate the code...",
      };
      setMessages((prev) => [...prev, aiResponse]);
    }, 1000);
  };

  const handleSuggestion = (prompt: string) => {
    setInput(prompt);
  };

  return (
    <div className="h-full flex flex-col bg-[#0B0F14] border-l border-[#1F2937]">
      {/* Header */}
      <div className="h-12 border-b border-[#1F2937] flex items-center gap-2 px-4">
        <Sparkles className="w-5 h-5 text-blue-500" />
        <h2 className="font-semibold">COCO Agent</h2>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-lg p-3 ${
                  message.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-[#111827] text-gray-100"
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Suggestions */}
      {messages.length === 1 && (
        <div className="px-4 pb-3">
          <p className="text-xs text-gray-400 mb-2">Quick actions:</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.label}
                onClick={() => handleSuggestion(suggestion.prompt)}
                className="flex items-center gap-2 px-3 py-2 bg-[#111827] hover:bg-[#1F2937] rounded-lg text-sm transition-colors"
              >
                <suggestion.icon className="w-4 h-4" />
                <span>{suggestion.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-[#1F2937]">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="What do you want to build?"
            className="min-h-[80px] bg-[#111827] border-[#1F2937] resize-none"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim()}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
