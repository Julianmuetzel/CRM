import { NextResponse } from 'next/server';
import { createOrFindAccount } from '../../../../lib/metaapi';

export async function POST(request) {
  try {
    const body = await request.json();
    const { login, password, server } = body;

    if (!login || !password || !server) {
      return NextResponse.json(
        { error: 'Login, Passwort und Server sind erforderlich' },
        { status: 400 }
      );
    }

    if (!process.env.META_API_TOKEN) {
      return NextResponse.json(
        { error: 'META_API_TOKEN ist nicht konfiguriert. Bitte in Vercel Environment Variables setzen.' },
        { status: 500 }
      );
    }

    const accountId = await createOrFindAccount({
      login: String(login),
      password,
      server,
      name: `Capital.com MT5 – ${login}`,
    });

    return NextResponse.json({ accountId, login, server });
  } catch (error) {
    const msg = error?.response?.data?.message || error.message || 'Verbindung fehlgeschlagen';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
