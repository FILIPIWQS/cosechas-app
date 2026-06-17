import webpush from 'web-push';
import { Redis } from '@upstash/redis';

export const dynamic = 'force-dynamic';

const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;

const SUBS_KEY = 'cosechas:push_subs';
const PRODUCTS_KEY = 'cosechas:products';

const vapidOk =
  process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_EMAIL;

if (vapidOk) {
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL}`,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

async function get(key) {
  if (!redis) return [];
  let data = await redis.get(key);
  if (!data) return [];
  if (typeof data === 'string') { try { data = JSON.parse(data); } catch { return []; } }
  return Array.isArray(data) ? data : [];
}

export async function GET(request) {
  const auth = request.headers.get('authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!redis) return Response.json({ error: 'db_not_configured' }, { status: 503 });
  if (!vapidOk) return Response.json({ error: 'vapid_not_configured' }, { status: 503 });

  try {
    const products = await get(PRODUCTS_KEY);
    const pending = products.filter((p) => !p.countedToday).length;
    if (pending === 0) return Response.json({ ok: true, sent: 0, pending: 0 });

    const subs = await get(SUBS_KEY);
    if (subs.length === 0) return Response.json({ ok: true, sent: 0, pending });

    const payload = JSON.stringify({
      title: '⚠️ Estoque pendente – Cosechas',
      body: `Faltam ${pending} produto${pending > 1 ? 's' : ''} para contar hoje!`,
    });

    const results = await Promise.allSettled(
      subs.map((sub) => webpush.sendNotification(sub, payload))
    );

    // Remove expired subscriptions
    const valid = subs.filter((_, i) => results[i].status === 'fulfilled');
    if (valid.length !== subs.length) await redis.set(SUBS_KEY, valid);

    return Response.json({ ok: true, sent: valid.length, pending });
  } catch (e) {
    return Response.json({ error: 'notify_failed', detail: e.message }, { status: 500 });
  }
}
