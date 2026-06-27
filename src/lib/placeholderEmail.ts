export const createPlaceholderEmail = (userId: string) => `no-email+${userId}@corefit.local`;

export const isPlaceholderEmail = (email: string | null | undefined) =>
  Boolean(email?.toLowerCase().endsWith('@corefit.local') && email.toLowerCase().startsWith('no-email+'));
