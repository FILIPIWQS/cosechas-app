import { getStores, saveStores, redisConfigured } from '../../../lib/storesServer';

export const dynamic = 'force-dynamic';

function isAdmin(request) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  return request.headers.get('x-admin-password') === expected;
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function slugify(name) {
  const slug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return slug || genId();
}

export async function GET() {
  const stores = await getStores();
  return Response.json({ stores });
}

export async function POST(request) {
  if (!isAdmin(request)) return Response.json({ error: 'unauthorized' }, { status: 401 });
  if (!redisConfigured) return Response.json({ error: 'db_not_configured' }, { status: 503 });
  try {
    const body = await request.json();
    const name = String(body.name || '').trim();
    if (!name) return Response.json({ error: 'name_required' }, { status: 400 });
    const stores = await getStores();
    let id = slugify(name);
    if (stores.some((s) => s.id === id)) id = `${id}-${genId().slice(0, 4)}`;
    const store = { id, name };
    await saveStores([...stores, store]);
    return Response.json({ store });
  } catch (e) {
    return Response.json({ error: 'create_failed' }, { status: 500 });
  }
}

export async function PUT(request) {
  if (!isAdmin(request)) return Response.json({ error: 'unauthorized' }, { status: 401 });
  if (!redisConfigured) return Response.json({ error: 'db_not_configured' }, { status: 503 });
  try {
    const body = await request.json();
    const id = body.id;
    const name = String(body.name || '').trim();
    if (!id) return Response.json({ error: 'id_required' }, { status: 400 });
    if (!name) return Response.json({ error: 'name_required' }, { status: 400 });
    const stores = await getStores();
    const idx = stores.findIndex((s) => s.id === id);
    if (idx === -1) return Response.json({ error: 'not_found' }, { status: 404 });
    const next = stores.slice();
    next[idx] = { ...next[idx], name };
    await saveStores(next);
    return Response.json({ store: next[idx] });
  } catch (e) {
    return Response.json({ error: 'update_failed' }, { status: 500 });
  }
}
