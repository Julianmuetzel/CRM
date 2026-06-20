# FX Tracker Pro – Myfxbook iPhone App

Eine vollständige Trading-Analytics-App für iOS, die MetaTrader 5 und Capital.com integriert.

## Features

| Feature | Beschreibung |
|---|---|
| **Dashboard** | Kontostand, Equity, Margin, P&L-Übersicht |
| **Offene Positionen** | Live-Trades mit P&L, SL/TP, Schließen-Funktion |
| **Trade-Historie** | Alle abgeschlossenen Trades mit Suchfunktion |
| **Analytics** | Win Rate, Profit Factor, Equity Curve, Risk Analysis |
| **Wirtschaftskalender** | Wirtschaftsereignisse mit Impact-Level |
| **Markt-Sentiment** | Fear & Greed Index, Händler-Sentiment, Währungsstärke |
| **Einstellungen** | Kontoverwaltung, Benachrichtigungen, Sicherheit |

## Verbindungen

### Capital.com
1. Erstelle einen API-Schlüssel unter: Capital.com → Mein Konto → API-Schlüssel
2. Gib API-Key, E-Mail und Passwort in der App ein
3. Wähle zwischen Live- und Demo-Konto

### MetaTrader 5
Verbindet über die MT5 Web-API deines Brokers (falls vom Broker unterstützt):
- Server-URL: `https://mt5.deinbroker.com`
- Login: Kontonummer
- Passwort: MT5-Passwort

## Installation

```bash
cd MyfxbookApp
npm install
npx expo start
```

Dann mit Expo Go auf iPhone scannen oder `--ios` für Simulator verwenden.

## Tech Stack

- **React Native** + **Expo**
- **React Navigation** (Bottom Tabs + Stack)
- **react-native-chart-kit** (Charts)
- **expo-secure-store** (sichere Credential-Speicherung)
- **Axios** (HTTP-Requests)
- **Capital.com REST API**

## Sicherheit

- Credentials werden mit `expo-secure-store` (iOS Keychain) gespeichert
- Alle API-Verbindungen über HTTPS
- Biometrische Authentifizierung (optional)
