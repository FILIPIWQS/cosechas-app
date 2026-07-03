import { Redis } from '@upstash/redis';
import { SEED } from '../[action]/route.js';

const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;
const GLOBAL_HASH_KEY = 'siembras:products:hash';

export const dynamic = 'force-dynamic';

function parseProduct(raw) {
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return null; }
  }
  return raw && typeof raw === 'object' ? raw : null;
}

function summarize(hash) {
  if (!hash) return { total: 0, withImage: 0, samples: [] };
  const entries = Object.entries(hash);
  let withImage = 0;
  const samples = [];
  for (const [id, raw] of entries) {
    const p = parseProduct(raw);
    if (p && p.image) withImage++;
    if (samples.length < 5) samples.push({ id, name: p?.name, image: p?.image || null });
  }
  return { total: entries.length, withImage, samples };
}

export async function GET() {
  if (!redis) {
    return Response.json({ error: 'Redis not configured' }, { status: 503 });
  }
  try {
    const [gen0Hash, gen0ArrayRaw, gen1Hash, gen2Hash, countsHash, seedverGlobal, seedverNiteroi, seedverCosechas] = await Promise.all([
      redis.hgetall('cosechas:products:hash'),
      redis.get('cosechas:products'),
      redis.hgetall('siembras:niteroi:products:hash'),
      redis.hgetall('siembras:products:hash'),
      redis.hgetall('siembras:niteroi:counts'),
      redis.get('siembras:seedver'),
      redis.get('siembras:niteroi:seedver'),
      redis.get('cosechas:seedver'),
    ]);

    let gen0Array = gen0ArrayRaw;
    if (typeof gen0Array === 'string') {
      try { gen0Array = JSON.parse(gen0Array); } catch { gen0Array = null; }
    }
    const gen0ArraySummary = Array.isArray(gen0Array)
      ? {
          total: gen0Array.length,
          withImage: gen0Array.filter((p) => p && p.image).length,
          samples: gen0Array.slice(0, 5).map((p) => ({ id: p.id, name: p.name, image: p.image || null })),
        }
      : { total: 0, withImage: 0, samples: [] };

    return Response.json({
      'cosechas:products:hash (gen0 hash)': summarize(gen0Hash),
      'cosechas:products (gen0 array)': gen0ArraySummary,
      'siembras:niteroi:products:hash (gen1)': summarize(gen1Hash),
      'siembras:products:hash (gen2 global catalog, current)': summarize(gen2Hash),
      'siembras:niteroi:counts (gen2 counts)': { total: countsHash ? Object.keys(countsHash).length : 0 },
      seedVersions: { global: seedverGlobal, niteroiOld: seedverNiteroi, cosechasOld: seedverCosechas },
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// Conservative backfill: only fills `image` when the current catalog entry has
// none AND SEED has a URL for that exact product name. Never overwrites an
// existing (possibly custom) image.
export async function POST() {
  if (!redis) {
    return Response.json({ error: 'Redis not configured' }, { status: 503 });
  }
  try {
    const hash = await redis.hgetall(GLOBAL_HASH_KEY);
    if (!hash) return Response.json({ updated: 0, checked: 0 });
    const seedMap = new Map(SEED.filter((s) => s.image).map((s) => [s.name.toLowerCase().trim(), s.image]));
    const toUpdate = {};
    const filled = [];
    let checked = 0;
    for (const [id, raw] of Object.entries(hash)) {
      const p = parseProduct(raw);
      if (!p) continue;
      checked++;
      if (p.image) continue; // never overwrite an existing image
      const img = seedMap.get((p.name || '').toLowerCase().trim());
      if (img) {
        p.image = img;
        p.updatedAt = Date.now();
        toUpdate[id] = JSON.stringify(p);
        filled.push({ id, name: p.name, image: img });
      }
    }
    if (Object.keys(toUpdate).length > 0) await redis.hset(GLOBAL_HASH_KEY, toUpdate);
    return Response.json({ checked, updated: filled.length, filled });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
