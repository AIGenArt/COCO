import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { openRouterClient } from "@/lib/ai/openrouter-client";

export const dynamic = 'force-dynamic';

interface PlanRequest {
  prompt: string;
  workspaceId: string;
  context?: {
    currentFiles?: string[];
    mode: "plan" | "build";
  };
}

interface PlanResponse {
  planId: string;
  summary: string;
  actions: Array<{
    id: string;
    type: string;
    path?: string;
    content?: string;
    description: string;
  }>;
  filesAffected: string[];
  requiresApproval: boolean;
  estimatedChanges: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: PlanRequest = await request.json();
    const { prompt, workspaceId, context } = body;
    
    if (!prompt || !workspaceId) {
      return NextResponse.json(
        { error: "Missing required fields: prompt, workspaceId" },
        { status: 400 }
      );
    }
    
    // Generate plan ID
    const planId = `plan_${nanoid(12)}`;
    
    // Call OpenRouter with Qwen3 for planning
    let aiResponse;
    let usedFallback = false;
    
    try {
      console.log(`[AI Plan] Calling OpenRouter with model: ${process.env.AI_MODEL_PLAN || 'qwen/qwen3-coder-480b-a35b-instruct:free'}`);
      console.log(`[AI Plan] Prompt: ${prompt}`);
      
      const aiResponseText = await openRouterClient.plan(prompt, context);
      
      console.log(`[AI Plan] Raw response length: ${aiResponseText.length}`);
      console.log(`[AI Plan] Response preview: ${aiResponseText.substring(0, 200)}...`);
      
      aiResponse = JSON.parse(aiResponseText);
      console.log(`[AI Plan] Successfully parsed AI response with ${aiResponse.actions?.length || 0} actions`);
      
    } catch (aiError) {
      console.error("[AI Plan] AI planning error:", aiError);
      console.error("[AI Plan] Error details:", {
        message: aiError instanceof Error ? aiError.message : 'Unknown error',
        stack: aiError instanceof Error ? aiError.stack : undefined
      });
      
      // Fallback to improved pattern matching if AI fails
      console.log("[AI Plan] Falling back to pattern matching");
      usedFallback = true;
      
      const actions = generateActionsFromPrompt(prompt, workspaceId);
      aiResponse = {
        summary: `Plan to: ${prompt} (using fallback pattern matching)`,
        actions: actions.map(a => ({
          type: a.type,
          path: a.path,
          description: a.description,
          content: a.content,
        })),
      };
    }
    
    // Add IDs to actions
    const actions = (aiResponse.actions || []).map((action: any) => ({
      id: `action_${nanoid(8)}`,
      ...action,
    }));
    
    const filesAffected = actions
      .filter((a: any) => a.path)
      .map((a: any) => a.path as string);
    
    const response: PlanResponse = {
      planId,
      summary: aiResponse.summary || `Plan to: ${prompt}`,
      actions,
      filesAffected,
      requiresApproval: true,
      estimatedChanges: actions.length,
    };
    
    // Store plan in memory for now (will use Supabase later)
    global.plans = global.plans || new Map();
    global.plans.set(planId, {
      ...response,
      workspaceId,
      createdAt: Date.now(),
      status: "pending",
    });
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error("Plan generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate plan" },
      { status: 500 }
    );
  }
}

// Helper: Generate actions from prompt (improved pattern matching)
function generateActionsFromPrompt(prompt: string, workspaceId: string) {
  const lowerPrompt = prompt.toLowerCase();
  const actions = [];
  
  // Pattern matching for different types of apps
  if (lowerPrompt.includes("checklist") || lowerPrompt.includes("todo") || lowerPrompt.includes("list")) {
    // Checklist/Todo app
    actions.push({
      id: `action_${nanoid(8)}`,
      type: "write_file",
      path: "components/TodoList.tsx",
      content: `"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
}

export function TodoList() {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [input, setInput] = useState("");

  const addTodo = () => {
    if (input.trim()) {
      setTodos([...todos, { id: Date.now().toString(), text: input, completed: false }]);
      setInput("");
    }
  };

  const toggleTodo = (id: string) => {
    setTodos(todos.map(todo => 
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ));
  };

  const deleteTodo = (id: string) => {
    setTodos(todos.filter(todo => todo.id !== id));
  };

  const clearCompleted = () => {
    setTodos(todos.filter(todo => !todo.completed));
  };

  const remaining = todos.filter(t => !t.completed).length;

  return (
    <div className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-3xl font-bold text-center mb-6">My Checklist</h1>
      
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addTodo()}
          placeholder="Add a new item..."
          className="flex-1"
        />
        <Button onClick={addTodo}>Add</Button>
      </div>

      <div className="space-y-2">
        {todos.map((todo) => (
          <div
            key={todo.id}
            className="flex items-center gap-3 p-3 bg-secondary rounded-lg hover:bg-secondary/80 transition-colors"
          >
            <Checkbox
              checked={todo.completed}
              onCheckedChange={() => toggleTodo(todo.id)}
            />
            <span className={\`flex-1 \${todo.completed ? "line-through text-muted-foreground" : ""}\`}>
              {todo.text}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => deleteTodo(todo.id)}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      {todos.length > 0 && (
        <div className="flex items-center justify-between pt-4 border-t">
          <span className="text-sm text-muted-foreground">
            {remaining} item{remaining !== 1 ? "s" : ""} left
          </span>
          {todos.some(t => t.completed) && (
            <Button variant="outline" size="sm" onClick={clearCompleted}>
              Clear completed
            </Button>
          )}
        </div>
      )}
    </div>
  );
}`,
      description: "Create TodoList component with add, toggle, delete, and clear functionality",
    });
    
    actions.push({
      id: `action_${nanoid(8)}`,
      type: "write_file",
      path: "app/page.tsx",
      content: `import { TodoList } from "@/components/TodoList";

export default function Home() {
  return (
    <main className="min-h-screen bg-background py-8">
      <TodoList />
    </main>
  );
}`,
      description: "Update page to use TodoList",
    });
  } else if (lowerPrompt.includes("hero") || lowerPrompt.includes("landing")) {
    actions.push({
      id: `action_${nanoid(8)}`,
      type: "write_file",
      path: "components/Hero.tsx",
      content: `export function Hero() {
  return (
    <section className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 to-purple-700">
      <div className="text-center text-white px-4">
        <h1 className="text-6xl font-bold mb-4">
          Welcome to COCO
        </h1>
        <p className="text-xl mb-8 text-blue-100">
          AI-powered development workspace
        </p>
        <button className="px-8 py-3 bg-white text-blue-600 rounded-lg font-semibold hover:bg-blue-50 transition-colors">
          Get Started
        </button>
      </div>
    </section>
  );
}`,
      description: "Create Hero component",
    });
    
    actions.push({
      id: `action_${nanoid(8)}`,
      type: "write_file",
      path: "app/page.tsx",
      content: `import { Hero } from "@/components/Hero";

export default function Home() {
  return <Hero />;
}`,
      description: "Update page to use Hero",
    });
  } else if (lowerPrompt.includes("button") || lowerPrompt.includes("component")) {
    actions.push({
      id: `action_${nanoid(8)}`,
      type: "write_file",
      path: "components/CustomButton.tsx",
      content: `interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary";
}

export function CustomButton({ children, onClick, variant = "primary" }: ButtonProps) {
  return (
    <button
      onClick={onClick}
      className={\`px-4 py-2 rounded-lg font-medium transition-colors \${
        variant === "primary"
          ? "bg-blue-600 text-white hover:bg-blue-700"
          : "bg-gray-200 text-gray-800 hover:bg-gray-300"
      }\`}
    >
      {children}
    </button>
  );
}`,
      description: "Create CustomButton component",
    });
  } else {
    // Generic file creation
    actions.push({
      id: `action_${nanoid(8)}`,
      type: "write_file",
      path: "components/NewComponent.tsx",
      content: `export function NewComponent() {
  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold">New Component</h2>
      <p className="text-gray-600">Created from: ${prompt}</p>
    </div>
  );
}`,
      description: `Create component based on: ${prompt}`,
    });
  }
  
  return actions;
}

// Declare global type
declare global {
  var plans: Map<string, any> | undefined;
}
