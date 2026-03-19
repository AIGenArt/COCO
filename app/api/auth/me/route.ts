import { NextResponse } from "next/server";
import { requireUser } from "../../../lib/auth/guards";
import { ensureProfile } from "../../../lib/db/profiles";

type GithubUserMetadata = {
  avatar_url?: string | null;
};

export async function GET() {
  try {
    const user = await requireUser();

    const githubIdentity = (user.identities ?? []).find((identity) => identity.provider === "github");
    const githubId = githubIdentity?.identity_data?.id ?? user.id;
    const githubLogin = githubIdentity?.identity_data?.login ?? user.email ?? "";
    const userMetadata = (user.user_metadata ?? {}) as GithubUserMetadata;
    const githubAvatarUrl = userMetadata.avatar_url ?? null;

    const profile = await ensureProfile(githubId, githubId, githubLogin, githubAvatarUrl);

    return NextResponse.json({ success: true, data: { user, profile } });
  } catch {
    return NextResponse.json({ success: false, error: { code: "unauthorized", message: "Unauthorized" } }, { status: 401 });
  }
}
