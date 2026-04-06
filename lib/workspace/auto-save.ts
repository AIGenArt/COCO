/**
 * Auto-Save System for Workspace Metadata
 * 
 * Handles debounced and fallback saves for workspace metadata only.
 * Does NOT save file content - files stay in filesystem.
 * 
 * Triggers:
 * - Debounced (2 sec) after metadata changes
 * - Blur (when editor loses focus)
 * - Route change (before navigation)
 * - Before sandbox start
 */

interface WorkspaceMetadata {
  id: string;
  name: string;
  description: string | null;
  template: string;
}

type SaveCallback = (metadata: WorkspaceMetadata) => Promise<void>;

class AutoSaveManager {
  private debounceTimer: NodeJS.Timeout | null = null;
  private readonly debounceDelay = 2000; // 2 seconds
  private readonly MIN_SAVE_INTERVAL = 2000; // 2 seconds minimum between saves (rate limit)
  private readonly MAX_RETRIES = 3; // Maximum retry attempts per save
  private lastSavedState: string | null = null;
  private lastSaveTime = 0; // Timestamp of last successful save
  private saveCallback: SaveCallback | null = null;
  private isSaving = false;
  private pendingMetadata: WorkspaceMetadata | null = null; // Coalesced pending save
  private retryCount = 0; // Current retry count
  private currentSaveId: string | null = null; // Track current save to prevent stale retries

  /**
   * Initialize auto-save with a save callback
   */
  initialize(callback: SaveCallback) {
    this.saveCallback = callback;
  }

  /**
   * Check if we can save (rate limit check)
   */
  private canSave(): boolean {
    const now = Date.now();
    return now - this.lastSaveTime >= this.MIN_SAVE_INTERVAL;
  }

  /**
   * Check if metadata has actually changed
   */
  private hasMetadataChanged(metadata: WorkspaceMetadata): boolean {
    const currentState = JSON.stringify(metadata);
    if (this.lastSavedState === currentState) {
      return false;
    }
    return true;
  }

  /**
   * Debounced save - triggers 2 seconds after last metadata change
   */
  debouncedSave(metadata: WorkspaceMetadata) {
    // Clear existing timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Only save if metadata actually changed
    if (!this.hasMetadataChanged(metadata)) {
      return;
    }

    // Set new timer
    this.debounceTimer = setTimeout(() => {
      void this.executeSave(metadata, 'debounced');
    }, this.debounceDelay);
  }

  /**
   * Immediate save - for fallback triggers
   */
  async immediateSave(
    metadata: WorkspaceMetadata,
    trigger: 'blur' | 'route-change' | 'before-sandbox-start'
  ) {
    // Cancel any pending debounced save
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    // Only save if metadata actually changed
    if (!this.hasMetadataChanged(metadata)) {
      return;
    }

    await this.executeSave(metadata, trigger);
  }

  /**
   * Execute the actual save operation
   */
  private async executeSave(
    metadata: WorkspaceMetadata,
    trigger: 'debounced' | 'blur' | 'route-change' | 'before-sandbox-start',
    isRetry = false
  ) {
    if (!this.saveCallback) {
      console.error('AutoSave: No save callback registered');
      return;
    }

    // If save already in progress, queue this metadata (coalesce to latest)
    if (this.isSaving) {
      console.log('AutoSave: Save in progress, queueing latest metadata');
      this.pendingMetadata = metadata;
      // Reset retry count for new metadata
      this.retryCount = 0;
      return;
    }

    // Rate limit check (except for before-sandbox-start which is forced)
    if (trigger !== 'before-sandbox-start' && !this.canSave()) {
      console.log('AutoSave: Rate limit active, skipping save');
      return;
    }

    // Generate unique save ID for this attempt
    const saveId = `${Date.now()}-${Math.random()}`;
    this.currentSaveId = saveId;

    try {
      this.isSaving = true;
      console.log(`AutoSave: Saving metadata (trigger: ${trigger}, retry: ${this.retryCount}/${this.MAX_RETRIES})`);
      
      await this.saveCallback(metadata);
      
      // Only update lastSaveTime after successful save
      this.lastSaveTime = Date.now();
      
      // Update last saved state
      this.lastSavedState = JSON.stringify(metadata);
      
      // Reset retry count on success
      this.retryCount = 0;
      
      console.log(`AutoSave: Save successful (trigger: ${trigger})`);
    } catch (error) {
      console.error(`AutoSave: Save failed (trigger: ${trigger}, retry: ${this.retryCount}/${this.MAX_RETRIES})`, error);
      
      // Check if we should retry
      if (this.retryCount < this.MAX_RETRIES) {
        this.retryCount++;
        const backoffDelay = 2000 * this.retryCount; // Linear backoff: 2s, 4s, 6s
        
        setTimeout(() => {
          // Only retry if this is still the current save (not superseded by newer metadata)
          if (this.currentSaveId === saveId && this.hasMetadataChanged(metadata)) {
            console.log(`AutoSave: Retrying failed save after ${backoffDelay}ms (attempt ${this.retryCount}/${this.MAX_RETRIES})`);
            void this.executeSave(metadata, trigger, true);
          } else {
            console.log('AutoSave: Skipping retry - newer metadata available or already saved');
            this.retryCount = 0;
          }
        }, backoffDelay);
      } else {
        console.error('AutoSave: Max retries reached, giving up');
        this.retryCount = 0;
      }
      
      throw error;
    } finally {
      this.isSaving = false;
      
      // Process pending save if any (coalesced to latest)
      if (this.pendingMetadata) {
        console.log('AutoSave: Processing queued save');
        const queued = this.pendingMetadata;
        this.pendingMetadata = null;
        this.retryCount = 0; // Reset retry count for new save
        // Use debounced to respect rate limit
        this.debouncedSave(queued);
      }
    }
  }

  /**
   * Cancel any pending saves
   */
  cancel() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  /**
   * Reset the manager state
   */
  reset() {
    this.cancel();
    this.lastSavedState = null;
    this.saveCallback = null;
    this.isSaving = false;
  }

  /**
   * Check if there are unsaved changes
   */
  hasUnsavedChanges(metadata: WorkspaceMetadata): boolean {
    return this.hasMetadataChanged(metadata);
  }
}

// Singleton instance
export const autoSaveManager = new AutoSaveManager();

// Export types
export type { WorkspaceMetadata, SaveCallback };
