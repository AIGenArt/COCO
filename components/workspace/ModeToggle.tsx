'use client';

import { Button } from '@/components/ui/button';
import { FileText, Hammer } from 'lucide-react';
import { cn } from '@/lib/utils';

export type WorkspaceMode = 'plan' | 'build';

interface ModeToggleProps {
  mode: WorkspaceMode;
  onChange: (mode: WorkspaceMode) => void;
  disabled?: boolean;
}

export function ModeToggle({ mode, onChange, disabled }: ModeToggleProps) {
  return (
    <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
      <Button
        variant={mode === 'plan' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onChange('plan')}
        disabled={disabled}
        className={cn(
          'gap-2 transition-all',
          mode === 'plan' && 'shadow-sm'
        )}
      >
        <FileText className="w-4 h-4" />
        <span className="hidden sm:inline">Plan</span>
      </Button>
      <Button
        variant={mode === 'build' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onChange('build')}
        disabled={disabled}
        className={cn(
          'gap-2 transition-all',
          mode === 'build' && 'shadow-sm bg-accent hover:bg-accent/90'
        )}
      >
        <Hammer className="w-4 h-4" />
        <span className="hidden sm:inline">Build</span>
      </Button>
    </div>
  );
}

export function ModeIndicator({ mode }: { mode: WorkspaceMode }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted text-sm">
      {mode === 'plan' ? (
        <>
          <FileText className="w-4 h-4 text-primary" />
          <span className="font-medium">Planning Mode</span>
          <span className="text-muted-foreground">• AI is analyzing and creating blueprint</span>
        </>
      ) : (
        <>
          <Hammer className="w-4 h-4 text-accent" />
          <span className="font-medium">Build Mode</span>
          <span className="text-muted-foreground">• AI is generating and executing code</span>
        </>
      )}
    </div>
  );
}
