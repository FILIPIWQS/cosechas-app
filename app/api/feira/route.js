import { Redis } from '@upstash/redis';
import { DEFAULT_STORE } from '../../../lib/stores';

const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const redisConfigured = Boolean(url && token);
const redis = redisConfigured ? new Redis({ url, token }) : null;

// Same global catalog used by app/api/[action]/route.js.
const GLOBAL_HASH_KEY = 'siembras:products:hash';

// Per-store feira counts — never resets at midnight, only manually
// (via POST { reset: true }) when the user starts a new count.
function feiraCountsKeyFor(storeId) { return `siembras:${storeId}:feira:counts`; }

function getStoreId(request) {
  const id = request.headers.get('x-store-id');
  return id && /^[a-z0-9-]{1,64}$/i.test(id) ? id : DEFAULT_STORE;
}

function parseProduct(raw) {
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return null; }
  }
  return raw && typeof raw === 'object' ? raw : null;
}

export const dynamic = 'force-dynamic';

async function getFeiraCatalog() {
  if (!redis) return [];
  const hash = await redis.hgetall(GLOBAL_HASH_KEY);
  if (!hash || Object.keys(hash).length === 0) return [];
  return Object.values(hash).map(parseProduct).filter((p) => p && p.feira);
}

async function getFeiraCounts(storeId) {
  const hash = await redis.hgetall(feiraCountsKeyFor(storeId));
  const out = {};
  if (hash) {
    for (const [id, raw] of Object.entries(hash)) {
      const c = parseProduct(raw);
      if (c) out[id] = c;
    }
  }
  return out;
}

function mergeFeiraProduct(product, countEntry) {
  const c = countEntry || {};
  return {
    id: product.id,
    name: product.name,
    unit: product.unit || '',
    image: product.image || '',
    fornecedor: product.fornecedor || '',
    parFeira: Number(product.parFeira) || 0,
    count: Number(c.count) || 0,
    confirmed: !!c.confirmed,
    updatedAt: c.updatedAt || 0,
    by: c.by || '',
  };
}

export async function GET(request) {
  if (!redisConfigured) return Response.json({ error: 'db_not_configured' }, { status: 503 });
  const storeId = getStoreId(request);
  try {
    const catalog = await getFeiraCatalog();
    const counts = await getFeiraCounts(storeId);
    const products = catalog.map((p) => mergeFeiraProduct(p, counts[p.id]));
    return Response.json({ products });
  } catch (e) {
    return Response.json({ error: 'read_failed' }, { status: 500 });
  }
}

export async function POST(request) {
  if (!redisConfigured) return Response.json({ error: 'db_not_configured' }, { status: 503 });
  const storeId = getStoreId(request);
  try {
    const body = await request.json();

    // "Nova contagem de feira": wipes this store's feira counts entirely.
    if (body.reset === true) {
      await redis.del(feiraCountsKeyFor(storeId));
      return Response.json({ ok: true });
    }

    const id = body.id;
    const count = Number(body.count);
    const by = String(body.by || '').trim().slice(0, 40);
    const confirmed = body.confirmed !== false;
    if (!id) return Response.json({ error: 'id_required' }, { status: 400 });
    if (Number.isNaN(count) || count < 0) {
      return Response.json({ error: 'invalid_count' }, { status: 400 });
    }
    const catalogRaw = await redis.hget(GLOBAL_HASH_KEY, id);
    if (!catalogRaw) return Response.json({ error: 'not_found' }, { status: 404 });

    const entry = { count, confirmed, updatedAt: Date.now(), by };
    await redis.hset(feiraCountsKeyFor(storeId), { [id]: JSON.stringify(entry) });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: 'save_failed' }, { status: 500 });
  }
}
