import { AICapability, AIActionType, AIPolicyMode } from './types';

// Map action types to required capabilities
const ACTION_TO_CAPABILITY: Record<AIActionType, AICapability> = {
  read_file: 'ai:read_file',
  list_files: 'ai:list_files',
  write_file: 'ai:write_file',
  run_command: 'ai:run_command',
  commit_changes: 'ai:commit_changes',
  open_pr: 'ai:open_pr'
};

export function getRequiredCapability(actionType: AIActionType): AICapability {
  return ACTION_TO_CAPABILITY[actionType];
}

export function hasCapability(
  userCapabilities: AICapability[],
  required: AICapability
): boolean {
  return userCapabilities.includes(required);
}

// Default capabilities per policy mode
export function getDefaultCapabilities(mode: AIPolicyMode): AICapability[] {
  switch (mode) {
    case 'read_only':
      return ['ai:read_context', 'ai:list_files', 'ai:read_file', 'ai:read_logs'];
    
    case 'propose_only':
      return ['ai:read_context', 'ai:list_files', 'ai:read_file', 'ai:propose_patch'];
    
    case 'apply_with_approval':
      return [
        'ai:read_context',
        'ai:list_files',
        'ai:read_file',
        'ai:propose_patch',
        'ai:write_file',
        'ai:run_command',
        'ai:commit_changes',
        'ai:open_pr'
      ];
    
    case 'restricted_autonomy':
      return [
        'ai:read_context',
        'ai:list_files',
        'ai:read_file',
        'ai:write_file',
        'ai:run_command'
      ];
    
    default:
      return ['ai:read_context', 'ai:list_files', 'ai:read_file'];
  }
}
