// supabase/functions/send-sms/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  const { phone, message, senderId } = await req.json()
  const API_KEY = Deno.env.get("AFROMESSAGE_API_KEY")
  const SENDER_ID = senderId || Deno.env.get("AFROMESSAGE_SENDER_ID")

  if (!API_KEY || !SENDER_ID) {
    return new Response(JSON.stringify({ error: "Missing AfroMessage API key or sender ID" }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    })
  }

  try {
    const res = await fetch("https://api.afromessage.com/api/send", {
      method: "GET",
      headers: {
        "Content-Type": "application/json"
      },
    });

    const result = await res.json()

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    })
  }
})

//npx supabase secrets set AFROMESSAGE_SENDER_ID=your_sender_id_here
