import { Redis } from '@upstash/redis';

// Aceita os nomes injetados pelo Vercel (KV_*) ou os padroes do Upstash.
const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const redisConfigured = Boolean(url && token);
const redis = redisConfigured ? new Redis({ url, token }) : null;

const KEY = 'cosechas:products';
const SEED_VERSION_KEY = 'cosechas:seedver';
const SEED_VERSION = 2;

// Catalogo completo cadastrado automaticamente (descricao exata).
// image: caminho da foto quando disponivel (senao vazio).
const SEED = [
  { name: 'Selo (1 Rolo)', image: '/img/selo.jpg' },
  { name: 'Sacola Plástica (1000 Unidades)', image: '/img/sacola-plastica.jpg' },
  { name: 'Sacola Kraft + Base para copos (100 unidades)', image: '/img/sacola-kraft.jpg' },
  { name: 'Guardanapos (1000 unidades)', image: '/img/guardanapos.jpg' },
  { name: 'Copo M + Canudos (500 unidades)' },
  { name: 'Copo G + Canudos (500 unidades)' },
  { name: 'Bowl Médio (100 unidades)' },
  { name: 'Bowl Grande (100 unidades)' },
  { name: 'Colher TRIO (200 unidades)' },
  { name: 'Canudo BIO (500 unidades)' },
  { name: 'Água 510ml (12 unidades)' },
  { name: 'Whey Protein 900g' },
  { name: 'Uva Vermelha KG' },
  { name: 'Uva Verde KG' },
  { name: 'Uva Tompson (Verde) Sem Caroço' },
  { name: 'Uva Crimson (Vermelha) Sem Caroço' },
  { name: 'Suco de Laranja (Galão 3.5L)' },
  { name: 'Suco de Laranja (Bag 5L)' },
  { name: 'Sorvete de Chocolate 10L' },
  { name: 'Sorvete de Baunilha 10L' },
  { name: 'Salsa UN' },
  { name: 'Pitaya Barra (1KG)' },
  { name: 'Pepino KG' },
  { name: 'Pasta de Amendoim 1 KG' },
  { name: 'Nuts (Sabor Cranberry) 10 unds.' },
  { name: 'Nuts (Sabor Classico) 10 unds.' },
  { name: 'Morango In Natura (1KG)' },
  { name: 'Morango 1KG' },
  { name: 'Mix Sementes Secas 1 (Bubble Waffle) 1KG' },
  { name: 'Melancia KG' },
  { name: 'Mel 1.1KG (Floresta Verde)' },
  { name: 'Maça Nacional KG' },
  { name: 'Maracujá Polpa 1.2KG (Sempre Viva)' },
  { name: 'Manga Polpa 1.2KG (Sempre Viva)' },
  { name: 'Mamão KG' },
  { name: 'Limão Siciliano' },
  { name: 'Limão KG' },
  { name: 'Leite Em Pó [Fardo com 25 unidades x (360g)]' },
  { name: 'Laranja Pera' },
  { name: 'Kiwi KG' },
  { name: 'Iogurte Grego 450g (Itambé)' },
  { name: 'Iogurte 1000g' },
  { name: 'Hortelã' },
  { name: 'Graviola Polpa 1.2KG (Sempre Viva)' },
  { name: 'Granola Nechio 500g' },
  { name: 'Gengibre KG' },
  { name: 'Espinafre' },
  { name: 'Framboesa 1.02KG' },
  { name: 'Doce de Leite 1.05KG (Vabene)' },
  { name: 'Damasco 500g (Bubble Waffle)' },
  { name: 'Creme de Cupuaçu (7L)' },
  { name: 'Creme de Coco (3.4 KG)' },
  { name: 'Creme de Avelã 1.01KG (Specialita)' },
  { name: 'Cranberry (2KG)' },
  { name: 'Cranberry (11.34KG)' },
  { name: 'Chocolate cremoso 1 kg (Frete a combinar com vendedor)' },
  { name: 'Cereja Congelada (1KG)' },
  { name: 'Cenoura KG' },
  { name: 'Cappuccino 1kg (Frete a combinar com vendedor)' },
  { name: 'Caju Polpa 1.2KG (Sempre Viva)' },
  { name: 'Blueberry Fruta 1.02KG' },
  { name: 'Blend Pura Energia (200G) [15 Und]' },
  { name: 'Blend Melancia Limão (200G) [15 Und]' },
  { name: 'Blend Limonada de Coco (200G) [15 Und]' },
  { name: 'Blend Enamorados (200G) [15 Und]' },
  { name: 'Blend Controle de Peso (200G) [15 Und]' },
  { name: 'Blend Colibri Roxo (200G) [15 Und]' },
  { name: 'Beterraba KG' },
  { name: "Banana D'Agua KG" },
  { name: 'Açaí Mix Natural (7L)' },
  { name: 'Açaí (10L)' },
  { name: 'Avelã com Chocolate 4KG (Dorella)' },
  { name: 'Aveia Nechio 500g' },
  { name: 'Amora Fruta 1.02KG' },
  { name: 'Aipo UN' },
  { name: 'Acerola Polpa 1.2KG (Sempre Viva)' },
  { name: 'Abacaxi KG' },
  { name: 'Abacaxi Em Pedaços (Pct 3KG)' },
  { name: 'Abacate KG' },
  { name: '1º pedido - Franquias' },
];

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
    let products = await getProducts();
    // Cadastro/atualizacao automatica do catalogo (apenas quando muda a versao).
    const ver = Number(await redis.get(SEED_VERSION_KEY)) || 0;
    if (ver < SEED_VERSION) {
      const byName = new Map(products.map((p) => [p.name, p]));
      const now = Date.now();
      let changed = false;
      let i = 0;
      for (const s of SEED) {
        const existing = byName.get(s.name);
        if (!existing) {
          products.push({
            id: genId() + (i++).toString(36),
            name: s.name,
            unit: '',
            par: 0,
            count: 0,
            image: s.image || '',
            updatedAt: now,
          });
          changed = true;
        } else if (s.image && !existing.image) {
          existing.image = s.image;
          changed = true;
        }
      }
      if (changed) await saveProducts(products);
      await redis.set(SEED_VERSION_KEY, String(SEED_VERSION));
    }
    return Response.json({ products });
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
        image: String(body.image || '').trim(),
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
    if (body.image !== undefined) p.image = String(body.image).trim();
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
