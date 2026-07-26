import { NextResponse } from 'next/server';
import { DEFAULT_STORE } from '../../../lib/stores';
import { getStores } from '../../../lib/storesServer';

const MAX_MESSAGE_LENGTH = 4000;

function splitIntoChunks(text, maxLength) {
  const lines = text.split('\n');
  const chunks = [];
  let current = '';
  for (const line of lines) {
    const candidate = current ? `${current}\n${line}` : line;
    if (candidate.length > maxLength && current) {
      chunks.push(current);
      current = line;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

async function sendTelegramMessage(chatId, text) {
  const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });

  const rawBody = await res.text();
  let data;
  try {
    data = JSON.parse(rawBody);
  } catch {
    data = rawBody;
  }

  if (!res.ok || data.ok === false) {
    throw { status: res.status, details: data };
  }
  return data;
}

export async function POST(req) {
  try {
    const { message } = await req.json();
    if (!message) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    const storeId = req.headers.get('x-store-id');
    const stores = await getStores();
    const store = stores.find((s) => s.id === storeId) || stores.find((s) => s.id === DEFAULT_STORE) || stores[0];
    const fullMessage = `🏪 ${store.name}\n${message}`;

    const chatIds = (process.env.TELEGRAM_CHAT_ID || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);

    if (chatIds.length === 0) {
      return NextResponse.json({ error: 'TELEGRAM_CHAT_ID is not set' }, { status: 500 });
    }

    const chunks = splitIntoChunks(fullMessage, MAX_MESSAGE_LENGTH);

    console.log('[send-telegram] sending', chunks.length, 'part(s) to', chatIds);

    const results = await Promise.all(
      chatIds.map(async (chatId) => {
        const parts = [];
        for (let i = 0; i < chunks.length; i++) {
          const text = chunks.length > 1 ? `(${i + 1}/${chunks.length})\n${chunks[i]}` : chunks[i];
          parts.push(await sendTelegramMessage(chatId, text));
        }
        return { chatId, data: parts };
      })
    );

    return NextResponse.json({ success: true, results });
  } catch (err) {
    if (err.status) {
      return NextResponse.json(
        { error: 'Telegram API error', status: err.status, details: err.details },
        { status: err.status || 500 }
      );
    }
    console.log('[send-telegram] unexpected error', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
