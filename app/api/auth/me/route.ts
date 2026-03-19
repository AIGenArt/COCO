import { NextResponse } from "next/server";
import { requireUser } from "../../../lib/auth/guards";
import { ensureProfile } from "../../../lib/db/profiles";

export async function GET() {
  try {
    const user = await requireUser();

    const githubIdentity = (user.identities ?? []).find((i) => i.provider === "github");
    const githubId = githubIdentity?.identity_data?.id ?? user.id;
    const githubLogin =
      githubIdentity?.identity_data?.login ?? user.email ?? "";

    const githubAvatarUrl =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (user.user_metadata as any)?.avatar_url ?? null;

    const profile = await ensureProfile(githubId, githubId, githubLogin, githubAvatarUrl);

    return NextResponse.json({ success: true, data: { user, profile } });
  } catch (error) {
    return NextResponse.json({ success: false, error: { code: "unauthorized", message: "Unauthorized" } }, { status: 401 });
  }
}
