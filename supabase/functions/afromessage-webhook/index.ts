// supabase/functions/afromessage-webhook/index.ts

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Function to verify webhook signature (if AfroMessage supports it)
// You'll need to get the webhook secret from your AfroMessage dashboard
const verifyWebhookSignature = (payload: string, signature: string, secret: string): boolean => {
  // This is a placeholder. You'll need to implement the actual signature
  // verification logic based on AfroMessage's documentation.
  // Typically involves hashing the payload with the secret and comparing.
  console.warn("Webhook signature verification is a placeholder. Implement actual logic.");
  return true; // For now, always return true, but DO NOT do this in production without proper verification
};

serve(async (req) => {
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

    const payload = await req.json();
    console.log("Received webhook payload:", payload);

    // Optional: Webhook signature verification
    const signature = req.headers.get("x-afromessage-signature"); // Check AfroMessage docs for actual header name
    const webhookSecret = Deno.env.get("AFROMESSAGE_WEBHOOK_SECRET");

    if (signature && webhookSecret) {
      const isValid = verifyWebhookSignature(JSON.stringify(payload), signature, webhookSecret);
      if (!isValid) {
        console.warn("Invalid webhook signature.");
        return new Response("Invalid signature", { status: 401 });
      }
    }

    // Extract relevant information from the webhook payload
    // Adjust these paths based on the actual AfroMessage webhook payload structure
    const messageId = payload.message_id || payload.data?.message_id; // AfroMessage's message ID
    const status = payload.status || payload.data?.status; // e.g., 'DELIVERED', 'FAILED'
    const deliveredAt = payload.delivered_at || payload.data?.delivered_at;
    const errorMessage = payload.error_message || payload.data?.error_message;
    const customParameters = payload.custom_parameters || payload.data?.custom_parameters;

    const notificationId = customParameters?.notification_id; // Our internal notification ID

    if (!notificationId || !status) {
      console.warn("Missing notification_id or status in webhook payload.", payload);
      return new Response("Missing required data", { status: 400 });
    }

    let newSmsStatus: string;
    let newStatus: string;

    switch (status.toUpperCase()) {
      case "DELIVERED":
        newSmsStatus = "delivered";
        newStatus = "delivered";
        break;
      case "FAILED":
      case "UNDELIVERED": // Example of another possible failed status
        newSmsStatus = "failed";
        newStatus = "failed";
        break;
      case "SENT":
      case "PENDING":
      case "QUEUED":
        newSmsStatus = status.toLowerCase();
        newStatus = "pending"; // Keep as pending until delivered or failed
        break;
      default:
        console.warn("Unknown SMS status received:", status);
        newSmsStatus = status.toLowerCase();
        newStatus = "pending";
    }

    // Update notification status in database
    const { data: updatedNotification, error: updateError } = await supabase
      .from("notifications")
      .update({
        sms_status: newSmsStatus,
        status: newStatus,
        delivered_at: newSmsStatus === "delivered" ? deliveredAt : null,
        error_message: errorMessage,
      })
      .eq("id", notificationId)
      .select();

    if (updateError) {
      console.error("Error updating notification status:", updateError);
      return new Response("Failed to update notification status", { status: 500 });
    }

    // Log delivery event
    await supabase.from("notification_delivery_logs").insert({
      notification_id: notificationId,
      channel: "sms",
      status: newSmsStatus,
      provider_response: payload,
      error_message: errorMessage,
    });

    return new Response("Webhook received and processed", { status: 200 });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});