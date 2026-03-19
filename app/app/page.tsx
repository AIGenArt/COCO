import AuthShell from "../components/AuthShell";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="w-full max-w-2xl rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <header className="mb-6 space-y-2">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            COCO — AI Coding Workspace
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Secure sandboxed workspaces with GitHub App integration.
          </p>
        </header>

        <AuthShell />

        <section className="mt-8 rounded-md bg-zinc-50 p-4 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          <p>
            Before you start working, make sure you follow the docs in <code>/docs/boot.md</code>.
          </p>
        </section>
      </main>
    </div>
  );
}
