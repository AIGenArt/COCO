-- COCO AI Governance Schema
-- Production-grade database schema with RLS, constraints, and state machine enforcement
-- Version: 1.0.0
-- Created: 2026-03-20

-- ============================================================================
-- AI POLICIES TABLE
-- Defines governance policies per workspace
-- ============================================================================

CREATE TABLE ai_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  
  -- Policy configuration
  name TEXT NOT NULL DEFAULT 'Default Policy',
  mode TEXT NOT NULL CHECK (mode IN ('read_only', 'propose_only', 'apply_with_approval', 'restricted_autonomy')),
  
  -- Capabilities (JSONB array of capability strings)
  capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Restrictions
  restricted_paths TEXT[] NOT NULL DEFAULT '{}',
  restricted_commands TEXT[] NOT NULL DEFAULT '{}',
  
  -- Limits
  max_tokens_per_request INTEGER NOT NULL DEFAULT 4000,
  allowed_models TEXT[] NOT NULL DEFAULT '{"gpt-4", "claude-3-sonnet"}',
  
  -- Approval requirements (JSONB array of action types)
  requires_approval_for JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Policy versioning (critical for audit trail)
  version TEXT NOT NULL DEFAULT '1.0.0',
  
  -- Status
  active BOOLEAN NOT NULL DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Constraints
  CONSTRAINT valid_capabilities CHECK (jsonb_typeof(capabilities) = 'array'),
  CONSTRAINT valid_approval_list CHECK (jsonb_typeof(requires_approval_for) = 'array')
);

-- Indexes
CREATE INDEX idx_ai_policies_workspace_id ON ai_policies(workspace_id);
CREATE INDEX idx_ai_policies_active ON ai_policies(active) WHERE active = true;

-- RLS Policies
ALTER TABLE ai_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view policies for own workspaces"
  ON ai_policies FOR SELECT
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create policies for own workspaces"
  ON ai_policies FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT id FROM workspaces WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update policies for own workspaces"
  ON ai_policies FOR UPDATE
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- AI ACTIONS TABLE
-- State authority for all AI actions
-- ============================================================================

CREATE TABLE ai_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Ownership
  workspace_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  
  -- Action details
  action_type TEXT NOT NULL CHECK (action_type IN ('read_file', 'list_files', 'write_file', 'run_command', 'commit_changes', 'open_pr')),
  action_payload JSONB NOT NULL,
  
  -- Governance
  capability TEXT NOT NULL,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  policy_id UUID REFERENCES ai_policies(id),
  policy_version TEXT NOT NULL,
  policy_decision JSONB NOT NULL,
  
  -- State machine (enforced by constraints)
  status TEXT NOT NULL CHECK (status IN ('planned', 'awaiting_approval', 'approved', 'rejected', 'executed', 'failed')),
  
  -- Approval tracking
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  approval_reason TEXT,
  
  rejected_by UUID REFERENCES auth.users(id),
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  
  -- Execution tracking
  executed_at TIMESTAMPTZ,
  execution_result JSONB,
  
  -- Security
  secrets_detected BOOLEAN NOT NULL DEFAULT false,
  policy_violations JSONB DEFAULT '[]'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- State machine constraints
  CONSTRAINT valid_approval CHECK (
    (status = 'approved' AND approved_by IS NOT NULL AND approved_at IS NOT NULL)
    OR (status != 'approved')
  ),
  CONSTRAINT valid_rejection CHECK (
    (status = 'rejected' AND rejected_by IS NOT NULL AND rejected_at IS NOT NULL)
    OR (status != 'rejected')
  ),
  CONSTRAINT valid_execution CHECK (
    (status = 'executed' AND executed_at IS NOT NULL)
    OR (status != 'executed')
  ),
  CONSTRAINT no_execute_without_approval CHECK (
    (status = 'executed' AND (approved_by IS NOT NULL OR risk_level = 'low'))
    OR (status != 'executed')
  )
);

-- Indexes for performance
CREATE INDEX idx_ai_actions_workspace_id ON ai_actions(workspace_id);
CREATE INDEX idx_ai_actions_user_id ON ai_actions(user_id);
CREATE INDEX idx_ai_actions_status ON ai_actions(status);
CREATE INDEX idx_ai_actions_created_at ON ai_actions(created_at DESC);
CREATE INDEX idx_ai_actions_risk_level ON ai_actions(risk_level);

-- RLS Policies
ALTER TABLE ai_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own actions"
  ON ai_actions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create actions for own workspaces"
  ON ai_actions FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    workspace_id IN (
      SELECT id FROM workspaces WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own actions"
  ON ai_actions FOR UPDATE
  USING (user_id = auth.uid());

-- ============================================================================
-- AI ACTION APPROVALS TABLE
-- First-class approval tracking (not just a field)
-- ============================================================================

CREATE TABLE ai_action_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relations
  action_id UUID NOT NULL REFERENCES ai_actions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  
  -- Approval details
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  reason TEXT NOT NULL,
  
  -- What was approved/rejected
  actions_snapshot JSONB NOT NULL,
  diff TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT valid_decision CHECK (
    (status IN ('approved', 'rejected') AND decided_at IS NOT NULL)
    OR (status = 'pending')
  )
);

-- Indexes
CREATE INDEX idx_ai_action_approvals_action_id ON ai_action_approvals(action_id);
CREATE INDEX idx_ai_action_approvals_user_id ON ai_action_approvals(user_id);
CREATE INDEX idx_ai_action_approvals_status ON ai_action_approvals(status);

-- RLS Policies
ALTER TABLE ai_action_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view approvals for own actions"
  ON ai_action_approvals FOR SELECT
  USING (
    action_id IN (
      SELECT id FROM ai_actions WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create approvals for own actions"
  ON ai_action_approvals FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    action_id IN (
      SELECT id FROM ai_actions WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own approvals"
  ON ai_action_approvals FOR UPDATE
  USING (user_id = auth.uid());

-- ============================================================================
-- AI POLICY DECISIONS TABLE
-- Audit trail for every policy evaluation
-- ============================================================================

CREATE TABLE ai_policy_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relations
  action_id UUID NOT NULL REFERENCES ai_actions(id) ON DELETE CASCADE,
  policy_id UUID REFERENCES ai_policies(id),
  
  -- Decision details
  decision TEXT NOT NULL CHECK (decision IN ('allow', 'deny', 'require_approval')),
  reason TEXT NOT NULL,
  
  -- Context at decision time
  risk_level TEXT NOT NULL,
  capability TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  
  -- Metadata
  evaluation_time_ms INTEGER,
  
  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_ai_policy_decisions_action_id ON ai_policy_decisions(action_id);
CREATE INDEX idx_ai_policy_decisions_decision ON ai_policy_decisions(decision);
CREATE INDEX idx_ai_policy_decisions_created_at ON ai_policy_decisions(created_at DESC);

-- RLS Policies
ALTER TABLE ai_policy_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view policy decisions for own actions"
  ON ai_policy_decisions FOR SELECT
  USING (
    action_id IN (
      SELECT id FROM ai_actions WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can insert policy decisions"
  ON ai_policy_decisions FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- AI AUDIT LOGS TABLE
-- Complete audit trail (not optional)
-- ============================================================================

CREATE TABLE ai_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relations
  user_id UUID REFERENCES auth.users(id),
  workspace_id UUID,
  action_id UUID REFERENCES ai_actions(id) ON DELETE SET NULL,
  
  -- Event details
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  
  -- Event data
  action_type TEXT,
  capability TEXT,
  risk_level TEXT,
  decision TEXT,
  reason TEXT,
  
  -- Metadata (redacted)
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Security flag
  is_security_event BOOLEAN NOT NULL DEFAULT false,
  
  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for audit queries
CREATE INDEX idx_ai_audit_logs_user_id ON ai_audit_logs(user_id);
CREATE INDEX idx_ai_audit_logs_workspace_id ON ai_audit_logs(workspace_id);
CREATE INDEX idx_ai_audit_logs_action_id ON ai_audit_logs(action_id);
CREATE INDEX idx_ai_audit_logs_event_type ON ai_audit_logs(event_type);
CREATE INDEX idx_ai_audit_logs_severity ON ai_audit_logs(severity);
CREATE INDEX idx_ai_audit_logs_created_at ON ai_audit_logs(created_at DESC);
CREATE INDEX idx_ai_audit_logs_security_events ON ai_audit_logs(is_security_event) WHERE is_security_event = true;

-- RLS Policies
ALTER TABLE ai_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own audit logs"
  ON ai_audit_logs FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Service role can insert audit logs"
  ON ai_audit_logs FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- AUTH EVENTS TABLE
-- Authentication audit trail
-- ============================================================================

CREATE TABLE auth_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User
  user_id UUID REFERENCES auth.users(id),
  
  -- Event details
  event_type TEXT NOT NULL CHECK (event_type IN ('signup', 'login', 'logout', 'password_reset', 'email_confirm', 'mfa_enable', 'mfa_disable')),
  
  -- Context
  ip_address INET,
  user_agent TEXT,
  
  -- Result
  success BOOLEAN NOT NULL,
  error_message TEXT,
  
  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_auth_events_user_id ON auth_events(user_id);
CREATE INDEX idx_auth_events_event_type ON auth_events(event_type);
CREATE INDEX idx_auth_events_created_at ON auth_events(created_at DESC);
CREATE INDEX idx_auth_events_failed ON auth_events(success) WHERE success = false;

-- RLS Policies
ALTER TABLE auth_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own auth events"
  ON auth_events FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Service role can insert auth events"
  ON auth_events FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for ai_policies
CREATE TRIGGER update_ai_policies_updated_at
  BEFORE UPDATE ON ai_policies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to enforce state machine transitions
CREATE OR REPLACE FUNCTION enforce_action_state_machine()
RETURNS TRIGGER AS $$
BEGIN
  -- Validate state transitions
  IF OLD.status = 'executed' AND NEW.status != 'executed' THEN
    RAISE EXCEPTION 'Cannot change status of executed action';
  END IF;
  
  IF OLD.status = 'rejected' AND NEW.status NOT IN ('rejected') THEN
    RAISE EXCEPTION 'Cannot change status of rejected action';
  END IF;
  
  IF NEW.status = 'approved' AND OLD.status NOT IN ('planned', 'awaiting_approval') THEN
    RAISE EXCEPTION 'Can only approve actions that are planned or awaiting approval';
  END IF;
  
  IF NEW.status = 'executed' AND OLD.status NOT IN ('approved', 'planned') THEN
    RAISE EXCEPTION 'Can only execute approved or low-risk planned actions';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for state machine enforcement
CREATE TRIGGER enforce_ai_action_state_machine
  BEFORE UPDATE ON ai_actions
  FOR EACH ROW
  EXECUTE FUNCTION enforce_action_state_machine();

-- ============================================================================
-- VIEWS
-- ============================================================================

-- View for pending approvals
CREATE VIEW pending_approvals AS
SELECT 
  a.id,
  a.workspace_id,
  a.user_id,
  a.action_type,
  a.risk_level,
  a.created_at,
  a.action_payload
FROM ai_actions a
WHERE a.status = 'awaiting_approval'
ORDER BY a.created_at DESC;

-- View for security events
CREATE VIEW security_events AS
SELECT 
  id,
  user_id,
  workspace_id,
  event_type,
  severity,
  reason,
  created_at
FROM ai_audit_logs
WHERE is_security_event = true
ORDER BY created_at DESC;

-- ============================================================================
-- GRANTS
-- ============================================================================

-- Grant access to authenticated users
GRANT SELECT ON ai_policies TO authenticated;
GRANT SELECT ON ai_actions TO authenticated;
GRANT SELECT ON ai_action_approvals TO authenticated;
GRANT SELECT ON ai_policy_decisions TO authenticated;
GRANT SELECT ON ai_audit_logs TO authenticated;
GRANT SELECT ON auth_events TO authenticated;

-- Grant access to views
GRANT SELECT ON pending_approvals TO authenticated;
GRANT SELECT ON security_events TO authenticated;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE ai_policies IS 'AI governance policies per workspace';
COMMENT ON TABLE ai_actions IS 'State authority for all AI actions - enforces state machine';
COMMENT ON TABLE ai_action_approvals IS 'First-class approval tracking with full audit trail';
COMMENT ON TABLE ai_policy_decisions IS 'Audit trail for every policy evaluation';
COMMENT ON TABLE ai_audit_logs IS 'Complete audit trail - not optional';
COMMENT ON TABLE auth_events IS 'Authentication audit trail';

COMMENT ON COLUMN ai_actions.status IS 'State machine: planned → awaiting_approval → approved → executed (or rejected)';
COMMENT ON COLUMN ai_actions.policy_version IS 'Critical for audit trail - explains why action was allowed';
COMMENT ON CONSTRAINT no_execute_without_approval ON ai_actions IS 'Enforces that high-risk actions cannot be executed without approval';
