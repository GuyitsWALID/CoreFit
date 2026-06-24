import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const constantTimeEqual = (left: string, right: string) => {
  const encoder = new TextEncoder();
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index++) {
    difference |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }
  return difference === 0;
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    const expected = Deno.env.get("HOTKEY_CODE");
    if (!expected) throw new Error("Admin hotkey is not configured.");
    const { code } = await req.json();
    const valid = typeof code === "string" && constantTimeEqual(code.trim(), expected.trim());
    return new Response(JSON.stringify(valid ? { valid: true } : { valid: false, error: "Invalid access code." }), {
      status: valid ? 200 : 401,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    return new Response(JSON.stringify({ valid: false, error: error instanceof Error ? error.message : "Verification failed." }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
