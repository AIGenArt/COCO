// AI Service Layer with Puter.js integration and rate limiting

interface RateLimitState {
  lastRequestTime: number;
  requestCount: number;
  windowStart: number;
}

interface QueuedRequest {
  id: string;
  execute: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  priority: number;
}

class AIService {
  private rateLimitState: Map<string, RateLimitState> = new Map();
  private requestQueue: QueuedRequest[] = [];
  private isProcessingQueue = false;
  private abortControllers: Map<string, AbortController> = new Map();
  
  // Rate limiting config
  private readonly MIN_REQUEST_INTERVAL = 1000; // 1 second between requests
  private readonly BURST_WINDOW = 30000; // 30 seconds
  private readonly MAX_BURST_REQUESTS = 10; // Max 10 requests in 30s
  private readonly DEBOUNCE_DELAY = 800; // 800ms debounce for plan requests
  
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  
  /**
   * Check if request is allowed based on rate limits
   */
  private canMakeRequest(workspaceId: string): boolean {
    const state = this.rateLimitState.get(workspaceId);
    const now = Date.now();
    
    if (!state) {
      this.rateLimitState.set(workspaceId, {
        lastRequestTime: now,
        requestCount: 1,
        windowStart: now,
      });
      return true;
    }
    
    // Check minimum interval
    if (now - state.lastRequestTime < this.MIN_REQUEST_INTERVAL) {
      return false;
    }
    
    // Check burst protection
    if (now - state.windowStart > this.BURST_WINDOW) {
      // Reset window
      state.windowStart = now;
      state.requestCount = 1;
    } else {
      // Within window
      if (state.requestCount >= this.MAX_BURST_REQUESTS) {
        return false;
      }
      state.requestCount++;
    }
    
    state.lastRequestTime = now;
    return true;
  }
  
  /**
   * Add request to queue
   */
  private queueRequest<T>(
    workspaceId: string,
    execute: () => Promise<T>,
    priority: number = 0
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = `${workspaceId}_${Date.now()}_${Math.random()}`;
      
      this.requestQueue.push({
        id,
        execute,
        resolve,
        reject,
        priority,
      });
      
      // Sort by priority (higher first)
      this.requestQueue.sort((a, b) => b.priority - a.priority);
      
      this.processQueue();
    });
  }
  
  /**
   * Process queued requests
   */
  private async processQueue() {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }
    
    this.isProcessingQueue = true;
    
    while (this.requestQueue.length > 0) {
      const request = this.requestQueue[0];
      
      // Extract workspace ID from request ID
      const workspaceId = request.id.split('_')[0];
      
      if (this.canMakeRequest(workspaceId)) {
        this.requestQueue.shift();
        
        try {
          const result = await request.execute();
          request.resolve(result);
        } catch (error) {
          request.reject(error);
        }
      } else {
        // Wait before trying again
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    this.isProcessingQueue = false;
  }
  
  /**
   * Debounced plan request
   */
  async planWithDebounce(
    workspaceId: string,
    prompt: string,
    context?: any
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      // Clear existing timer
      const existingTimer = this.debounceTimers.get(workspaceId);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }
      
      // Set new timer
      const timer = setTimeout(() => {
        this.debounceTimers.delete(workspaceId);
        this.plan(workspaceId, prompt, context)
          .then(resolve)
          .catch(reject);
      }, this.DEBOUNCE_DELAY);
      
      this.debounceTimers.set(workspaceId, timer);
    });
  }
  
  /**
   * Send plan request to AI (prompt-based)
   */
  async plan(
    workspaceId: string,
    prompt: string,
    context?: any
  ): Promise<any> {
    return this.queueRequest(workspaceId, async () => {
      const abortController = new AbortController();
      const requestId = `plan_${workspaceId}_${Date.now()}`;
      this.abortControllers.set(requestId, abortController);
      
      try {
        // Call new prompt-based plan API
        const response = await fetch('/api/ai/prompt/plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            workspaceId,
            context,
          }),
          signal: abortController.signal,
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Plan request failed');
        }
        
        const data = await response.json();
        return { success: true, data };
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw error;
        }
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      } finally {
        this.abortControllers.delete(requestId);
      }
    }, 1); // Priority 1 for plan requests
  }
  
  /**
   * Approve an action
   */
  async approve(actionId: string): Promise<any> {
    // No debounce for approval
    const response = await fetch(`/api/ai/actions/${actionId}/approve`, {
      method: 'POST',
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Approval failed');
    }
    
    return response.json();
  }
  
  /**
   * Execute a plan
   */
  async executePlan(
    planId: string,
    workspaceId: string
  ): Promise<any> {
    return this.queueRequest(workspaceId, async () => {
      const abortController = new AbortController();
      const requestId = `execute_${workspaceId}_${Date.now()}`;
      this.abortControllers.set(requestId, abortController);
      
      try {
        const response = await fetch('/api/ai/prompt/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            planId,
            workspaceId,
          }),
          signal: abortController.signal,
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Execution failed');
        }
        
        const data = await response.json();
        return data;
      } finally {
        this.abortControllers.delete(requestId);
      }
    }, 2); // Priority 2 for execute requests (higher than plan)
  }
  
  /**
   * Execute approved actions (legacy)
   */
  async execute(
    workspaceId: string,
    actionIds: string[],
    onProgress?: (progress: { actionId: string; status: string; message?: string }) => void
  ): Promise<any> {
    return this.queueRequest(workspaceId, async () => {
      const abortController = new AbortController();
      const requestId = `execute_${workspaceId}_${Date.now()}`;
      this.abortControllers.set(requestId, abortController);
      
      try {
        const response = await fetch('/api/ai/actions/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            actionIds,
            workspaceId,
          }),
          signal: abortController.signal,
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Execution failed');
        }
        
        const data = await response.json();
        return data;
      } finally {
        this.abortControllers.delete(requestId);
      }
    }, 2); // Priority 2 for execute requests (higher than plan)
  }
  
  /**
   * Cancel a specific request
   */
  cancel(requestId: string) {
    const controller = this.abortControllers.get(requestId);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(requestId);
    }
  }
  
  /**
   * Cancel all requests for a workspace
   */
  cancelWorkspace(workspaceId: string) {
    for (const [id, controller] of Array.from(this.abortControllers.entries())) {
      if (id.includes(workspaceId)) {
        controller.abort();
        this.abortControllers.delete(id);
      }
    }
    
    // Remove from queue
    this.requestQueue = this.requestQueue.filter(
      req => !req.id.startsWith(workspaceId)
    );
  }
  
  /**
   * Get rate limit status
   */
  getRateLimitStatus(workspaceId: string) {
    const state = this.rateLimitState.get(workspaceId);
    if (!state) {
      return {
        canRequest: true,
        requestsInWindow: 0,
        timeUntilNextRequest: 0,
      };
    }
    
    const now = Date.now();
    const timeSinceLastRequest = now - state.lastRequestTime;
    const timeUntilNextRequest = Math.max(
      0,
      this.MIN_REQUEST_INTERVAL - timeSinceLastRequest
    );
    
    return {
      canRequest: this.canMakeRequest(workspaceId),
      requestsInWindow: state.requestCount,
      timeUntilNextRequest,
    };
  }
}

// Singleton instance
export const aiService = new AIService();
