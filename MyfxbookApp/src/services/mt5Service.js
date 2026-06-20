import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// MT5 Web API - connects to broker's MT5 API endpoint
class MT5Service {
  constructor() {
    this.client = null;
    this.serverUrl = null;
    this.token = null;
    this.account = null;
  }

  async connect(serverUrl, login, password) {
    try {
      // MT5 REST API (MetaQuotes Web API or broker-specific)
      const cleanUrl = serverUrl.replace(/\/$/, '');
      const response = await axios.post(`${cleanUrl}/api/auth/token`, {
        login: parseInt(login),
        password,
      });

      if (response.data?.token) {
        this.token = response.data.token;
        this.serverUrl = cleanUrl;
        this.account = response.data.account;

        this.client = axios.create({
          baseURL: cleanUrl,
          headers: {
            Authorization: `Bearer ${this.token}`,
            'Content-Type': 'application/json',
          },
        });

        await SecureStore.setItemAsync('mt5_server', serverUrl);
        await SecureStore.setItemAsync('mt5_login', login.toString());
        await SecureStore.setItemAsync('mt5_password', password);

        return { success: true, data: response.data };
      }
      return { success: false, error: 'Invalid credentials' };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Connection failed. Check server URL.',
      };
    }
  }

  async restoreSession() {
    try {
      const serverUrl = await SecureStore.getItemAsync('mt5_server');
      const login = await SecureStore.getItemAsync('mt5_login');
      const password = await SecureStore.getItemAsync('mt5_password');

      if (serverUrl && login && password) {
        return await this.connect(serverUrl, login, password);
      }
      return { success: false, error: 'No saved credentials' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getAccountInfo() {
    if (!this.client) return { success: false, error: 'Not connected' };
    try {
      const response = await this.client.get('/api/account/info');
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data || error.message };
    }
  }

  async getOpenPositions() {
    if (!this.client) return { success: false, error: 'Not connected' };
    try {
      const response = await this.client.get('/api/positions');
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data || error.message };
    }
  }

  async getTradeHistory(from, to) {
    if (!this.client) return { success: false, error: 'Not connected' };
    try {
      const response = await this.client.get('/api/history/deals', {
        params: { from, to },
      });
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data || error.message };
    }
  }

  async getOrders() {
    if (!this.client) return { success: false, error: 'Not connected' };
    try {
      const response = await this.client.get('/api/orders');
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data || error.message };
    }
  }

  isConnected() {
    return !!this.client && !!this.token;
  }

  async disconnect() {
    await SecureStore.deleteItemAsync('mt5_server');
    await SecureStore.deleteItemAsync('mt5_login');
    await SecureStore.deleteItemAsync('mt5_password');
    this.client = null;
    this.token = null;
    this.serverUrl = null;
    this.account = null;
  }
}

export const mt5Service = new MT5Service();
export default mt5Service;
