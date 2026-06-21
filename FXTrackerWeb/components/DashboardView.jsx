'use client';
import { useState, useEffect } from 'react';
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { RefreshCw, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { formatCurrency, formatPercent } from '../lib/servers';

function StatBox({ label, value, sub, valueClass = 'text-white', size = 'md' }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <p className="text-muted text-xs font-semibold uppercase tracking-wider mb-1">{label}</p>
      <p className={`font-extrabold leading-tight ${valueClass} ${size === 'lg' ? 'text-2xl' : 'text-xl'}`}>
        {value}
      </p>
      {sub && <p className="text-muted text-xs mt-1">{sub}</p>}
    </div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const val = payload[0].value;
  return (
    <div className="bg-card border border-border rounded-xl px-3 py-2">
      <p className="text-muted text-xs">{label}</p>
      <p className={`font-bold text-sm ${val >= 0 ? 'text-profit' : 'text-loss'}`}>
        {val >= 0 ? '+' : ''}{val?.toFixed(2)}
      </p>
    </div>
  );
}

export default function DashboardView({ accountId }) {
  const [account, setAccount] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [positions, setPositions] = useState([]);
  const [period, setPeriod] = useState('year');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);

  useEffect(() => { loadAll(); }, [accountId, period]);

  async function loadAll(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [accRes, posRes, histRes] = await Promise.all([
        fetch(`/api/account?accountId=${accountId}`),
        fetch(`/api/positions?accountId=${accountId}`),
        fetch(`/api/history?accountId=${accountId}&period=${period}`),
      ]);

      const [acc, pos, hist] = await Promise.all([
        accRes.json(), posRes.json(), histRes.json(),
      ]);

      if (!accRes.ok) throw new Error(acc.error);
      setAccount(acc);
      setPositions(Array.isArray(pos) ? pos : []);
      if (histRes.ok && hist.analytics) setAnalytics(hist.analytics);
      setLastUpdate(new Date());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 py-20">
        <div className="w-12 h-12 border-2 border-border border-t-primary rounded-full animate-spin" />
        <p className="text-muted text-sm">Lade Kontodaten...</p>
        <p className="text-muted/60 text-xs">MT5 Server Verbindung wird aufgebaut</p>
      </div>
    );
  }

  if (!account) return null;

  const openPnL = positions.reduce((s, p) => s + (p.unrealizedProfit || p.profit || 0), 0);
  const currency = account.currency || 'USD';
  const growth = account.equity && account.balance
    ? ((account.equity - account.balance) / account.balance) * 100
    : 0;

  const chartData = analytics?.monthlyPnl?.length
    ? analytics.monthlyPnl.map(m => ({
        name: m.month?.slice(5, 7) + '/' + m.month?.slice(2, 4),
        value: m.profit,
      }))
    : analytics?.dailyPnl?.slice(-14).map(d => ({
        name: d.date?.slice(5),
        value: d.profit,
      })) || [];

  return (
    <div className="space-y-4">
      {/* Balance Hero Card */}
      <div
        className="rounded-3xl p-6 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #1D2B4E 0%, #111827 100%)' }}
      >
        <div className="absolute inset-0 opacity-20"
          style={{ background: 'radial-gradient(circle at 80% 50%, #3B82F6 0%, transparent 60%)' }} />
        <div className="relative">
          <div className="flex justify-between items-start mb-5">
            <div>
              <p className="text-muted text-xs font-semibold uppercase tracking-wider mb-1">Kontostand</p>
              <p className="text-4xl font-extrabold text-white tracking-tight">
                {formatCurrency(account.balance, currency)}
              </p>
            </div>
            <button
              onClick={() => loadAll(true)}
              className={`w-10 h-10 bg-white/10 rounded-full flex items-center justify-center ${refreshing ? 'animate-spin' : ''}`}
            >
              <RefreshCw size={16} color="white" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
            <div>
              <p className="text-white/50 text-xs mb-1">Eigenkapital</p>
              <p className="text-white font-bold text-lg">{formatCurrency(account.equity, currency)}</p>
            </div>
            <div className="text-right">
              <p className="text-white/50 text-xs mb-1">Offenes P&L</p>
              <p className={`font-bold text-lg ${openPnL >= 0 ? 'text-profit' : 'text-loss'}`}>
                {openPnL >= 0 ? '+' : ''}{formatCurrency(openPnL, currency)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Period Selector */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {[
          { key: 'week', label: '1W' },
          { key: 'month', label: '1M' },
          { key: '3months', label: '3M' },
          { key: '6months', label: '6M' },
          { key: 'year', label: '1J' },
        ].map(p => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
              period === p.key
                ? 'bg-primary text-white'
                : 'bg-surface text-muted hover:text-white'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-3">
        <StatBox
          label="Free Margin"
          value={formatCurrency(account.freeMargin, currency)}
        />
        <StatBox
          label="Margin Level"
          value={account.marginLevel ? `${account.marginLevel?.toFixed(1)}%` : '∞'}
          valueClass={account.marginLevel < 100 ? 'text-loss' : account.marginLevel < 200 ? 'text-yellow-400' : 'text-profit'}
        />
      </div>

      {/* Analytics Stats */}
      {analytics && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <StatBox
              label="Win Rate"
              value={formatPercent(analytics.winRate, 1)}
              valueClass={analytics.winRate >= 50 ? 'text-profit' : 'text-loss'}
              sub={`${analytics.totalWins}W / ${analytics.totalLosses}L`}
            />
            <StatBox
              label="Profit Factor"
              value={analytics.profitFactor >= 999 ? '∞' : analytics.profitFactor?.toFixed(2)}
              valueClass={analytics.profitFactor >= 1.5 ? 'text-profit' : analytics.profitFactor >= 1 ? 'text-yellow-400' : 'text-loss'}
              sub={analytics.profitFactor >= 1.5 ? 'Exzellent' : analytics.profitFactor >= 1 ? 'Gut' : 'Negativ'}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <StatBox
              label="Netto-Gewinn"
              value={formatCurrency(analytics.netProfit, currency)}
              valueClass={analytics.netProfit >= 0 ? 'text-profit' : 'text-loss'}
            />
            <StatBox
              label="Max. Drawdown"
              value={`${analytics.maxDrawdown?.toFixed(2)}%`}
              valueClass={analytics.maxDrawdown > 20 ? 'text-loss' : analytics.maxDrawdown > 10 ? 'text-yellow-400' : 'text-profit'}
            />
          </div>

          {/* Equity Curve / Monthly P&L Chart */}
          {chartData.length > 0 && (
            <div className="bg-card border border-border rounded-2xl p-4">
              <p className="text-white font-bold text-sm mb-4">
                {analytics.monthlyPnl?.length ? 'Monatliche P&L' : 'Tägliche P&L'}
              </p>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="name"
                    tick={{ fill: '#94A3B8', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis hide />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={0} stroke="#1E293B" strokeDasharray="3 3" />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    fill="url(#profitGrad)"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Detailed Analytics Grid */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-white font-bold text-sm mb-4">Detailstatistiken</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {[
                { label: 'Gesamt Trades', value: analytics.totalTrades },
                { label: 'Sharpe Ratio', value: analytics.sharpeRatio?.toFixed(2) },
                { label: 'Avg. Gewinn', value: formatCurrency(analytics.avgWin, currency) },
                { label: 'Avg. Verlust', value: formatCurrency(analytics.avgLoss, currency) },
                { label: 'Bester Trade', value: formatCurrency(analytics.bestTrade, currency) },
                { label: 'Schlechtester', value: formatCurrency(analytics.worstTrade, currency) },
                { label: 'Konsekutiv Gewinne', value: analytics.maxConsecWins },
                { label: 'Konsekutiv Verluste', value: analytics.maxConsecLosses },
                { label: 'Longs Win %', value: formatPercent(analytics.longsWon, 1) },
                { label: 'Shorts Win %', value: formatPercent(analytics.shortsWon, 1) },
              ].map(s => (
                <div key={s.label} className="flex justify-between items-baseline border-b border-border/50 pb-2">
                  <span className="text-muted text-xs">{s.label}</span>
                  <span className="text-white text-xs font-semibold">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Open Positions Preview */}
      {positions.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex justify-between items-center mb-3">
            <p className="text-white font-bold text-sm">Offene Positionen ({positions.length})</p>
            <span className={`text-xs font-bold ${openPnL >= 0 ? 'text-profit' : 'text-loss'}`}>
              {openPnL >= 0 ? '+' : ''}{formatCurrency(openPnL, currency)}
            </span>
          </div>
          <div className="space-y-2">
            {positions.slice(0, 5).map((pos, i) => {
              const pnl = pos.unrealizedProfit || pos.profit || 0;
              return (
                <div key={i} className="flex items-center justify-between py-2 border-t border-border/50">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      pos.type === 0 || pos.type === 'BUY'
                        ? 'bg-profit/15 text-profit'
                        : 'bg-loss/15 text-loss'
                    }`}>
                      {pos.type === 0 || pos.type === 'BUY' ? 'KAUF' : 'VERK'}
                    </span>
                    <div>
                      <p className="text-white text-sm font-semibold">{pos.symbol}</p>
                      <p className="text-muted text-xs">{pos.volume} Lots</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                      {pnl >= 0 ? '+' : ''}{formatCurrency(pnl, currency)}
                    </p>
                    <p className="text-muted text-xs">@{pos.openPrice}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {lastUpdate && (
        <p className="text-center text-muted text-xs pb-2">
          Zuletzt aktualisiert: {lastUpdate.toLocaleTimeString('de-DE')}
        </p>
      )}
    </div>
  );
}
