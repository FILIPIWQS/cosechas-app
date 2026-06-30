import { Redis } from '@upstash/redis';

const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;

export const dynamic = 'force-dynamic';

function todayBRT() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

export async function GET() {
  const utcNow = new Date().toISOString();
  const todayBrt = todayBRT();

  let redisCountDate = null;
  if (redis) {
    try {
      redisCountDate = await redis.get('cosechas:countdate');
    } catch (e) {
      redisCountDate = `error: ${e.message}`;
    }
  } else {
    redisCountDate = 'Redis not configured';
  }

  return Response.json({ utcNow, todayBrt, redisCountDate });
}
