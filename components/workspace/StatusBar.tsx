"use client";

import { useState, useEffect } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2 } from "lucide-react";

interface StatusBarProps {
  cursorPosition?: { line: number; column: number };
  indentation?: number;
  encoding?: string;
  lineEnding?: string;
  language?: string;
  errors?: number;
  warnings?: number;
}

export function StatusBar({
  cursorPosition = { line: 1, column: 1 },
  indentation = 2,
  encoding = "UTF-8",
  lineEnding = "LF",
  language = "TypeScript JSX",
  errors = 0,
  warnings = 0,
}: StatusBarProps) {
  return (
    <div className="h-6 border-t border-border flex items-center justify-between px-3 bg-[#0b0d10] text-xs">
      {/* Left Side */}
      <div className="flex items-center gap-4">
        {/* App Status */}
        <div className="flex items-center gap-2">
          <span className="font-semibold text-primary">COCO</span>
          <div className="flex items-center gap-2">
            {errors > 0 && (
              <div className="flex items-center gap-1 text-destructive">
                <AlertCircle className="w-3 h-3" />
                <span>{errors}</span>
              </div>
            )}
            {warnings > 0 && (
              <div className="flex items-center gap-1 text-yellow-500">
                <AlertTriangle className="w-3 h-3" />
                <span>{warnings}</span>
              </div>
            )}
            {errors === 0 && warnings === 0 && (
              <div className="flex items-center gap-1 text-green-500">
                <CheckCircle2 className="w-3 h-3" />
                <span>0</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Side */}
      <div className="flex items-center gap-4 text-muted-foreground">
        {/* Cursor Position */}
        <button className="hover:text-foreground transition-colors">
          Ln {cursorPosition.line}, Col {cursorPosition.column}
        </button>

        {/* Indentation */}
        <button className="hover:text-foreground transition-colors">
          Spaces: {indentation}
        </button>

        {/* Encoding */}
        <button className="hover:text-foreground transition-colors">
          {encoding}
        </button>

        {/* Line Ending */}
        <button className="hover:text-foreground transition-colors">
          {lineEnding}
        </button>

        {/* Language */}
        <button className="hover:text-foreground transition-colors">
          {language}
        </button>

        {/* Formatter Status */}
        <button className="hover:text-foreground transition-colors flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" />
          <span>Prettier</span>
        </button>
      </div>
    </div>
  );
}
