const PLACEHOLDERS = {
  DATABASE_URL: "postgres://test@127.0.0.1/test",
  REDIS_URL: "redis://127.0.0.1:6379",
  OPENAI_API_KEY: "test",
  CLOUDFLARE_ACCOUNT_ID: "test",
  CLOUDFLARE_AI_TOKEN: "test",
  NEON_AI_GATEWAY_TOKEN: "test",
  NEON_AI_GATEWAY_BASE_URL: "https://gateway.invalid",
  STOPHY_API_KEY: "test",
  ANTHROPIC_API_KEY: "test",
  GOOGLE_CLIENT_ID: "test",
  GOOGLE_CLIENT_SECRET: "test",
  STORAGE_ENDPOINT: "http://127.0.0.1:9000",
  STORAGE_REGION: "test",
  STORAGE_BUCKET: "test",
  STORAGE_ACCESS_KEY_ID: "test",
  STORAGE_SECRET_ACCESS_KEY: "test",
  BETTER_AUTH_SECRET: "test-only-placeholder-secret-32-chars",
};

for (const [key, value] of Object.entries(PLACEHOLDERS)) process.env[key] ??= value;
