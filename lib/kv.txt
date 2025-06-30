import { createClient } from 'redis';

type RedisClient = ReturnType<typeof createClient>;

let redisClient: RedisClient | null = null;
let connectionPromise: Promise<RedisClient> | null = null;

function connectToRedis(): Promise<RedisClient> {
  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = (async () => {
    try {
      console.log('[KV-Debug] Attempting to connect to Redis.');

      if (!process.env.REDIS_URL) {
        console.error('[KV-Critical] REDIS_URL environment variable is not set!');
        throw new Error('REDIS_URL environment variable is not set.');
      }
      console.log('[KV-Debug] REDIS_URL is present.');

      const client = createClient({
        url: process.env.REDIS_URL,
      });

      client.on('error', (err: Error) => console.error('[KV-Critical] Redis Client Error:', err));

      console.log('[KV-Debug] Connecting to client...');
      await client.connect();
      console.log('[KV-Debug] Redis client connected successfully.');

      redisClient = client;
      return client;
    } catch (error) {
      console.error('[KV-Critical] Failed to connect to Redis during initialization:', error);
      connectionPromise = null; // Reset promise on failure to allow retries
      throw error; // Re-throw to ensure calling function knows about the failure
    }
  })();

  return connectionPromise;
}

async function getClient(): Promise<RedisClient> {
  if (redisClient) {
    return redisClient;
  }
  return connectToRedis();
}

// Create a kv-like wrapper to handle JSON serialization and mimic @vercel/kv behavior
export const kv = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const client = await getClient();
      const value = await client.get(key);
      if (value === null) {
        return null;
      }
      return JSON.parse(value) as T;
    } catch (error) {
      console.error(`[KV-Error] Failed to GET key "${key}":`, error);
      return null;
    }
  },
  async set<T>(key: string, value: T, options?: { ex?: number }): Promise<void> {
    try {
      const client = await getClient();
      const stringValue = JSON.stringify(value);
      if (options?.ex) {
        await client.set(key, stringValue, { EX: options.ex });
      } else {
        await client.set(key, stringValue);
      }
    } catch (error) {
      console.error(`[KV-Error] Failed to SET key "${key}":`, error);
    }
  },
  async del(key: string): Promise<void> {
    try {
      const client = await getClient();
      await client.del(key);
    } catch (error) {
      console.error(`[KV-Error] Failed to DEL key "${key}":`, error);
    }
  },
}; 