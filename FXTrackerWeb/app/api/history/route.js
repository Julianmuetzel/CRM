import { NextResponse } from 'next/server';
import { getDeals, computeAnalytics } from '../../../lib/metaapi';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get('accountId');
  const period = searchParams.get('period') || 'year';

  if (!accountId) return NextResponse.json({ error: 'accountId required' }, { status: 400 });

  const now = new Date();
  let startDate;

  switch (period) {
    case 'week':
      startDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      startDate = new Date(now - 30 * 24 * 60 * 60 * 1000);
      break;
    case '3months':
      startDate = new Date(now - 90 * 24 * 60 * 60 * 1000);
      break;
    case '6months':
      startDate = new Date(now - 180 * 24 * 60 * 60 * 1000);
      break;
    case 'year':
    default:
      startDate = new Date(now - 365 * 24 * 60 * 60 * 1000);
  }

  try {
    const deals = await getDeals(accountId, startDate.toISOString(), now.toISOString());
    const analytics = computeAnalytics(deals);
    return NextResponse.json({ deals, analytics });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
