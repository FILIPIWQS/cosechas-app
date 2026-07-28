import { getProdutos, saveProdutos, genId } from '../../../../lib/etiquetasServer';

export const dynamic = 'force-dynamic';

export async function GET() {
  const produtos = await getProdutos();
  return Response.json({ produtos });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const nome = String(body.nome || '').trim();
    const dias = Number(body.dias);
    const tipoEtiqueta = body.tipoEtiqueta === 'procedencia' ? 'procedencia' : 'manipulacao';
    if (!nome) return Response.json({ error: 'nome_required' }, { status: 400 });
    if (Number.isNaN(dias) || dias < 0) return Response.json({ error: 'dias_invalido' }, { status: 400 });
    const produtos = await getProdutos();
    const produto = { id: genId(), nome, dias, tipoEtiqueta };
    await saveProdutos([...produtos, produto]);
    return Response.json({ produto });
  } catch (e) {
    return Response.json({ error: 'create_failed' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return Response.json({ error: 'id_required' }, { status: 400 });
    const produtos = await getProdutos();
    await saveProdutos(produtos.filter((p) => p.id !== id));
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: 'delete_failed' }, { status: 500 });
  }
}
