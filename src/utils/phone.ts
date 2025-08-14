// src/utils/phone.ts
export function formatPhoneNumberForSms(raw: string | null | undefined): string {
  if (!raw) return '';

  // Remove spaces, dashes, parentheses, leading/trailing whitespace
  let s = String(raw).trim().replace(/[\s()-]/g, '');

  // If it already has a plus and digits, return normalized version
  if (/^\+\d+$/.test(s)) {
    return s;
  }

  // If it starts with '00' treat as international prefix -> replace with '+'
  if (/^00\d+$/.test(s)) {
    return '+' + s.slice(2);
  }

  // Ethiopia special-casing (common in your project)
  // - Accept formats: '912345678', '0912345678', '251912345678', '+251912345678'
  // - Ethiopia mobile often 9 digits (starting with 9), or 10 with leading 0
  if (/^(?:0)?9\d{8}$/.test(s)) {
    // remove leading 0 if any, then add +251
    const noLeading = s.replace(/^0/, '');
    return '+251' + noLeading;
  }

  // If it looks like national number with leading 0 and length 10 (e.g. 0XXXXXXXXX)
  if (/^0\d{8,11}$/.test(s)) {
    // remove leading zero and prefix with + (best-effort, do NOT assume country code)
    const noZero = s.replace(/^0/, '');
    return '+' + noZero;
  }

  // If it's all digits and length looks like full international (country code included) -> just prefix '+'
  if (/^\d{8,15}$/.test(s)) {
    return '+' + s;
  }

  // Fallback: return original cleaned string (so it is at least stripped) — caller should validate
  return s;
}
