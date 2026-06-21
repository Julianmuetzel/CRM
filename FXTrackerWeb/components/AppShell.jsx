'use client';
import { useState } from 'react';
import { Home, Activity, BarChart2, Clock, LogOut } from 'lucide-react';
import DashboardView from './DashboardView';
import PositionsView from './PositionsView';
import TradesView from './TradesView';
import AnalyticsView from './AnalyticsView';

const TABS = [
  { key: 'dashboard', label: 'Dashboard', Icon: Home },
  { key: 'positions', label: 'Positionen', Icon: Activity },
  { key: 'trades', label: 'Historie', Icon: Clock },
  { key: 'analytics', label: 'Analytics', Icon: BarChart2 },
];

export default function AppShell({ accountId, onLogout }) {
  const [activeTab, setActiveTab] = useState('dashboard');

  function renderContent() {
    switch (activeTab) {
      case 'dashboard': return <DashboardView accountId={accountId} />;
      case 'positions': return <PositionsView accountId={accountId} />;
      case 'trades': return <TradesView accountId={accountId} />;
      case 'analytics': return <AnalyticsView accountId={accountId} />;
      default: return null;
    }
  }

  return (
    <div className="min-h-dvh bg-bg flex flex-col">
      {/* Status Bar Spacer */}
      <div className="safe-top" />

      {/* Header */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-border sticky top-0 bg-bg/95 backdrop-blur-xl z-40">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}
          >
            <span className="text-white font-black text-xs">FX</span>
          </div>
          <div>
            <span className="text-white font-extrabold text-base leading-none">FX Tracker Pro</span>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-profit pulse-dot" />
              <span className="text-profit text-xs font-medium">Live</span>
            </div>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="flex items-center gap-1.5 text-muted text-xs font-medium bg-surface border border-border rounded-full px-3 py-1.5"
        >
          <LogOut size={12} />
          Abmelden
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto scroll-container px-4 pt-4 pb-28">
        <div className="max-w-lg mx-auto slide-up">
          {renderContent()}
        </div>
      </main>

      {/* Bottom Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-bg/95 backdrop-blur-xl border-t border-border tab-bar z-50">
        <div className="flex max-w-lg mx-auto">
          {TABS.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 transition-all ${
                activeTab === key ? 'text-primary' : 'text-muted'
              }`}
            >
              <div className={`p-1.5 rounded-xl transition-all ${activeTab === key ? 'bg-primary/15' : ''}`}>
                <Icon size={20} strokeWidth={activeTab === key ? 2.5 : 1.5} />
              </div>
              <span className="text-xs font-semibold">{label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
