import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontSize, fontWeight, spacing, borderRadius } from '../../theme';

const { width } = Dimensions.get('window');

function SentimentBar({ symbol, bullish, bearish }) {
  const totalWidth = width - spacing.lg * 2 - 32;

  return (
    <View style={styles.sentimentItem}>
      <View style={styles.sentimentHeader}>
        <Text style={styles.sentimentSymbol}>{symbol}</Text>
        <View style={styles.sentimentValues}>
          <Text style={[styles.sentimentPct, { color: colors.profit }]}>{bullish}%</Text>
          <Text style={styles.sentimentSep}>/</Text>
          <Text style={[styles.sentimentPct, { color: colors.loss }]}>{bearish}%</Text>
        </View>
      </View>
      <View style={styles.sentimentBar}>
        <View
          style={[
            styles.sentimentFillBull,
            { width: (bullish / 100) * totalWidth },
          ]}
        />
        <View
          style={[
            styles.sentimentFillBear,
            { width: (bearish / 100) * totalWidth },
          ]}
        />
      </View>
      <View style={styles.sentimentLabels}>
        <Text style={[styles.sentimentLabel, { color: colors.profit }]}>Bullish</Text>
        <Text style={[styles.sentimentLabel, { color: colors.loss }]}>Bearish</Text>
      </View>
    </View>
  );
}

function FearGreedGauge({ value }) {
  const getLabel = v => {
    if (v <= 20) return { label: 'Extreme Angst', color: colors.loss };
    if (v <= 40) return { label: 'Angst', color: '#F97316' };
    if (v <= 60) return { label: 'Neutral', color: colors.warning };
    if (v <= 80) return { label: 'Gier', color: '#84CC16' };
    return { label: 'Extreme Gier', color: colors.profit };
  };

  const { label, color } = getLabel(value);
  const rotation = ((value / 100) * 180 - 90) + 'deg';

  return (
    <View style={styles.gaugeContainer}>
      <Text style={styles.gaugeTitle}>Fear & Greed Index</Text>
      <View style={styles.gauge}>
        <LinearGradient
          colors={[colors.loss, '#F97316', colors.warning, '#84CC16', colors.profit]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gaugeBar}
        />
        <View style={[styles.gaugeIndicator, { left: `${value}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.gaugeValue, { color }]}>{value}</Text>
      <Text style={[styles.gaugeLabel, { color }]}>{label}</Text>
    </View>
  );
}

function MarketCard({ title, change, price, icon, trend }) {
  const isPositive = parseFloat(change) >= 0;
  return (
    <View style={styles.marketCard}>
      <View style={styles.marketIcon}>
        <Text style={styles.marketIconText}>{icon}</Text>
      </View>
      <Text style={styles.marketTitle}>{title}</Text>
      <Text style={styles.marketPrice}>{price}</Text>
      <Text style={[styles.marketChange, { color: isPositive ? colors.profit : colors.loss }]}>
        {isPositive ? '+' : ''}{change}%
      </Text>
      <Ionicons
        name={isPositive ? 'trending-up' : 'trending-down'}
        size={14}
        color={isPositive ? colors.profit : colors.loss}
      />
    </View>
  );
}

// Mock sentiment data
const SENTIMENT_DATA = [
  { symbol: 'EUR/USD', bullish: 58, bearish: 42 },
  { symbol: 'GBP/USD', bullish: 45, bearish: 55 },
  { symbol: 'USD/JPY', bullish: 72, bearish: 28 },
  { symbol: 'AUD/USD', bullish: 38, bearish: 62 },
  { symbol: 'USD/CHF', bullish: 61, bearish: 39 },
  { symbol: 'NZD/USD', bullish: 44, bearish: 56 },
  { symbol: 'USD/CAD', bullish: 53, bearish: 47 },
  { symbol: 'XAU/USD', bullish: 67, bearish: 33 },
];

const MARKET_DATA = [
  { title: 'S&P 500', change: '0.42', price: '5,321', icon: '🇺🇸', trend: 'up' },
  { title: 'EUR/USD', change: '-0.18', price: '1.0876', icon: '🇪🇺', trend: 'down' },
  { title: 'Bitcoin', change: '2.34', price: '$67,234', icon: '₿', trend: 'up' },
  { title: 'Gold', change: '0.89', price: '$2,342', icon: '🥇', trend: 'up' },
  { title: 'Oil', change: '-1.12', price: '$78.34', icon: '🛢️', trend: 'down' },
  { title: 'DAX', change: '0.61', price: '18,234', icon: '🇩🇪', trend: 'up' },
];

export default function MarketSentimentScreen() {
  const [loading, setLoading] = useState(true);
  const [fearGreed] = useState(62);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(t);
  }, []);

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <LinearGradient colors={['#0A0E1A', '#111827']} style={StyleSheet.absoluteFill} />
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.loadingText}>Sentiment wird geladen...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0A0E1A', '#111827']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.title}>Markt Sentiment</Text>
            <View style={styles.liveTag}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          </View>

          {/* Fear & Greed */}
          <View style={styles.card}>
            <FearGreedGauge value={fearGreed} />
          </View>

          {/* Market Overview */}
          <Text style={styles.sectionTitle}>Märkte</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.marketsRow}
          >
            {MARKET_DATA.map(m => (
              <MarketCard key={m.title} {...m} />
            ))}
          </ScrollView>

          {/* Sentiment */}
          <Text style={styles.sectionTitle}>Händler-Sentiment</Text>
          <View style={styles.card}>
            {SENTIMENT_DATA.map(s => (
              <SentimentBar key={s.symbol} {...s} />
            ))}
          </View>

          {/* Market Breadth */}
          <Text style={styles.sectionTitle}>Marktbreite</Text>
          <View style={styles.breadthCard}>
            {[
              { label: 'Advancing', value: 312, color: colors.profit },
              { label: 'Declining', value: 198, color: colors.loss },
              { label: 'Unchanged', value: 45, color: colors.textMuted },
            ].map(b => (
              <View key={b.label} style={styles.breadthItem}>
                <Text style={[styles.breadthValue, { color: b.color }]}>{b.value}</Text>
                <Text style={styles.breadthLabel}>{b.label}</Text>
                <LinearGradient
                  colors={[b.color + '40', b.color + '10']}
                  style={[
                    styles.breadthBar,
                    { width: (b.value / 555) * (width - spacing.lg * 2 - 96) },
                  ]}
                />
              </View>
            ))}
          </View>

          {/* Currency Strength */}
          <Text style={styles.sectionTitle}>Währungsstärke</Text>
          <View style={[styles.card, { marginBottom: 20 }]}>
            {[
              { currency: 'USD', strength: 82 },
              { currency: 'EUR', strength: 61 },
              { currency: 'GBP', strength: 55 },
              { currency: 'JPY', strength: 28 },
              { currency: 'AUD', strength: 42 },
              { currency: 'CHF', strength: 70 },
              { currency: 'CAD', strength: 48 },
              { currency: 'NZD', strength: 38 },
            ].map(c => (
              <View key={c.currency} style={styles.strengthItem}>
                <Text style={styles.strengthCurrency}>{c.currency}</Text>
                <View style={styles.strengthBarBg}>
                  <LinearGradient
                    colors={
                      c.strength >= 60
                        ? [colors.profit + '80', colors.profit]
                        : c.strength <= 40
                        ? [colors.loss + '80', colors.loss]
                        : [colors.warning + '80', colors.warning]
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.strengthBarFill, { width: `${c.strength}%` }]}
                  />
                </View>
                <Text style={styles.strengthValue}>{c.strength}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: colors.textSecondary, marginTop: 12 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: { color: colors.text, fontSize: fontSize.xxl, fontWeight: fontWeight.extrabold },
  liveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderRadius: borderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.loss },
  liveText: { color: colors.loss, fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  gaugeContainer: { alignItems: 'center', gap: 8 },
  gaugeTitle: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    marginBottom: 4,
  },
  gauge: {
    width: '100%',
    height: 20,
    position: 'relative',
    justifyContent: 'center',
  },
  gaugeBar: {
    height: 10,
    borderRadius: 5,
    width: '100%',
  },
  gaugeIndicator: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.background,
    top: 2,
    marginLeft: -8,
  },
  gaugeValue: { fontSize: 48, fontWeight: fontWeight.extrabold },
  gaugeLabel: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold },
  marketsRow: { paddingHorizontal: spacing.lg, gap: 10, marginBottom: spacing.md },
  marketCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
    alignItems: 'center',
    width: 110,
    gap: 4,
  },
  marketIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marketIconText: { fontSize: 18 },
  marketTitle: { color: colors.textSecondary, fontSize: fontSize.xs, fontWeight: fontWeight.medium },
  marketPrice: { color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  marketChange: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  sentimentItem: { marginBottom: spacing.md },
  sentimentHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  sentimentSymbol: { color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  sentimentValues: { flexDirection: 'row', gap: 4 },
  sentimentPct: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  sentimentSep: { color: colors.textMuted },
  sentimentBar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: colors.border,
  },
  sentimentFillBull: { backgroundColor: colors.profit, height: '100%' },
  sentimentFillBear: { backgroundColor: colors.loss, height: '100%' },
  sentimentLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  sentimentLabel: { fontSize: 10 },
  breadthCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    gap: 12,
  },
  breadthItem: { gap: 4 },
  breadthValue: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  breadthLabel: { color: colors.textMuted, fontSize: fontSize.xs },
  breadthBar: { height: 6, borderRadius: 3 },
  strengthItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  strengthCurrency: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    width: 36,
  },
  strengthBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  strengthBarFill: { height: '100%', borderRadius: 4 },
  strengthValue: { color: colors.textMuted, fontSize: fontSize.xs, width: 28, textAlign: 'right' },
});
