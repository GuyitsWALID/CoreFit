// utils/sendWelcomeViaEdge.ts
export async function callSendWelcomeSmsFunction(fnUrl: string, payload: Record<string, any>) {
  try {
    const res = await fetch(fnUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Optional: include client JWT if you want the function to optionally validate caller
        // "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("send-sms function returned an error", res.status, json);
      return { ok: false, status: res.status, body: json };
    }
    return { ok: true, status: res.status, body: json };
  } catch (err) {
    console.error("Network/error calling send-sms function", err);
    return { ok: false, error: String(err) };
  }
}
