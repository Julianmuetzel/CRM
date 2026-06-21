// Capital.com MetaTrader 5 Server List
export const CAPITAL_SERVERS = [
  { label: 'Capital.com – Demo', value: 'CAPITALCOM-MT5-DEMO01' },
  { label: 'Capital.com – Live 01', value: 'CAPITALCOM-MT5-LIVE01' },
  { label: 'Capital.com – Live 02', value: 'CAPITALCOM-MT5-LIVE02' },
  { label: 'Capital.com – Live 03', value: 'CAPITALCOM-MT5-LIVE03' },
  { label: 'Capital.com – Demo (EU)', value: 'CAPITALCOM-MT5-DEMO-EU01' },
  { label: 'Capital.com – Live (EU)', value: 'CAPITALCOM-MT5-LIVE-EU01' },
];

export function formatCurrency(value, currency = 'USD', decimals = 2) {
  if (value === null || value === undefined) return '-';
  const n = parseFloat(value) || 0;
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

export function formatPercent(value, decimals = 2) {
  const n = parseFloat(value) || 0;
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(decimals)}%`;
}

export function formatNumber(value, decimals = 2) {
  const n = parseFloat(value) || 0;
  return n.toLocaleString('de-DE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function getRelativeTime(date) {
  if (!date) return '-';
  const d = new Date(date);
  const now = new Date();
  const diff = now - d;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `vor ${minutes} Min.`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.floor(hours / 24);
  return `vor ${days} Tagen`;
}
