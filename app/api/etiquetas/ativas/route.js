import { getEtiquetas, saveEtiquetas, getStoreId, genId } from '../../../../lib/etiquetasServer';

export const dynamic = 'force-dynamic';

function hojeISO() {
  // Data local, não UTC — ver comentário equivalente em app/etiquetas/page.js.
  const d = new Date();
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function somarDias(dataISO, dias) {
  const d = new Date(`${dataISO}T00:00:00`);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

export async function GET(request) {
  const storeId = getStoreId(request);
  const etiquetas = await getEtiquetas(storeId);
  return Response.json({ etiquetas });
}

export async function POST(request) {
  const storeId = getStoreId(request);
  try {
    const body = await request.json();
    const produto = String(body.produto || '').trim();
    const dias = Number(body.dias);
    const dataManipulacao = body.dataManipulacao || hojeISO();
    const colaborador = String(body.colaborador || '').trim();
    if (!produto) return Response.json({ error: 'produto_required' }, { status: 400 });
    if (Number.isNaN(dias) || dias < 0) return Response.json({ error: 'dias_invalido' }, { status: 400 });
    if (!colaborador) return Response.json({ error: 'colaborador_required' }, { status: 400 });

    // Troca antecipada de um produto do mesmo grupo de validade: em vez de
    // dataManipulacao + dias, herda a data de validade que o resto do grupo
    // já tem, pra não desalinhar o grupo com uma data só daquele produto.
    const dataValidadeGrupo = /^\d{4}-\d{2}-\d{2}$/.test(body.dataValidadeGrupo || '') ? body.dataValidadeGrupo : null;

    const registro = {
      id: genId(),
      produto,
      dataManipulacao,
      dataValidade: dataValidadeGrupo || somarDias(dataManipulacao, dias),
      colaborador,
    };
    const etiquetas = await getEtiquetas(storeId);
    await saveEtiquetas(storeId, [...etiquetas, registro]);
    return Response.json({ etiqueta: registro });
  } catch (e) {
    return Response.json({ error: 'create_failed' }, { status: 500 });
  }
}

export async function DELETE(request) {
  const storeId = getStoreId(request);
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return Response.json({ error: 'id_required' }, { status: 400 });
    const etiquetas = await getEtiquetas(storeId);
    await saveEtiquetas(storeId, etiquetas.filter((e) => e.id !== id));
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: 'delete_failed' }, { status: 500 });
  }
}

// Marca que o aviso de Telegram (véspera ou dia da troca) já foi mandado pra
// essa etiqueta, pra checagem periódica não mandar de novo.
export async function PATCH(request) {
  const storeId = getStoreId(request);
  try {
    const body = await request.json();
    const { id, tipo } = body;
    if (!id || (tipo !== 'vespera' && tipo !== 'dia')) return Response.json({ error: 'dados_invalidos' }, { status: 400 });
    const etiquetas = await getEtiquetas(storeId);
    const idx = etiquetas.findIndex((e) => e.id === id);
    if (idx === -1) return Response.json({ error: 'nao_encontrado' }, { status: 404 });
    const atualizada = { ...etiquetas[idx], avisos: { ...etiquetas[idx].avisos, [tipo]: true } };
    const novaLista = [...etiquetas];
    novaLista[idx] = atualizada;
    await saveEtiquetas(storeId, novaLista);
    return Response.json({ etiqueta: atualizada });
  } catch (e) {
    return Response.json({ error: 'update_failed' }, { status: 500 });
  }
}
