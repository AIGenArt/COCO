import { createServerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { User } from "@supabase/supabase-js";
import { getPublicConfig } from "../config/public";

type CookieMutation = {
  name: string;
  value: string;
  options: Parameters<Awaited<ReturnType<typeof cookies>>["set"]>[2];
};

export async function requireUser(): Promise<User> {
  const cookieStore = await cookies();
  const cookieMethods = {
    getAll: () => cookieStore.getAll().map((cookie) => ({ name: cookie.name, value: cookie.value })),
    setAll: (newCookies: CookieMutation[]) => {
      for (const cookie of newCookies) {
        cookieStore.set(cookie.name, cookie.value, cookie.options);
      }
    }
  };

  const config = getPublicConfig();

  const supabase = createServerClient(
    config.NEXT_PUBLIC_SUPABASE_URL,
    config.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: cookieMethods }
  );

  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Unauthorized");
  }

  return user;
}

export function unauthorizedResponse(): NextResponse {
  return NextResponse.json(
    { success: false, error: { code: "unauthorized", message: "Unauthorized" } },
    { status: 401 }
  );
}