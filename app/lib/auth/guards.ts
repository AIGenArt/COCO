import { createServerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { User } from "@supabase/supabase-js";
import { config } from "../config";

export async function requireUser(): Promise<User> {
  const cookieStore = await cookies();
  const cookieMethods = {
    getAll: () => {
      return cookieStore.getAll().map((c) => ({ name: c.name, value: c.value }));
    },
    setAll: (newCookies: { name: string; value: string; options: any }[]) => {
      for (const cookie of newCookies) {
        cookieStore.set(cookie.name, cookie.value, cookie.options);
      }
    }
  };

  const supabase = createServerClient(
    config.NEXT_PUBLIC_SUPABASE_URL,
    config.SUPABASE_SERVICE_ROLE_KEY,
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
  return NextResponse.json({ success: false, error: { code: "unauthorized", message: "Unauthorized" } }, { status: 401 });
}
