"use client";

import { useState } from "react";
import { Send, Loader2, FileText, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/lib/workspace/workspace-store";
import { aiService } from "@/lib/workspace/ai-service";
import { actionExecutor } from "@/lib/workspace/action-executor";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

interface PlanAction {
  id: string;
  type: string;
  path?: string;
  content?: string;
  description: string;
}

interface PlanState {
  planId: string | null;
  summary: string;
  actions: PlanAction[];
  filesAffected: string[];
  status: "idle" | "planning" | "ready" | "executing" | "done" | "failed";
  error?: string;
}

export function TaskPanel() {
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [planState, setPlanState] = useState<PlanState>({
    planId: null,
    summary: "",
    actions: [],
    filesAffected: [],
    status: "idle",
  });
  const [isLoading, setIsLoading] = useState(false);
  
  const { currentMode, buildStatus, setMode, startBuild, completeBuild } = useWorkspaceStore();
  
  const handleSendPrompt = async () => {
    if (!prompt.trim() || isLoading) return;
    
    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: "user",
      content: prompt,
      timestamp: Date.now(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setPrompt("");
    setIsLoading(true);
    setPlanState({ planId: null, summary: "", actions: [], filesAffected: [], status: "planning" });
    
    try {
      // Call AI service to plan
      const response = await aiService.planWithDebounce(
        "workspace_1", // TODO: Get actual workspace ID
        prompt
      );
      
      if (response.success && response.data) {
        const { planId, summary, actions, filesAffected } = response.data;
        
        const assistantMessage: Message = {
          id: `msg_${Date.now()}_ai`,
          role: "assistant",
          content: summary,
          timestamp: Date.now(),
        };
        
        setMessages(prev => [...prev, assistantMessage]);
        
        setPlanState({
          planId,
          summary,
          actions,
          filesAffected,
          status: "ready",
        });
      } else {
        throw new Error(response.error || "Failed to create plan");
      }
    } catch (error) {
      const errorMessage: Message = {
        id: `msg_${Date.now()}_error`,
        role: "assistant",
        content: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        timestamp: Date.now(),
      };
      
      setMessages(prev => [...prev, errorMessage]);
      setPlanState({ 
        planId: null,
        summary: "",
        actions: [],
        filesAffected: [],
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleBuildPlan = async () => {
    if (!planState.planId || planState.actions.length === 0) return;
    
    // Switch to build mode
    setMode("build");
    setPlanState(prev => ({ ...prev, status: "executing" }));
    
    // Start build session
    const buildId = `build_${Date.now()}`;
    startBuild(buildId);
    
    try {
      // Execute plan via backend
      const result = await aiService.executePlan(planState.planId, "workspace_1");
      
      if (result.success) {
        // Now execute actions in workspace store
        const plannedActions = planState.actions.map(action => ({
          id: action.id,
          userId: "user_1",
          workspaceId: "workspace_1",
          action: {
            type: action.type as any,
            workspaceId: "workspace_1",
            path: action.path || "",
            content: action.content || "",
          },
          capability: "ai:write_file" as any,
          risk: "medium" as any,
          decision: {
            outcome: "require_approval" as any,
            reason: "File write requires approval",
            approvalType: "user" as any,
          },
          status: "approved" as any,
          createdAt: new Date().toISOString(),
        }));
        
        const execResult = await actionExecutor.executeBatch(
          plannedActions,
          (progress) => {
            console.log("Progress:", progress);
          }
        );
        
        if (execResult.success) {
          completeBuild(true);
          setPlanState(prev => ({ ...prev, status: "done" }));
          
          const successMessage: Message = {
            id: `msg_${Date.now()}_success`,
            role: "assistant",
            content: `✓ Build complete! Updated ${execResult.filesAffected.length} file(s).`,
            timestamp: Date.now(),
          };
          setMessages(prev => [...prev, successMessage]);
        } else {
          throw new Error(execResult.error || "Build failed");
        }
      } else {
        throw new Error("Backend execution failed");
      }
    } catch (error) {
      completeBuild(false, error instanceof Error ? error.message : "Unknown error");
      setPlanState(prev => ({ 
        ...prev, 
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error"
      }));
      
      const errorMessage: Message = {
        id: `msg_${Date.now()}_error`,
        role: "assistant",
        content: `✗ Build failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };
  
  const canSendPrompt = !isLoading && buildStatus !== "building";
  
  return (
    <div className="w-80 bg-[#0b0d10] border-r border-border flex flex-col">
      {/* Header */}
      <div className="h-12 border-b border-border flex items-center justify-between px-4">
        <span className="text-sm font-medium">Task</span>
        <div className={cn(
          "px-2 py-0.5 rounded text-xs font-medium",
          currentMode === "plan" ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"
        )}>
          {currentMode === "plan" ? "Plan" : "Build"}
        </div>
      </div>
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <p className="text-sm font-medium mb-1">What do you want to build?</p>
            <p className="text-xs text-muted-foreground">
              Describe your task and I'll help you build it
            </p>
          </div>
        )}
        
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "flex gap-2",
              message.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            <div
              className={cn(
                "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                message.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-foreground"
              )}
            >
              {message.content}
            </div>
          </div>
        ))}
        
        {/* Plan Display */}
        {planState.status === "ready" && planState.actions.length > 0 && (
          <div className="bg-secondary rounded-lg p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">Planned Actions</span>
              <span className="text-xs text-muted-foreground">
                {planState.actions.length} action(s)
              </span>
            </div>
            
            {planState.actions.map((action) => (
              <div key={action.id} className="flex items-start gap-2 text-xs">
                <FileText className="w-3.5 h-3.5 mt-0.5 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">
                    {action.path || action.description}
                  </div>
                  <div className="text-muted-foreground">
                    {action.description}
                  </div>
                </div>
              </div>
            ))}
            
            <button
              onClick={handleBuildPlan}
              disabled={buildStatus === "building"}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="w-4 h-4" />
              Build This
            </button>
          </div>
        )}
        
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Planning...</span>
          </div>
        )}
      </div>
      
      {/* Input */}
      <div className="border-t border-border p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendPrompt();
              }
            }}
            placeholder="Describe what you want to build..."
            className="flex-1 bg-secondary border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            disabled={!canSendPrompt}
          />
          <button
            onClick={handleSendPrompt}
            disabled={!prompt.trim() || !canSendPrompt}
            className="px-3 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        {buildStatus === "building" && (
          <p className="text-xs text-muted-foreground mt-2">
            Build in progress... Input will be available after completion
          </p>
        )}
      </div>
    </div>
  );
}
