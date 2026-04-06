/**
 * Workspace Bootstrap
 * 
 * Handles deterministic and idempotent workspace initialization in E2B sandboxes.
 * Validates all required files BEFORE starting dev server.
 */

export type WorkspaceBootstrapPhase =
  | 'prepare_source'
  | 'materialize_files'
  | 'validate_structure'
  | 'install_dependencies'
  | 'start_dev_server'
  | 'ready';

export interface BootstrapResult {
  success: boolean;
  phase: WorkspaceBootstrapPhase;
  error?: string;
  missingFiles?: string[];
  validatedFiles?: string[];
}

export interface WorkspaceTemplate {
  files: Array<{
    path: string;
    content: string;
  }>;
}

/**
 * Required files for a valid Next.js App Router workspace
 */
const REQUIRED_FILES = [
  'package.json',
  'app/layout.tsx',
  'app/page.tsx',
  'tsconfig.json',
  'next.config.mjs',
  'tailwind.config.ts',
  'postcss.config.mjs',
  'app/globals.css',
] as const;

/**
 * Validate workspace structure
 * Checks that all required files exist
 */
export async function validateWorkspaceStructure(
  checkFileExists: (path: string) => Promise<boolean>
): Promise<{ valid: boolean; missingFiles: string[]; validatedFiles: string[] }> {
  console.log('[Bootstrap] Validating workspace structure...');
  
  const missingFiles: string[] = [];
  const validatedFiles: string[] = [];

  for (const file of REQUIRED_FILES) {
    const exists = await checkFileExists(file);
    if (exists) {
      validatedFiles.push(file);
    } else {
      missingFiles.push(file);
    }
  }

  if (missingFiles.length > 0) {
    console.error('[Bootstrap] ✗ Validation failed. Missing files:', missingFiles);
    return { valid: false, missingFiles, validatedFiles };
  }

  console.log('[Bootstrap] ✓ Validation passed. All required files present.');
  return { valid: true, missingFiles: [], validatedFiles };
}

/**
 * Bootstrap workspace in E2B sandbox
 * Idempotent - safe to call multiple times
 */
export async function bootstrapWorkspace(
  template: WorkspaceTemplate,
  writeFile: (path: string, content: string) => Promise<void>,
  checkFileExists: (path: string) => Promise<boolean>,
  onPhaseChange?: (phase: WorkspaceBootstrapPhase) => void
): Promise<BootstrapResult> {
  try {
    // Phase 1: Prepare source
    console.log('[Bootstrap] Phase: prepare_source');
    onPhaseChange?.('prepare_source');

    if (!template.files || template.files.length === 0) {
      return {
        success: false,
        phase: 'prepare_source',
        error: 'Template has no files',
      };
    }

    // Phase 2: Materialize files
    console.log('[Bootstrap] Phase: materialize_files');
    onPhaseChange?.('materialize_files');

    console.log(`[Bootstrap] Writing ${template.files.length} files...`);
    for (const file of template.files) {
      try {
        await writeFile(file.path, file.content);
        console.log(`[Bootstrap] ✓ Wrote ${file.path}`);
      } catch (error) {
        console.error(`[Bootstrap] ✗ Failed to write ${file.path}:`, error);
        return {
          success: false,
          phase: 'materialize_files',
          error: `Failed to write ${file.path}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    }

    // Phase 3: Validate structure
    console.log('[Bootstrap] Phase: validate_structure');
    onPhaseChange?.('validate_structure');

    const validation = await validateWorkspaceStructure(checkFileExists);
    
    if (!validation.valid) {
      return {
        success: false,
        phase: 'validate_structure',
        error: 'Workspace structure validation failed',
        missingFiles: validation.missingFiles,
        validatedFiles: validation.validatedFiles,
      };
    }

    // Success - ready for dependency installation
    console.log('[Bootstrap] ✓ Bootstrap complete, ready for install_dependencies phase');
    return {
      success: true,
      phase: 'validate_structure',
      validatedFiles: validation.validatedFiles,
    };

  } catch (error) {
    console.error('[Bootstrap] ✗ Bootstrap failed:', error);
    return {
      success: false,
      phase: 'prepare_source',
      error: error instanceof Error ? error.message : 'Unknown bootstrap error',
    };
  }
}

/**
 * Generate minimal valid Next.js workspace template
 */
export function generateMinimalTemplate(): WorkspaceTemplate {
  return {
    files: [
      {
        path: 'package.json',
        content: JSON.stringify({
          name: 'workspace',
          version: '0.1.0',
          private: true,
          scripts: {
            dev: 'next dev',
            build: 'next build',
            start: 'next start',
            lint: 'next lint',
          },
          dependencies: {
            react: '^18',
            'react-dom': '^18',
            next: '14.2.3',
          },
          devDependencies: {
            typescript: '^5',
            '@types/node': '^20',
            '@types/react': '^18',
            '@types/react-dom': '^18',
            postcss: '^8',
            tailwindcss: '^3.4.1',
            autoprefixer: '^10.0.1',
          },
        }, null, 2),
      },
      {
        path: 'tsconfig.json',
        content: JSON.stringify({
          compilerOptions: {
            lib: ['dom', 'dom.iterable', 'esnext'],
            allowJs: true,
            skipLibCheck: true,
            strict: true,
            noEmit: true,
            esModuleInterop: true,
            module: 'esnext',
            moduleResolution: 'bundler',
            resolveJsonModule: true,
            isolatedModules: true,
            jsx: 'preserve',
            incremental: true,
            plugins: [{ name: 'next' }],
            paths: { '@/*': ['./*'] },
          },
          include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
          exclude: ['node_modules'],
        }, null, 2),
      },
      {
        path: 'next.config.mjs',
        content: `/** @type {import('next').NextConfig} */
const nextConfig = {};

export default nextConfig;
`,
      },
      {
        path: 'tailwind.config.ts',
        content: `import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
export default config;
`,
      },
      {
        path: 'postcss.config.mjs',
        content: `/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

export default config;
`,
      },
      {
        path: 'app/globals.css',
        content: `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --foreground-rgb: 0, 0, 0;
  --background-start-rgb: 214, 219, 220;
  --background-end-rgb: 255, 255, 255;
}

@media (prefers-color-scheme: dark) {
  :root {
    --foreground-rgb: 255, 255, 255;
    --background-start-rgb: 0, 0, 0;
    --background-end-rgb: 0, 0, 0;
  }
}

body {
  color: rgb(var(--foreground-rgb));
  background: linear-gradient(
      to bottom,
      transparent,
      rgb(var(--background-end-rgb))
    )
    rgb(var(--background-start-rgb));
}
`,
      },
      {
        path: 'app/layout.tsx',
        content: `import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "COCO Workspace",
  description: "Built with COCO",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
`,
      },
      {
        path: 'app/page.tsx',
        content: `export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-center font-mono text-sm">
        <h1 className="text-4xl font-bold text-center mb-4">
          Welcome to COCO
        </h1>
        <p className="text-center text-gray-600">
          Your workspace is ready. Start building!
        </p>
      </div>
    </main>
  );
}
`,
      },
    ],
  };
}
