/**
 * React Hook for Workspace Metadata Auto-Save
 * 
 * Integrates auto-save manager with React components.
 * Handles all save triggers and provides save status.
 */

import { useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { autoSaveManager, type WorkspaceMetadata } from './auto-save';

interface UseWorkspaceAutoSaveOptions {
  workspaceId: string;
  metadata: WorkspaceMetadata;
  onSave: (metadata: WorkspaceMetadata) => Promise<void>;
  enabled?: boolean;
}

export function useWorkspaceAutoSave({
  workspaceId,
  metadata,
  onSave,
  enabled = true,
}: UseWorkspaceAutoSaveOptions) {
  const router = useRouter();
  const metadataRef = useRef(metadata);

  // Update ref when metadata changes
  useEffect(() => {
    metadataRef.current = metadata;
  }, [metadata]);

  // Initialize auto-save manager
  useEffect(() => {
    if (!enabled) return;

    autoSaveManager.initialize(onSave);

    return () => {
      autoSaveManager.reset();
    };
  }, [onSave, enabled]);

  // Trigger debounced save when metadata changes
  useEffect(() => {
    if (!enabled) return;

    autoSaveManager.debouncedSave(metadata);
  }, [metadata, enabled]);

  // Blur handler - save when window loses focus (with rate limit check)
  useEffect(() => {
    if (!enabled) return;

    const handleBlur = () => {
      const current = metadataRef.current;
      
      // Only save if metadata has changed
      if (!autoSaveManager.hasUnsavedChanges(current)) {
        return;
      }
      
      // immediateSave will check rate limit internally
      void autoSaveManager.immediateSave(current, 'blur');
    };

    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('blur', handleBlur);
    };
  }, [enabled]);

  // Route change handler - save before navigation
  useEffect(() => {
    if (!enabled) return;

    // beforeunload is best-effort only (unreliable for async)
    // Primary saves happen via debounce, blur, and manual triggers
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const current = metadataRef.current;
      
      // Only warn/save if there are actual unsaved changes
      if (autoSaveManager.hasUnsavedChanges(current)) {
        // Attempt save (best effort)
        void autoSaveManager.immediateSave(current, 'route-change');
        
        // Show browser warning
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    // Note: beforeunload is unreliable for async operations
    // Rely primarily on: debounce, blur, and saveBeforeSandboxStart
    // This is just a safety net

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [enabled]);

  // Manual save function for before sandbox start
  const saveBeforeSandboxStart = useCallback(async () => {
    if (!enabled) return;
    await autoSaveManager.immediateSave(metadataRef.current, 'before-sandbox-start');
  }, [enabled]);

  // Manual save function
  const saveNow = useCallback(async () => {
    if (!enabled) return;
    await autoSaveManager.immediateSave(metadataRef.current, 'blur');
  }, [enabled]);

  // Check if there are unsaved changes
  const hasUnsavedChanges = useCallback(() => {
    if (!enabled) return false;
    return autoSaveManager.hasUnsavedChanges(metadataRef.current);
  }, [enabled]);

  return {
    saveBeforeSandboxStart,
    saveNow,
    hasUnsavedChanges,
  };
}
