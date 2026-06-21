'use client';
import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, ReferenceLine,
} from 'recharts';
import { formatCurrency, formatPercent } from '../lib/servers';

const COLORS_PIE = ['#10B981', '#EF4444'];

function GaugeMeter({ value, label, good, bad }) {
  const isGood = value >= good;
  const isBad = value <= bad;
  const color = isGood ? '#10B981' : isBad ? '#EF4444' : '#F59E0B';
  const pct = Math.min(Math.max(value, 0), 100);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-24 h-12">
        <svg viewBox="0 0 100 50" className="w-full">
          <path d="M 5 50 A 45 45 0 0 1 95 50" fill="none" stroke="#1E293B" strokeWidth="10" strokeLinecap="round" />
          <path
            d="M 5 50 A 45 45 0 0 1 95 50"
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${pct * 1.41} 141`}
          />
        </svg>
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
          <p className="text-xs font-extrabold" style={{ color }}>{value?.toFixed(1)}%</p>
        </div>
      </div>
      <p className="text-muted text-xs text-center">{label}</p>
    </div>
  );
}

export default function AnalyticsView({ accountId }) {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('year');

  useEffect(() => { loadData(); }, [accountId, period]);

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch(`/api/history?accountId=${accountId}&period=${period}`);
      const data = await res.json();
      if (res.ok && data.analytics) setAnalytics(data.analytics);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-border border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!analytics) return null;

  const winLossData = [
    { name: 'Gewinne', value: analytics.totalWins },
    { name: 'Verluste', value: analytics.totalLosses },
  ];

  const monthlyChartData = (analytics.monthlyPnl || []).map(m => ({
    name: m.month?.slice(5, 7) + '/' + m.month?.slice(2, 4),
    value: m.profit,
    fill: m.profit >= 0 ? '#10B981' : '#EF4444',
  }));

  const dailyChartData = (analytics.dailyPnl || []).slice(-20).map(d => ({
    name: d.date?.slice(5),
    value: d.profit,
  }));

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-extrabold text-white">Analytics</h2>
        <div className="flex gap-1.5">
          {[
            { key: 'month', label: '1M' },
            { key: '3months', label: '3M' },
            { key: 'year', label: '1J' },
          ].map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                period === p.key ? 'bg-primary text-white' : 'bg-surface text-muted'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-3">
        {[
          {
            label: 'Win Rate',
            value: `${analytics.winRate?.toFixed(1)}%`,
            sub: `${analytics.totalWins}W / ${analytics.totalLosses}L`,
            good: analytics.winRate >= 50,
          },
          {
            label: 'Profit Factor',
            value: analytics.profitFactor >= 999 ? '∞' : analytics.profitFactor?.toFixed(2),
            sub: analytics.profitFactor >= 1.5 ? 'Exzellent' : analytics.profitFactor >= 1 ? 'Positiv' : 'Negativ',
            good: analytics.profitFactor >= 1,
          },
          {
            label: 'Sharpe Ratio',
            value: analytics.sharpeRatio?.toFixed(2),
            sub: analytics.sharpeRatio >= 1 ? 'Gut' : 'Niedrig',
            good: analytics.sharpeRatio >= 1,
          },
          {
            label: 'Max Drawdown',
            value: `${analytics.maxDrawdown?.toFixed(2)}%`,
            sub: analytics.maxDrawdown < 10 ? 'Niedrig' : analytics.maxDrawdown < 20 ? 'Moderat' : 'Hoch',
            good: analytics.maxDrawdown < 10,
            inverse: true,
          },
        ].map(m => (
          <div key={m.label} className="bg-card border border-border rounded-2xl p-4">
            <p className="text-muted text-xs font-semibold uppercase tracking-wider mb-2">{m.label}</p>
            <p className={`text-2xl font-extrabold ${
              m.inverse
                ? (m.good ? 'text-profit' : 'text-loss')
                : (m.good ? 'text-profit' : 'text-loss')
            }`}>
              {m.value}
            </p>
            <p className="text-muted text-xs mt-1">{m.sub}</p>
          </div>
        ))}
      </div>

      {/* Gauge Section */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <p className="text-white font-bold text-sm mb-4">Performance-Meter</p>
        <div className="flex justify-around">
          <GaugeMeter value={analytics.winRate || 0} label="Win Rate" good={60} bad={40} />
          <GaugeMeter value={analytics.longsWon || 0} label="Longs Won" good={55} bad={45} />
          <GaugeMeter value={analytics.shortsWon || 0} label="Shorts Won" good={55} bad={45} />
        </div>
      </div>

      {/* Monthly Bar Chart */}
      {monthlyChartData.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-white font-bold text-sm mb-4">Monatliche P&L</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyChartData}>
              <XAxis dataKey="name" tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip
                formatter={v => [v?.toFixed(2), 'P&L']}
                contentStyle={{ backgroundColor: '#141E30', border: '1px solid #1E293B', borderRadius: 12, color: '#F1F5F9' }}
              />
              <ReferenceLine y={0} stroke="#1E293B" />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {monthlyChartData.map((entry, i) => (
                  <Cell key={i} fill={entry.value >= 0 ? '#10B981' : '#EF4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Win/Loss Pie */}
      {(analytics.totalWins > 0 || analytics.totalLosses > 0) && (
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-white font-bold text-sm mb-4">Win/Loss Verhältnis</p>
          <div className="flex items-center gap-4">
            <PieChart width={140} height={140}>
              <Pie data={winLossData} dataKey="value" innerRadius={40} outerRadius={65} paddingAngle={3}>
                {winLossData.map((_, i) => <Cell key={i} fill={COLORS_PIE[i]} />)}
              </Pie>
            </PieChart>
            <div className="space-y-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-3 h-3 rounded-full bg-profit" />
                  <span className="text-profit font-bold">Gewinne: {analytics.totalWins}</span>
                </div>
                <p className="text-muted text-xs ml-5">Avg: {formatCurrency(analytics.avgWin)}</p>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-3 h-3 rounded-full bg-loss" />
                  <span className="text-loss font-bold">Verluste: {analytics.totalLosses}</span>
                </div>
                <p className="text-muted text-xs ml-5">Avg: {formatCurrency(analytics.avgLoss)}</p>
              </div>
              <div className="border-t border-border pt-2">
                <p className="text-muted text-xs">Risk/Reward</p>
                <p className="text-white font-bold">
                  1:{analytics.avgLoss > 0 ? (analytics.avgWin / analytics.avgLoss).toFixed(2) : '∞'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Daily PnL Line */}
      {dailyChartData.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-4 pb-6">
          <p className="text-white font-bold text-sm mb-4">Tägliche P&L (letzte 20 Tage)</p>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={dailyChartData}>
              <XAxis dataKey="name" tick={{ fill: '#94A3B8', fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip
                formatter={v => [v?.toFixed(2), 'P&L']}
                contentStyle={{ backgroundColor: '#141E30', border: '1px solid #1E293B', borderRadius: 12, color: '#F1F5F9' }}
              />
              <ReferenceLine y={0} stroke="#1E293B" strokeDasharray="3 3" />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#6366F1"
                strokeWidth={2}
                dot={{ fill: '#6366F1', strokeWidth: 0, r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Full Stats Table */}
      <div className="bg-card border border-border rounded-2xl p-4 pb-6">
        <p className="text-white font-bold text-sm mb-4">Vollständige Statistiken</p>
        <div className="space-y-2.5">
          {[
            { label: 'Gesamt Trades', value: analytics.totalTrades },
            { label: 'Netto-Gewinn', value: formatCurrency(analytics.netProfit), color: analytics.netProfit >= 0 ? 'text-profit' : 'text-loss' },
            { label: 'Brutto-Gewinn', value: formatCurrency(analytics.totalProfit), color: 'text-profit' },
            { label: 'Brutto-Verlust', value: formatCurrency(analytics.totalLoss), color: 'text-loss' },
            { label: 'Bester Trade', value: formatCurrency(analytics.bestTrade), color: 'text-profit' },
            { label: 'Schlechtester Trade', value: formatCurrency(analytics.worstTrade), color: 'text-loss' },
            { label: 'Konsekutive Gewinne', value: analytics.maxConsecWins },
            { label: 'Konsekutive Verluste', value: analytics.maxConsecLosses },
            { label: 'Longs Win Rate', value: formatPercent(analytics.longsWon, 1) },
            { label: 'Shorts Win Rate', value: formatPercent(analytics.shortsWon, 1) },
          ].map(s => (
            <div key={s.label} className="flex justify-between items-center border-b border-border/40 pb-2">
              <span className="text-muted text-sm">{s.label}</span>
              <span className={`text-sm font-bold ${s.color || 'text-white'}`}>{s.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
