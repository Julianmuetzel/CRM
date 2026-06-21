'use client';
import { useState } from 'react';
import { TrendingUp, Eye, EyeOff, Server, Lock, User, ChevronDown } from 'lucide-react';
import { CAPITAL_SERVERS } from '../lib/servers';

export default function LoginView({ onConnect }) {
  const [form, setForm] = useState({ login: '', password: '', server: CAPITAL_SERVERS[0].value });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showServerPicker, setShowServerPicker] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.login || !form.password || !form.server) {
      setError('Bitte alle Felder ausfüllen');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Verbindung fehlgeschlagen');

      // Store in sessionStorage
      sessionStorage.setItem('fxt_account', JSON.stringify({ ...data, login: form.login }));
      onConnect(data.accountId);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const selectedServer = CAPITAL_SERVERS.find(s => s.value === form.server);

  return (
    <div className="min-h-dvh bg-bg flex flex-col items-center justify-center px-6 py-12">
      {/* Logo */}
      <div className="flex flex-col items-center mb-10">
        <div
          className="w-20 h-20 rounded-3xl flex items-center justify-center mb-5"
          style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}
        >
          <TrendingUp size={36} color="white" strokeWidth={2.5} />
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">FX Tracker Pro</h1>
        <p className="text-muted text-sm mt-1">MetaTrader 5 Analytics für Capital.com</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">

        {/* Info Box */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 flex gap-3">
          <div className="text-blue-400 mt-0.5 text-lg">ℹ️</div>
          <p className="text-blue-300 text-xs leading-relaxed">
            Gib deine <strong>MT5-Kontonummer</strong>, dein <strong>Passwort</strong> und den <strong>Capital.com Server</strong> ein – genau wie bei MyFxBook. Keine API-Keys nötig.
          </p>
        </div>

        {/* MT5 Login */}
        <div>
          <label className="block text-muted text-xs font-semibold uppercase tracking-wider mb-2">
            MT5 Kontonummer
          </label>
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted">
              <User size={18} />
            </div>
            <input
              type="number"
              value={form.login}
              onChange={e => setForm(f => ({ ...f, login: e.target.value }))}
              placeholder="12345678"
              className="w-full bg-surface border border-border rounded-2xl pl-11 pr-4 py-4 text-white placeholder-muted text-base focus:outline-none focus:border-primary transition-colors"
              inputMode="numeric"
            />
          </div>
        </div>

        {/* Password */}
        <div>
          <label className="block text-muted text-xs font-semibold uppercase tracking-wider mb-2">
            Passwort (Investor oder Master)
          </label>
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted">
              <Lock size={18} />
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              placeholder="••••••••"
              className="w-full bg-surface border border-border rounded-2xl pl-11 pr-12 py-4 text-white placeholder-muted text-base focus:outline-none focus:border-primary transition-colors"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-white transition-colors"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <p className="text-muted text-xs mt-1.5 ml-1">
            💡 Investor-Passwort = nur lesend (empfohlen)
          </p>
        </div>

        {/* Server Selection */}
        <div>
          <label className="block text-muted text-xs font-semibold uppercase tracking-wider mb-2">
            Capital.com Server
          </label>
          <button
            type="button"
            onClick={() => setShowServerPicker(!showServerPicker)}
            className="w-full bg-surface border border-border rounded-2xl px-4 py-4 flex items-center gap-3 text-left transition-colors hover:border-primary/50"
          >
            <Server size={18} className="text-muted shrink-0" />
            <span className="text-white flex-1 text-base">{selectedServer?.label || form.server}</span>
            <ChevronDown
              size={18}
              className={`text-muted transition-transform ${showServerPicker ? 'rotate-180' : ''}`}
            />
          </button>

          {showServerPicker && (
            <div className="mt-2 bg-surface border border-border rounded-2xl overflow-hidden shadow-xl">
              {CAPITAL_SERVERS.map(s => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => {
                    setForm(f => ({ ...f, server: s.value }));
                    setShowServerPicker(false);
                  }}
                  className={`w-full px-4 py-3.5 text-left text-sm transition-colors hover:bg-white/5 ${
                    form.server === s.value ? 'text-primary font-semibold' : 'text-white'
                  } border-b border-border last:border-0`}
                >
                  {s.label}
                  <span className="block text-muted text-xs mt-0.5">{s.value}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 text-red-400 text-sm">
            ⚠️ {error}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 rounded-2xl font-bold text-white text-base transition-all disabled:opacity-60 disabled:scale-100 active:scale-[0.98]"
          style={{
            background: loading ? '#374151' : 'linear-gradient(135deg, #3B82F6, #6366F1)',
          }}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-3">
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Verbinde mit MT5 Server...
            </span>
          ) : (
            'Mit MetaTrader 5 verbinden'
          )}
        </button>

        {/* Features */}
        <div className="grid grid-cols-3 gap-3 pt-2">
          {[
            { icon: '🔒', label: 'Sicher' },
            { icon: '⚡', label: 'Echtzeit' },
            { icon: '📊', label: 'Analytics' },
          ].map(f => (
            <div key={f.label} className="flex flex-col items-center gap-1.5 bg-surface/50 rounded-2xl py-3">
              <span className="text-2xl">{f.icon}</span>
              <span className="text-muted text-xs">{f.label}</span>
            </div>
          ))}
        </div>
      </form>
    </div>
  );
}
