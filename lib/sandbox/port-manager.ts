/**
 * Port Manager
 * 
 * Manages port allocation for workspace dev servers
 */

import { DEFAULT_PROCESS_CONFIG } from './process-types';

class PortManager {
  private allocatedPorts: Map<string, number> = new Map();
  private basePort: number;
  private maxPorts: number;

  constructor(basePort = DEFAULT_PROCESS_CONFIG.basePort, maxPorts = DEFAULT_PROCESS_CONFIG.maxProcesses) {
    this.basePort = basePort;
    this.maxPorts = maxPorts;
  }

  /**
   * Allocate a port for a workspace
   */
  allocatePort(workspaceId: string): number {
    // Check if workspace already has a port
    const existingPort = this.allocatedPorts.get(workspaceId);
    if (existingPort) {
      return existingPort;
    }

    // Find next available port
    const usedPorts = new Set(this.allocatedPorts.values());
    
    for (let i = 0; i < this.maxPorts; i++) {
      const port = this.basePort + i;
      if (!usedPorts.has(port)) {
        this.allocatedPorts.set(workspaceId, port);
        return port;
      }
    }

    throw new Error(`No available ports. Maximum ${this.maxPorts} workspaces can run simultaneously.`);
  }

  /**
   * Release a port
   */
  releasePort(workspaceId: string): void {
    this.allocatedPorts.delete(workspaceId);
  }

  /**
   * Get port for workspace
   */
  getPort(workspaceId: string): number | null {
    return this.allocatedPorts.get(workspaceId) || null;
  }

  /**
   * Check if port is available
   */
  isPortAvailable(port: number): boolean {
    const usedPorts = new Set(this.allocatedPorts.values());
    return !usedPorts.has(port);
  }

  /**
   * Get all allocated ports
   */
  getAllocatedPorts(): Map<string, number> {
    return new Map(this.allocatedPorts);
  }

  /**
   * Clear all allocations
   */
  clear(): void {
    this.allocatedPorts.clear();
  }
}

// Singleton instance
export const portManager = new PortManager();
