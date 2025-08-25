// supabase/functions/send-sms/index.ts

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import AfroMessage from "https://esm.sh/afromessage@1.0.9";

console.log("Function cold start: Initializing..." );

// Initialize Supabase client
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("CRITICAL: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.");
  throw new Error("Server configuration error: Supabase credentials missing.");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
console.log("Supabase client initialized.");

// Initialize AfroMessage client
const AFROMESSAGE_TOKEN = Deno.env.get("AFROMESSAGE_TOKEN");
const AFROMESSAGE_SENDER_NAMES = Deno.env.get("AFROMESSAGE_SENDER_NAMES");
const AFROMESSAGE_IDENTIFIER_ID = Deno.env.get("AFROMESSAGE_IDENTIFIER_ID");

if (!AFROMESSAGE_TOKEN || !AFROMESSAGE_IDENTIFIER_ID || !AFROMESSAGE_SENDER_NAMES) {
  console.error("CRITICAL: Missing one or more AfroMessage environment variables.");
  throw new Error("Server configuration error: AfroMessage credentials missing.");
}

const afromessageClient = new AfroMessage({
  apiKey: AFROMESSAGE_TOKEN,
  from: AFROMESSAGE_IDENTIFIER_ID,
  sender: AFROMESSAGE_SENDER_NAMES,
});
console.log("AfroMessage client initialized.");

serve(async (req) => {
  try {
    console.log(`Received request: ${req.method} ${req.url}`);

    if (req.method === "OPTIONS") {
      console.log("Handling OPTIONS request (CORS preflight).");
      return new Response("ok", {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    const { type, data } = await req.json();
    console.log(`Request type: ${type}, Data:`, data);

    // --- ROUTE 1: SEND MANUAL SMS ---
    if (type === "send_manual_sms") {
      const { recipients, message, sender_id, notification_id } = data;

      if (!recipients || !message || !sender_id) {
        return new Response(
          JSON.stringify({ error: "Missing required fields: recipients, message, sender_id" }),
          { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
        );
      }

      console.log("Attempting to insert notification record for manual SMS...");
      const { data: notificationData, error: notificationError } = await supabase
        .from("notifications")
        .insert({
          id: notification_id,
          title: "Manual SMS",
          body: message,
          recipient_type: 'user',
          recipient_phone: recipients[0],
          sent_by_admin_id: sender_id,
          trigger_source: "manual",
          status: "pending",
          sms_status: "pending",
          channels: ["sms"],
        })
        .select();

      if (notificationError) {
        console.error("Error inserting notification:", notificationError);
        return new Response(
          JSON.stringify({ error: "Failed to log notification", details: notificationError.message }),
          { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
        );
      }
      
      const notificationRecord = notificationData[0];
      console.log("Notification record inserted:", notificationRecord.id);

      console.log("Attempting to send manual SMS via AfroMessage...");
      const smsResponse = await afromessageClient.sendSms({
        to: recipients.join(','),
        message: message,
        custom_parameters: { notification_id: notificationRecord.id },
      });
      console.log('AfroMessage API response:', JSON.stringify(smsResponse, null, 2));

      if (smsResponse && smsResponse.acknowledge === "success" && smsResponse.response && smsResponse.response.acknowledge === "success") {
        const messageData = smsResponse.response.response;
        console.log("SMS sent successfully. Updating notification status.");
        await supabase
          .from("notifications")
          .update({ sms_status: "sent", sent_at: new Date().toISOString(), sms_provider_id: messageData.message_id })
          .eq("id", notificationRecord.id);
        await supabase.from("notification_delivery_logs").insert({
          notification_id: notificationRecord.id,
          channel: "sms",
          status: "sent",
          provider_response: messageData,
        });
        return new Response(JSON.stringify({ success: true, data: messageData }), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
          status: 200,
        });
      } else {
        let errorDetails = "Unknown AfroMessage API error.";
        if (smsResponse && smsResponse.response && smsResponse.response.response && smsResponse.response.response.errors) {
          errorDetails = smsResponse.response.response.errors.join(', ');
        }
        console.error("AfroMessage SMS send error:", errorDetails);
        await supabase
          .from("notifications")
          .update({ sms_status: "failed", status: "failed", error_message: errorDetails })
          .eq("id", notificationRecord.id);
        await supabase.from("notification_delivery_logs").insert({
          notification_id: notificationRecord.id,
          channel: "sms",
          status: "failed",
          provider_response: smsResponse,
          error_message: errorDetails,
        });
        return new Response(
          JSON.stringify({ success: false, error: errorDetails }),
          { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
        );
      }
    } 
    // --- ROUTE 2: SEND WELCOME SMS ---
    else if (type === "send_welcome_sms") {
      const { recipient_phone, recipient_name, username, password, gym_name, gym_address, gym_phone, recipient_id } = data;

      if (!recipient_phone || !recipient_name || !username || !password) {
        return new Response(
          JSON.stringify({ error: "Missing required fields for welcome SMS" }),
          { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
        );
      }

      console.log("Fetching welcome template...");
      const { data: templateData, error: templateError } = await supabase
        .from("notification_templates")
        .select("body, title, id")
        .eq("template_key", "welcome_user")  // ✅ correct column
        .eq("is_active", true)               // ✅ only active template
        .maybeSingle(); 

      if (templateError || !templateData) {
        console.error("Error fetching welcome template:", templateError);
        return new Response(
          JSON.stringify({ error: "Welcome template not found or error fetching" }),
          { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
        );
      }

      let messageBody = templateData.body
        .replace(/{name}/g, recipient_name)
        .replace(/{username}/g, username)
        .replace(/{password}/g, password)
        .replace(/{gym_name}/g, gym_name || "Your Gym")
        .replace(/{gym_address}/g, gym_address || "Our Location")
        .replace(/{gym_phone}/g, gym_phone || "Our Phone");

      console.log("Attempting to insert welcome notification record...");
      const { data: notificationData, error: notificationError } = await supabase
        .from("notifications")
        .insert({
          template_id: templateData.id,
          title: templateData.title,
          body: messageBody,
          recipient_type: "user",
          recipient_id: recipient_id,
          recipient_phone: recipient_phone,
          trigger_source: "system_auto",
          trigger_event: "user_registration",
          status: "pending",
          sms_status: "pending",
          channels: ["sms"],
        })
        .select();

      if (notificationError) {
        console.error("Error inserting welcome notification:", notificationError);
        return new Response(
          JSON.stringify({ error: "Failed to log welcome notification", details: notificationError.message }),
          { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
        );
      }
      
      const notificationRecord = notificationData[0];
      console.log("Welcome notification record inserted:", notificationRecord.id);

      console.log("Attempting to send welcome SMS via AfroMessage...");
      const smsResponse = await afromessageClient.sendSms({
        to: recipient_phone,
        message: messageBody,
        custom_parameters: { notification_id: notificationRecord.id },
      });
      console.log('AfroMessage API response:', JSON.stringify(smsResponse, null, 2));

      if (smsResponse && smsResponse.acknowledge === "success" && smsResponse.response && smsResponse.response.acknowledge === "success") {
        const messageData = smsResponse.response.response;
        console.log("Welcome SMS sent successfully. Updating notification status.");
        await supabase
          .from("notifications")
          .update({ sms_status: "sent", sent_at: new Date().toISOString(), sms_provider_id: messageData.message_id })
          .eq("id", notificationRecord.id);
        await supabase.from("notification_delivery_logs").insert({
          notification_id: notificationRecord.id,
          channel: "sms",
          status: "sent",
          provider_response: messageData,
        });
        return new Response(JSON.stringify({ success: true, data: messageData }), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
          status: 200,
        });
      } else {
        let errorDetails = "Unknown AfroMessage API error.";
        if (smsResponse && smsResponse.response && smsResponse.response.response && smsResponse.response.response.errors) {
          errorDetails = smsResponse.response.response.errors.join(', ');
        }
        console.error("AfroMessage welcome SMS send error:", errorDetails);
        await supabase
          .from("notifications")
          .update({ sms_status: "failed", status: "failed", error_message: errorDetails })
          .eq("id", notificationRecord.id);
        await supabase.from("notification_delivery_logs").insert({
          notification_id: notificationRecord.id,
          channel: "sms",
          status: "failed",
          provider_response: smsResponse,
          error_message: errorDetails,
        });
        return new Response(
          JSON.stringify({ success: false, error: errorDetails }),
          { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
        );
      }
    } 
    // --- ROUTE 3: INVALID TYPE ---
    else {
      console.warn(`Invalid request type received: ${type}`);
      return new Response(JSON.stringify({ error: "Invalid request type" }), {
        status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }
  } catch (error) {
    console.error("!!! UNCAUGHT FUNCTION EXECUTION ERROR !!!");
    console.error('Error Name:', error.name);
    console.error('Error Message:', error.message);
    console.error('Error Stack:', error.stack);

    return new Response(JSON.stringify({ error: error.message || "An unknown error occurred" }), {
      status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
});

