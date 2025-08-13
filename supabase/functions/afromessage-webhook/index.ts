// supabase/functions/afromessage-webhook/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";

// CORS headers (keep '*' for testing; restrict in production)
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false } }
);

// Map provider statuses to our internal status values (simple mapping)
function normalizeStatus(raw?: string | null) {
  if (!raw) return "unknown";
  const s = String(raw).toLowerCase();
  if (["delivered", "deliv", "del"].some(k => s.includes(k))) return "delivered";
  if (["failed", "failed_to", "undelivered", "error"].some(k => s.includes(k))) return "failed";
  if (["sent", "queued", "accepted"].some(k => s.includes(k))) return "sent";
  return s;
}

serve(async (req: Request) => {
  // Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed. Use POST." }), {
      status: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch (err) {
    console.error("Invalid JSON payload for afromessage-webhook:", err);
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  console.log("AfroMessage Webhook Payload:", JSON.stringify(payload));

  try {
    // Common webhook fields (adapt to actual AfroMessage shape)
    const messageId = payload?.message_id ?? payload?.sms_id ?? payload?.id ?? null;
    const campaignId = payload?.campaign_id ?? payload?.bulk_id ?? null;
    const toNumber = payload?.to ?? payload?.recipient ?? payload?.msisdn ?? null;
    const rawStatus = payload?.status ?? payload?.state ?? null;
    const status = normalizeStatus(rawStatus);
    const deliveredAt = payload?.delivered_at ?? payload?.timestamp ?? new Date().toISOString();
    const errorReason = payload?.error_reason ?? payload?.reason ?? null;

    // Helper to find notification id by provider id or by recipient phone + recent records
    async function findNotificationIdByProviderId(providerId: string | null) {
      if (!providerId) return null;
      const res = await supabaseAdmin
        .from("notifications")
        .select("id")
        .eq("sms_provider_id", providerId)
        .limit(1)
        .maybeSingle();
      return res.data?.id ?? null;
    }

    async function findNotificationIdByPhone(phone: string | null) {
      if (!phone) return null;
      const res = await supabaseAdmin
        .from("notifications")
        .select("id")
        .eq("recipient_phone", phone)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return res.data?.id ?? null;
    }

    // Decide how to update
    if (messageId) {
      // Single SMS status update
      const notifId = await findNotificationIdByProviderId(messageId) ?? await findNotificationIdByPhone(toNumber);
      if (notifId) {
        const updatePayload: any = {
          sms_status: status,
          status: status === "delivered" ? "delivered" : status === "sent" ? "sent" : "failed",
          delivered_at: deliveredAt,
          metadata: { ...(payload ?? {}) },
        };
        const { error: updateError } = await supabaseAdmin.from("notifications").update(updatePayload).eq("id", notifId);
        if (updateError) console.error("Error updating notification (single):", updateError.message);
      } else {
        console.warn("No matching notification found for messageId:", messageId, "to:", toNumber);
      }

      // Insert delivery log (attach notification_id if found)
      const notifIdForLog = await findNotificationIdByProviderId(messageId) ?? await findNotificationIdByPhone(toNumber);
      const { error: logError } = await supabaseAdmin.from("notification_delivery_logs").insert({
        notification_id: notifIdForLog,
        channel: "sms",
        status: status,
        provider_response: payload,
        error_message: status === "failed" ? errorReason : null,
        attempt_number: 1,
        received_at: new Date().toISOString(),
      });
      if (logError) console.error("Error inserting delivery log (single):", logError.message);

      return new Response("OK", { status: 200, headers: CORS_HEADERS });
    } else if (campaignId) {
      // Campaign-level (bulk) update — update notifications that reference this campaign id
      const { error: updateError } = await supabaseAdmin
        .from("notifications")
        .update({
          sms_status: status,
          status: status === "delivered" ? "delivered" : status === "sent" ? "sent" : "failed",
          delivered_at: deliveredAt,
          metadata: { ...(payload ?? {}) },
        })
        .eq("sms_provider_id", campaignId);

      if (updateError) console.error("Error updating notifications for campaign:", updateError.message);

      const { error: logError } = await supabaseAdmin.from("notification_delivery_logs").insert({
        notification_id: null, // campaign-level log; if you can map to individual messages, create per-message logs
        channel: "sms",
        status: status,
        provider_response: payload,
        error_message: status === "failed" ? errorReason : null,
        attempt_number: 1,
        metadata: { campaign_id: campaignId },
        received_at: new Date().toISOString(),
      });
      if (logError) console.error("Error inserting delivery log (campaign):", logError.message);

      return new Response("OK", { status: 200, headers: CORS_HEADERS });
    } else {
      console.warn("Webhook payload missing message_id and campaign_id; attempting phone match", payload);
      // Fallback: update by phone if possible
      const notifId = await findNotificationIdByPhone(toNumber);
      if (notifId) {
        const { error: updateError } = await supabaseAdmin.from("notifications").update({
          sms_status: status,
          status: status === "delivered" ? "delivered" : status === "sent" ? "sent" : "failed",
          delivered_at: deliveredAt,
          metadata: { ...(payload ?? {}) },
        }).eq("id", notifId);
        if (updateError) console.error("Error updating notification via phone fallback:", updateError.message);

        const { error: logError } = await supabaseAdmin.from("notification_delivery_logs").insert({
          notification_id: notifId,
          channel: "sms",
          status: status,
          provider_response: payload,
          error_message: status === "failed" ? errorReason : null,
          attempt_number: 1,
          received_at: new Date().toISOString(),
        });
        if (logError) console.error("Error inserting delivery log for phone fallback:", logError.message);

        return new Response("OK", { status: 200, headers: CORS_HEADERS });
      }

      // Nothing to update
      return new Response(JSON.stringify({ error: "Missing message_id/campaign_id and no matching phone found" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
  } catch (err) {
    console.error("Error in afromessage-webhook function:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
