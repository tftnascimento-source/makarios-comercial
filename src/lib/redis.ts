import { Redis } from "@upstash/redis";
import { env } from "@/lib/env";

// Parse Upstash REST credentials from the Redis URL
// Format: rediss://default:TOKEN@HOST:PORT
function createUpstashClient() {
  const raw = env.REDIS_URL;
  try {
    const url = new URL(raw);
    const restUrl = `https://${url.hostname}`;
    const token   = decodeURIComponent(url.password);
    return new Redis({ url: restUrl, token });
  } catch {
    // Fallback: try UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN if set
    return Redis.fromEnv();
  }
}

export type RedisClient = Redis;

let _client: Redis | null = null;

export function getRedisSync(): Redis {
  if (!_client) _client = createUpstashClient();
  return _client;
}

/** Kept async for backwards compatibility with call-sites that await it. */
export async function getRedis(): Promise<Redis> {
  return getRedisSync();
}
