import { Redis } from '@upstash/redis';
import { STORES as DEFAULT_STORES } from './stores';

const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
export const redisConfigured = Boolean(url && token);
const redis = redisConfigured ? new Redis({ url, token }) : null;

export const STORES_KEY = 'siembras:stores';

export async function getStores() {
  if (!redis) return DEFAULT_STORES;
  let data = await redis.get(STORES_KEY);
  if (data == null) return DEFAULT_STORES;
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch { return DEFAULT_STORES; }
  }
  return Array.isArray(data) && data.length > 0 ? data : DEFAULT_STORES;
}

export async function saveStores(stores) {
  if (!redis) return;
  await redis.set(STORES_KEY, stores);
}
