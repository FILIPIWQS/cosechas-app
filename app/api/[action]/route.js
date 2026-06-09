import { Redis } from '@upstash/redis';

// Aceita os nomes injetados pelo Vercel (KV_*) ou os padroes do Upstash.
const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const redisConfigured = Boolean(url && token);
const redis = redisConfigured ? new Redis({ url, token }) : null;

const KEY = 'cosechas:products';

export const dynamic = 'force-dynamic';

async function getProducts() {
  if (!redis) return [];
  let data = await redis.get(KEY);
  if (data == null) return [];
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      return [];
    }
  }
  return Array.isArray(data) ? data : [];
}

async function saveProducts(products) {
  await redis.set(KEY, products);
}

function isAdmin(request) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  return request.headers.get('x-admin-password') === expected;
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export async function GET(request, { params }) {
  if (params.action !== 'products') {
    return Response.json({ error: 'not_found' }, { status: 404 });
  }
  if (!redisConfigured) {
    return Response.json({ error: 'db_not_configured' }, { status: 503 });
  }
  try {
    return Response.json({ products: await getProducts() });
  } catch (e) {
    return Response.json({ error: 'read_failed' }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  const action = params.action;

  if (action === 'verify') {
    if (!process.env.ADMIN_PASSWORD) {
      return Response.json({ error: 'admin_password_not_set' }, { status: 503 });
    }
    return isAdmin(request)
      ? Response.json({ ok: true })
      : Response.json({ ok: false }, { status: 401 });
  }

  if (action === 'count') {
    if (!redisConfigured) return Response.json({ error: 'db_not_configured' }, { status: 503 });
    try {
      const body = await request.json();
      const id = body.id;
      const count = Number(body.count);
      if (!id) return Response.json({ error: 'id_required' }, { status: 400 });
      if (Number.isNaN(count) || count < 0) {
        return Response.json({ error: 'invalid_count' }, { status: 400 });
      }
      const products = await getProducts();
      const idx = products.findIndex((p) => p.id === id);
      if (idx === -1) return Response.json({ error: 'not_found' }, { status: 404 });
      products[idx].count = count;
      products[idx].updatedAt = Date.now();
      await saveProducts(products);
      return Response.json({ ok: true });
    } catch (e) {
      return Response.json({ error: 'count_failed' }, { status: 500 });
    }
  }

  if (action === 'reset') {
    if (!isAdmin(request)) return Response.json({ error: 'unauthorized' }, { status: 401 });
    try {
      const products = await getProducts();
      const now = Date.now();
      products.forEach((p) => {
        p.count = 0;
        p.updatedAt = now;
      });
      await saveProducts(products);
      return Response.json({ ok: true });
    } catch (e) {
      return Response.json({ error: 'reset_failed' }, { status: 500 });
    }
  }

  if (action === 'products') {
    if (!isAdmin(request)) return Response.json({ error: 'unauthorized' }, { status: 401 });
    try {
      const body = await request.json();
      const name = String(body.name || '').trim();
      if (!name) return Response.json({ error: 'name_required' }, { status: 400 });
      const product = {
        id: genId(),
        name,
        unit: String(body.unit || '').trim(),
        par: Math.max(0, Number(body.par) || 0),
        count: 0,
        updatedAt: Date.now(),
      };
      const products = await getProducts();
      products.push(product);
      await saveProducts(products);
      return Response.json({ product });
    } catch (e) {
      return Response.json({ error: 'create_failed' }, { status: 500 });
    }
  }

  return Response.json({ error: 'not_found' }, { status: 404 });
}

export async function PUT(request, { params }) {
  if (params.action !== 'products') return Response.json({ error: 'not_found' }, { status: 404 });
  if (!isAdmin(request)) return Response.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const body = await request.json();
    if (!body.id) return Response.json({ error: 'id_required' }, { status: 400 });
    const products = await getProducts();
    const idx = products.findIndex((p) => p.id === body.id);
    if (idx === -1) return Response.json({ error: 'not_found' }, { status: 404 });
    const p = products[idx];
    if (body.name !== undefined) p.name = String(body.name).trim();
    if (body.unit !== undefined) p.unit = String(body.unit).trim();
    if (body.par !== undefined) p.par = Math.max(0, Number(body.par) || 0);
    p.updatedAt = Date.now();
    await saveProducts(products);
    return Response.json({ product: p });
  } catch (e) {
    return Response.json({ error: 'update_failed' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  if (params.action !== 'products') return Response.json({ error: 'not_found' }, { status: 404 });
  if (!isAdmin(request)) return Response.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return Response.json({ error: 'id_required' }, { status: 400 });
    const products = await getProducts();
    await saveProducts(products.filter((p) => p.id !== id));
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: 'delete_failed' }, { status: 500 });
  }
}
