import { Redis } from '@upstash/redis';

const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;
const SUBS_KEY = 'cosechas:push_subs';

export const dynamic = 'force-dynamic';

async function getSubs() {
  if (!redis) return [];
  let data = await redis.get(SUBS_KEY);
  if (!data) return [];
  if (typeof data === 'string') { try { data = JSON.parse(data); } catch { return []; } }
  return Array.isArray(data) ? data : [];
}

export async function POST(request) {
  if (!redis) return Response.json({ error: 'db_not_configured' }, { status: 503 });
  try {
    const sub = await request.json();
    if (!sub?.endpoint) return Response.json({ error: 'invalid_subscription' }, { status: 400 });
    const subs = await getSubs();
    const idx = subs.findIndex((s) => s.endpoint === sub.endpoint);
    if (idx >= 0) subs[idx] = sub;
    else subs.push(sub);
    await redis.set(SUBS_KEY, subs);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: 'subscribe_failed' }, { status: 500 });
  }
}

export async function DELETE(request) {
  if (!redis) return Response.json({ error: 'db_not_configured' }, { status: 503 });
  try {
    const { endpoint } = await request.json();
    const subs = await getSubs();
    await redis.set(SUBS_KEY, subs.filter((s) => s.endpoint !== endpoint));
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: 'unsubscribe_failed' }, { status: 500 });
  }
}
