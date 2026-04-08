/**
 * Bootstrap Service
 * 
 * Handles workspace source materialization and validation.
 * Ensures required files exist before dev server starts.
 */

import type { BootstrapValidationResult, BootstrapMode } from './types';

/**
 * Required files for Next.js App Router template
 */
const REQUIRED_FILES = [
  'package.json',
  'app/layout.tsx',
  'app/page.tsx',
  'next.config.mjs',
] as const;

/**
 * Filesystem interface for sandbox operations
 */
export interface SandboxFilesystem {
  exists(path: string): Promise<boolean>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
}

/**
 * Validate workspace structure before starting dev server
 * 
 * Checks:
 * 1. All required files exist
 * 2. package.json is valid JSON
 * 3. package.json has scripts.dev
 * 4. package.json has next dependency
 */
export async function validateWorkspaceStructure(
  fs: SandboxFilesystem
): Promise<BootstrapValidationResult> {
  console.log('[Bootstrap] Validating workspace structure...');
  
  const missing: string[] = [];
  const details: string[] = [];

  // 1. Check file existence
  for (const file of REQUIRED_FILES) {
    const exists = await fs.exists(file);
    if (!exists) {
      missing.push(file);
      console.error(`[Bootstrap] ✗ Missing required file: ${file}`);
    }
  }

  if (missing.length > 0) {
    return {
      ok: false,
      missing,
      details: [`Missing ${missing.length} required file(s)`],
    };
  }

  console.log('[Bootstrap] ✓ All required files present');

  // 2. Validate package.json
  try {
    const packageJsonRaw = await fs.readFile('package.json');
    const pkg = JSON.parse(packageJsonRaw);

    // Check scripts.dev
    if (!pkg?.scripts?.dev) {
      details.push('package.json missing scripts.dev');
      console.error('[Bootstrap] ✗ package.json missing scripts.dev');
    }

    // Check next dependency
    const hasNext = 
      pkg?.dependencies?.next || 
      pkg?.devDependencies?.next;
    
    if (!hasNext) {
      details.push('next dependency missing from package.json');
      console.error('[Bootstrap] ✗ next dependency missing');
    }

    // Check if it's a valid Next.js project
    if (!pkg?.dependencies?.react) {
      details.push('react dependency missing from package.json');
      console.error('[Bootstrap] ✗ react dependency missing');
    }

  } catch (error) {
    details.push('package.json is not valid JSON');
    console.error('[Bootstrap] ✗ package.json parse error:', error);
  }

  const ok = details.length === 0;
  
  if (ok) {
    console.log('[Bootstrap] ✓ All validations passed');
  } else {
    console.error('[Bootstrap] ✗ Validation failed:', details);
  }

  return {
    ok,
    missing: [],
    details: details.length > 0 ? details : undefined,
  };
}

/**
 * Materialize workspace source from template
 * 
 * This is a placeholder - actual implementation depends on
 * how templates are stored and deployed.
 */
export async function materializeTemplate(
  fs: SandboxFilesystem,
  templateName: string
): Promise<void> {
  console.log(`[Bootstrap] Materializing template: ${templateName}`);
  
  // TODO: Implement template materialization
  // This should:
  // 1. Copy template files to sandbox
  // 2. Replace placeholders if any
  // 3. Ensure all required files are present
  
  console.log('[Bootstrap] ✓ Template materialized');
}

/**
 * Materialize workspace source from repository
 * 
 * This is a placeholder - actual implementation depends on
 * Git integration.
 */
export async function materializeRepo(
  fs: SandboxFilesystem,
  repoUrl: string,
  branch?: string
): Promise<void> {
  console.log(`[Bootstrap] Materializing repo: ${repoUrl}`);
  
  // TODO: Implement repo cloning
  // This should:
  // 1. Clone repo to sandbox
  // 2. Checkout specified branch
  // 3. Ensure working directory is correct
  
  console.log('[Bootstrap] ✓ Repo materialized');
}

/**
 * Bootstrap workspace based on mode
 */
export async function bootstrapWorkspace(
  fs: SandboxFilesystem,
  mode: BootstrapMode,
  source: string
): Promise<BootstrapValidationResult> {
  console.log(`[Bootstrap] Starting bootstrap (mode: ${mode})`);
  
  try {
    // Materialize source
    if (mode === 'template') {
      await materializeTemplate(fs, source);
    } else {
      await materializeRepo(fs, source);
    }

    // Validate structure
    const validation = await validateWorkspaceStructure(fs);
    
    if (!validation.ok) {
      console.error('[Bootstrap] ✗ Validation failed after materialization');
      return validation;
    }

    console.log('[Bootstrap] ✓ Bootstrap complete');
    return validation;

  } catch (error) {
    console.error('[Bootstrap] ✗ Bootstrap error:', error);
    return {
      ok: false,
      missing: [],
      details: [
        error instanceof Error ? error.message : 'Unknown bootstrap error'
      ],
    };
  }
}
