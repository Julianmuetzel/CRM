import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LineChart } from 'react-native-chart-kit';
import { useApp } from '../../store/AppContext';
import { colors, fontSize, fontWeight, spacing, borderRadius } from '../../theme';
import StatCard from '../../components/common/StatCard';
import Badge from '../../components/common/Badge';

const { width } = Dimensions.get('window');

function formatCurrency(value, currency = 'USD') {
  const num = parseFloat(value) || 0;
  return `${num >= 0 ? '' : '-'}$${Math.abs(num).toLocaleString('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatPercent(value) {
  const num = parseFloat(value) || 0;
  return `${num >= 0 ? '+' : ''}${num.toFixed(2)}%`;
}

export default function DashboardScreen({ navigation }) {
  const { state, refreshData } = useApp();
  const [refreshing, setRefreshing] = useState(false);
  const { dashboard, positions, analytics, connections } = state;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  }, [refreshData]);

  const openPositionsCount = positions.length;
  const totalPnL = positions.reduce((s, p) => s + (p.profit || 0), 0);

  const chartData = {
    labels: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'],
    datasets: [
      {
        data: analytics.dailyPnl?.length >= 7
          ? analytics.dailyPnl.slice(-7)
          : [0, 120, -80, 340, 180, -50, totalPnL || 0],
        color: (opacity = 1) => `rgba(59,130,246,${opacity})`,
        strokeWidth: 2,
      },
    ],
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0A0E1A', '#111827']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        >
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>Dashboard</Text>
              <View style={styles.statusRow}>
                {connections.capital.connected && (
                  <View style={styles.statusDot}>
                    <View style={styles.dot} />
                    <Text style={styles.statusText}>Capital.com</Text>
                  </View>
                )}
                {connections.mt5.connected && (
                  <View style={styles.statusDot}>
                    <View style={styles.dot} />
                    <Text style={styles.statusText}>MT5</Text>
                  </View>
                )}
              </View>
            </View>
            <TouchableOpacity
              style={styles.notifButton}
              onPress={() => navigation.navigate('Settings')}
            >
              <Ionicons name="settings-outline" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Balance Card */}
          <LinearGradient
            colors={['#1D2B4E', '#162032']}
            style={styles.balanceCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.balanceLabel}>Kontostand</Text>
            <Text style={styles.balanceValue}>{formatCurrency(dashboard.balance)}</Text>
            <View style={styles.equityRow}>
              <View>
                <Text style={styles.equityLabel}>Eigenkapital</Text>
                <Text style={styles.equityValue}>{formatCurrency(dashboard.equity)}</Text>
              </View>
              <View style={styles.pnlContainer}>
                <Text style={styles.equityLabel}>Tages-P&L</Text>
                <Text
                  style={[
                    styles.pnlValue,
                    { color: totalPnL >= 0 ? colors.profit : colors.loss },
                  ]}
                >
                  {formatCurrency(totalPnL)}
                </Text>
              </View>
            </View>
          </LinearGradient>

          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            <StatCard
              label="Freie Margin"
              value={formatCurrency(dashboard.freeMargin)}
              icon="💰"
            />
            <StatCard
              label="Offene Trades"
              value={openPositionsCount.toString()}
              icon="📊"
              positive={openPositionsCount > 0}
            />
          </View>
          <View style={styles.statsGrid}>
            <StatCard
              label="Win Rate"
              value={`${analytics.winRate?.toFixed(1) || '0.0'}%`}
              icon="🎯"
              positive={analytics.winRate >= 50}
            />
            <StatCard
              label="Profit Factor"
              value={(analytics.profitFactor || 0).toFixed(2)}
              icon="📈"
              positive={analytics.profitFactor >= 1}
            />
          </View>

          {/* Chart */}
          <View style={styles.chartCard}>
            <Text style={styles.sectionTitle}>Performance (7 Tage)</Text>
            <LineChart
              data={chartData}
              width={width - spacing.lg * 2 - 32}
              height={180}
              chartConfig={{
                backgroundColor: 'transparent',
                backgroundGradientFrom: 'transparent',
                backgroundGradientTo: 'transparent',
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(59,130,246,${opacity})`,
                labelColor: () => colors.textMuted,
                style: { borderRadius: 8 },
                propsForDots: {
                  r: '4',
                  strokeWidth: '2',
                  stroke: colors.primary,
                },
              }}
              bezier
              style={styles.chart}
              withInnerLines={false}
              withOuterLines={false}
            />
          </View>

          {/* Open Positions Preview */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Offene Positionen</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Trades')}>
                <Text style={styles.seeAll}>Alle anzeigen</Text>
              </TouchableOpacity>
            </View>
            {positions.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="pulse-outline" size={32} color={colors.textMuted} />
                <Text style={styles.emptyText}>Keine offenen Positionen</Text>
              </View>
            ) : (
              positions.slice(0, 3).map(pos => (
                <View key={pos.id} style={styles.positionRow}>
                  <View style={styles.positionLeft}>
                    <Badge
                      label={pos.direction === 'BUY' ? 'KAUF' : 'VERKAUF'}
                      type={pos.direction === 'BUY' ? 'buy' : 'sell'}
                      small
                    />
                    <Text style={styles.positionSymbol}>{pos.symbol}</Text>
                    <Text style={styles.positionSize}>{pos.size} Lots</Text>
                  </View>
                  <View style={styles.positionRight}>
                    <Text
                      style={[
                        styles.positionPnL,
                        { color: pos.profit >= 0 ? colors.profit : colors.loss },
                      ]}
                    >
                      {formatCurrency(pos.profit)}
                    </Text>
                    <Text style={styles.positionLevel}>@{pos.openLevel}</Text>
                  </View>
                </View>
              ))
            )}
          </View>

          {/* Quick Stats */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Schnellübersicht</Text>
            <View style={styles.quickStats}>
              {[
                { label: 'Gesamt Trades', value: analytics.totalTrades || 0 },
                { label: 'Gewinnende', value: analytics.totalWins || 0 },
                { label: 'Verlierende', value: analytics.totalLosses || 0 },
                { label: 'Avg. Gewinn', value: formatCurrency(analytics.avgWin) },
                { label: 'Avg. Verlust', value: formatCurrency(analytics.avgLoss) },
                { label: 'Bester Trade', value: formatCurrency(analytics.bestTrade) },
              ].map(s => (
                <View key={s.label} style={styles.quickStat}>
                  <Text style={styles.quickStatValue}>{s.value}</Text>
                  <Text style={styles.quickStatLabel}>{s.label}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={{ height: 20 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  greeting: {
    color: colors.text,
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.extrabold,
  },
  statusRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  statusDot: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.profit },
  statusText: { color: colors.textMuted, fontSize: fontSize.xs },
  notifButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceCard: {
    margin: spacing.lg,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.2)',
  },
  balanceLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  balanceValue: {
    color: colors.text,
    fontSize: 36,
    fontWeight: fontWeight.extrabold,
    letterSpacing: -1,
    marginVertical: 4,
  },
  equityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
  },
  equityLabel: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    marginBottom: 2,
  },
  equityValue: { color: colors.textSecondary, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  pnlContainer: { alignItems: 'flex-end' },
  pnlValue: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  statsGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  chartCard: {
    margin: spacing.lg,
    marginTop: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
  },
  chart: { marginTop: 8, borderRadius: 8 },
  section: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    marginBottom: spacing.sm,
  },
  seeAll: { color: colors.primary, fontSize: fontSize.sm },
  emptyState: {
    alignItems: 'center',
    padding: spacing.xl,
    gap: 8,
  },
  emptyText: { color: colors.textMuted, fontSize: fontSize.sm },
  positionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  positionLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  positionSymbol: { color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  positionSize: { color: colors.textMuted, fontSize: fontSize.xs },
  positionRight: { alignItems: 'flex-end' },
  positionPnL: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  positionLevel: { color: colors.textMuted, fontSize: fontSize.xs },
  quickStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickStat: {
    width: '30%',
    marginBottom: 4,
  },
  quickStatValue: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
  quickStatLabel: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
});
