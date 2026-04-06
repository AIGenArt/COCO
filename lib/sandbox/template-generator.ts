/**
 * Template Generator
 * 
 * Generates config files for new workspaces
 */

import { promises as fs } from 'fs';
import path from 'path';

export async function generatePackageJson(
  workspacePath: string,
  workspaceId: string,
  port: number
): Promise<void> {
  const packageJson = {
    name: workspaceId,
    version: "0.1.0",
    private: true,
    scripts: {
      dev: `next dev --port ${port}`,
      build: "next build",
      start: "next start",
      lint: "next lint"
    },
    dependencies: {
      "@radix-ui/react-accordion": "^1.2.1",
      "@radix-ui/react-alert-dialog": "^1.1.2",
      "@radix-ui/react-aspect-ratio": "^1.1.0",
      "@radix-ui/react-avatar": "^1.1.1",
      "@radix-ui/react-checkbox": "^1.1.2",
      "@radix-ui/react-collapsible": "^1.1.1",
      "@radix-ui/react-context-menu": "^2.2.2",
      "@radix-ui/react-dialog": "^1.1.2",
      "@radix-ui/react-dropdown-menu": "^2.1.2",
      "@radix-ui/react-hover-card": "^1.1.2",
      "@radix-ui/react-icons": "^1.3.1",
      "@radix-ui/react-label": "^2.1.8",
      "@radix-ui/react-menubar": "^1.1.2",
      "@radix-ui/react-navigation-menu": "^1.2.1",
      "@radix-ui/react-popover": "^1.1.2",
      "@radix-ui/react-progress": "^1.1.0",
      "@radix-ui/react-radio-group": "^1.2.1",
      "@radix-ui/react-scroll-area": "^1.2.0",
      "@radix-ui/react-select": "^2.1.2",
      "@radix-ui/react-separator": "^1.1.0",
      "@radix-ui/react-slider": "^1.2.1",
      "@radix-ui/react-slot": "^1.2.4",
      "@radix-ui/react-switch": "^1.1.1",
      "@radix-ui/react-tabs": "^1.1.1",
      "@radix-ui/react-toast": "^1.2.2",
      "@radix-ui/react-toggle": "^1.1.0",
      "@radix-ui/react-toggle-group": "^1.1.0",
      "@radix-ui/react-tooltip": "^1.1.3",
      "class-variance-authority": "^0.7.0",
      "clsx": "^2.1.1",
      "cmdk": "^1.0.0",
      "date-fns": "^3.6.0",
      "embla-carousel-react": "^8.3.1",
      "input-otp": "^1.2.5",
      "lucide-react": "^0.454.0",
      "next": "14.2.35",
      "next-themes": "^0.3.0",
      "react": "^18",
      "react-day-picker": "^8.10.1",
      "react-dom": "^18",
      "react-hook-form": "^7.53.1",
      "react-resizable-panels": "^2.1.6",
      "recharts": "^2.13.2",
      "sonner": "^1.5.0",
      "tailwind-merge": "^2.5.4",
      "tailwindcss-animate": "^1.0.7",
      "vaul": "^1.1.1"
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
  };

  await fs.writeFile(
    path.join(workspacePath, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );
}

export async function generateNextConfig(workspacePath: string): Promise<void> {
  const content = `/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
`;

  await fs.writeFile(path.join(workspacePath, 'next.config.mjs'), content);
}

export async function generateTailwindConfig(workspacePath: string): Promise<void> {
  const content = `import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
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
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
`;

  await fs.writeFile(path.join(workspacePath, 'tailwind.config.ts'), content);
}

export async function generateTsConfig(workspacePath: string): Promise<void> {
  const content = `{
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

  await fs.writeFile(path.join(workspacePath, 'tsconfig.json'), content);
}

export async function generatePostCssConfig(workspacePath: string): Promise<void> {
  const content = `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`;

  await fs.writeFile(path.join(workspacePath, 'postcss.config.mjs'), content);
}

export async function generateLibUtils(workspacePath: string): Promise<void> {
  const libDir = path.join(workspacePath, 'lib');
  await fs.mkdir(libDir, { recursive: true });

  const content = `import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
`;

  await fs.writeFile(path.join(libDir, 'utils.ts'), content);
}

export async function generateHooks(workspacePath: string): Promise<void> {
  const hooksDir = path.join(workspacePath, 'hooks');
  await fs.mkdir(hooksDir, { recursive: true });

  // use-mobile.tsx
  const useMobile = `import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(\`(max-width: \${MOBILE_BREAKPOINT - 1}px)\`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}
`;

  await fs.writeFile(path.join(hooksDir, 'use-mobile.tsx'), useMobile);

  // use-toast.ts
  const useToast = `import * as React from "react"

import type { ToastActionElement, ToastProps } from "@/components/ui/toast"

const TOAST_LIMIT = 1
const TOAST_REMOVE_DELAY = 1000000

type ToasterToast = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
}

const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const

let count = 0

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return count.toString()
}

type ActionType = typeof actionTypes

type Action =
  | {
      type: ActionType["ADD_TOAST"]
      toast: ToasterToast
    }
  | {
      type: ActionType["UPDATE_TOAST"]
      toast: Partial<ToasterToast>
    }
  | {
      type: ActionType["DISMISS_TOAST"]
      toastId?: ToasterToast["id"]
    }
  | {
      type: ActionType["REMOVE_TOAST"]
      toastId?: ToasterToast["id"]
    }

interface State {
  toasts: ToasterToast[]
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) {
    return
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId)
    dispatch({
      type: "REMOVE_TOAST",
      toastId: toastId,
    })
  }, TOAST_REMOVE_DELAY)

  toastTimeouts.set(toastId, timeout)
}

export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "ADD_TOAST":
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      }

    case "UPDATE_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      }

    case "DISMISS_TOAST": {
      const { toastId } = action

      if (toastId) {
        addToRemoveQueue(toastId)
      } else {
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id)
        })
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false,
              }
            : t
        ),
      }
    }
    case "REMOVE_TOAST":
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        }
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      }
  }
}

const listeners: Array<(state: State) => void> = []

let memoryState: State = { toasts: [] }

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action)
  listeners.forEach((listener) => {
    listener(memoryState)
  })
}

type Toast = Omit<ToasterToast, "id">

function toast({ ...props }: Toast) {
  const id = genId()

  const update = (props: ToasterToast) =>
    dispatch({
      type: "UPDATE_TOAST",
      toast: { ...props, id },
    })
  const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id })

  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss()
      },
    },
  })

  return {
    id: id,
    dismiss,
    update,
  }
}

function useToast() {
  const [state, setState] = React.useState<State>(memoryState)

  React.useEffect(() => {
    listeners.push(setState)
    return () => {
      const index = listeners.indexOf(setState)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }, [state])

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId }),
  }
}

export { useToast, toast }
`;

  await fs.writeFile(path.join(hooksDir, 'use-toast.ts'), useToast);
}
