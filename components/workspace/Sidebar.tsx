"use client";

import { 
  LayoutDashboard, 
  FolderOpen, 
  FileText, 
  Sparkles, 
  Files,
  Github,
  Settings
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/" },
  { icon: FolderOpen, label: "Workspaces", href: "/workspace" },
  { icon: FileText, label: "Plan", href: "/workspace?tab=plan" },
  { icon: Sparkles, label: "Agent", href: "/workspace?tab=code" },
  { icon: Files, label: "Files", href: "/workspace?tab=code" },
];

const bottomItems = [
  { icon: Github, label: "GitHub", href: "#" },
  { icon: Settings, label: "Settings", href: "#" },
];

export function Sidebar() {
  const [activeItem, setActiveItem] = useState("Workspaces");

  return (
    <div className="w-16 bg-[#0A0A0A] border-r border-[#1F2937] flex flex-col items-center py-4">
      {/* Logo */}
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mb-8">
        <Sparkles className="w-5 h-5 text-white" />
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 flex flex-col gap-2 w-full px-2">
        {navItems.map((item) => (
          <button
            key={item.label}
            onClick={() => setActiveItem(item.label)}
            className={cn(
              "w-12 h-12 rounded-lg flex items-center justify-center transition-colors",
              "hover:bg-[#1F2937]",
              activeItem === item.label && "bg-[#1F2937] text-blue-500"
            )}
            title={item.label}
          >
            <item.icon className="w-5 h-5" />
          </button>
        ))}
      </nav>

      {/* Bottom Items */}
      <div className="flex flex-col gap-2 w-full px-2 mt-auto">
        {bottomItems.map((item) => (
          <button
            key={item.label}
            className="w-12 h-12 rounded-lg flex items-center justify-center hover:bg-[#1F2937] transition-colors"
            title={item.label}
          >
            <item.icon className="w-5 h-5" />
          </button>
        ))}
      </div>
    </div>
  );
}
