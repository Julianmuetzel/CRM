import React, { createContext, useContext, useReducer, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import capitalApi from '../services/capitalApi';
import mt5Service from '../services/mt5Service';

const AppContext = createContext(null);

const initialState = {
  isAuthenticated: false,
  isLoading: true,
  connections: {
    capital: { connected: false, account: null },
    mt5: { connected: false, account: null },
  },
  dashboard: {
    balance: 0,
    equity: 0,
    margin: 0,
    freeMargin: 0,
    marginLevel: 0,
    profit: 0,
    profitPercent: 0,
    deposit: 0,
  },
  positions: [],
  orders: [],
  history: [],
  analytics: {
    totalTrades: 0,
    winRate: 0,
    profitFactor: 0,
    avgWin: 0,
    avgLoss: 0,
    maxDrawdown: 0,
    sharpeRatio: 0,
    longsWon: 0,
    shortsWon: 0,
    bestTrade: 0,
    worstTrade: 0,
    dailyPnl: [],
    monthlyPnl: [],
  },
  activeAccount: 'capital',
  theme: 'dark',
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_AUTHENTICATED':
      return { ...state, isAuthenticated: action.payload };
    case 'SET_CONNECTION':
      return {
        ...state,
        connections: {
          ...state.connections,
          [action.payload.type]: action.payload.data,
        },
      };
    case 'SET_DASHBOARD':
      return { ...state, dashboard: { ...state.dashboard, ...action.payload } };
    case 'SET_POSITIONS':
      return { ...state, positions: action.payload };
    case 'SET_ORDERS':
      return { ...state, orders: action.payload };
    case 'SET_HISTORY':
      return { ...state, history: action.payload };
    case 'SET_ANALYTICS':
      return { ...state, analytics: { ...state.analytics, ...action.payload } };
    case 'SET_ACTIVE_ACCOUNT':
      return { ...state, activeAccount: action.payload };
    case 'RESET':
      return { ...initialState, isLoading: false };
    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    initializeApp();
  }, []);

  async function initializeApp() {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const capitalResult = await capitalApi.restoreSession();
      if (capitalResult.success) {
        dispatch({
          type: 'SET_CONNECTION',
          payload: { type: 'capital', data: { connected: true, account: capitalResult.data } },
        });
        dispatch({ type: 'SET_AUTHENTICATED', payload: true });
        await refreshData();
      }

      const mt5Result = await mt5Service.restoreSession();
      if (mt5Result.success) {
        dispatch({
          type: 'SET_CONNECTION',
          payload: { type: 'mt5', data: { connected: true, account: mt5Result.data } },
        });
        if (!capitalResult.success) {
          dispatch({ type: 'SET_AUTHENTICATED', payload: true });
        }
      }
    } catch (e) {
      console.error('Init error:', e);
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }

  async function refreshData() {
    try {
      if (capitalApi.isConnected()) {
        const [accountRes, positionsRes, ordersRes] = await Promise.all([
          capitalApi.getAccountDetails(),
          capitalApi.getPositions(),
          capitalApi.getOrders(),
        ]);

        if (accountRes.success && accountRes.data?.accounts?.length > 0) {
          const acc = accountRes.data.accounts[0];
          dispatch({
            type: 'SET_DASHBOARD',
            payload: {
              balance: acc.balance?.balance || 0,
              equity: acc.balance?.equity || 0,
              margin: acc.balance?.margin || 0,
              freeMargin: acc.balance?.available || 0,
              profit: acc.balance?.pnl || 0,
              deposit: acc.balance?.deposit || 0,
            },
          });
        }

        if (positionsRes.success) {
          const positions = (positionsRes.data?.positions || []).map(p => ({
            id: p.position?.dealId,
            symbol: p.market?.epic,
            name: p.market?.instrumentName,
            direction: p.position?.direction,
            size: p.position?.size,
            openLevel: p.position?.openLevel,
            currentLevel: p.market?.bid,
            profit: p.position?.upl,
            openDate: p.position?.createdDate,
            stopLevel: p.position?.stopLevel,
            limitLevel: p.position?.limitLevel,
            currency: p.position?.currency,
            source: 'capital',
          }));
          dispatch({ type: 'SET_POSITIONS', payload: positions });
        }

        if (ordersRes.success) {
          const orders = (ordersRes.data?.workingOrders || []).map(o => ({
            id: o.workingOrderData?.dealId,
            symbol: o.marketData?.epic,
            name: o.marketData?.instrumentName,
            direction: o.workingOrderData?.direction,
            size: o.workingOrderData?.size,
            level: o.workingOrderData?.level,
            type: o.workingOrderData?.orderType,
            createdDate: o.workingOrderData?.createdDate,
            source: 'capital',
          }));
          dispatch({ type: 'SET_ORDERS', payload: orders });
        }

        const historyRes = await capitalApi.getTransactionHistory();
        if (historyRes.success) {
          const history = (historyRes.data?.transactions || []).map(t => ({
            id: t.reference,
            type: t.transactionType,
            symbol: t.instrumentName,
            profit: parseFloat(t.profitAndLoss?.replace(/[^-0-9.]/g, '') || 0),
            date: t.date,
            size: t.size,
            openLevel: t.openLevel,
            closeLevel: t.closeLevel,
            source: 'capital',
          }));
          dispatch({ type: 'SET_HISTORY', payload: history });
          computeAnalytics(history, dispatch);
        }
      }
    } catch (e) {
      console.error('Refresh error:', e);
    }
  }

  function computeAnalytics(history, dispatch) {
    const trades = history.filter(t => t.type === 'TRADE' || t.profit !== 0);
    if (trades.length === 0) return;

    const wins = trades.filter(t => t.profit > 0);
    const losses = trades.filter(t => t.profit < 0);
    const totalProfit = wins.reduce((s, t) => s + t.profit, 0);
    const totalLoss = Math.abs(losses.reduce((s, t) => s + t.profit, 0));

    const profits = trades.map(t => t.profit);
    const best = Math.max(...profits);
    const worst = Math.min(...profits);

    dispatch({
      type: 'SET_ANALYTICS',
      payload: {
        totalTrades: trades.length,
        winRate: trades.length > 0 ? (wins.length / trades.length) * 100 : 0,
        profitFactor: totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? 999 : 0,
        avgWin: wins.length > 0 ? totalProfit / wins.length : 0,
        avgLoss: losses.length > 0 ? totalLoss / losses.length : 0,
        bestTrade: best,
        worstTrade: worst,
        totalWins: wins.length,
        totalLosses: losses.length,
      },
    });
  }

  async function connectCapital(apiKey, identifier, password, isDemo) {
    dispatch({ type: 'SET_LOADING', payload: true });
    const result = await capitalApi.createSession(apiKey, identifier, password, isDemo);
    if (result.success) {
      dispatch({
        type: 'SET_CONNECTION',
        payload: { type: 'capital', data: { connected: true, account: result.data } },
      });
      dispatch({ type: 'SET_AUTHENTICATED', payload: true });
      await refreshData();
    }
    dispatch({ type: 'SET_LOADING', payload: false });
    return result;
  }

  async function connectMT5(serverUrl, login, password) {
    dispatch({ type: 'SET_LOADING', payload: true });
    const result = await mt5Service.connect(serverUrl, login, password);
    if (result.success) {
      dispatch({
        type: 'SET_CONNECTION',
        payload: { type: 'mt5', data: { connected: true, account: result.data } },
      });
      dispatch({ type: 'SET_AUTHENTICATED', payload: true });
    }
    dispatch({ type: 'SET_LOADING', payload: false });
    return result;
  }

  async function disconnect(type) {
    if (type === 'capital') {
      await capitalApi.logout();
      dispatch({
        type: 'SET_CONNECTION',
        payload: { type: 'capital', data: { connected: false, account: null } },
      });
    } else if (type === 'mt5') {
      await mt5Service.disconnect();
      dispatch({
        type: 'SET_CONNECTION',
        payload: { type: 'mt5', data: { connected: false, account: null } },
      });
    }

    if (!capitalApi.isConnected() && !mt5Service.isConnected()) {
      dispatch({ type: 'RESET' });
    }
  }

  return (
    <AppContext.Provider
      value={{
        state,
        dispatch,
        connectCapital,
        connectMT5,
        disconnect,
        refreshData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
