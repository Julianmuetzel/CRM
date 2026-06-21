// MetaApi Cloud REST API integration
// Connects to MT5 accounts using only login credentials (no API key from user)
const axios = require('axios');

const META_API_TOKEN = process.env.META_API_TOKEN;
const DOMAIN = 'new-york.agiliumtrade.ai';
const PROVISIONING_URL = `https://mt-provisioning-api-v1.${DOMAIN}`;
const CLIENT_URL = `https://mt-client-api-v1.${DOMAIN}`;

function getHeaders() {
  return {
    'auth-token': META_API_TOKEN,
    'Content-Type': 'application/json',
  };
}

export async function createOrFindAccount({ login, password, server, name = 'FX Tracker Account' }) {
  const headers = getHeaders();

  // Check if account already exists
  const listRes = await axios.get(`${PROVISIONING_URL}/users/current/accounts`, {
    headers,
    params: { limit: 100 },
  });

  const existing = listRes.data?.find(
    a => a.login === String(login) && a.server === server
  );

  if (existing) {
    // Update password if different
    if (existing.state !== 'DEPLOYED') {
      await axios.post(`${PROVISIONING_URL}/users/current/accounts/${existing._id}/deploy`, {}, { headers });
      await waitForConnection(existing._id);
    }
    return existing._id;
  }

  // Create new account
  const createRes = await axios.post(
    `${PROVISIONING_URL}/users/current/accounts`,
    {
      login: String(login),
      password,
      name,
      server,
      type: 'cloud',
      platform: 'mt5',
      magic: 0,
      application: 'MetaApi',
    },
    { headers }
  );

  const accountId = createRes.data.id;

  await axios.post(`${PROVISIONING_URL}/users/current/accounts/${accountId}/deploy`, {}, { headers });
  await waitForConnection(accountId);

  return accountId;
}

async function waitForConnection(accountId, maxWaitMs = 60000) {
  const headers = getHeaders();
  const start = Date.now();

  while (Date.now() - start < maxWaitMs) {
    const res = await axios.get(`${PROVISIONING_URL}/users/current/accounts/${accountId}`, { headers });
    const state = res.data?.connectionStatus;

    if (state === 'CONNECTED') return;
    if (state === 'ERROR') throw new Error('MT5 connection failed – check credentials and server');

    await new Promise(r => setTimeout(r, 3000));
  }
  throw new Error('Connection timeout – MT5 server may be unavailable');
}

export async function getAccountInformation(accountId) {
  const res = await axios.get(
    `${CLIENT_URL}/users/current/accounts/${accountId}/account-information`,
    { headers: getHeaders() }
  );
  return res.data;
}

export async function getPositions(accountId) {
  const res = await axios.get(
    `${CLIENT_URL}/users/current/accounts/${accountId}/positions`,
    { headers: getHeaders() }
  );
  return res.data;
}

export async function getOrders(accountId) {
  const res = await axios.get(
    `${CLIENT_URL}/users/current/accounts/${accountId}/orders`,
    { headers: getHeaders() }
  );
  return res.data;
}

export async function getDeals(accountId, startDate, endDate) {
  const start = startDate || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
  const end = endDate || new Date().toISOString();

  const res = await axios.get(
    `${CLIENT_URL}/users/current/accounts/${accountId}/history-deals/time/${encodeURIComponent(start)}/${encodeURIComponent(end)}`,
    { headers: getHeaders() }
  );
  return res.data;
}

export function computeAnalytics(deals) {
  const trades = deals.filter(d => d.type === 'DEAL_TYPE_BUY' || d.type === 'DEAL_TYPE_SELL');
  const closedTrades = trades.filter(d => d.entryType === 'DEAL_ENTRY_OUT' || d.entryType === 'DEAL_ENTRY_INOUT');

  if (closedTrades.length === 0) {
    return { totalTrades: 0, winRate: 0, profitFactor: 0, avgWin: 0, avgLoss: 0, maxDrawdown: 0, totalProfit: 0, totalLoss: 0, bestTrade: 0, worstTrade: 0, longsWon: 0, shortsWon: 0, sharpeRatio: 0, monthlyPnl: [], dailyPnl: [] };
  }

  const wins = closedTrades.filter(t => t.profit > 0);
  const losses = closedTrades.filter(t => t.profit < 0);
  const totalGross = wins.reduce((s, t) => s + t.profit, 0);
  const totalLoss = Math.abs(losses.reduce((s, t) => s + t.profit, 0));

  const profits = closedTrades.map(t => t.profit);
  const best = Math.max(...profits, 0);
  const worst = Math.min(...profits, 0);

  // Max Drawdown
  let peak = 0, maxDD = 0, runningPnL = 0;
  for (const t of closedTrades) {
    runningPnL += t.profit;
    if (runningPnL > peak) peak = runningPnL;
    const dd = ((peak - runningPnL) / (peak || 1)) * 100;
    if (dd > maxDD) maxDD = dd;
  }

  // Sharpe (simplified)
  const mean = profits.reduce((a, b) => a + b, 0) / profits.length;
  const variance = profits.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / profits.length;
  const sharpe = variance > 0 ? (mean / Math.sqrt(variance)) * Math.sqrt(252) : 0;

  // Longs/Shorts won
  const longsWon = closedTrades.filter(t => t.type === 'DEAL_TYPE_BUY' && t.profit > 0).length;
  const longsTotal = closedTrades.filter(t => t.type === 'DEAL_TYPE_BUY').length;
  const shortsWon = closedTrades.filter(t => t.type === 'DEAL_TYPE_SELL' && t.profit > 0).length;
  const shortsTotal = closedTrades.filter(t => t.type === 'DEAL_TYPE_SELL').length;

  // Monthly PnL
  const monthlyMap = {};
  for (const t of closedTrades) {
    const month = new Date(t.time).toISOString().slice(0, 7);
    monthlyMap[month] = (monthlyMap[month] || 0) + t.profit;
  }
  const monthlyPnl = Object.entries(monthlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, profit]) => ({ month, profit }));

  // Daily PnL (last 30 days)
  const dailyMap = {};
  for (const t of closedTrades) {
    const day = new Date(t.time).toISOString().slice(0, 10);
    dailyMap[day] = (dailyMap[day] || 0) + t.profit;
  }
  const dailyPnl = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-30)
    .map(([date, profit]) => ({ date, profit }));

  // Consecutive wins/losses
  let maxConsecWins = 0, maxConsecLosses = 0, curW = 0, curL = 0;
  for (const t of closedTrades) {
    if (t.profit > 0) { curW++; curL = 0; maxConsecWins = Math.max(maxConsecWins, curW); }
    else { curL++; curW = 0; maxConsecLosses = Math.max(maxConsecLosses, curL); }
  }

  return {
    totalTrades: closedTrades.length,
    winRate: (wins.length / closedTrades.length) * 100,
    profitFactor: totalLoss > 0 ? totalGross / totalLoss : totalGross > 0 ? 999 : 0,
    avgWin: wins.length > 0 ? totalGross / wins.length : 0,
    avgLoss: losses.length > 0 ? totalLoss / losses.length : 0,
    maxDrawdown: maxDD,
    totalProfit: totalGross,
    totalLoss,
    bestTrade: best,
    worstTrade: worst,
    longsWon: longsTotal > 0 ? (longsWon / longsTotal) * 100 : 0,
    shortsWon: shortsTotal > 0 ? (shortsWon / shortsTotal) * 100 : 0,
    sharpeRatio: sharpe,
    maxConsecWins,
    maxConsecLosses,
    totalWins: wins.length,
    totalLosses: losses.length,
    monthlyPnl,
    dailyPnl,
    netProfit: totalGross - totalLoss,
  };
}
