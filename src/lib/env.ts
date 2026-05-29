import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  AUTH_SECRET: z.string().min(32),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

function parseEnv() {
  // During Next.js build phase (static analysis / page data collection),
  // environment variables are not available in the worker process.
  // Skip validation so the build succeeds — runtime will enforce correctness.
  if (process.env["NEXT_PHASE"] === "phase-production-build") {
    return process.env as unknown as z.infer<typeof envSchema>;
  }

  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error(
      "❌ Invalid environment variables:",
      result.error.flatten().fieldErrors
    );
    throw new Error("Invalid environment variables");
  }
  return result.data;
}

export const env = parseEnv();
