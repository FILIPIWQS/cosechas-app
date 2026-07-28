import { getConfig, getEtiquetas, getStoreId } from '../../../../lib/etiquetasServer';
import { buildEtiquetasLotePdf } from '../../../../lib/etiquetaPdf';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const storeId = getStoreId(request);
  try {
    const body = await request.json();
    const ids = Array.isArray(body.ids) ? body.ids : [];
    if (ids.length === 0) return Response.json({ error: 'ids_required' }, { status: 400 });

    const idsSet = new Set(ids);
    const etiquetas = await getEtiquetas(storeId);
    const registros = etiquetas.filter((e) => idsSet.has(e.id));
    if (registros.length === 0) return Response.json({ error: 'nenhuma_encontrada' }, { status: 404 });

    const config = await getConfig(storeId);
    const pdfBytes = await buildEtiquetasLotePdf(registros, config.larguraMm, config.alturaMm);

    return new Response(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="etiquetas-lote.pdf"',
      },
    });
  } catch (e) {
    return Response.json({ error: 'pdf_failed' }, { status: 500 });
  }
}
