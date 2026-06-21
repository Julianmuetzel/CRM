import { NextResponse } from 'next/server';
import { getAccountInformation } from '../../../lib/metaapi';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get('accountId');

  if (!accountId) return NextResponse.json({ error: 'accountId required' }, { status: 400 });

  try {
    const data = await getAccountInformation(accountId);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
