// supabase/functions/afromessage-webhook/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";
// Initialize Supabase client with service role key for secure writes
const supabaseAdmin = createClient(
Deno.env.get("SUPABASE_URL") ?? "",
Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
{ auth: { persistSession: false } }
);
serve(async (req) => {
try {
// Only allow POST requests
if (req.method !== "POST") {
return new Response("Method Not Allowed", { status: 405 });
}
const payload = await req.json();
console.log("AfroMessage Webhook Payload:", payload);
// Determine the type of webhook (e.g., SMS status, campaign status)
// AfroMessage webhook structure might vary, adapt this based on their
documentation
const messageId = payload.message_id || payload.sms_id; // Single SMS
const campaignId = payload.campaign_id; // Bulk/Personalized SMS
const status = payload.status; // e.g., 'DELIVERED', 'FAILED', 'SENT'
const deliveredAt = payload.delivered_at || new Date().toISOString();
const errorReason = payload.error_reason || null;
let updateResult;
if (messageId) {
// Handle single SMS status update
updateResult = await supabaseAdmin
.from("notifications")
.update({
sms_status: status.toLowerCase(),
status: status.toLowerCase() === "delivered" ? "delivered" :
"failed",
delivered_at: deliveredAt,
metadata: { ...payload }, // Store full payload for debugging
})
.eq("sms_provider_id", messageId);
if (updateResult.error) {
console.error("Error updating single notification status:",
updateResult.error.message);
}
// Log delivery attempt
const { error: logError } = await supabaseAdmin
.from("notification_delivery_logs")
.insert({
notification_id: (await
supabaseAdmin.from("notifications").select("id").eq("sms_provider_id",
messageId).single()).data?.id,
channel: "sms",
status: status.toLowerCase(),
provider_response: payload,
error_message: errorReason,
attempt_number: 1, // Assuming first attempt for webhook update
});
if (logError) {
console.error("Error logging single SMS delivery:",
logError.message);
}
} else if (campaignId) {
// Handle bulk/personalized SMS campaign status update
// AfroMessage might send individual message statuses within a
campaign, or a campaign summary
// This example assumes a campaign summary update or individual
message updates linked by campaign_id
// Update all notifications belonging to this campaign
updateResult = await supabaseAdmin
.from("notifications")
.update({
sms_status: status.toLowerCase(),
status: status.toLowerCase() === "delivered" ? "delivered" :
"failed",
delivered_at: deliveredAt,
metadata: { ...payload },
})
.eq("sms_provider_id", campaignId); // Assuming sms_provider_id
stores campaign_id for bulk
if (updateResult.error) {
console.error("Error updating bulk notification status:",
updateResult.error.message);
}
// For bulk, you might need to iterate through individual messages in
the payload
// and update their statuses if AfroMessage provides that granularity
in the webhook
// Log delivery attempt for the campaign (or individual messages if
granular)
const { error: logError } = await supabaseAdmin
.from("notification_delivery_logs")
.insert({
notification_id: null, // Campaign-level log, or iterate for
individual messages
channel: "sms",
status: status.toLowerCase(),
provider_response: payload,
error_message: errorReason,
attempt_number: 1,
metadata: { campaign_id: campaignId },
});
if (logError) {
console.error("Error logging bulk SMS delivery:", logError.message);
}
} else {
console.warn("Webhook payload missing message_id or campaign_id:",
payload);
return new Response("Bad Request: Missing message_id or campaign_id",
{ status: 400 });
}
return new Response("OK", { status: 200 });
} catch (error) {
console.error("Error in afromessage-webhook function:", error);
return new Response(JSON.stringify({ error: error.message }), {
status: 500,
headers: { "Content-Type": "application/json" },
});
}
});