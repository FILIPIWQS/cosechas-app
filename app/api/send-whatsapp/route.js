import { NextResponse } from 'next/server';
import { DEFAULT_STORE } from '../../../lib/stores';
import { getStores } from '../../../lib/storesServer';

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

    const url = `${process.env.EVOLUTION_API_URL}/message/sendText/${process.env.EVOLUTION_INSTANCE}`;
    const numbers = (process.env.WHATSAPP_DESTINATION_NUMBER || '')
      .split(',')
      .map((n) => n.trim())
      .filter(Boolean);

    if (numbers.length === 0) {
      return NextResponse.json({ error: 'WHATSAPP_DESTINATION_NUMBER is not set' }, { status: 500 });
    }

    console.log('[send-whatsapp] POST to', url, 'numbers:', numbers);

    const results = await Promise.all(
      numbers.map(async (number) => {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: process.env.EVOLUTION_API_KEY,
          },
          body: JSON.stringify({ number, text: fullMessage }),
        });

        console.log('[send-whatsapp] status for', number, res.status);

        const rawBody = await res.text();

        if (!res.ok) {
          let parsedError;
          try {
            parsedError = JSON.parse(rawBody);
          } catch {
            parsedError = rawBody;
          }
          console.log('[send-whatsapp] error body for', number, rawBody);
          throw { number, status: res.status, details: parsedError };
        }

        let data;
        try {
          data = JSON.parse(rawBody);
        } catch {
          data = rawBody;
        }
        return { number, data };
      })
    );

    return NextResponse.json({ success: true, results });
  } catch (err) {
    if (err.number) {
      return NextResponse.json(
        { error: 'Evolution API error', number: err.number, status: err.status, details: err.details },
        { status: err.status || 500 }
      );
    }
    console.log('[send-whatsapp] unexpected error', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
