"use client";

import { ChevronRight, ChevronDown, File, Folder } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface FileNode {
  name: string;
  type: "file" | "folder";
  path: string;
  children?: FileNode[];
}

const mockFileTree: FileNode[] = [
  {
    name: "app",
    type: "folder",
    path: "app",
    children: [
      { name: "page.tsx", type: "file", path: "app/page.tsx" },
      { name: "layout.tsx", type: "file", path: "app/layout.tsx" },
      { name: "globals.css", type: "file", path: "app/globals.css" },
    ],
  },
  {
    name: "components",
    type: "folder",
    path: "components",
    children: [
      { name: "Button.tsx", type: "file", path: "components/Button.tsx" },
      { name: "Card.tsx", type: "file", path: "components/Card.tsx" },
    ],
  },
  {
    name: "lib",
    type: "folder",
    path: "lib",
    children: [
      { name: "utils.ts", type: "file", path: "lib/utils.ts" },
    ],
  },
  { name: "package.json", type: "file", path: "package.json" },
  { name: "tsconfig.json", type: "file", path: "tsconfig.json" },
];

interface FileTreeProps {
  selectedFile: string;
  onSelectFile: (path: string) => void;
}

function TreeNode({ 
  node, 
  selectedFile, 
  onSelectFile, 
  level = 0 
}: { 
  node: FileNode; 
  selectedFile: string; 
  onSelectFile: (path: string) => void;
  level?: number;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const isSelected = selectedFile === node.path;

  if (node.type === "file") {
    return (
      <button
        onClick={() => onSelectFile(node.path)}
        className={cn(
          "w-full flex items-center gap-2 px-2 py-1 text-sm hover:bg-[#1F2937] rounded transition-colors",
          isSelected && "bg-[#1F2937] text-blue-500"
        )}
        style={{ paddingLeft: `${(level + 1) * 12 + 8}px` }}
      >
        <File className="w-4 h-4 flex-shrink-0" />
        <span className="truncate">{node.name}</span>
      </button>
    );
  }

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-2 py-1 text-sm hover:bg-[#1F2937] rounded transition-colors"
        style={{ paddingLeft: `${level * 12 + 8}px` }}
      >
        {isOpen ? (
          <ChevronDown className="w-4 h-4 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 flex-shrink-0" />
        )}
        <Folder className="w-4 h-4 flex-shrink-0" />
        <span className="truncate">{node.name}</span>
      </button>
      {isOpen && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              selectedFile={selectedFile}
              onSelectFile={onSelectFile}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FileTree({ selectedFile, onSelectFile }: FileTreeProps) {
  return (
    <div className="h-full bg-[#0B0F14] border-r border-[#1F2937] overflow-y-auto">
      <div className="p-2">
        <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2 px-2">Files</h3>
        <div className="space-y-1">
          {mockFileTree.map((node) => (
            <TreeNode
              key={node.path}
              node={node}
              selectedFile={selectedFile}
              onSelectFile={onSelectFile}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
