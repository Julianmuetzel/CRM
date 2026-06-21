'use client';
import { useState, useEffect } from 'react';
import LoginView from '../components/LoginView';
import AppShell from '../components/AppShell';

export default function Page() {
  const [accountId, setAccountId] = useState(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem('fxt_account');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed?.accountId) setAccountId(parsed.accountId);
      } catch {}
    }
    setHydrated(true);
  }, []);

  function handleConnect(id) {
    setAccountId(id);
  }

  function handleLogout() {
    sessionStorage.removeItem('fxt_account');
    setAccountId(null);
  }

  if (!hydrated) {
    return (
      <div className="min-h-dvh bg-[#0A0E1A] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-[#1E293B] border-t-[#3B82F6] rounded-full animate-spin" />
      </div>
    );
  }

  if (!accountId) {
    return <LoginView onConnect={handleConnect} />;
  }

  return <AppShell accountId={accountId} onLogout={handleLogout} />;
}
