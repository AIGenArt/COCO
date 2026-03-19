import { getBucketState, upsertBucketState } from "../db/github";
import { logger } from "../logger";
import { GitHubBucketKey, RateLimitState } from "./types";

export class GitHubRateLimitError extends Error {
  constructor(message: string, readonly retryAfterUntil: string | null = null) {
    super(message);
    this.name = "GitHubRateLimitError";
  }
}

export type HeadersLike = Headers | Record<string, string | null | undefined>;

function headerValue(headers: HeadersLike, name: string): string | null {
  if (headers instanceof Headers) {
    return headers.get(name);
  }

  const value = headers[name] ?? headers[name.toLowerCase()];
  return typeof value === "string" ? value : null;
}

function toIsoFromSeconds(seconds: number | null): string | null {
  if (seconds === null || Number.isNaN(seconds)) {
    return null;
  }

  return new Date(seconds * 1000).toISOString();
}

function addSeconds(seconds: number): string {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

function computeJitterMs(maxMs = 500): number {
  return Math.floor(Math.random() * maxMs);
}

export function computeBackoffDelayMs(attempt: number): number {
  const base = [2_000, 5_000, 15_000][Math.min(attempt, 2)] ?? 15_000;
  return base + computeJitterMs();
}

export class GitHubRateLimiter {
  async beforeRequest(bucket: GitHubBucketKey): Promise<void> {
    const state = await getBucketState(bucket);
    const now = Date.now();
    const blockedUntil = [state?.retry_after_until, state?.secondary_limited_until]
      .filter((value): value is string => Boolean(value))
      .map((value) => new Date(value).getTime())
      .filter((value) => !Number.isNaN(value))
      .sort((a, b) => b - a)[0];

    if (blockedUntil && blockedUntil > now) {
      throw new GitHubRateLimitError(`GitHub bucket ${bucket} is temporarily blocked`, new Date(blockedUntil).toISOString());
    }

    if (state?.remaining === 0 && state.reset_at) {
      const resetAt = new Date(state.reset_at).getTime();
      if (!Number.isNaN(resetAt) && resetAt > now) {
        throw new GitHubRateLimitError(`GitHub bucket ${bucket} exhausted`, state.reset_at);
      }
    }
  }

  async afterResponse(bucket: GitHubBucketKey, headers: HeadersLike, status: number): Promise<RateLimitState> {
    const retryAfterSeconds = Number.parseInt(headerValue(headers, "retry-after") ?? "", 10);
    const remaining = Number.parseInt(headerValue(headers, "x-ratelimit-remaining") ?? "", 10);
    const resetSeconds = Number.parseInt(headerValue(headers, "x-ratelimit-reset") ?? "", 10);
    const retryAfterUntil = Number.isFinite(retryAfterSeconds) ? addSeconds(retryAfterSeconds) : null;
    const resetAt = Number.isFinite(resetSeconds) ? toIsoFromSeconds(resetSeconds) : null;
    const secondaryLimitedUntil = status === 403 && retryAfterUntil ? retryAfterUntil : null;

    const nextState = {
      bucket_key: bucket,
      remaining: Number.isFinite(remaining) ? remaining : null,
      reset_at: resetAt,
      retry_after_until: retryAfterUntil,
      secondary_limited_until: secondaryLimitedUntil,
      updated_at: new Date().toISOString()
    } as const;

    await upsertBucketState(nextState);
    return {
      remaining: nextState.remaining,
      resetAt: nextState.reset_at,
      retryAfterUntil: nextState.retry_after_until,
      secondaryLimitedUntil: nextState.secondary_limited_until
    };
  }

  async markFailure(bucket: GitHubBucketKey, error: unknown, attempt = 0): Promise<RateLimitState | null> {
    const parsed = parseRateLimitFailure(error, attempt);
    if (!parsed) {
      return null;
    }

    await upsertBucketState({
      bucket_key: bucket,
      remaining: parsed.remaining,
      reset_at: parsed.resetAt,
      retry_after_until: parsed.retryAfterUntil,
      secondary_limited_until: parsed.secondaryLimitedUntil,
      updated_at: new Date().toISOString()
    });

    logger.warn({ bucket, ...parsed }, "GitHub rate limit encountered");
    return parsed;
  }
}

export function parseRateLimitFailure(error: unknown, attempt = 0): RateLimitState | null {
  if (!(error instanceof Error)) {
    return null;
  }

  const maybeStatus = Reflect.get(error, "status");
  const maybeHeaders = Reflect.get(error, "headers") as HeadersLike | undefined;
  const status = typeof maybeStatus === "number" ? maybeStatus : null;
  const retryAfterHeader = maybeHeaders ? headerValue(maybeHeaders, "retry-after") : null;
  const resetHeader = maybeHeaders ? headerValue(maybeHeaders, "x-ratelimit-reset") : null;
  const remainingHeader = maybeHeaders ? headerValue(maybeHeaders, "x-ratelimit-remaining") : null;
  const retryAfterSeconds = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) : Number.NaN;
  const resetSeconds = resetHeader ? Number.parseInt(resetHeader, 10) : Number.NaN;
  const remaining = remainingHeader ? Number.parseInt(remainingHeader, 10) : Number.NaN;
  const message = error.message.toLowerCase();
  const isRateLimited =
    status === 429 ||
    (status === 403 && (message.includes("secondary rate limit") || message.includes("rate limit") || retryAfterHeader !== null)) ||
    remaining === 0;

  if (!isRateLimited) {
    return null;
  }

  const fallbackDelayMs = computeBackoffDelayMs(attempt);
  const retryAfterUntil = Number.isFinite(retryAfterSeconds)
    ? addSeconds(retryAfterSeconds)
    : new Date(Date.now() + fallbackDelayMs).toISOString();
  const resetAt = Number.isFinite(resetSeconds) ? toIsoFromSeconds(resetSeconds) : null;

  return {
    remaining: Number.isFinite(remaining) ? remaining : null,
    resetAt,
    retryAfterUntil,
    secondaryLimitedUntil: status === 403 ? retryAfterUntil : null
  };
}

const rateLimiterSingleton = new GitHubRateLimiter();

export function getGitHubRateLimiter() {
  return rateLimiterSingleton;
}
