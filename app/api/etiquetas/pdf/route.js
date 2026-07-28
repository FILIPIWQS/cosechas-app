import { getConfig, getStoreId } from '../../../../lib/etiquetasServer';
import { buildEtiquetaPdf } from '../../../../lib/etiquetaPdf';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const storeId = getStoreId(request);
  try {
    const body = await request.json();
    const produto = String(body.produto || '').trim();
    const dataManipulacao = body.dataManipulacao;
    const dataValidade = body.dataValidade;
    const colaborador = String(body.colaborador || '').trim();
    if (!produto || !dataManipulacao || !dataValidade || !colaborador) {
      return Response.json({ error: 'dados_incompletos' }, { status: 400 });
    }
    const quantidade = Math.max(1, parseInt(body.quantidade, 10) || 1);

    let larguraMm = Number(body.larguraMm);
    let alturaMm = Number(body.alturaMm);
    if (!larguraMm || !alturaMm) {
      const config = await getConfig(storeId);
      larguraMm = config.larguraMm;
      alturaMm = config.alturaMm;
    }

    const registro = { produto, dataManipulacao, dataValidade, colaborador };
    const pdfBytes = await buildEtiquetaPdf(registro, quantidade, larguraMm, alturaMm);

    return new Response(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="etiqueta.pdf"',
      },
    });
  } catch (e) {
    return Response.json({ error: 'pdf_failed' }, { status: 500 });
  }
}
