"use client";

import { 
  Menu,
  MessageSquare,
  Search,
  Blocks,
  Settings
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

const railItems = [
  { icon: Menu, label: "Menu", id: "menu" },
  { icon: MessageSquare, label: "Chat", id: "chat" },
  { icon: Search, label: "Search", id: "search" },
  { icon: Blocks, label: "Extensions", id: "extensions" },
];

export function IconRail() {
  const [activeItem, setActiveItem] = useState("chat");

  return (
    <div className="w-12 bg-[#0a0c10] border-r border-border flex flex-col items-center py-2">
      {/* Top Items */}
      <div className="flex flex-col gap-1 w-full px-1.5">
        {railItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveItem(item.id)}
            className={cn(
              "w-9 h-9 rounded flex items-center justify-center transition-colors",
              "hover:bg-secondary",
              activeItem === item.id && "bg-secondary text-primary"
            )}
            title={item.label}
          >
            <item.icon className="w-5 h-5" />
          </button>
        ))}
      </div>

      {/* Bottom Items */}
      <div className="flex flex-col gap-1 w-full px-1.5 mt-auto">
        <button
          className="w-9 h-9 rounded flex items-center justify-center hover:bg-secondary transition-colors"
          title="Settings"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
