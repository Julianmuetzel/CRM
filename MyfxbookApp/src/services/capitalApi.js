import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const BASE_URL = 'https://api-capital.backend.gbfintech.com/api/v1';
const DEMO_BASE_URL = 'https://demo-api-capital.backend.gbfintech.com/api/v1';

class CapitalApiService {
  constructor() {
    this.client = null;
    this.sessionToken = null;
    this.accountToken = null;
    this.isDemo = false;
  }

  getBaseUrl() {
    return this.isDemo ? DEMO_BASE_URL : BASE_URL;
  }

  async createSession(apiKey, identifier, password, isDemo = false) {
    this.isDemo = isDemo;
    const baseUrl = this.getBaseUrl();

    try {
      const response = await axios.post(
        `${baseUrl}/session`,
        { identifier, password },
        {
          headers: {
            'X-CAP-API-KEY': apiKey,
            'Content-Type': 'application/json',
          },
        }
      );

      const { CST, 'X-SECURITY-TOKEN': securityToken } = response.headers;
      this.sessionToken = securityToken;
      this.accountToken = CST;

      this.client = axios.create({
        baseURL: baseUrl,
        headers: {
          'X-CAP-API-KEY': apiKey,
          'X-SECURITY-TOKEN': this.sessionToken,
          'CST': this.accountToken,
          'Content-Type': 'application/json',
        },
      });

      await SecureStore.setItemAsync('capital_api_key', apiKey);
      await SecureStore.setItemAsync('capital_identifier', identifier);
      await SecureStore.setItemAsync('capital_password', password);
      await SecureStore.setItemAsync('capital_is_demo', isDemo ? 'true' : 'false');

      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.errorCode || error.message,
      };
    }
  }

  async restoreSession() {
    try {
      const apiKey = await SecureStore.getItemAsync('capital_api_key');
      const identifier = await SecureStore.getItemAsync('capital_identifier');
      const password = await SecureStore.getItemAsync('capital_password');
      const isDemo = (await SecureStore.getItemAsync('capital_is_demo')) === 'true';

      if (apiKey && identifier && password) {
        return await this.createSession(apiKey, identifier, password, isDemo);
      }
      return { success: false, error: 'No saved credentials' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getAccountDetails() {
    try {
      const response = await this.client.get('/accounts');
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data || error.message };
    }
  }

  async getAccountInfo() {
    try {
      const response = await this.client.get('/accounts/preferences');
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data || error.message };
    }
  }

  async getPositions() {
    try {
      const response = await this.client.get('/positions');
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data || error.message };
    }
  }

  async getOrders() {
    try {
      const response = await this.client.get('/workingorders');
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data || error.message };
    }
  }

  async getHistory(from, to, lastPeriod = 'WEEK') {
    try {
      const params = {};
      if (from) params.from = from;
      if (to) params.to = to;
      if (lastPeriod) params.lastPeriod = lastPeriod;

      const response = await this.client.get('/history/activity', { params });
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data || error.message };
    }
  }

  async getTransactionHistory(from, to) {
    try {
      const params = {};
      if (from) params.from = from;
      if (to) params.to = to;

      const response = await this.client.get('/history/transactions', { params });
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data || error.message };
    }
  }

  async getMarketDetails(epic) {
    try {
      const response = await this.client.get(`/markets/${epic}`);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data || error.message };
    }
  }

  async searchMarkets(searchTerm) {
    try {
      const response = await this.client.get('/markets', {
        params: { searchTerm },
      });
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data || error.message };
    }
  }

  async getPrices(epic, resolution = 'MINUTE', max = 100) {
    try {
      const response = await this.client.get(`/prices/${epic}`, {
        params: { resolution, max },
      });
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data || error.message };
    }
  }

  async closePosition(dealId, direction, size) {
    try {
      const response = await this.client.delete(`/positions/${dealId}`, {
        data: { direction, size },
      });
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data || error.message };
    }
  }

  async createPosition(epic, direction, size, limitLevel, stopLevel) {
    try {
      const body = { epic, direction, size };
      if (limitLevel) body.limitLevel = limitLevel;
      if (stopLevel) body.stopLevel = stopLevel;

      const response = await this.client.post('/positions', body);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data || error.message };
    }
  }

  isConnected() {
    return !!this.client && !!this.sessionToken;
  }

  async logout() {
    try {
      if (this.client) {
        await this.client.delete('/session');
      }
      await SecureStore.deleteItemAsync('capital_api_key');
      await SecureStore.deleteItemAsync('capital_identifier');
      await SecureStore.deleteItemAsync('capital_password');
      await SecureStore.deleteItemAsync('capital_is_demo');
      this.client = null;
      this.sessionToken = null;
      this.accountToken = null;
    } catch (error) {
      console.error('Logout error:', error);
    }
  }
}

export const capitalApi = new CapitalApiService();
export default capitalApi;
