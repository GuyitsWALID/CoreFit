// supabase/functions/afromessage-webhook/index.ts

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Function to verify webhook signature (placeholder)
// Replace with REAL implementation using AfroMessage docs!
const verifyWebhookSignature = (payload: string, signature: string, secret: string): boolean => {
  // Placeholder: Implement actual verification logic for security
  console.warn("Webhook signature verification is a placeholder. Implement actual logic.");
  return true;
};

serve(async (req: Request) => {
  try {
    // Handle CORS preflight requests
    if (req.method === "OPTIONS") {
      return new Response("ok", {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        },
      });
    }

    // Parse incoming webhook payload
    const payload = await req.json();
    console.log("Received webhook payload:", payload);

    // Optional: Webhook signature verification
    const signature = req.headers.get("x-afromessage-signature"); // Use correct header from docs!
    const webhookSecret = Deno.env.get("AFROMESSAGE_WEBHOOK_SECRET");

    if (signature && webhookSecret) {
      const isValid = verifyWebhookSignature(JSON.stringify(payload), signature, webhookSecret);
      if (!isValid) {
        console.warn("Invalid webhook signature received.");
        return new Response("Invalid signature", { status: 401 });
      }
    }

    // Extract necessary fields (update paths based on actual AfroMessage webhook fields!)
    const messageId = payload.message_id || payload.data?.message_id;
    const status = payload.status || payload.data?.status;
    const deliveredAt = payload.delivered_at || payload.data?.delivered_at;
    const errorMessage = payload.error_message || payload.data?.error_message;
    const customParameters = payload.custom_parameters || payload.data?.custom_parameters;

    const notificationId = customParameters?.notification_id;

    if (!notificationId || !status) {
      console.warn("Missing notification_id or status in webhook payload.", payload);
      return new Response("Missing required data", { status: 400 });
    }

    // Determine new statuses for our system
    let newSmsStatus: string;
    let newStatus: string;

    switch (status.toUpperCase()) {
      case "DELIVERED":
        newSmsStatus = "delivered";
        newStatus = "delivered";
        break;
      case "FAILED":
      case "UNDELIVERED":
        newSmsStatus = "failed";
        newStatus = "failed";
        break;
      case "SENT":
      case "PENDING":
      case "QUEUED":
        newSmsStatus = status.toLowerCase();
        newStatus = "pending";
        break;
      default:
        console.warn("Unknown SMS status received:", status);
        newSmsStatus = status.toLowerCase();
        newStatus = "pending";
    }

    // Update notification record in database
    const { error: updateError } = await supabase
      .from("notifications")
      .update({
        sms_status: newSmsStatus,
        status: newStatus,
        delivered_at: newSmsStatus === "delivered" ? deliveredAt : null,
        error_message: errorMessage,
      })
      .eq("id", notificationId);

    if (updateError) {
      console.error("Error updating notification status:", updateError);
      return new Response("Failed to update notification status", { status: 500 });
    }

    // Log the delivery event always
    await supabase.from("notification_delivery_logs").insert({
      notification_id: notificationId,
      channel: "sms",
      status: newSmsStatus,
      provider_response: payload,
      error_message: errorMessage,
    });

    return new Response("Webhook received and processed", { status: 200 });
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Error processing webhook:", error.message, error.stack);
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    } else {
      console.error("Unknown error processing webhook:", error);
      return new Response(JSON.stringify({ error: "An unknown error occurred" }), { status: 500 });
    }
  }
});
