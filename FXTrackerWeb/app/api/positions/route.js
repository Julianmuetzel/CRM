import { NextResponse } from 'next/server';
import { getPositions, getOrders } from '../../../lib/metaapi';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get('accountId');
  const type = searchParams.get('type') || 'positions';

  if (!accountId) return NextResponse.json({ error: 'accountId required' }, { status: 400 });

  try {
    const data = type === 'orders' ? await getOrders(accountId) : await getPositions(accountId);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
