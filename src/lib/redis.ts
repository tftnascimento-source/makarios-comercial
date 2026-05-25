import { createClient } from "@node-redis/client";
import { env } from "@/lib/env";

type RedisClient = ReturnType<typeof createClient>;
let client: RedisClient | null = null;

export async function getRedis(): Promise<RedisClient> {
  if (!client) {
    client = createClient({ url: env.REDIS_URL });
    client.on("error", (err: Error) =>
      console.error("Redis client error:", err)
    );
    await client.connect();
  }
  return client;
}
