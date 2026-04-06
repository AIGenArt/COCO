/**
 * Workspace Bootstrap
 * 
 * Supports two modes:
 * - manual: Fast, deterministic file generation (10-20s)
 * - ai: AI-driven generation with validation (1-3min)
 */

import { createE2BAIService } from '@/lib/ai/e2b-ai-service';
import { E2BManager } from './e2b-manager';
import {
  generatePackageJson,
  generateNextConfig,
  generateTailwindConfig,
  generateTsConfig,
  generatePostCssConfig,
  generateLibUtils,
} from './template-generator';

export interface WorkspaceBootstrapResult {
  success: boolean;
  message: string;
  files?: string[];
  error?: string;
  mode?: 'manual' | 'ai';
}

/**
 * Bootstrap workspace using AI
 * AI will create all files, test them, and ensure everything works
 */
export async function bootstrapWorkspaceWithAI(
  sandboxId: string,
  workspaceName: string
): Promise<WorkspaceBootstrapResult> {
  console.log('[AI Bootstrap] Starting AI-driven workspace bootstrap...');
  console.log('[AI Bootstrap] Sandbox ID:', sandboxId);
  console.log('[AI Bootstrap] Workspace name:', workspaceName);

  try {
    // Connect to sandbox
    console.log('[AI Bootstrap] Connecting to E2B sandbox...');
    const aiService = await createE2BAIService(sandboxId);
    console.log('[AI Bootstrap] ✓ Connected to sandbox');

    // Let AI create the workspace
    console.log('[AI Bootstrap] Requesting AI to build workspace...');
    const result = await aiService.buildFeature(
      `Create a complete Next.js 14 workspace named "${workspaceName}" with App Router.

REQUIRED FILES (you MUST create ALL of these):
1. package.json - with Next.js 14, React 18, TypeScript, Tailwind CSS
2. tsconfig.json - standard Next.js TypeScript config
3. next.config.mjs - basic Next.js config
4. tailwind.config.ts - Tailwind configuration
5. postcss.config.mjs - PostCSS with Tailwind
6. app/layout.tsx - root layout with metadata
7. app/page.tsx - homepage with beautiful gradient design
8. app/globals.css - Tailwind directives and base styles

IMPORTANT STEPS:
1. Write ALL files using write_file tool
2. Run "npm install" using execute_bash tool
3. Verify all files exist using list_files tool
4. Check for any errors
5. Only respond with success when npm install completes

Return JSON when done:
{
  "success": true,
  "message": "Workspace created successfully",
  "files": ["package.json", "app/layout.tsx", "app/page.tsx", ...]
}`,
      {
        maxIterations: 20, // Give AI more iterations for workspace setup
      }
    );

    console.log('[AI Bootstrap] AI result:', result);

    if (result.success) {
      console.log('[AI Bootstrap] ✓ Workspace created successfully');
      console.log('[AI Bootstrap] Files created:', result.files?.join(', '));
    } else {
      console.error('[AI Bootstrap] ✗ Workspace creation failed:', result.message);
    }

    return result;

  } catch (error) {
    console.error('[AI Bootstrap] ✗ Error during AI bootstrap:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error during AI bootstrap',
      error: error instanceof Error ? error.stack : undefined,
    };
  }
}

/**
 * Manual workspace bootstrap
 * Fast, deterministic file generation
 */
export async function bootstrapWorkspaceManual(
  sandboxId: string,
  workspaceName: string
): Promise<WorkspaceBootstrapResult> {
  console.log('[Manual Bootstrap] Starting manual workspace bootstrap...');
  console.log('[Manual Bootstrap] Sandbox ID:', sandboxId);
  console.log('[Manual Bootstrap] Workspace name:', workspaceName);

  try {
    // Generate template files
    const files = [];
    
    // Generate config files inline
    const packageJson = JSON.stringify({
      name: workspaceName,
      version: "0.1.0",
      private: true,
      scripts: {
        dev: `next dev --port 3000`,
        build: "next build",
        start: "next start",
        lint: "next lint"
      },
      dependencies: {
        "next": "14.2.35",
        "react": "^18",
        "react-dom": "^18",
        "clsx": "^2.1.1",
        "tailwind-merge": "^2.5.4",
      },
      devDependencies: {
        "@types/node": "^20",
        "@types/react": "^18",
        "@types/react-dom": "^18",
        "eslint": "^8",
        "eslint-config-next": "14.2.16",
        "postcss": "^8",
        "tailwindcss": "^3.4.1",
        "typescript": "^5"
      }
    }, null, 2);

    const nextConfig = `/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
`;

    const tailwindConfig = `import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
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
`;

    const tsConfig = `{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
`;

    const postCssConfig = `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`;

    const libUtils = `import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
`;

    files.push(
      { path: 'package.json', content: packageJson },
      { path: 'next.config.mjs', content: nextConfig },
      { path: 'tailwind.config.ts', content: tailwindConfig },
      { path: 'tsconfig.json', content: tsConfig },
      { path: 'postcss.config.mjs', content: postCssConfig },
      { path: 'lib/utils.ts', content: libUtils },
    );

    // Add app files
    files.push(
      {
        path: 'app/page.tsx',
        content: `export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
      <h1 className="text-6xl font-bold text-white">Hello COCO!</h1>
    </div>
  );
}`,
      },
      {
        path: 'app/layout.tsx',
        content: `import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "COCO App",
  description: "Built with COCO",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}`,
      },
      {
        path: 'app/globals.css',
        content: `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
  }
  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
  }
}

@layer base {
  * { @apply border-border; }
  body { @apply bg-background text-foreground; }
}`,
      }
    );

    console.log(`[Manual Bootstrap] Generated ${files.length} files`);

    // Write files to sandbox
    console.log('[Manual Bootstrap] Writing files to sandbox...');
    await E2BManager.writeFiles(sandboxId, files);
    console.log('[Manual Bootstrap] ✓ Files written');

    // Start dev server
    console.log('[Manual Bootstrap] Starting dev server...');
    await E2BManager.startDevServer(sandboxId, 3000);
    console.log('[Manual Bootstrap] ✓ Dev server started');

    return {
      success: true,
      message: 'Workspace created successfully with manual bootstrap',
      files: files.map(f => f.path),
      mode: 'manual',
    };

  } catch (error) {
    console.error('[Manual Bootstrap] ✗ Error during manual bootstrap:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error during manual bootstrap',
      error: error instanceof Error ? error.stack : undefined,
      mode: 'manual',
    };
  }
}

/**
 * Main bootstrap function - chooses mode based on environment
 */
export async function bootstrapWorkspace(
  sandboxId: string,
  workspaceName: string
): Promise<WorkspaceBootstrapResult> {
  const mode = process.env.BOOTSTRAP_MODE || 'manual';
  
  console.log(`[Bootstrap] Using ${mode} mode`);

  if (mode === 'ai') {
    return await bootstrapWorkspaceWithAI(sandboxId, workspaceName);
  } else {
    return await bootstrapWorkspaceManual(sandboxId, workspaceName);
  }
}
