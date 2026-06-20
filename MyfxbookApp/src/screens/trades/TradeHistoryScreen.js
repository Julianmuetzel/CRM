import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '../../store/AppContext';
import Badge from '../../components/common/Badge';
import { colors, fontSize, fontWeight, spacing, borderRadius } from '../../theme';

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
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function HistoryItem({ trade }) {
  const [expanded, setExpanded] = useState(false);
  const isWin = trade.profit > 0;

  return (
    <TouchableOpacity
      style={styles.tradeCard}
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.8}
    >
      <View style={styles.tradeHeader}>
        <View style={styles.tradeLeft}>
          <View
            style={[
              styles.profitIndicator,
              { backgroundColor: isWin ? colors.profit : colors.loss },
            ]}
          />
          <View>
            <Text style={styles.tradeSymbol}>{trade.symbol || trade.type}</Text>
            <Text style={styles.tradeDate}>{formatDate(trade.date)}</Text>
          </View>
        </View>
        <View style={styles.tradeRight}>
          <Text
            style={[
              styles.tradeProfit,
              { color: isWin ? colors.profit : colors.loss },
            ]}
          >
            {formatCurrency(trade.profit)}
          </Text>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={colors.textMuted}
          />
        </View>
      </View>

      {expanded && (
        <View style={styles.tradeDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Eröffnung</Text>
            <Text style={styles.detailValue}>{trade.openLevel || '-'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Schließung</Text>
            <Text style={styles.detailValue}>{trade.closeLevel || '-'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Größe</Text>
            <Text style={styles.detailValue}>{trade.size || '-'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Typ</Text>
            <Text style={styles.detailValue}>{trade.type || '-'}</Text>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function TradeHistoryScreen() {
  const { state, refreshData } = useApp();
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const { history } = state;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  }, [refreshData]);

  const filtered = history.filter(t => {
    const matchSearch = !search || (t.symbol || '').toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === 'all' ||
      (filter === 'wins' && t.profit > 0) ||
      (filter === 'losses' && t.profit < 0);
    return matchSearch && matchFilter;
  });

  const totalProfit = filtered.reduce((s, t) => s + (t.profit || 0), 0);
  const wins = filtered.filter(t => t.profit > 0).length;
  const losses = filtered.filter(t => t.profit <= 0).length;

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0A0E1A', '#111827']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.header}>
          <Text style={styles.title}>Trade Historie</Text>
        </View>

        {/* Stats Bar */}
        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{filtered.length}</Text>
            <Text style={styles.statLabel}>Trades</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.profit }]}>{wins}</Text>
            <Text style={styles.statLabel}>Gewinne</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.loss }]}>{losses}</Text>
            <Text style={styles.statLabel}>Verluste</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text
              style={[
                styles.statValue,
                { color: totalProfit >= 0 ? colors.profit : colors.loss },
              ]}
            >
              {formatCurrency(totalProfit)}
            </Text>
            <Text style={styles.statLabel}>Gesamt</Text>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={16} color={colors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Symbol suchen..."
            placeholderTextColor={colors.textMuted}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Filters */}
        <View style={styles.filterRow}>
          {[
            { key: 'all', label: 'Alle' },
            { key: 'wins', label: 'Gewinne' },
            { key: 'losses', label: 'Verluste' },
          ].map(f => (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterBtn, filter === f.key && styles.filterBtnActive]}
              onPress={() => setFilter(f.key)}
            >
              <Text
                style={[styles.filterText, filter === f.key && styles.filterTextActive]}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(item, idx) => item.id || idx.toString()}
          renderItem={({ item }) => <HistoryItem trade={item} />}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="time-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>Keine Historie</Text>
              <Text style={styles.emptyText}>Abgeschlossene Trades erscheinen hier</Text>
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: { color: colors.text, fontSize: fontSize.xxl, fontWeight: fontWeight.extrabold },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  statLabel: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: colors.border, marginVertical: 4 },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: fontSize.sm,
    paddingVertical: 10,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: 8,
    marginBottom: spacing.md,
  },
  filterBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceElevated,
  },
  filterBtnActive: { backgroundColor: colors.primary },
  filterText: { color: colors.textMuted, fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  filterTextActive: { color: '#fff' },
  list: { padding: spacing.lg, paddingTop: 0, gap: 8 },
  tradeCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
  },
  tradeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  tradeLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  profitIndicator: { width: 4, height: 32, borderRadius: 2 },
  tradeSymbol: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  tradeDate: { color: colors.textMuted, fontSize: fontSize.xs },
  tradeRight: { alignItems: 'flex-end', gap: 4 },
  tradeProfit: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  tradeDetails: {
    padding: 12,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 6,
  },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between' },
  detailLabel: { color: colors.textMuted, fontSize: fontSize.xs },
  detailValue: { color: colors.textSecondary, fontSize: fontSize.xs },
  empty: {
    alignItems: 'center',
    paddingTop: 80,
    gap: 12,
  },
  emptyTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.semibold },
  emptyText: { color: colors.textMuted, fontSize: fontSize.sm },
});
