import Redis from 'ioredis';
import { loadEnv } from '../config/env';

let client: Redis | undefined;

export function getRedisClient(): Redis {
  if (!client) {
    client = new Redis(loadEnv().REDIS_URL, { maxRetriesPerRequest: 3 });
  }
  return client;
}
