import { NextResponse } from "next/server";
import { logger } from "../../../lib/logger";
import { processGitHubWebhook, verifyGitHubWebhookSignature } from "../../../lib/github/github-webhooks";

export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  const deliveryId = request.headers.get("x-github-delivery");
  const eventType = request.headers.get("x-github-event");

  if (!verifyGitHubWebhookSignature(payload, signature)) {
    return NextResponse.json({ success: false, error: { code: "invalid_signature", message: "Invalid webhook signature" } }, { status: 401 });
  }

  if (!deliveryId || !eventType) {
    return NextResponse.json({ success: false, error: { code: "invalid_webhook", message: "Missing GitHub delivery headers" } }, { status: 400 });
  }

  try {
    const parsedPayload = JSON.parse(payload) as Record<string, unknown>;
    const result = await processGitHubWebhook({
      deliveryId,
      eventType,
      payload: parsedPayload
    });

    return NextResponse.json({ success: true, duplicate: result.duplicate }, { status: result.duplicate ? 200 : 202 });
  } catch (error) {
    logger.error({ deliveryId, eventType, error }, "GitHub webhook handler failed");
    return NextResponse.json({ success: false, error: { code: "webhook_processing_failed", message: "Webhook processing failed" } }, { status: 500 });
  }
}
