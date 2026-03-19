import { createWorkspaceOperation } from "../db/workspace-operations";
import { logger } from "../logger";

type QueueTask<T> = () => Promise<T>;

type QueueOptions = {
  workspaceId?: string;
  installationId?: number;
  userId?: string;
  type: "sync" | "write";
  metadata?: Record<string, unknown>;
};

class Semaphore {
  private inFlight = 0;
  private waiters: Array<() => void> = [];

  constructor(private readonly limit: number) {}

  async acquire(): Promise<() => void> {
    if (this.inFlight >= this.limit) {
      await new Promise<void>((resolve) => this.waiters.push(resolve));
    }

    this.inFlight += 1;
    return () => {
      this.inFlight -= 1;
      const next = this.waiters.shift();
      next?.();
    };
  }
}

export class GitHubOperationQueue {
  private readonly workspaceChains = new Map<string, Promise<unknown>>();
  private readonly installationSemaphores = new Map<number, Semaphore>();
  private readonly globalSemaphore = new Semaphore(10);

  async run<T>(key: string, task: QueueTask<T>, options: QueueOptions): Promise<T> {
    const workspaceKey = options.workspaceId ?? key;
    const current = this.workspaceChains.get(workspaceKey) ?? Promise.resolve();

    const next = current
      .catch(() => undefined)
      .then(async () => {
        const releaseGlobal = await this.globalSemaphore.acquire();
        const releaseInstallation = options.installationId
          ? await this.getInstallationSemaphore(options.installationId).acquire()
          : () => undefined;

        try {
          if (options.workspaceId && options.userId) {
            await createWorkspaceOperation({
              workspaceId: options.workspaceId,
              userId: options.userId,
              type: "git",
              initiatedBy: "system",
              metadata: {
                queueKey: key,
                queueType: options.type,
                ...(options.metadata ?? {})
              }
            });
          }

          return await task();
        } finally {
          releaseInstallation();
          releaseGlobal();
        }
      });

    this.workspaceChains.set(workspaceKey, next);

    try {
      return await next;
    } finally {
      if (this.workspaceChains.get(workspaceKey) === next) {
        this.workspaceChains.delete(workspaceKey);
      }
      logger.info({ key, workspaceKey, installationId: options.installationId, type: options.type }, "GitHub operation queue task finished");
    }
  }

  private getInstallationSemaphore(installationId: number): Semaphore {
    const existing = this.installationSemaphores.get(installationId);
    if (existing) {
      return existing;
    }

    const semaphore = new Semaphore(2);
    this.installationSemaphores.set(installationId, semaphore);
    return semaphore;
  }
}

const githubOperationQueueSingleton = new GitHubOperationQueue();

export function getGitHubOperationQueue() {
  return githubOperationQueueSingleton;
}
