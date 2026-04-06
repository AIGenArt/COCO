import { nanoid } from "nanoid";
import { FileTree, FileNode } from "./types";

export const generateId = () => nanoid(10);

export function createInitialFileTree(): FileTree {
  const now = Date.now();

  const ids = {
    app: generateId(), components: generateId(), lib: generateId(), hooks: generateId(),
    appPage: generateId(), appLayout: generateId(), globals: generateId(),
    utils: generateId(), useMobile: generateId(), useToast: generateId(),
    tailwind: generateId(), tsconfig: generateId(), nextConfig: generateId(), postcss: generateId(),
  };

  const nodes: Record<string, FileNode> = {

    // ── app/ ──────────────────────────────────────────────
    [ids.app]: {
      id: ids.app, name: "app", type: "folder", path: "app",
      parentId: null, children: [ids.appPage, ids.appLayout, ids.globals],
      createdAt: now, updatedAt: now,
    },
    [ids.appPage]: {
      id: ids.appPage, name: "page.tsx", type: "file", path: "app/page.tsx",
      parentId: ids.app,
      content: `export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
      <h1 className="text-6xl font-bold text-white">Hello COCO!</h1>
    </div>
  );
}`,
      createdAt: now, updatedAt: now,
    },
    [ids.appLayout]: {
      id: ids.appLayout, name: "layout.tsx", type: "file", path: "app/layout.tsx",
      parentId: ids.app,
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
      createdAt: now, updatedAt: now,
    },
    [ids.globals]: {
      id: ids.globals, name: "globals.css", type: "file", path: "app/globals.css",
      parentId: ids.app,
      content: `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;
  }
  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 212.7 26.8% 83.9%;
  }
}

@layer base {
  * { @apply border-border; }
  body { @apply bg-background text-foreground; }
}`,
      createdAt: now, updatedAt: now,
    },

    // ── components/ ───────────────────────────────────────
    [ids.components]: {
      id: ids.components, name: "components", type: "folder", path: "components",
      parentId: null, children: [], createdAt: now, updatedAt: now,
    },

    // ── lib/ ──────────────────────────────────────────────
    [ids.lib]: {
      id: ids.lib, name: "lib", type: "folder", path: "lib",
      parentId: null, children: [ids.utils], createdAt: now, updatedAt: now,
    },
    [ids.utils]: {
      id: ids.utils, name: "utils.ts", type: "file", path: "lib/utils.ts",
      parentId: ids.lib,
      content: `import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}`,
      createdAt: now, updatedAt: now,
    },

    // ── hooks/ ────────────────────────────────────────────
    [ids.hooks]: {
      id: ids.hooks, name: "hooks", type: "folder", path: "hooks",
      parentId: null, children: [ids.useMobile, ids.useToast],
      createdAt: now, updatedAt: now,
    },
    [ids.useMobile]: {
      id: ids.useMobile, name: "use-mobile.tsx", type: "file", path: "hooks/use-mobile.tsx",
      parentId: ids.hooks,
      content: `import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(\`(max-width: \${MOBILE_BREAKPOINT - 1}px)\`)
    const onChange = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}`,
      createdAt: now, updatedAt: now,
    },
    [ids.useToast]: {
      id: ids.useToast, name: "use-toast.ts", type: "file", path: "hooks/use-toast.ts",
      parentId: ids.hooks,
      content: `import * as React from "react"

export function useToast() {
  const [toasts, setToasts] = React.useState<string[]>([])
  const toast = (message: string) => setToasts((t) => [...t, message])
  return { toasts, toast }
}`,
      createdAt: now, updatedAt: now,
    },

    // ── config files ──────────────────────────────────────
    [ids.tailwind]: {
      id: ids.tailwind, name: "tailwind.config.ts", type: "file", path: "tailwind.config.ts",
      parentId: null,
      content: `import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;`,
      createdAt: now, updatedAt: now,
    },
    [ids.tsconfig]: {
      id: ids.tsconfig, name: "tsconfig.json", type: "file", path: "tsconfig.json",
      parentId: null,
      content: `{
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
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}`,
      createdAt: now, updatedAt: now,
    },
    [ids.nextConfig]: {
      id: ids.nextConfig, name: "next.config.mjs", type: "file", path: "next.config.mjs",
      parentId: null,
      content: `/** @type {import('next').NextConfig} */
const nextConfig = { reactStrictMode: true };
export default nextConfig;`,
      createdAt: now, updatedAt: now,
    },
    [ids.postcss]: {
      id: ids.postcss, name: "postcss.config.mjs", type: "file", path: "postcss.config.mjs",
      parentId: null,
      content: `export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};`,
      createdAt: now, updatedAt: now,
    },
  };

  return {
    nodes,
    rootIds: [
      ids.app, ids.components, ids.lib, ids.hooks,
      ids.tailwind, ids.tsconfig, ids.nextConfig, ids.postcss,
    ],
  };
}
