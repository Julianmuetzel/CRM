import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, fontSize, fontWeight, borderRadius, spacing } from '../../theme';
import OpenTradesScreen from './OpenTradesScreen';
import TradeHistoryScreen from './TradeHistoryScreen';

export default function TradesTabScreen() {
  const [tab, setTab] = useState('open');

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Sub-Tab Navigation */}
      <View style={styles.subTabs}>
        <TouchableOpacity
          style={[styles.subTab, tab === 'open' && styles.subTabActive]}
          onPress={() => setTab('open')}
        >
          <Text style={[styles.subTabText, tab === 'open' && styles.subTabTextActive]}>
            Offen
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.subTab, tab === 'history' && styles.subTabActive]}
          onPress={() => setTab('history')}
        >
          <Text style={[styles.subTabText, tab === 'history' && styles.subTabTextActive]}>
            Historie
          </Text>
        </TouchableOpacity>
      </View>

      {tab === 'open' ? <OpenTradesScreen /> : <TradeHistoryScreen />}
    </View>
  );
}

const styles = StyleSheet.create({
  subTabs: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceElevated,
    padding: 4,
    marginHorizontal: spacing.lg,
    marginTop: 60,
    marginBottom: 8,
    borderRadius: borderRadius.md,
  },
  subTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: borderRadius.sm,
  },
  subTabActive: { backgroundColor: colors.primary },
  subTabText: { color: colors.textMuted, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  subTabTextActive: { color: '#fff' },
});
