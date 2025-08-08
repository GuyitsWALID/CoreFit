// supabase/functions/send-sms/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";
// Initialize Supabase client with service role key for secure writes
const supabaseAdmin = createClient(
Deno.env.get("SUPABASE_URL") ?? "",
Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
{ auth: { persistSession: false } }
);
// AfroMessage API configuration
const AFROMESSAGE_API_TOKEN = Deno.env.get("AFROMESSAGE_API_TOKEN");
const AFROMESSAGE_IDENTIFIER_ID = Deno.env.get("AFROMESSAGE_IDENTIFIER_ID");
const AFROMESSAGE_SENDER_NAME = Deno.env.get("AFROMESSAGE_SENDER_NAME");
const AFROMESSAGE_API_BASE_URL = "https://api.afromessage.com/api";
// Helper function to send SMS via AfroMessage
async function sendSmsViaAfroMessage(
to: string | { to: string; message: string }[],
message: string | null,
callbackUrl: string,
isBulk: boolean = false,
campaignName?: string
) {
const headers = {
Authorization: `Bearer ${AFROMESSAGE_API_TOKEN}`,
"Content-Type": "application/json",
};
let payload: any;
let url: string;
if (isBulk) {
  url = `${AFROMESSAGE_API_BASE_URL}/bulk_send`;
payload = {
to: Array.isArray(to) ? to.map(m => m.to).join(",") : to, // For bulk,comma-separated string
message: message, // For bulk, message is for all recipients
from: AFROMESSAGE_IDENTIFIER_ID,
sender: AFROMESSAGE_SENDER_NAME,
campaign: campaignName || `Bulk SMS - ${new Date().toISOString()}`,
createCallback: callbackUrl,
statusCallback: callbackUrl,
};
if (Array.isArray(to)) {
// Personalized bulk
url = `${AFROMESSAGE_API_BASE_URL}/personalized_bulk_send`;
payload = {
messages: to, // Array of {to, message} objects
from: AFROMESSAGE_IDENTIFIER_ID,
sender: AFROMESSAGE_SENDER_NAME,
campaign: campaignName || `Personalized Bulk SMS - ${new
Date().toISOString()}`,
createCallback: callbackUrl,
statusCallback: callbackUrl,
};
}
} else {
url = `${AFROMESSAGE_API_BASE_URL}/send`;
payload = {
from: AFROMESSAGE_IDENTIFIER_ID,
sender: AFROMESSAGE_SENDER_NAME,
to: to,
message: message,
callback: callbackUrl,
};
}
try {
const response = await fetch(url, {
method: "POST",
headers: headers,
body: JSON.stringify(payload),
});
const data = await response.json();
if (!response.ok) {
console.error("AfroMessage API error:", data);
return { success: false, error: data.message || "AfroMessage API error" };
}
console.log("AfroMessage API response:", data);
return { success: true, data: data };
} catch (error) {
console.error("Error sending SMS via AfroMessage:", error);
return { success: false, error: error.message };
}
}
serve(async (req) => {
try {
// Only allow POST requests
if (req.method !== "POST") {
return new Response("Method Not Allowed", { status: 405 });
}
const { type, data } = await req.json();
if (!type) {
return new Response(
JSON.stringify({ error: "Missing 'type' in request body" }),
{ status: 400, headers: { "Content-Type": "application/json" } }
);
}
let result: any;
switch (type) {
case "send_welcome_message":
result = await handleSendWelcomeMessage(data);
break;
case "send_manual_sms":
result = await handleSendManualSms(data);
break;
case "send_personalized_bulk_sms":
result = await handleSendPersonalizedBulkSms(data);
break;
default:
return new Response(
JSON.stringify({ error: "Unknown message type" }),
{ status: 400, headers: { "Content-Type": "application/json" } }
);
}
if (result.success) {
return new Response(JSON.stringify(result), {
status: 200,
headers: { "Content-Type": "application/json" },
});
} else {
return new Response(JSON.stringify(result), {
status: 400,
headers: { "Content-Type": "application/json" },
});
}
} catch (error) {
console.error("Error in send-sms function:", error);
return new Response(JSON.stringify({ error: error.message }), {
status: 500,
headers: { "Content-Type": "application/json" },
});
}
});
// --- Handlers for different SMS types ---
async function handleSendWelcomeMessage(data: any) {
const { user_id, user_data } = data;
if (!user_id || !user_data || !user_data.phone || !user_data.name ||
!user_data.username || !user_data.password) {
return { success: false, error: "Missing required user data for welcome message" };
}
// Fetch welcome template
const { data: template, error: templateError } = await supabaseAdmin
.from("notification_templates")
.select("*")
.eq("name", "welcome_user")
.single();
if (templateError || !template) {
console.error("Error fetching welcome template:",
templateError?.message);
return { success: false, error: "Welcome template not found or database error" };
}
let messageBody = template.body;
// Replace placeholders
for (const key in user_data) {
messageBody = messageBody.replace(new RegExp(`{${key}}`, "g"),
user_data[key]);
}
// Create notification record
const { data: notification, error: notificationError } = await
supabaseAdmin
.from("notifications")
.insert({
template_id: template.id,
title: template.title,
body: messageBody,
recipient_type: "user",
recipient_id: user_id,
recipient_phone: user_data.phone,
trigger_source: "system_auto",
trigger_event: "user_registration",
channels: ["sms"],
status: "pending",
scheduled_at: new Date().toISOString(),
metadata: { user_data: user_data },
})
.select()
.single();
if (notificationError || !notification) {
console.error("Error creating notification record:",
notificationError?.message);
return { success: false, error: "Failed to create notification record" };
}
// Send SMS via AfroMessage
const webhookUrl =
`${Deno.env.get("SUPABASE_URL")}/functions/v1/afromessage-webhook`;
const smsResult = await sendSmsViaAfroMessage(
user_data.phone,
messageBody,
webhookUrl
);
// Update notification status based on AfroMessage response
const updateData: any = {
sms_status: smsResult.success ? "sent" : "failed",
status: smsResult.success ? "sent" : "failed",
sent_at: new Date().toISOString(),
};
if (smsResult.success) {
updateData.sms_provider_id = smsResult.data.response.message_id;
}
const { error: updateError } = await supabaseAdmin
.from("notifications")
.update(updateData)
.eq("id", notification.id);
if (updateError) {
console.error("Error updating notification status:",
updateError.message);
}
// Create delivery log
const { error: logError } = await supabaseAdmin
.from("notification_delivery_logs")
.insert({
notification_id: notification.id,
channel: "sms",
status: smsResult.success ? "sent" : "failed",
provider_response: smsResult.data || smsResult.error,
error_message: smsResult.success ? null : smsResult.error,
attempt_number: 1,
});
if (logError) {
console.error("Error creating delivery log:", logError.message);
}
return { success: smsResult.success, notification_id: notification.id,
message: smsResult.success ? "SMS sent successfully" : smsResult.error };
}
async function handleSendManualSms(data: any) {
const { recipients, message, sender_id, template_id } = data;
if (!recipients || !Array.isArray(recipients) || recipients.length === 0
|| !message || !sender_id) {
return { success: false, error: "Missing required fields for manual SMS"
};
}
const webhookUrl =
`${Deno.env.get("SUPABASE_URL")}/functions/v1/afromessage-webhook`;
if (recipients.length === 1) {
// Single SMS
const recipientPhone = recipients[0];
// Create notification record
const { data: notification, error: notificationError } = await
supabaseAdmin
.from("notifications")
.insert({
template_id: template_id,
title: "Manual SMS",
body: message,
recipient_type: "user", // Assuming manual sends are to users
recipient_phone: recipientPhone,
sent_by_admin_id: sender_id,
trigger_source: "manual",
channels: ["sms"],
status: "pending",
scheduled_at: new Date().toISOString(),
})
.select()
.single();
if (notificationError || !notification) {
console.error("Error creating notification record:",
notificationError?.message);
return { success: false, error: "Failed to create notification record"
};
}
const smsResult = await sendSmsViaAfroMessage(
recipientPhone,
message,
webhookUrl
);
const updateData: any = {
sms_status: smsResult.success ? "sent" : "failed",
status: smsResult.success ? "sent" : "failed",
sent_at: new Date().toISOString(),
};
if (smsResult.success) {
updateData.sms_provider_id = smsResult.data.response.message_id;
}
const { error: updateError } = await supabaseAdmin
.from("notifications")
.update(updateData)
.eq("id", notification.id);
if (updateError) {
console.error("Error updating notification status:",
updateError.message);
}
const { error: logError } = await supabaseAdmin
.from("notification_delivery_logs")
.insert({
notification_id: notification.id,
channel: "sms",
status: smsResult.success ? "sent" : "failed",
provider_response: smsResult.data || smsResult.error,
error_message: smsResult.success ? null : smsResult.error,
attempt_number: 1,
});
if (logError) {
console.error("Error creating delivery log:", logError.message);
}
return { success: smsResult.success, notification_id: notification.id,
message: smsResult.success ? "SMS sent successfully" : smsResult.error };
} else {
// Bulk SMS (same message to multiple recipients)
const campaignName = `Manual Bulk SMS - ${new Date().toISOString()}`;
const smsResult = await sendSmsViaAfroMessage(
recipients.join(","), // AfroMessage bulk_send expects comma-separated numbers
message,
webhookUrl,
true, // isBulk
campaignName
);
if (!smsResult.success) {
return { success: false, error: smsResult.error };
}
// Create individual notification records for each recipient
const notificationsToInsert = recipients.map((phone_number: string) => ({
template_id: template_id,
title: "Bulk Manual SMS",
body: message,
recipient_type: "user",
recipient_phone: phone_number,
sent_by_admin_id: sender_id,
trigger_source: "manual",
channels: ["sms"],
status: "sent", // Initial status after sending to AfroMessage
sms_status: "sent",
sms_provider_id: smsResult.data.response.campaign_id, // Use campaign ID for bulk
scheduled_at: new Date().toISOString(),
sent_at: new Date().toISOString(),
metadata: { campaign_name: campaignName },
}));
const { data: insertedNotifications, error: insertError } = await
supabaseAdmin
.from("notifications")
.insert(notificationsToInsert)
.select();
if (insertError) {
console.error("Error creating bulk notification records:",
insertError.message);
return { success: false, error: "Failed to create bulk notification records" };
}
return { success: true, campaign_id:
smsResult.data.response.campaign_id, notifications_created:
insertedNotifications?.length };
}
}
async function handleSendPersonalizedBulkSms(data: any) {
const { messages, sender_id, template_id } = data;
if (!messages || !Array.isArray(messages) || messages.length === 0 ||
!sender_id) {
return { success: false, error: "Missing required fields forpersonalized bulk SMS" };
}
const webhookUrl =
`${Deno.env.get("SUPABASE_URL")}/functions/v1/afromessage-webhook`;
const campaignName = `Personalized Bulk SMS - ${new Date().toISOString()}`;
// AfroMessage personalized bulk send expects an array of objects with 'to' and 'message'
const afromessageMessages = messages.map((msg: any) => ({
to: msg.phone,
message: msg.message,
}));
const smsResult = await sendSmsViaAfroMessage(
afromessageMessages, // Pass array of messages
null, // message is not used for personalized bulk
webhookUrl,
true, // isBulk
);
if (!smsResult.success) {
return { success: false, error: smsResult.error };
}
// Create individual notification records for each personalized message
const notificationsToInsert = messages.map((msg: any) => ({
template_id: template_id,
title: "Personalized Bulk SMS",
body: msg.message,
recipient_type: "user",
recipient_id: msg.user_id, // Optional user_id if available
recipient_phone: msg.phone,
sent_by_admin_id: sender_id,
trigger_source: "manual",
channels: ["sms"],
status: "sent",
sms_status: "sent",
sms_provider_id: smsResult.data.response.campaign_id, // Use campaign ID for bulk
scheduled_at: new Date().toISOString(),
sent_at: new Date().toISOString(),
metadata: { campaign_name: campaignName },
}));
const { data: insertedNotifications, error: insertError } = await
supabaseAdmin
.from("notifications")
.insert(notificationsToInsert)
.select();
if (insertError) {
console.error("Error creating personalized bulk notification records:",
insertError.message);
return { success: false, error: "Failed to create personalized bulk notification records" };
}
return { success: true, campaign_id: smsResult.data.response.campaign_id,
notifications_created: insertedNotifications?.length };
}