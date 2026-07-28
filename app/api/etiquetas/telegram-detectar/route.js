export const dynamic = 'force-dynamic';

// Lê as últimas conversas que alguém iniciou com o bot (getUpdates), pra
// listar candidatos de "chat id" sem a pessoa precisar caçar o número manual.
export async function GET() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return Response.json({ error: 'bot_nao_configurado' }, { status: 500 });

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=100`, { cache: 'no-store' });
    const data = await res.json();
    if (!data.ok) return Response.json({ error: 'telegram_api_error', details: data }, { status: 502 });

    const porId = new Map();
    for (const update of data.result || []) {
      const chat = update.message?.chat || update.my_chat_member?.chat;
      if (!chat) continue;
      const nome = chat.title || [chat.first_name, chat.last_name].filter(Boolean).join(' ') || chat.username || String(chat.id);
      porId.set(String(chat.id), nome);
    }
    const candidatos = Array.from(porId, ([id, nome]) => ({ id, nome }));
    return Response.json({ candidatos });
  } catch (e) {
    return Response.json({ error: e.message || 'detect_failed' }, { status: 500 });
  }
}
