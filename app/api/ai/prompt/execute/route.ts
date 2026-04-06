import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

interface ExecuteRequest {
  planId: string;
  workspaceId: string;
}

interface ExecuteResponse {
  success: boolean;
  executedActions: string[];
  filesChanged: string[];
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: ExecuteRequest = await request.json();
    const { planId, workspaceId } = body;
    
    if (!planId || !workspaceId) {
      return NextResponse.json(
        { error: "Missing required fields: planId, workspaceId" },
        { status: 400 }
      );
    }
    
    // Retrieve plan from memory
    const plans = global.plans || new Map();
    const plan = plans.get(planId);
    
    if (!plan) {
      return NextResponse.json(
        { error: "Plan not found" },
        { status: 404 }
      );
    }
    
    if (plan.workspaceId !== workspaceId) {
      return NextResponse.json(
        { error: "Plan does not belong to this workspace" },
        { status: 403 }
      );
    }
    
    if (plan.status === "executed") {
      return NextResponse.json(
        { error: "Plan already executed" },
        { status: 400 }
      );
    }
    
    // Mark plan as executed
    plan.status = "executed";
    plan.executedAt = Date.now();
    plans.set(planId, plan);
    
    // Return execution result
    const response: ExecuteResponse = {
      success: true,
      executedActions: plan.actions.map((a: any) => a.id),
      filesChanged: plan.filesAffected || [],
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error("Plan execution error:", error);
    return NextResponse.json(
      { 
        success: false,
        executedActions: [],
        filesChanged: [],
        error: "Failed to execute plan" 
      },
      { status: 500 }
    );
  }
}
