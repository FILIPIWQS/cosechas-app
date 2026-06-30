import { Redis } from '@upstash/redis';

const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!redis) {
    return Response.json({ error: 'Redis not configured' }, { status: 503 });
  }
  try {
    let data = await redis.get('cosechas:products');
    if (data == null) return Response.json({ products: [] });
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch { return Response.json({ error: 'parse_failed' }, { status: 500 }); }
    }
    const products = Array.isArray(data) ? data : [];
    return Response.json({
      total: products.length,
      products: products.map((p) => ({ name: p.name, fornecedor: p.fornecedor ?? null })),
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
