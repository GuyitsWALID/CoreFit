import { serve } from "serve";
import { createClient } from "@supabase/supabase-js";
import Afromessage from "afromessage";

// Initialize Supabase client
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Server configuration error: Supabase credentials missing.");
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Initialize AfroMessage singleton
const AFROMESSAGE_TOKEN = Deno.env.get("AFROMESSAGE_TOKEN");
const AFROMESSAGE_SENDER_NAME = Deno.env.get("AFROMESSAGE_SENDER_NAMES");
const AFROMESSAGE_IDENTIFIER_ID = Deno.env.get("AFROMESSAGE_IDENTIFIER_ID");
if (!AFROMESSAGE_TOKEN || !AFROMESSAGE_SENDER_NAME || !AFROMESSAGE_IDENTIFIER_ID) {
  throw new Error("Server configuration error: AfroMessage credentials missing.");
}
const afromessageClient = Afromessage.getInstance({
  apiKey: AFROMESSAGE_TOKEN,
  senderName: AFROMESSAGE_SENDER_NAME,
  identifierId: AFROMESSAGE_IDENTIFIER_ID,
});

serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "authorization,x-client-info,apikey,content-type",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Max-Age": "86400",
        },
      });
    }
    const { type, data } = await req.json();

    if (type === "send_manual_sms") {
      const { recipients, message, sender_id, notification_id } = data;
      if (!recipients || !message || !sender_id) {
        return new Response(
          JSON.stringify({ error: "Missing required fields: recipients, message, sender_id" }),
          { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
        );
      }

      // Insert notification
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
        }).select();

      if (notificationError) {
        return new Response(
          JSON.stringify({ error: "Failed to log notification", details: notificationError.message }),
          { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
        );
      }

      const notificationRecord = notificationData[0];

      // Send single SMS
      const smsResponse = await afromessageClient.sendSms({
        from: AFROMESSAGE_IDENTIFIER_ID,
        sender: AFROMESSAGE_SENDER_NAME,
        to: recipients[0],   // AfroMessage expects a string, not array for single
        message: message,
      });

      // AfroMessage response structure:
      // {
      //   acknowledge: "success",
      //   response: { status, message_id, message, to }
      // }
      if (
        smsResponse &&
        smsResponse.acknowledge === "success" &&
        smsResponse.response &&
        smsResponse.response.message_id
      ) {
        const messageData = smsResponse.response;
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
        if (smsResponse?.response?.status) {
          errorDetails = smsResponse.response.status;
        }
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

    // Default route fallback
    return new Response(JSON.stringify({ error: "Invalid request type" }), {
      status: 400,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });

  } catch (error: unknown) {
    if (error instanceof Error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    } else {
      return new Response(JSON.stringify({ error: "An unknown error occurred" }), {
        status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }
  }
});
