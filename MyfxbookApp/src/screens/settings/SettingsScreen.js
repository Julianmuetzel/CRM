import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../store/AppContext';
import { colors, fontSize, fontWeight, spacing, borderRadius } from '../../theme';

function SettingItem({ icon, label, value, onPress, toggle, toggleValue, onToggle, danger, rightText }) {
  return (
    <TouchableOpacity
      style={styles.settingItem}
      onPress={onPress}
      disabled={!!toggle}
      activeOpacity={0.7}
    >
      <View style={[styles.settingIcon, danger && { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
        <Ionicons name={icon} size={18} color={danger ? colors.loss : colors.primary} />
      </View>
      <View style={styles.settingContent}>
        <Text style={[styles.settingLabel, danger && { color: colors.loss }]}>{label}</Text>
        {value && <Text style={styles.settingValue}>{value}</Text>}
      </View>
      {toggle ? (
        <Switch
          value={toggleValue}
          onValueChange={onToggle}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={toggleValue ? '#fff' : colors.textMuted}
        />
      ) : rightText ? (
        <Text style={styles.rightText}>{rightText}</Text>
      ) : (
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      )}
    </TouchableOpacity>
  );
}

function SectionTitle({ title }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function ConnectionCard({ type, title, connected, account, onDisconnect }) {
  return (
    <View style={styles.connectionCard}>
      <View style={styles.connectionHeader}>
        <View style={styles.connectionInfo}>
          <View style={[styles.connectionDot, { backgroundColor: connected ? colors.profit : colors.textMuted }]} />
          <Text style={styles.connectionTitle}>{title}</Text>
        </View>
        {connected && (
          <View style={styles.connectedBadge}>
            <Text style={styles.connectedText}>Verbunden</Text>
          </View>
        )}
      </View>
      {connected ? (
        <TouchableOpacity
          style={styles.disconnectBtn}
          onPress={() => onDisconnect(type)}
        >
          <Ionicons name="unlink-outline" size={14} color={colors.loss} />
          <Text style={styles.disconnectText}>Trennen</Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.notConnectedText}>Nicht verbunden</Text>
      )}
    </View>
  );
}

export default function SettingsScreen({ navigation }) {
  const { state, disconnect } = useApp();
  const [notifications, setNotifications] = useState(true);
  const [biometric, setBiometric] = useState(false);
  const [priceAlerts, setPriceAlerts] = useState(true);
  const [darkMode, setDarkMode] = useState(true);

  const { connections } = state;

  async function handleDisconnect(type) {
    Alert.alert(
      'Verbindung trennen',
      `${type === 'capital' ? 'Capital.com' : 'MetaTrader 5'} Verbindung trennen?`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Trennen',
          style: 'destructive',
          onPress: () => disconnect(type),
        },
      ]
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0A0E1A', '#111827']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.title}>Einstellungen</Text>
          </View>

          {/* Profile */}
          <View style={styles.profileCard}>
            <LinearGradient
              colors={['#1D2B4E', '#162032']}
              style={styles.profileGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>FX</Text>
              </View>
              <View>
                <Text style={styles.profileName}>FX Trader</Text>
                <Text style={styles.profileSub}>
                  {connections.capital.connected ? 'Capital.com Konto' : 'Kein Konto verbunden'}
                </Text>
              </View>
            </LinearGradient>
          </View>

          {/* Connections */}
          <SectionTitle title="Verbundene Konten" />
          <View style={styles.section}>
            <ConnectionCard
              type="capital"
              title="Capital.com"
              connected={connections.capital.connected}
              onDisconnect={handleDisconnect}
            />
            <View style={styles.divider} />
            <ConnectionCard
              type="mt5"
              title="MetaTrader 5"
              connected={connections.mt5.connected}
              onDisconnect={handleDisconnect}
            />
          </View>

          {!connections.capital.connected && !connections.mt5.connected && (
            <TouchableOpacity
              style={styles.connectBtn}
              onPress={() => navigation.navigate('Login')}
            >
              <LinearGradient
                colors={['#3B82F6', '#6366F1']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.connectBtnGradient}
              >
                <Ionicons name="add-circle" size={18} color="#fff" />
                <Text style={styles.connectBtnText}>Konto verbinden</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* Notifications */}
          <SectionTitle title="Benachrichtigungen" />
          <View style={styles.section}>
            <SettingItem
              icon="notifications-outline"
              label="Push-Benachrichtigungen"
              toggle
              toggleValue={notifications}
              onToggle={setNotifications}
            />
            <View style={styles.divider} />
            <SettingItem
              icon="alert-circle-outline"
              label="Preisalarme"
              toggle
              toggleValue={priceAlerts}
              onToggle={setPriceAlerts}
            />
          </View>

          {/* Security */}
          <SectionTitle title="Sicherheit" />
          <View style={styles.section}>
            <SettingItem
              icon="finger-print-outline"
              label="Biometrische Authentifizierung"
              toggle
              toggleValue={biometric}
              onToggle={setBiometric}
            />
            <View style={styles.divider} />
            <SettingItem
              icon="key-outline"
              label="PIN ändern"
              onPress={() => Alert.alert('PIN', 'PIN-Funktion kommt bald')}
            />
          </View>

          {/* Appearance */}
          <SectionTitle title="Darstellung" />
          <View style={styles.section}>
            <SettingItem
              icon="moon-outline"
              label="Dark Mode"
              toggle
              toggleValue={darkMode}
              onToggle={setDarkMode}
            />
            <View style={styles.divider} />
            <SettingItem
              icon="language-outline"
              label="Sprache"
              rightText="Deutsch"
              onPress={() => Alert.alert('Sprache', 'Sprachauswahl kommt bald')}
            />
            <View style={styles.divider} />
            <SettingItem
              icon="cash-outline"
              label="Währung"
              rightText="USD"
              onPress={() => Alert.alert('Währung', 'Währungsauswahl kommt bald')}
            />
          </View>

          {/* Data */}
          <SectionTitle title="Daten & Privatsphäre" />
          <View style={styles.section}>
            <SettingItem
              icon="refresh-outline"
              label="Daten aktualisieren"
              rightText="Auto"
              onPress={() => Alert.alert('Info', 'Daten werden automatisch aktualisiert')}
            />
            <View style={styles.divider} />
            <SettingItem
              icon="download-outline"
              label="Daten exportieren"
              onPress={() => Alert.alert('Export', 'CSV-Export kommt bald')}
            />
            <View style={styles.divider} />
            <SettingItem
              icon="trash-outline"
              label="Alle Daten löschen"
              danger
              onPress={() => Alert.alert('Warnung', 'Alle lokalen Daten löschen?', [
                { text: 'Abbrechen', style: 'cancel' },
                { text: 'Löschen', style: 'destructive' },
              ])}
            />
          </View>

          {/* About */}
          <SectionTitle title="Über die App" />
          <View style={styles.section}>
            <SettingItem
              icon="information-circle-outline"
              label="Version"
              rightText="1.0.0"
            />
            <View style={styles.divider} />
            <SettingItem
              icon="document-text-outline"
              label="Nutzungsbedingungen"
              onPress={() => Alert.alert('AGB', 'Öffnet externe Seite')}
            />
            <View style={styles.divider} />
            <SettingItem
              icon="shield-outline"
              label="Datenschutzrichtlinie"
              onPress={() => Alert.alert('Datenschutz', 'Öffnet externe Seite')}
            />
          </View>

          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  title: { color: colors.text, fontSize: fontSize.xxl, fontWeight: fontWeight.extrabold },
  profileCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.2)',
  },
  profileGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: spacing.lg,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(59,130,246,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.primary, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  profileName: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  profileSub: { color: colors.textSecondary, fontSize: fontSize.sm },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: spacing.lg,
    marginBottom: 6,
    marginTop: spacing.md,
  },
  section: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginHorizontal: spacing.lg,
    overflow: 'hidden',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 56,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: 12,
  },
  settingIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(59,130,246,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingContent: { flex: 1 },
  settingLabel: { color: colors.text, fontSize: fontSize.md },
  settingValue: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 1 },
  rightText: { color: colors.textMuted, fontSize: fontSize.sm },
  connectionCard: {
    padding: spacing.md,
  },
  connectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  connectionInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  connectionDot: { width: 8, height: 8, borderRadius: 4 },
  connectionTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  connectedBadge: {
    backgroundColor: 'rgba(16,185,129,0.15)',
    borderRadius: borderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  connectedText: { color: colors.profit, fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  disconnectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  disconnectText: { color: colors.loss, fontSize: fontSize.xs },
  notConnectedText: { color: colors.textMuted, fontSize: fontSize.xs },
  connectBtn: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  connectBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  connectBtnText: { color: '#fff', fontSize: fontSize.md, fontWeight: fontWeight.semibold },
});
