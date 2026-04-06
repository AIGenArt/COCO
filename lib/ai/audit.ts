import { AIAuditEvent } from './types';
import { redactObject } from './redaction';

// Audit logging for COCO AI Governance
// Implements Sæt D: Audit, Ansvarlighed og Compliance

export async function auditAIEvent(event: AIAuditEvent): Promise<void> {
  // Sæt D, Regel D1: Alle AI-beslutninger er sporbare
  
  // Redact any secrets before logging
  const redactedEvent = redactObject(event);
  
  // For now, log to console
  // TODO: Write to database when Supabase is connected
  console.log('[AI AUDIT]', JSON.stringify(redactedEvent, null, 2));
  
  // In production, this would write to audit_logs table:
  // await supabase.from('audit_logs').insert({
  //   user_id: event.userId,
  //   workspace_id: event.workspaceId,
  //   action: event.eventType,
  //   details: {
  //     actionType: event.actionType,
  //     capability: event.capability,
  //     risk: event.risk,
  //     decision: event.decision,
  //     reason: event.reason,
  //     ...event.metadata
  //   }
  // });
}

export async function auditAIRun(data: {
  workspaceId: string;
  userId: string;
  model: string;
  promptHash: string;
  proposedActions: any[];
  policyId?: string;
  riskLevel: string;
  capabilitiesUsed: string[];
  secretsDetected: boolean;
  policyViolations: string[];
}): Promise<string> {
  // Sæt D, Regel D1: Full traceability
  
  const runId = `ai_run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Redact any secrets
  const redactedData = redactObject(data);
  
  console.log('[AI RUN]', JSON.stringify({
    id: runId,
    ...redactedData,
    timestamp: new Date().toISOString()
  }, null, 2));
  
  // TODO: Write to ai_runs table when Supabase is connected
  // const { data: aiRun, error } = await supabase
  //   .from('ai_runs')
  //   .insert({
  //     workspace_id: data.workspaceId,
  //     user_id: data.userId,
  //     model: data.model,
  //     prompt_hash: data.promptHash,
  //     proposed_actions: data.proposedActions,
  //     policy_id: data.policyId,
  //     risk_level: data.riskLevel,
  //     capabilities_used: data.capabilitiesUsed,
  //     secrets_detected: data.secretsDetected,
  //     policy_violations: data.policyViolations,
  //     requires_approval: data.riskLevel === 'high' || data.riskLevel === 'critical'
  //   })
  //   .select('id')
  //   .single();
  
  return runId;
}

export async function auditApproval(data: {
  aiRunId: string;
  userId: string;
  status: 'approved' | 'rejected';
  reason: string;
  actions: any[];
}): Promise<void> {
  // Sæt D, Regel D2: Klar ansvarsplacering
  
  const redactedData = redactObject(data);
  
  console.log('[AI APPROVAL]', JSON.stringify({
    ...redactedData,
    timestamp: new Date().toISOString()
  }, null, 2));
  
  // TODO: Write to ai_approvals table when Supabase is connected
  // await supabase
  //   .from('ai_approvals')
  //   .insert({
  //     ai_run_id: data.aiRunId,
  //     user_id: data.userId,
  //     status: data.status,
  //     reason: data.reason,
  //     actions: data.actions,
  //     decided_at: new Date().toISOString()
  //   });
}

export async function auditExecution(
  aiRunId: string,
  result: any
): Promise<void> {
  // Sæt D, Regel D3: AI-forslag og eksekvering adskilles
  
  const redactedResult = redactObject(result);
  
  console.log('[AI EXECUTION]', JSON.stringify({
    aiRunId,
    result: redactedResult,
    timestamp: new Date().toISOString()
  }, null, 2));
  
  // TODO: Update ai_runs table when Supabase is connected
  // await supabase
  //   .from('ai_runs')
  //   .update({
  //     executed: true,
  //     executed_at: new Date().toISOString(),
  //     execution_result: result
  //   })
  //   .eq('id', aiRunId);
}

export async function auditSecurityEvent(data: {
  userId: string;
  workspaceId: string;
  eventType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: any;
}): Promise<void> {
  // Sæt D, Regel D4: Governance-events er sikkerhedshændelser
  
  const redactedData = redactObject(data);
  
  console.error('[SECURITY EVENT]', JSON.stringify({
    ...redactedData,
    timestamp: new Date().toISOString()
  }, null, 2));
  
  // TODO: Write to audit_logs table with security flag when Supabase is connected
  // await supabase.from('audit_logs').insert({
  //   user_id: data.userId,
  //   workspace_id: data.workspaceId,
  //   action: data.eventType,
  //   details: {
  //     ...data.details,
  //     severity: data.severity,
  //     security_event: true,
  //     timestamp: new Date().toISOString()
  //   }
  // });
}
