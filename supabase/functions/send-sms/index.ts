import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import AfroMessage from "@afromessage/afromessage-node";
// Initialize Supabase client
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);
// Initialize AfroMessage client
const afromessage = new AfroMessage({
  apiKey: Deno.env.get("AFROMESSAGE_API_TOKEN")!,
  identifierId: Deno.env.get("AFROMESSAGE_IDENTIFIER_ID")!,
  baseUrl: Deno.env.get("AFROMESSAGE_API_BASE_URL") ||
    "https://api.afromessage.com/api",
});
serve(async (req) => {
  try {
    // Handle CORS preflight requests
    if (req.method === "OPTIONS") {
      return new Response("ok", {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "authorization, x-client-info,
apikey, content- type",
},
});
}
const { type, data } = await req.json();
if (type === "send_manual_sms") {
  const { recipients, message, sender_id, notification_id } = data;
  if (!recipients || !message || !sender_id) {
    return new Response(
      JSON.stringify({ error: "Missing required fields: recipients,message,sender_id" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  const senderName = Deno.env.get("AFROMESSAGE_SENDER_NAME") ||
    "Whale";
  // Log notification to database before sending SMS
  const { data: notificationData, error: notificationError } = await supabase
    .from("notifications")
    .insert({
      id: notification_id, // Use provided ID or let DB generate
      title: "Manual SMS",
      body: message,
      recipient_type: "member", // Assuming manual SMS is for members
      recipient_phone: recipients[0], // For single recipient
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
      JSON.stringify({
        error: "Failed to log notification", details:
          notificationError.message
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
  const notificationRecord = notificationData[0];
  // Send SMS using AfroMessage Node.js library
  const smsResponse = await afromessage.sms.send({
    to: recipients,
    from: senderName,
    message: message,
    // Optional: Pass notification_id as a custom parameter for webhook
    correlation
custom_parameters: { notification_id: notificationRecord.id },
  });
  if (smsResponse.status === "success") {
    // Update notification status in DB
    await supabase
      .from("notifications")
      .update({
        sms_status: "sent", sent_at: new Date().toISOString(),
        sms_provider_id: smsResponse.data.message_id
      })
      .eq("id", notificationRecord.id);
    // Log delivery attempt
    await supabase.from("notification_delivery_logs").insert({
      notification_id: notificationRecord.id,
      channel: "sms",
      status: "sent",
      provider_response: smsResponse.data,
    });
    return new Response(JSON.stringify({
      success: true, data:
        smsResponse.data
    }), 
    {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      status: 200,
    });
  } else {
    // Handle AfroMessage API error
    console.error("AfroMessage SMS send error:", smsResponse.error);
    // Update notification status to failed
    await supabase
      .from("notifications")
      .update({
        sms_status: "failed", status: "failed", error_message:
          smsResponse.error.message
      })
      .eq("id", notificationRecord.id);
    // Log failed delivery attempt
    await supabase.from("notification_delivery_logs").insert({
      notification_id: notificationRecord.id,
      channel: "sms",
      status: "failed",
      provider_response: smsResponse.error,
      error_message: smsResponse.error.message,
    });
    return new Response(
      JSON.stringify({
        success: false, error: smsResponse.error.message
      }),
      {
        status: 500, headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      }
    );
  }
} else if (type === "send_welcome_sms") {
  const { recipient_phone, recipient_name, username, password, gym_name,
    gym_address, gym_phone, recipient_id } = data;
  if (!recipient_phone || !recipient_name || !username || !password) {
    return new Response(
      JSON.stringify({
        error: "Missing required fields for welcome SMS"
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  const senderName = Deno.env.get("AFROMESSAGE_SENDER_NAME") ||
    "YourGymName";
  // Fetch welcome template
  const { data: templateData, error: templateError } = await supabase
    .from("notification_templates")
    .select("body, title")
    .eq("name", "welcome_user")
    .single();
  if (templateError || !templateData) {
    console.error("Error fetching welcome template:", templateError);
    return new Response(
      JSON.stringify({
        error: "Welcome template not found or error
fetching" }),
{ status: 500, headers: { "Content-Type": "application/json" } }
);
  }
  let messageBody = templateData.body;
  messageBody = messageBody.replace(/{name}/g, recipient_name);
  messageBody = messageBody.replace(/{username}/g, username);
  messageBody = messageBody.replace(/{password}/g, password);
  messageBody = messageBody.replace(/{gym_name}/g, gym_name || "Your Gym");
  messageBody = messageBody.replace(/{gym_address}/g, gym_address || "Our Location");
  messageBody = messageBody.replace(/{gym_phone}/g, gym_phone || "Our Phone");
// Log notification to database before sending SMS
const { data: notificationData, error: notificationError } = await
    supabase
      .from("notifications")
      .insert({
        template_id: templateData.id, // Assuming templateData has an ID
        title: templateData.title,
        body: messageBody,
        recipient_type: "member",
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
    console.error("Error inserting welcome notification:",
      notificationError);
    return new Response(
      JSON.stringify({
        error: "Failed to log welcome notification",
        details: notificationError.message
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
  const notificationRecord = notificationData[0];
  // Send SMS using AfroMessage Node.js library
  const smsResponse = await afromessage.sms.send({
    to: [recipient_phone],
    from: senderName,
    message: messageBody,
    custom_parameters: { notification_id: notificationRecord.id },
  });
  if (smsResponse.status === "success") {
    // Update notification status in DB
    await supabase
      .from("notifications")
      .update({
        sms_status: "sent", sent_at: new Date().toISOString(),
        sms_provider_id: smsResponse.data.message_id
      })
      .eq("id", notificationRecord.id);
    // Log delivery attempt
    await supabase.from("notification_delivery_logs").insert({
      notification_id: notificationRecord.id,
      channel: "sms",
      status: "sent",
      provider_response: smsResponse.data,
    });
    return new Response(JSON.stringify({
      success: true, data:
        smsResponse.data
    }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      status: 200,
    });
  } else {
    // Handle AfroMessage API error
    console.error("AfroMessage welcome SMS send error:",
      smsResponse.error);
    // Update notification status to failed
    await supabase
      .from("notifications")
      .update({
        sms_status: "failed", status: "failed", error_message:
          smsResponse.error.message
      })
      .eq("id", notificationRecord.id);
    // Log failed delivery attempt
    await supabase.from("notification_delivery_logs").insert({
      notification_id: notificationRecord.id,
      channel: "sms",
      status: "failed",
      provider_response: smsResponse.error,
      error_message: smsResponse.error.message,
    });
    return new Response(
      JSON.stringify({
        success: false, error: smsResponse.error.message
      }),
      {
        status: 500, headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      }
    );
  }
} else {
  return new Response(JSON.stringify({ error: "Invalid request type" }),
    {
      status: 400, headers: { "Content-Type": "application/json" }
    });
}
} catch (error) {
  console.error("Function execution error:", error);
  return new Response(JSON.stringify({ error: error.message }), {
    status: 500, headers: { "Content-Type": "application/json" }
  });
}
});