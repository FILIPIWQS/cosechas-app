import { getConfig, saveConfig, getStoreId } from '../../../../lib/etiquetasServer';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const storeId = getStoreId(request);
  const config = await getConfig(storeId);
  return Response.json({ config });
}

export async function POST(request) {
  const storeId = getStoreId(request);
  try {
    const body = await request.json();
    const larguraMm = Number(body.larguraMm);
    const alturaMm = Number(body.alturaMm);
    const nomeLoja = String(body.nomeLoja ?? '').trim();
    if (!larguraMm || larguraMm < 20) return Response.json({ error: 'largura_invalida' }, { status: 400 });
    if (!alturaMm || alturaMm < 20) return Response.json({ error: 'altura_invalida' }, { status: 400 });
    const config = { larguraMm, alturaMm, nomeLoja };
    await saveConfig(storeId, config);
    return Response.json({ config });
  } catch (e) {
    return Response.json({ error: 'save_failed' }, { status: 500 });
  }
}
