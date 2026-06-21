'use client';
import { useState, useEffect } from 'react';
import { formatCurrency } from '../lib/servers';
import { ChevronDown, ChevronUp, Search, Filter } from 'lucide-react';

function TradeCard({ trade, currency }) {
  const [open, setOpen] = useState(false);
  const isWin = trade.profit > 0;
  const isBuy = trade.type === 0 || trade.type === 'DEAL_TYPE_BUY';

  const date = trade.time
    ? new Date(trade.time).toLocaleDateString('de-DE', {
        day: '2-digit', month: '2-digit', year: '2-digit',
        hour: '2-digit', minute: '2-digit',
      })
    : '-';

  return (
    <div
      className="bg-card border border-border rounded-2xl overflow-hidden cursor-pointer"
      onClick={() => setOpen(!open)}
    >
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <div className={`w-1 self-stretch rounded-full ${isWin ? 'bg-profit' : 'bg-loss'}`} />
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                isBuy ? 'bg-profit/15 text-profit' : 'bg-loss/15 text-loss'
              }`}>
                {isBuy ? 'KAUF' : 'VERK'}
              </span>
              <span className="text-white font-bold text-sm">{trade.symbol}</span>
            </div>
            <p className="text-muted text-xs">{date}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <p className={`font-extrabold text-base ${isWin ? 'text-profit' : 'text-loss'}`}>
              {trade.profit >= 0 ? '+' : ''}{formatCurrency(trade.profit, currency)}
            </p>
            <p className="text-muted text-xs">{trade.volume || '-'} Lots</p>
          </div>
          {open ? <ChevronUp size={14} className="text-muted" /> : <ChevronDown size={14} className="text-muted" />}
        </div>
      </div>

      {open && (
        <div className="px-4 pb-4 pt-0 border-t border-border grid grid-cols-2 gap-3">
          {[
            { label: 'Eröffnung', value: trade.openPrice || trade.price || '-' },
            { label: 'Schließung', value: trade.closePrice || '-' },
            { label: 'Volumen', value: trade.volume || '-' },
            { label: 'Commission', value: formatCurrency(trade.commission || 0, currency) },
            { label: 'Swap', value: formatCurrency(trade.swap || 0, currency) },
            { label: 'Kommentar', value: trade.comment || '-' },
          ].map(d => (
            <div key={d.label} className="pt-3">
              <p className="text-muted text-xs mb-0.5">{d.label}</p>
              <p className="text-white text-sm font-medium">{d.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TradesView({ accountId }) {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [period, setPeriod] = useState('year');
  const [account, setAccount] = useState(null);

  useEffect(() => { loadData(); }, [accountId, period]);

  async function loadData() {
    setLoading(true);
    try {
      const [histRes, accRes] = await Promise.all([
        fetch(`/api/history?accountId=${accountId}&period=${period}`),
        fetch(`/api/account?accountId=${accountId}`),
      ]);
      const [hist, acc] = await Promise.all([histRes.json(), accRes.json()]);
      if (histRes.ok && hist.deals) setDeals(hist.deals);
      if (accRes.ok) setAccount(acc);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const currency = account?.currency || 'USD';

  const filteredDeals = deals.filter(d => {
    const matchSearch = !search || (d.symbol || '').toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === 'all' ||
      (filter === 'wins' && d.profit > 0) ||
      (filter === 'losses' && d.profit < 0);
    const isActualTrade = d.type === 'DEAL_TYPE_BUY' || d.type === 'DEAL_TYPE_SELL' || typeof d.type === 'number';
    return matchSearch && matchFilter && isActualTrade;
  }).sort((a, b) => new Date(b.time) - new Date(a.time));

  const totalPnL = filteredDeals.reduce((s, d) => s + (d.profit || 0), 0);
  const wins = filteredDeals.filter(d => d.profit > 0).length;
  const losses = filteredDeals.filter(d => d.profit < 0).length;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-extrabold text-white">Trade Historie</h2>
        <p className="text-muted text-xs mt-0.5">Alle abgeschlossenen Trades</p>
      </div>

      {/* Period */}
      <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
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
              period === p.key ? 'bg-primary text-white' : 'bg-surface text-muted'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="bg-card border border-border rounded-2xl p-4 grid grid-cols-4 gap-2">
        {[
          { label: 'Trades', value: filteredDeals.length, color: 'text-white' },
          { label: 'Gewinne', value: wins, color: 'text-profit' },
          { label: 'Verluste', value: losses, color: 'text-loss' },
          { label: 'Gesamt', value: formatCurrency(totalPnL, currency, 0), color: totalPnL >= 0 ? 'text-profit' : 'text-loss' },
        ].map(s => (
          <div key={s.label} className="text-center">
            <p className={`font-extrabold text-base ${s.color}`}>{s.value}</p>
            <p className="text-muted text-xs">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Symbol suchen..."
          className="w-full bg-surface border border-border rounded-2xl pl-10 pr-4 py-3 text-white placeholder-muted text-sm focus:outline-none focus:border-primary"
        />
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {[
          { key: 'all', label: 'Alle' },
          { key: 'wins', label: '✓ Gewinne' },
          { key: 'losses', label: '✗ Verluste' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              filter === f.key ? 'bg-primary text-white' : 'bg-surface text-muted'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-border border-t-primary rounded-full animate-spin" />
        </div>
      ) : filteredDeals.length === 0 ? (
        <div className="flex flex-col items-center py-16 gap-3">
          <span className="text-4xl">📊</span>
          <p className="text-white font-semibold">Keine Trades gefunden</p>
          <p className="text-muted text-sm text-center">Ändere den Zeitraum oder Such-Filter</p>
        </div>
      ) : (
        <div className="space-y-2 pb-4">
          {filteredDeals.map((deal, i) => (
            <TradeCard key={deal.id || i} trade={deal} currency={currency} />
          ))}
        </div>
      )}
    </div>
  );
}
