import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../../store/AppContext';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import { colors, fontSize, fontWeight, spacing, borderRadius } from '../../theme';

export default function LoginScreen({ navigation }) {
  const { connectCapital, connectMT5 } = useApp();
  const [activeTab, setActiveTab] = useState('capital');
  const [loading, setLoading] = useState(false);

  const [capitalForm, setCapitalForm] = useState({
    apiKey: '',
    identifier: '',
    password: '',
    isDemo: false,
  });

  const [mt5Form, setMt5Form] = useState({
    serverUrl: '',
    login: '',
    password: '',
  });

  async function handleCapitalLogin() {
    if (!capitalForm.apiKey || !capitalForm.identifier || !capitalForm.password) {
      Alert.alert('Fehler', 'Bitte alle Felder ausfüllen');
      return;
    }
    setLoading(true);
    const result = await connectCapital(
      capitalForm.apiKey,
      capitalForm.identifier,
      capitalForm.password,
      capitalForm.isDemo
    );
    setLoading(false);
    if (!result.success) {
      Alert.alert('Verbindung fehlgeschlagen', result.error || 'Unbekannter Fehler');
    }
  }

  async function handleMT5Login() {
    if (!mt5Form.serverUrl || !mt5Form.login || !mt5Form.password) {
      Alert.alert('Fehler', 'Bitte alle Felder ausfüllen');
      return;
    }
    setLoading(true);
    const result = await connectMT5(mt5Form.serverUrl, mt5Form.login, mt5Form.password);
    setLoading(false);
    if (!result.success) {
      Alert.alert('Verbindung fehlgeschlagen', result.error || 'Server nicht erreichbar');
    }
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0A0E1A', '#111827', '#0A0E1A']}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.logoContainer}>
                <LinearGradient
                  colors={['#3B82F6', '#6366F1']}
                  style={styles.logo}
                >
                  <Ionicons name="trending-up" size={32} color="#fff" />
                </LinearGradient>
              </View>
              <Text style={styles.appName}>FX Tracker Pro</Text>
              <Text style={styles.subtitle}>Professionelles Trading Analytics</Text>
            </View>

            {/* Tab Switcher */}
            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'capital' && styles.activeTab]}
                onPress={() => setActiveTab('capital')}
              >
                <Text style={[styles.tabText, activeTab === 'capital' && styles.activeTabText]}>
                  Capital.com
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'mt5' && styles.activeTab]}
                onPress={() => setActiveTab('mt5')}
              >
                <Text style={[styles.tabText, activeTab === 'mt5' && styles.activeTabText]}>
                  MetaTrader 5
                </Text>
              </TouchableOpacity>
            </View>

            {/* Capital.com Form */}
            {activeTab === 'capital' && (
              <View style={styles.formContainer}>
                <View style={styles.infoBox}>
                  <Ionicons name="information-circle" size={16} color={colors.primary} />
                  <Text style={styles.infoText}>
                    API-Schlüssel findest du in Capital.com → Einstellungen → API
                  </Text>
                </View>

                <Input
                  label="API-Schlüssel"
                  value={capitalForm.apiKey}
                  onChangeText={v => setCapitalForm(f => ({ ...f, apiKey: v }))}
                  placeholder="dein-api-schluessel"
                  leftIcon="key-outline"
                />
                <Input
                  label="E-Mail / Benutzername"
                  value={capitalForm.identifier}
                  onChangeText={v => setCapitalForm(f => ({ ...f, identifier: v }))}
                  placeholder="email@example.com"
                  leftIcon="person-outline"
                  keyboardType="email-address"
                />
                <Input
                  label="Passwort"
                  value={capitalForm.password}
                  onChangeText={v => setCapitalForm(f => ({ ...f, password: v }))}
                  placeholder="••••••••"
                  secureTextEntry
                  leftIcon="lock-closed-outline"
                />

                <TouchableOpacity
                  style={styles.demoToggle}
                  onPress={() => setCapitalForm(f => ({ ...f, isDemo: !f.isDemo }))}
                >
                  <View style={[styles.checkbox, capitalForm.isDemo && styles.checkboxChecked]}>
                    {capitalForm.isDemo && <Ionicons name="checkmark" size={12} color="#fff" />}
                  </View>
                  <Text style={styles.demoText}>Demo-Konto verwenden</Text>
                </TouchableOpacity>

                <Button
                  title="Mit Capital.com verbinden"
                  variant="gradient"
                  onPress={handleCapitalLogin}
                  loading={loading}
                  style={{ marginTop: spacing.md }}
                />
              </View>
            )}

            {/* MT5 Form */}
            {activeTab === 'mt5' && (
              <View style={styles.formContainer}>
                <View style={styles.infoBox}>
                  <Ionicons name="information-circle" size={16} color={colors.primary} />
                  <Text style={styles.infoText}>
                    MT5 Web-API URL deines Brokers (z.B. https://mt5.broker.com)
                  </Text>
                </View>

                <Input
                  label="MT5 Server URL"
                  value={mt5Form.serverUrl}
                  onChangeText={v => setMt5Form(f => ({ ...f, serverUrl: v }))}
                  placeholder="https://mt5.yourbroker.com"
                  leftIcon="server-outline"
                  keyboardType="url"
                />
                <Input
                  label="Login / Kontonummer"
                  value={mt5Form.login}
                  onChangeText={v => setMt5Form(f => ({ ...f, login: v }))}
                  placeholder="12345678"
                  leftIcon="person-outline"
                  keyboardType="numeric"
                />
                <Input
                  label="Passwort"
                  value={mt5Form.password}
                  onChangeText={v => setMt5Form(f => ({ ...f, password: v }))}
                  placeholder="••••••••"
                  secureTextEntry
                  leftIcon="lock-closed-outline"
                />

                <Button
                  title="Mit MetaTrader 5 verbinden"
                  variant="gradient"
                  onPress={handleMT5Login}
                  loading={loading}
                  style={{ marginTop: spacing.md }}
                />
              </View>
            )}

            {/* Features */}
            <View style={styles.features}>
              {[
                { icon: 'analytics', label: 'Echtzeit-Analytics' },
                { icon: 'shield-checkmark', label: 'Sichere Verbindung' },
                { icon: 'pulse', label: 'Live-Trades' },
              ].map(f => (
                <View key={f.icon} style={styles.feature}>
                  <Ionicons name={f.icon} size={16} color={colors.primary} />
                  <Text style={styles.featureText}>{f.label}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flexGrow: 1,
    padding: spacing.lg,
    paddingTop: spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logoContainer: {
    marginBottom: spacing.md,
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: {
    color: colors.text,
    fontSize: fontSize.xxxl,
    fontWeight: fontWeight.extrabold,
    letterSpacing: -0.5,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    marginTop: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.md,
    padding: 4,
    marginBottom: spacing.lg,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: borderRadius.sm,
  },
  activeTab: {
    backgroundColor: colors.primary,
  },
  tabText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  activeTabText: {
    color: '#fff',
  },
  formContainer: {
    marginBottom: spacing.lg,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(59,130,246,0.1)',
    borderRadius: borderRadius.md,
    padding: 12,
    marginBottom: spacing.md,
    gap: 8,
  },
  infoText: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    flex: 1,
    lineHeight: 18,
  },
  demoToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: spacing.xs,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  demoText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
  },
  features: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  feature: {
    alignItems: 'center',
    gap: 6,
  },
  featureText: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
  },
});
