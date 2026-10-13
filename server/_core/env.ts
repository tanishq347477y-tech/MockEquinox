import { createRuntimeConfig } from "../runtimeConfig";

const config = createRuntimeConfig();

/** @deprecated Import runtimeConfig for new code; retained as a narrow server-only compatibility facade. */
export const ENV = {
  appOrigin: config.appOrigin,
  cookieSecret: config.sessionSecret,
  corsOrigins: config.corsOrigins,
  cronSecret: config.cronSecret,
  databaseUrl: config.databaseUrl,
  emailApiKey: config.emailApiKey,
  emailFrom: config.emailFrom,
  emailProviderUrl: config.emailProviderUrl,
  isProduction: config.isProduction,
  llmApiKey: config.llmApiKey,
  llmBaseUrl: config.llmBaseUrl,
  llmModel: config.llmModel,
  llmPdfModel: config.llmPdfModel,
  ownerEmail: config.ownerEmail,
  razorpayKeyId: config.razorpayKeyId,
  razorpayKeySecret: config.razorpayKeySecret,
  razorpayWebhookSecret: config.razorpayWebhookSecret,
  stagingAiTestMode: config.stagingAiTestMode,
  s3AccessKeyId: config.s3AccessKeyId,
  s3Bucket: config.s3Bucket,
  s3Endpoint: config.s3Endpoint,
  s3ForcePathStyle: config.s3ForcePathStyle,
  s3PublicBaseUrl: config.s3PublicBaseUrl,
  s3Region: config.s3Region,
  s3SecretAccessKey: config.s3SecretAccessKey,
};
