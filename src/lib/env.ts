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
  // During Next.js build phase the vars aren't available in the worker — skip.
  if (process.env["NEXT_PHASE"] === "phase-production-build") {
    return process.env as unknown as z.infer<typeof envSchema>;
  }

  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    // Log warning but don't throw — lets the app start so /api/debug can run.
    console.error(
      "❌ [env] Missing or invalid environment variables:",
      JSON.stringify(result.error.flatten().fieldErrors)
    );
    // Return raw process.env so modules can still load; runtime calls will fail
    // gracefully rather than crashing the entire function on startup.
    return process.env as unknown as z.infer<typeof envSchema>;
  }
  return result.data;
}

export const env = parseEnv();
