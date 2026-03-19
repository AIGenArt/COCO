import express, { Request, Response } from "express";
import { config } from "./config";
import { createLogger } from "./logger";
import { WorkspaceManager } from "./workspace-manager";

const logger = createLogger();
const workspaceManager = new WorkspaceManager();

const app = express();
app.use(express.json());

app.use((req: Request, res: Response, next) => {
  const auth = req.header("x-runtime-service-secret");
  if (!auth || auth !== config.RUNTIME_SERVICE_SECRET) {
    return res.status(401).json({ success: false, error: { code: "unauthorized", message: "Unauthorized" } });
  }
  next();
});

app.get("/health", (req, res) => {
  res.json({ success: true, data: { status: "ok" } });
});

app.post("/workspaces", async (req, res) => {
  const { workspaceId } = req.body as { workspaceId: string };

  if (!workspaceId) {
    return res.status(400).json({ success: false, error: { code: "invalid_input", message: "workspaceId is required" } });
  }

  try {
    const sandboxId = await workspaceManager.createWorkspace(workspaceId);
    return res.json({ success: true, data: { sandboxId } });
  } catch (error) {
    logger.error({ err: error, workspaceId }, "Failed to create workspace sandbox");
    return res.status(500).json({ success: false, error: { code: "runtime_error", message: "Failed to create workspace sandbox" } });
  }
});

app.delete("/workspaces/:id", async (req, res) => {
  const workspaceId = req.params.id;

  try {
    await workspaceManager.destroyWorkspace(workspaceId);
    return res.json({ success: true });
  } catch (error) {
    logger.error({ err: error, workspaceId }, "Failed to destroy workspace sandbox");
    return res.status(500).json({ success: false, error: { code: "runtime_error", message: "Failed to destroy workspace sandbox" } });
  }
});

app.post("/workspaces/:id/command", async (req, res) => {
  const workspaceId = req.params.id;
  const { command, env } = req.body as { command: string[]; env?: Record<string, string> };

  if (!Array.isArray(command) || command.length === 0) {
    return res.status(400).json({ success: false, error: { code: "invalid_input", message: "command is required" } });
  }

  try {
    const result = await workspaceManager.runCommand(workspaceId, command, env);
    return res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ err: error, workspaceId }, "Failed to run command in workspace sandbox");
    return res.status(500).json({ success: false, error: { code: "runtime_error", message: "Failed to run command" } });
  }
});

app.listen(config.RUNTIME_SERVICE_PORT, () => {
  logger.info(`Runtime service listening on port ${config.RUNTIME_SERVICE_PORT}`);
});
