import { getConfig, getProcedencias, getStoreId } from '../../../../lib/etiquetasServer';
import { buildProcedenciasLotePdf } from '../../../../lib/etiquetaPdf';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const storeId = getStoreId(request);
  try {
    const body = await request.json();
    const ids = Array.isArray(body.ids) ? body.ids : [];
    if (ids.length === 0) return Response.json({ error: 'ids_required' }, { status: 400 });

    const idsSet = new Set(ids);
    const procedencias = await getProcedencias(storeId);
    const registros = procedencias.filter((p) => idsSet.has(p.id));
    if (registros.length === 0) return Response.json({ error: 'nenhuma_encontrada' }, { status: 404 });

    const config = await getConfig(storeId);
    const pdfBytes = await buildProcedenciasLotePdf(registros, config.larguraMm, config.alturaMm);

    return new Response(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="procedencias-lote.pdf"',
      },
    });
  } catch (e) {
    return Response.json({ error: 'pdf_failed' }, { status: 500 });
  }
}
