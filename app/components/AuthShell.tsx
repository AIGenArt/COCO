"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "../lib/supabase/browser-client";

export default function AuthShell() {
  const [user, setUser] = useState<null | { id: string; email?: string | null }>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    async function load() {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      setUser(session?.user ?? null);
      setLoading(false);
    }

    load();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const signIn = async () => {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signInWithOAuth({ provider: "github" });
  };

  const signOut = async () => {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
  };

  if (loading) {
    return <div>Loading…</div>;
  }

  return (
    <div className="p-6">
      {user ? (
        <div className="space-y-4">
          <div>
            <div className="text-sm text-slate-600">Signed in as</div>
            <div className="text-lg font-semibold">{user.email ?? user.id}</div>
          </div>
          <button
            type="button"
            className="rounded bg-slate-900 px-4 py-2 text-white hover:bg-slate-800"
            onClick={signOut}
          >
            Sign out
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-slate-600">Sign in with GitHub to continue.</div>
          <button
            type="button"
            className="rounded bg-black px-4 py-2 text-white hover:bg-slate-800"
            onClick={signIn}
          >
            Sign in with GitHub
          </button>
        </div>
      )}
    </div>
  );
}
