"use client";

import { ChevronRight, ChevronDown, File, Folder, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/lib/workspace/workspace-store";
import { FileNode } from "@/lib/workspace/types";

interface TreeNodeProps {
  node: FileNode;
  level: number;
}

function StatusDot({ status }: { status?: 'new' | 'modified' | 'deleted' | 'unchanged' }) {
  if (!status || status === 'unchanged') return null;
  
  const colors = {
    new: 'bg-green-500',
    modified: 'bg-yellow-500',
    deleted: 'bg-red-500',
  };
  
  return (
    <div className={cn(
      "w-1.5 h-1.5 rounded-full flex-shrink-0",
      colors[status]
    )} />
  );
}

function TreeNode({ node, level }: TreeNodeProps) {
  const {
    selectedNodeId,
    expandedFolderIds,
    setSelectedNode,
    toggleFolder,
    openFile,
    getNodeChildren,
  } = useWorkspaceStore();

  const isSelected = selectedNodeId === node.id;
  const isExpanded = expandedFolderIds.has(node.id);
  const children = node.type === "folder" ? getNodeChildren(node.id) : [];

  const handleClick = () => {
    setSelectedNode(node.id);
    if (node.type === "file") {
      openFile(node.id);
    } else {
      toggleFolder(node.id);
    }
  };

  if (node.type === "file") {
    return (
      <button
        onClick={handleClick}
        className={cn(
          "w-full flex items-center gap-1.5 px-2 py-0.5 text-xs hover:bg-secondary transition-colors group",
          isSelected && "bg-secondary text-primary"
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
      >
        <File className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
        <span className="truncate flex-1 text-left">{node.name}</span>
        <StatusDot status={node.status} />
      </button>
    );
  }

  return (
    <div>
      <button
        onClick={handleClick}
        className={cn(
          "w-full flex items-center gap-1.5 px-2 py-0.5 text-xs hover:bg-secondary transition-colors group",
          isSelected && "bg-secondary"
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
      >
        {isExpanded ? (
          <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />
        )}
        <Folder className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
        <span className="truncate flex-1 text-left">{node.name}</span>
        <StatusDot status={node.status} />
      </button>
      {isExpanded && children.length > 0 && (
        <div>
          {children.map((child) => (
            <TreeNode key={child.id} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function Explorer() {
  const { fileTree } = useWorkspaceStore();

  return (
    <div className="w-60 bg-[#0b0d10] border-r border-border flex flex-col">
      {/* Header */}
      <div className="h-8 border-b border-border flex items-center justify-between px-2">
        <span className="text-xs font-medium uppercase text-muted-foreground">Explorer</span>
        <button className="w-5 h-5 rounded hover:bg-secondary flex items-center justify-center">
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* File Tree */}
      <div className="flex-1 overflow-y-auto py-1">
        {fileTree.rootIds.map((rootId) => {
          const node = fileTree.nodes[rootId];
          return node ? <TreeNode key={node.id} node={node} level={0} /> : null;
        })}
      </div>
    </div>
  );
}
