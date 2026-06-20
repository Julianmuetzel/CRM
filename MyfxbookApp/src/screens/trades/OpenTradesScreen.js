import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '../../store/AppContext';
import Badge from '../../components/common/Badge';
import { colors, fontSize, fontWeight, spacing, borderRadius } from '../../theme';
import capitalApi from '../../services/capitalApi';

function formatCurrency(v) {
  const n = parseFloat(v) || 0;
  return `${n >= 0 ? '+' : ''}$${Math.abs(n).toFixed(2)}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function PositionCard({ position, onClose }) {
  const isProfitable = position.profit >= 0;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitle}>
          <Badge
            label={position.direction === 'BUY' ? 'KAUF' : 'VERKAUF'}
            type={position.direction === 'BUY' ? 'buy' : 'sell'}
          />
          <Text style={styles.symbol}>{position.symbol}</Text>
          <Text style={styles.name} numberOfLines={1}>{position.name}</Text>
        </View>
        <TouchableOpacity style={styles.closeBtn} onPress={() => onClose(position)}>
          <Ionicons name="close-circle" size={22} color={colors.loss} />
        </TouchableOpacity>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Größe</Text>
          <Text style={styles.statValue}>{position.size}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Eröffnung</Text>
          <Text style={styles.statValue}>{position.openLevel}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Aktuell</Text>
          <Text style={styles.statValue}>{position.currentLevel || '-'}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>P&L</Text>
          <Text
            style={[styles.statValue, styles.pnl, { color: isProfitable ? colors.profit : colors.loss }]}
          >
            {formatCurrency(position.profit)}
          </Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        {position.stopLevel && (
          <View style={styles.levelTag}>
            <Text style={styles.levelLabel}>SL: </Text>
            <Text style={styles.levelValue}>{position.stopLevel}</Text>
          </View>
        )}
        {position.limitLevel && (
          <View style={styles.levelTag}>
            <Text style={styles.levelLabel}>TP: </Text>
            <Text style={styles.levelValue}>{position.limitLevel}</Text>
          </View>
        )}
        <Text style={styles.dateText}>{formatDate(position.openDate)}</Text>
      </View>

      <LinearGradient
        colors={isProfitable ? ['rgba(16,185,129,0.08)', 'transparent'] : ['rgba(239,68,68,0.08)', 'transparent']}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 0 }}
      />
    </View>
  );
}

export default function OpenTradesScreen() {
  const { state, refreshData } = useApp();
  const [refreshing, setRefreshing] = useState(false);
  const [sortBy, setSortBy] = useState('profit');
  const { positions } = state;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  }, [refreshData]);

  const sorted = [...positions].sort((a, b) => {
    if (sortBy === 'profit') return (b.profit || 0) - (a.profit || 0);
    if (sortBy === 'symbol') return (a.symbol || '').localeCompare(b.symbol || '');
    if (sortBy === 'size') return (b.size || 0) - (a.size || 0);
    return 0;
  });

  const totalPnL = positions.reduce((s, p) => s + (p.profit || 0), 0);

  async function handleClose(position) {
    Alert.alert(
      'Position schließen',
      `${position.symbol} (${position.size} Lots) schließen?`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Schließen',
          style: 'destructive',
          onPress: async () => {
            const result = await capitalApi.closePosition(
              position.id,
              position.direction === 'BUY' ? 'SELL' : 'BUY',
              position.size
            );
            if (result.success) {
              Alert.alert('Erfolg', 'Position geschlossen');
              await refreshData();
            } else {
              Alert.alert('Fehler', 'Position konnte nicht geschlossen werden');
            }
          },
        },
      ]
    );
  }

  const summary = {
    profitable: positions.filter(p => p.profit > 0).length,
    losing: positions.filter(p => p.profit < 0).length,
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0A0E1A', '#111827']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.header}>
          <Text style={styles.title}>Offene Positionen</Text>
          <View style={styles.summaryBadges}>
            <View style={[styles.summaryBadge, { backgroundColor: 'rgba(16,185,129,0.15)' }]}>
              <Text style={[styles.summaryBadgeText, { color: colors.profit }]}>
                ↑ {summary.profitable}
              </Text>
            </View>
            <View style={[styles.summaryBadge, { backgroundColor: 'rgba(239,68,68,0.15)' }]}>
              <Text style={[styles.summaryBadgeText, { color: colors.loss }]}>
                ↓ {summary.losing}
              </Text>
            </View>
          </View>
        </View>

        {/* Total P&L Banner */}
        <View style={[styles.pnlBanner, { borderColor: totalPnL >= 0 ? colors.profit : colors.loss }]}>
          <Text style={styles.pnlBannerLabel}>Gesamt P&L</Text>
          <Text style={[styles.pnlBannerValue, { color: totalPnL >= 0 ? colors.profit : colors.loss }]}>
            {formatCurrency(totalPnL)}
          </Text>
        </View>

        {/* Sort Controls */}
        <View style={styles.sortRow}>
          <Text style={styles.sortLabel}>Sortieren:</Text>
          {['profit', 'symbol', 'size'].map(s => (
            <TouchableOpacity
              key={s}
              style={[styles.sortBtn, sortBy === s && styles.sortBtnActive]}
              onPress={() => setSortBy(s)}
            >
              <Text style={[styles.sortBtnText, sortBy === s && styles.sortBtnTextActive]}>
                {s === 'profit' ? 'P&L' : s === 'symbol' ? 'Symbol' : 'Größe'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <FlatList
          data={sorted}
          keyExtractor={item => item.id || item.symbol}
          renderItem={({ item }) => <PositionCard position={item} onClose={handleClose} />}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="pulse-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>Keine offenen Positionen</Text>
              <Text style={styles.emptyText}>Deine aktuellen Trades werden hier angezeigt</Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
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
    paddingBottom: spacing.sm,
  },
  title: { color: colors.text, fontSize: fontSize.xxl, fontWeight: fontWeight.extrabold },
  summaryBadges: { flexDirection: 'row', gap: 8 },
  summaryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  summaryBadgeText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  pnlBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: 12,
  },
  pnlBannerLabel: { color: colors.textSecondary, fontSize: fontSize.sm },
  pnlBannerValue: { fontSize: fontSize.xl, fontWeight: fontWeight.extrabold },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    gap: 8,
    marginBottom: spacing.sm,
  },
  sortLabel: { color: colors.textMuted, fontSize: fontSize.xs },
  sortBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceElevated,
  },
  sortBtnActive: { backgroundColor: colors.primary },
  sortBtnText: { color: colors.textMuted, fontSize: fontSize.xs, fontWeight: fontWeight.medium },
  sortBtnTextActive: { color: '#fff' },
  list: { padding: spacing.lg, paddingTop: 0, gap: 10 },
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  cardTitle: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  symbol: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  name: { color: colors.textMuted, fontSize: fontSize.xs, flex: 1 },
  closeBtn: { padding: 4 },
  cardBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  stat: { alignItems: 'center', flex: 1 },
  statLabel: { color: colors.textMuted, fontSize: 10, marginBottom: 2, textTransform: 'uppercase' },
  statValue: { color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  pnl: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  levelTag: { flexDirection: 'row' },
  levelLabel: { color: colors.textMuted, fontSize: fontSize.xs },
  levelValue: { color: colors.textSecondary, fontSize: fontSize.xs },
  dateText: { color: colors.textMuted, fontSize: fontSize.xs, marginLeft: 'auto' },
  empty: {
    alignItems: 'center',
    paddingTop: 80,
    gap: 12,
  },
  emptyTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.semibold },
  emptyText: { color: colors.textMuted, fontSize: fontSize.sm },
});
