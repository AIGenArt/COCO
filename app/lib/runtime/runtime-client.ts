import { getRuntimeServerConfig } from "../config/server";

export type RuntimeResponse<T> = { success: boolean; data?: T; error?: { code: string; message: string } };

async function runtimeFetch<T>(path: string, init?: RequestInit): Promise<RuntimeResponse<T>> {
  const config = getRuntimeServerConfig();
  const url = new URL(path, config.RUNTIME_SERVICE_URL).toString();

  const res = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-runtime-service-secret": config.RUNTIME_SERVICE_SECRET,
      ...(init?.headers || {})
    }
  });

  const json = (await res.json()) as RuntimeResponse<T>;
  return json;
}

export async function createWorkspace(workspaceId: string) {
  return runtimeFetch<{ sandboxId: string }>("/workspaces", {
    method: "POST",
    body: JSON.stringify({ workspaceId })
  });
}

export async function destroyWorkspace(workspaceId: string) {
  return runtimeFetch<null>(`/workspaces/${encodeURIComponent(workspaceId)}`, {
    method: "DELETE"
  });
}

export async function runWorkspaceCommand(workspaceId: string, command: string[], env?: Record<string, string>) {
  return runtimeFetch<{ exitCode: number; stdout: string; stderr: string }>(`/workspaces/${encodeURIComponent(workspaceId)}/command`, {
    method: "POST",
    body: JSON.stringify({ command, env })
  });
}
