'use client';
import { useState, useEffect, useCallback } from 'react';
import { formatCurrency } from '../lib/servers';
import { RefreshCw } from 'lucide-react';

function PositionCard({ pos, currency, index }) {
  const pnl = pos.unrealizedProfit || pos.profit || 0;
  const isBuy = pos.type === 0 || pos.type === 'BUY';
  const pips = pos.currentPrice && pos.openPrice
    ? ((pos.currentPrice - pos.openPrice) * (isBuy ? 1 : -1) * 10000).toFixed(1)
    : null;

  return (
    <div className="bg-card border border-border rounded-2xl p-4 relative overflow-hidden">
      {/* Profit/Loss gradient overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: pnl >= 0
            ? 'linear-gradient(90deg, rgba(16,185,129,0.06) 0%, transparent 100%)'
            : 'linear-gradient(90deg, rgba(239,68,68,0.06) 0%, transparent 100%)',
        }}
      />

      <div className="relative">
        {/* Header */}
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
              isBuy ? 'bg-profit/15 text-profit' : 'bg-loss/15 text-loss'
            }`}>
              {isBuy ? 'KAUF' : 'VERKAUF'}
            </span>
            <div>
              <p className="text-white font-extrabold text-lg leading-none">{pos.symbol}</p>
              <p className="text-muted text-xs mt-0.5">{pos.volume} Lots</p>
            </div>
          </div>
          <div className="text-right">
            <p className={`font-extrabold text-xl ${pnl >= 0 ? 'text-profit glow-profit' : 'text-loss glow-loss'}`}>
              {pnl >= 0 ? '+' : ''}{formatCurrency(pnl, currency)}
            </p>
            {pips !== null && (
              <p className={`text-xs font-semibold ${pnl >= 0 ? 'text-profit/70' : 'text-loss/70'}`}>
                {pips > 0 ? '+' : ''}{pips} Pips
              </p>
            )}
          </div>
        </div>

        {/* Price Info */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-surface/60 rounded-xl p-2.5">
            <p className="text-muted text-xs mb-0.5">Eröffnung</p>
            <p className="text-white text-sm font-bold">{pos.openPrice}</p>
          </div>
          <div className="bg-surface/60 rounded-xl p-2.5">
            <p className="text-muted text-xs mb-0.5">Aktuell</p>
            <p className="text-white text-sm font-bold">{pos.currentPrice || '-'}</p>
          </div>
          <div className="bg-surface/60 rounded-xl p-2.5">
            <p className="text-muted text-xs mb-0.5">Swap</p>
            <p className="text-white text-sm font-bold">{formatCurrency(pos.swap || 0, currency, 2)}</p>
          </div>
        </div>

        {/* SL/TP */}
        {(pos.stopLoss > 0 || pos.takeProfit > 0) && (
          <div className="flex gap-3 mt-2">
            {pos.stopLoss > 0 && (
              <span className="text-xs bg-loss/10 text-loss/80 border border-loss/20 rounded-lg px-2 py-1">
                SL: {pos.stopLoss}
              </span>
            )}
            {pos.takeProfit > 0 && (
              <span className="text-xs bg-profit/10 text-profit/80 border border-profit/20 rounded-lg px-2 py-1">
                TP: {pos.takeProfit}
              </span>
            )}
          </div>
        )}

        {/* Time */}
        {pos.time && (
          <p className="text-muted text-xs mt-2">
            {new Date(pos.time).toLocaleString('de-DE', {
              day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
            })}
          </p>
        )}
      </div>
    </div>
  );
}

export default function PositionsView({ accountId }) {
  const [positions, setPositions] = useState([]);
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [posRes, accRes] = await Promise.all([
        fetch(`/api/positions?accountId=${accountId}`),
        fetch(`/api/account?accountId=${accountId}`),
      ]);
      const [pos, acc] = await Promise.all([posRes.json(), accRes.json()]);
      setPositions(Array.isArray(pos) ? pos : []);
      if (accRes.ok) setAccount(acc);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accountId]);

  useEffect(() => {
    load();
    const interval = setInterval(() => load(true), 15000);
    return () => clearInterval(interval);
  }, [load]);

  const currency = account?.currency || 'USD';
  const totalPnL = positions.reduce((s, p) => s + (p.unrealizedProfit || p.profit || 0), 0);
  const profitable = positions.filter(p => (p.unrealizedProfit || p.profit || 0) > 0).length;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-extrabold text-white">Offene Positionen</h2>
          <p className="text-muted text-xs mt-0.5">Aktualisiert alle 15 Sekunden</p>
        </div>
        <button
          onClick={() => load(true)}
          className={`w-10 h-10 bg-surface border border-border rounded-full flex items-center justify-center ${refreshing ? 'animate-spin' : ''}`}
        >
          <RefreshCw size={16} className="text-muted" />
        </button>
      </div>

      {/* Summary */}
      <div
        className="rounded-2xl p-4 border"
        style={{
          background: totalPnL >= 0
            ? 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.04))'
            : 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(239,68,68,0.04))',
          borderColor: totalPnL >= 0 ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)',
        }}
      >
        <div className="flex justify-between items-center">
          <div>
            <p className="text-muted text-xs font-semibold uppercase tracking-wider mb-1">Gesamt offenes P&L</p>
            <p className={`text-3xl font-extrabold ${totalPnL >= 0 ? 'text-profit' : 'text-loss'}`}>
              {totalPnL >= 0 ? '+' : ''}{formatCurrency(totalPnL, currency)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-muted text-xs">{positions.length} Positionen</p>
            <p className="text-profit text-sm font-semibold">↑ {profitable} gewinnend</p>
            <p className="text-loss text-sm font-semibold">↓ {positions.length - profitable} verlierend</p>
          </div>
        </div>
      </div>

      {/* Positions */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-border border-t-primary rounded-full animate-spin" />
        </div>
      ) : positions.length === 0 ? (
        <div className="flex flex-col items-center py-16 gap-3">
          <span className="text-4xl">📊</span>
          <p className="text-white font-semibold">Keine offenen Positionen</p>
          <p className="text-muted text-sm">Aktuell sind keine Trades aktiv</p>
        </div>
      ) : (
        <div className="space-y-3 pb-4">
          {positions.map((pos, i) => (
            <PositionCard key={pos.id || pos.positionId || i} pos={pos} currency={currency} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
