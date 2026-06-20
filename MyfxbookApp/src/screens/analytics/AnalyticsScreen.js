import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import { useApp } from '../../store/AppContext';
import { colors, fontSize, fontWeight, spacing, borderRadius } from '../../theme';

const { width } = Dimensions.get('window');
const CHART_WIDTH = width - spacing.lg * 2 - 32;

function MetricCard({ label, value, subLabel, icon, color }) {
  return (
    <View style={styles.metricCard}>
      <View style={styles.metricIcon}>
        <Ionicons name={icon} size={18} color={color || colors.primary} />
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
      {subLabel && <Text style={styles.metricSub}>{subLabel}</Text>}
    </View>
  );
}

function SectionHeader({ title, subtitle }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
    </View>
  );
}

export default function AnalyticsScreen() {
  const { state } = useApp();
  const { analytics, history } = state;
  const [period, setPeriod] = useState('month');

  const winRate = analytics.winRate || 0;
  const profitFactor = analytics.profitFactor || 0;
  const totalTrades = analytics.totalTrades || 0;
  const avgWin = analytics.avgWin || 0;
  const avgLoss = analytics.avgLoss || 0;

  const pieData = [
    {
      name: 'Gewinne',
      population: analytics.totalWins || 0,
      color: colors.profit,
      legendFontColor: colors.textSecondary,
      legendFontSize: 12,
    },
    {
      name: 'Verluste',
      population: analytics.totalLosses || 0,
      color: colors.loss,
      legendFontColor: colors.textSecondary,
      legendFontSize: 12,
    },
  ];

  const lineData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'Mai', 'Jun'],
    datasets: [
      {
        data: analytics.monthlyPnl?.length >= 6
          ? analytics.monthlyPnl.slice(-6)
          : [0, 500, -200, 800, 1200, 900],
        color: (opacity = 1) => `rgba(59,130,246,${opacity})`,
        strokeWidth: 2,
      },
    ],
  };

  const barData = {
    labels: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'],
    datasets: [
      {
        data: analytics.dailyPnl?.length >= 6
          ? analytics.dailyPnl.slice(-6)
          : [120, -80, 340, -150, 280, 190],
      },
    ],
  };

  const chartConfig = {
    backgroundColor: 'transparent',
    backgroundGradientFrom: 'transparent',
    backgroundGradientTo: 'transparent',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(59,130,246,${opacity})`,
    labelColor: () => colors.textMuted,
    propsForDots: { r: '4', strokeWidth: '2', stroke: colors.primary },
  };

  function formatCurrency(v) {
    const n = parseFloat(v) || 0;
    return `$${Math.abs(n).toFixed(2)}`;
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0A0E1A', '#111827']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.title}>Analytics</Text>
            <View style={styles.periodSelector}>
              {['week', 'month', 'year'].map(p => (
                <TouchableOpacity
                  key={p}
                  style={[styles.periodBtn, period === p && styles.periodBtnActive]}
                  onPress={() => setPeriod(p)}
                >
                  <Text
                    style={[styles.periodBtnText, period === p && styles.periodBtnTextActive]}
                  >
                    {p === 'week' ? 'Woche' : p === 'month' ? 'Monat' : 'Jahr'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Key Metrics */}
          <View style={styles.metricsGrid}>
            <MetricCard
              label="Win Rate"
              value={`${winRate.toFixed(1)}%`}
              icon="trophy"
              color={winRate >= 50 ? colors.profit : colors.loss}
              subLabel={winRate >= 50 ? 'Gut' : 'Verbesserungsbedarf'}
            />
            <MetricCard
              label="Profit Factor"
              value={profitFactor.toFixed(2)}
              icon="trending-up"
              color={profitFactor >= 1.5 ? colors.profit : profitFactor >= 1 ? colors.warning : colors.loss}
              subLabel={profitFactor >= 1.5 ? 'Hervorragend' : profitFactor >= 1 ? 'Gut' : 'Negativ'}
            />
            <MetricCard
              label="Gesamt Trades"
              value={totalTrades.toString()}
              icon="bar-chart"
              color={colors.primary}
            />
            <MetricCard
              label="Avg. Gewinn"
              value={formatCurrency(avgWin)}
              icon="arrow-up-circle"
              color={colors.profit}
            />
            <MetricCard
              label="Avg. Verlust"
              value={formatCurrency(avgLoss)}
              icon="arrow-down-circle"
              color={colors.loss}
            />
            <MetricCard
              label="Erwartungswert"
              value={formatCurrency(
                (winRate / 100) * avgWin - ((100 - winRate) / 100) * avgLoss
              )}
              icon="calculator"
              color={colors.accent}
            />
          </View>

          {/* Equity Curve */}
          <View style={styles.card}>
            <SectionHeader title="Equity Kurve" subtitle="Monatliche Performance" />
            <LineChart
              data={lineData}
              width={CHART_WIDTH}
              height={180}
              chartConfig={chartConfig}
              bezier
              withInnerLines={false}
              withOuterLines={false}
              style={styles.chart}
            />
          </View>

          {/* Daily P&L Bar */}
          <View style={styles.card}>
            <SectionHeader title="Tägliche P&L" subtitle="Letzte 6 Tage" />
            <BarChart
              data={barData}
              width={CHART_WIDTH}
              height={180}
              chartConfig={{
                ...chartConfig,
                color: (opacity = 1) => `rgba(99,102,241,${opacity})`,
              }}
              withInnerLines={false}
              style={styles.chart}
              showValuesOnTopOfBars
            />
          </View>

          {/* Win/Loss Pie */}
          {(analytics.totalWins > 0 || analytics.totalLosses > 0) && (
            <View style={styles.card}>
              <SectionHeader title="Win/Loss Verteilung" />
              <PieChart
                data={pieData}
                width={CHART_WIDTH}
                height={160}
                chartConfig={chartConfig}
                accessor="population"
                backgroundColor="transparent"
                paddingLeft="15"
                absolute
              />
            </View>
          )}

          {/* Risk Analysis */}
          <View style={styles.card}>
            <SectionHeader title="Risikoanalyse" />
            <View style={styles.riskGrid}>
              {[
                {
                  label: 'Risk/Reward Ratio',
                  value: avgLoss > 0 ? (avgWin / avgLoss).toFixed(2) : '-',
                  good: avgLoss > 0 && avgWin / avgLoss >= 1.5,
                },
                {
                  label: 'Bester Trade',
                  value: `$${(analytics.bestTrade || 0).toFixed(2)}`,
                  good: true,
                },
                {
                  label: 'Schlechtester Trade',
                  value: `$${(analytics.worstTrade || 0).toFixed(2)}`,
                  good: false,
                },
                {
                  label: 'Gewinn Trades',
                  value: `${analytics.totalWins || 0}`,
                  good: true,
                },
              ].map(r => (
                <View key={r.label} style={styles.riskItem}>
                  <Text style={styles.riskValue}>{r.value}</Text>
                  <Text style={styles.riskLabel}>{r.label}</Text>
                  <View
                    style={[
                      styles.riskIndicator,
                      { backgroundColor: r.good ? colors.profit : colors.loss },
                    ]}
                  />
                </View>
              ))}
            </View>
          </View>

          {/* Trade Distribution */}
          <View style={[styles.card, { marginBottom: 20 }]}>
            <SectionHeader title="Handelsverteilung" />
            <View style={styles.distributionRow}>
              <View style={styles.distributionItem}>
                <LinearGradient
                  colors={['rgba(16,185,129,0.2)', 'rgba(16,185,129,0.05)']}
                  style={styles.distributionBar}
                >
                  <View
                    style={[
                      styles.distributionFill,
                      {
                        height: `${winRate}%`,
                        backgroundColor: colors.profit,
                      },
                    ]}
                  />
                </LinearGradient>
                <Text style={styles.distributionLabel}>Gewinne</Text>
                <Text style={[styles.distributionValue, { color: colors.profit }]}>
                  {winRate.toFixed(0)}%
                </Text>
              </View>
              <View style={styles.distributionItem}>
                <LinearGradient
                  colors={['rgba(239,68,68,0.2)', 'rgba(239,68,68,0.05)']}
                  style={styles.distributionBar}
                >
                  <View
                    style={[
                      styles.distributionFill,
                      {
                        height: `${100 - winRate}%`,
                        backgroundColor: colors.loss,
                      },
                    ]}
                  />
                </LinearGradient>
                <Text style={styles.distributionLabel}>Verluste</Text>
                <Text style={[styles.distributionValue, { color: colors.loss }]}>
                  {(100 - winRate).toFixed(0)}%
                </Text>
              </View>
            </View>
          </View>
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
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  title: { color: colors.text, fontSize: fontSize.xxl, fontWeight: fontWeight.extrabold },
  periodSelector: { flexDirection: 'row', gap: 4 },
  periodBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceElevated,
  },
  periodBtnActive: { backgroundColor: colors.primary },
  periodBtnText: { color: colors.textMuted, fontSize: fontSize.xs, fontWeight: fontWeight.medium },
  periodBtnTextActive: { color: '#fff' },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  metricCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
    width: (width - spacing.lg * 2 - spacing.sm) / 2 - 1,
    gap: 4,
  },
  metricIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  metricValue: { color: colors.text, fontSize: fontSize.xl, fontWeight: fontWeight.extrabold },
  metricLabel: { color: colors.textSecondary, fontSize: fontSize.xs, fontWeight: fontWeight.medium },
  metricSub: { color: colors.textMuted, fontSize: 10 },
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  chart: { marginTop: 8, borderRadius: 8 },
  sectionHeader: { marginBottom: spacing.sm },
  sectionTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  sectionSubtitle: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 },
  riskGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  riskItem: {
    width: '45%',
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.md,
    padding: 12,
    gap: 2,
  },
  riskValue: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  riskLabel: { color: colors.textMuted, fontSize: fontSize.xs },
  riskIndicator: { width: 24, height: 3, borderRadius: 2, marginTop: 4 },
  distributionRow: { flexDirection: 'row', gap: 24, justifyContent: 'center', paddingTop: 8 },
  distributionItem: { alignItems: 'center', gap: 8 },
  distributionBar: {
    width: 80,
    height: 120,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  distributionFill: { width: '100%', borderRadius: borderRadius.md },
  distributionLabel: { color: colors.textSecondary, fontSize: fontSize.sm },
  distributionValue: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
});
