import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const { message } = await req.json();
    if (!message) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    const url = `${process.env.EVOLUTION_API_URL}/message/sendText/${process.env.EVOLUTION_INSTANCE}`;
    console.log('[send-whatsapp] POST', url);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: process.env.EVOLUTION_API_KEY,
      },
      body: JSON.stringify({
        number: process.env.WHATSAPP_DESTINATION_NUMBER,
        text: message,
      }),
    });

    console.log('[send-whatsapp] status', res.status);

    const rawBody = await res.text();

    if (!res.ok) {
      let parsedError;
      try {
        parsedError = JSON.parse(rawBody);
      } catch {
        parsedError = rawBody;
      }
      console.log('[send-whatsapp] error body', rawBody);
      return NextResponse.json(
        {
          error: 'Evolution API error',
          status: res.status,
          details: parsedError,
        },
        { status: res.status }
      );
    }

    let data;
    try {
      data = JSON.parse(rawBody);
    } catch {
      data = rawBody;
    }
    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.log('[send-whatsapp] unexpected error', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
