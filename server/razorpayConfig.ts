export type RazorpayConfig = {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
};

function isPlaceholder(value: string) {
  return /replace_in_production|replace-in-production|your_|example/i.test(value);
}

export function getRazorpayConfig(env: NodeJS.ProcessEnv = process.env): RazorpayConfig | null {
  const keyId = env.RAZORPAY_KEY_ID;
  const keySecret = env.RAZORPAY_KEY_SECRET;
  const webhookSecret = env.RAZORPAY_WEBHOOK_SECRET;
  if (!keyId || !keySecret || !webhookSecret) return null;
  if ([keyId, keySecret, webhookSecret].some(isPlaceholder)) return null;
  return { keyId, keySecret, webhookSecret };
}
