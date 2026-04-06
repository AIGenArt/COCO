"use client";

import { useEffect, useRef } from "react";
import Editor, { OnMount } from "@monaco-editor/react";
import { Loader2, Lock } from "lucide-react";
import { useWorkspaceStore } from "@/lib/workspace/workspace-store";

interface CodeEditorProps {
  value: string;
  onChange?: (value: string | undefined) => void;
  onCursorChange?: (position: { line: number; column: number }) => void;
  language?: string;
  path?: string;
}

// Helper to detect language from file path
function getLanguageFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  const languageMap: Record<string, string> = {
    'ts': 'typescript',
    'tsx': 'typescript',
    'js': 'javascript',
    'jsx': 'javascript',
    'json': 'json',
    'css': 'css',
    'scss': 'scss',
    'less': 'less',
    'html': 'html',
    'md': 'markdown',
    'prisma': 'prisma',
    'env': 'plaintext',
    'lock': 'plaintext',
    'gitignore': 'plaintext',
    'yml': 'yaml',
    'yaml': 'yaml',
  };
  return languageMap[ext || ''] || 'plaintext';
}

export function CodeEditor({ 
  value, 
  onChange, 
  onCursorChange,
  language, 
  path 
}: CodeEditorProps) {
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const { lockedByAI, buildStatus } = useWorkspaceStore();
  
  // Determine the correct language
  const detectedLanguage = path ? getLanguageFromPath(path) : (language || 'typescript');
  
  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    
    // Disable CSS validation to support Tailwind directives
    monaco.languages.css.cssDefaults.setOptions({
      validate: false,
    });
    
    // Also disable for SCSS/LESS if available
    if (monaco.languages.scss?.scssDefaults) {
      monaco.languages.scss.scssDefaults.setOptions({
        validate: false,
      });
    }
    if (monaco.languages.less?.lessDefaults) {
      monaco.languages.less.lessDefaults.setOptions({
        validate: false,
      });
    }
    
    // Configure editor with minimap and breadcrumbs
    editor.updateOptions({
      minimap: { enabled: true },
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      fontLigatures: true,
      lineHeight: 21,
      padding: { top: 16, bottom: 16 },
      scrollBeyondLastLine: false,
      renderLineHighlight: "all",
      smoothScrolling: true,
      cursorBlinking: "smooth",
      cursorSmoothCaretAnimation: "on",
      bracketPairColorization: { enabled: true },
      guides: {
        bracketPairs: true,
        indentation: true,
      },
      quickSuggestions: true,
      suggestOnTriggerCharacters: true,
    });
    
    // Listen to cursor position changes
    if (onCursorChange) {
      editor.onDidChangeCursorPosition((e) => {
        onCursorChange({
          line: e.position.lineNumber,
          column: e.position.column,
        });
      });
    }
  };
  
  // Update model language when path changes (critical for cached models!)
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current || !path) return;
    
    const model = editorRef.current.getModel();
    const correctLanguage = getLanguageFromPath(path);
    
    if (model && model.getLanguageId() !== correctLanguage) {
      monacoRef.current.editor.setModelLanguage(model, correctLanguage);
    }
  }, [path]);
  
  // Update read-only state when lock changes
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.updateOptions({
        readOnly: lockedByAI,
      });
    }
  }, [lockedByAI]);
  
  const isBuilding = buildStatus === "building";
  
  return (
    <div className="relative w-full h-full">
      <Editor
        height="100%"
        language={detectedLanguage}
        value={value}
        onChange={onChange}
        theme="vs-dark"
        path={path}
        onMount={handleEditorDidMount}
        options={{
          readOnly: lockedByAI,
          automaticLayout: true,
        }}
        loading={
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        }
      />
      
      {/* Editor Lock Overlay */}
      {lockedByAI && (
        <div className="absolute top-0 left-0 right-0 bg-secondary/80 backdrop-blur-sm border-b border-border px-4 py-2 flex items-center gap-2 z-10">
          <Lock className="w-4 h-4 text-primary" />
          <span className="text-xs font-medium">
            {isBuilding ? "AI is building..." : "Editor locked"}
          </span>
          {isBuilding && (
            <div className="ml-2 flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: "0.2s" }} />
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: "0.4s" }} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
