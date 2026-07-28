import { getTelegramChats, getStoreId, getConfig } from '../../../../lib/etiquetasServer';

export const dynamic = 'force-dynamic';

async function sendMessage(token, chatId, texto) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: texto }),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) throw { chatId, details: data };
  return data;
}

export async function POST(request) {
  const storeId = getStoreId(request);
  try {
    const body = await request.json();
    const mensagem = String(body.mensagem || '').trim();
    if (!mensagem) return Response.json({ error: 'mensagem_required' }, { status: 400 });

    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return Response.json({ enviado: false, motivo: 'bot_nao_configurado' });

    const chats = await getTelegramChats(storeId);
    if (chats.length === 0) return Response.json({ enviado: false, motivo: 'sem_chats_configurados' });

    // Nome da loja é local a essa instalação (configurado na tela "Config.
    // impressão"), não vem mais de uma lista compartilhada com outro app —
    // cada loja é uma instalação separada e precisa se identificar com o
    // próprio nome, senão toda loja manda aviso com o mesmo nome fixo.
    const config = await getConfig(storeId);
    const nomeLoja = config.nomeLoja?.trim() || 'Loja (nome não configurado)';
    const texto = `🏪 ${nomeLoja}\n${mensagem}`;

    const resultados = await Promise.allSettled(chats.map((c) => sendMessage(token, c.id, texto)));
    const falhas = resultados.filter((r) => r.status === 'rejected');
    return Response.json({ enviado: falhas.length < resultados.length, falhas: falhas.map((f) => f.reason) });
  } catch (e) {
    return Response.json({ error: e.message || 'send_failed' }, { status: 500 });
  }
}
