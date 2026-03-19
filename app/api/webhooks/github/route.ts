import { NextResponse } from "next/server";
import { logger } from "../../../lib/logger";
import { processGitHubWebhook, verifyGitHubWebhookSignature } from "../../../lib/github/github-webhooks";

function invalidWebhookResponse(code: string, message: string, status: number) {
  return NextResponse.json({ success: false, error: { code, message } }, { status });
}

export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  const deliveryId = request.headers.get("x-github-delivery");
  const eventType = request.headers.get("x-github-event");

  if (!verifyGitHubWebhookSignature(payload, signature)) {
    return invalidWebhookResponse("invalid_signature", "Invalid webhook signature", 401);
  }

  if (!deliveryId || !eventType) {
    return invalidWebhookResponse("invalid_webhook", "Missing GitHub delivery headers", 400);
  }

  let parsedPayload: Record<string, unknown>;
  try {
    parsedPayload = JSON.parse(payload) as Record<string, unknown>;
  } catch (error) {
    logger.warn({ deliveryId, eventType, error }, "Received invalid GitHub webhook JSON payload");
    return invalidWebhookResponse("invalid_payload", "Invalid webhook payload", 400);
  }

  try {
    const result = await processGitHubWebhook({
      deliveryId,
      eventType,
      payload: parsedPayload
    });

    return NextResponse.json({ success: true, duplicate: result.duplicate }, { status: result.duplicate ? 200 : 202 });
  } catch (error) {
    logger.error({ deliveryId, eventType, error }, "GitHub webhook handler failed");
    return invalidWebhookResponse("webhook_processing_failed", "Webhook processing failed", 500);
  }
}
