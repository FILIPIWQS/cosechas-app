import { getTelegramChats, saveTelegramChats, getStoreId } from '../../../../lib/etiquetasServer';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const storeId = getStoreId(request);
  const chats = await getTelegramChats(storeId);
  return Response.json({ chats });
}

export async function POST(request) {
  const storeId = getStoreId(request);
  try {
    const body = await request.json();
    const chats = Array.isArray(body.chats)
      ? body.chats
          .map((c) => ({ id: String(c.id || '').trim(), nome: String(c.nome || '').trim() }))
          .filter((c) => c.id)
      : [];
    await saveTelegramChats(storeId, chats);
    return Response.json({ chats });
  } catch (e) {
    return Response.json({ error: 'save_failed' }, { status: 500 });
  }
}
