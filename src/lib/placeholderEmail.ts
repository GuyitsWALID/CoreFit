export const createPlaceholderEmail = (userId: string) => `no-email+${userId}@corefit.local`;

export const isPlaceholderEmail = (email: string | null | undefined) =>
  Boolean(email?.toLowerCase().endsWith('@corefit.local') && email.toLowerCase().startsWith('no-email+'));

export const createPlaceholderPhone = (userId: string) => `NO_PHONE_${userId}`;

export const isPlaceholderPhone = (phone: string | null | undefined) =>
  Boolean(phone?.startsWith('NO_PHONE_'));
