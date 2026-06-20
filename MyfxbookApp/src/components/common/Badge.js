import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fontSize, borderRadius } from '../../theme';

export default function Badge({ label, type = 'default', small = false }) {
  const typeColors = {
    default: { bg: colors.surfaceElevated, text: colors.textSecondary },
    success: { bg: 'rgba(16,185,129,0.15)', text: colors.profit },
    danger: { bg: 'rgba(239,68,68,0.15)', text: colors.loss },
    warning: { bg: 'rgba(245,158,11,0.15)', text: colors.warning },
    info: { bg: 'rgba(59,130,246,0.15)', text: colors.primary },
    buy: { bg: 'rgba(16,185,129,0.15)', text: colors.profit },
    sell: { bg: 'rgba(239,68,68,0.15)', text: colors.loss },
  };

  const tc = typeColors[type] || typeColors.default;

  return (
    <View style={[styles.badge, { backgroundColor: tc.bg }, small && styles.small]}>
      <Text style={[styles.text, { color: tc.text }, small && styles.smallText]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
  },
  small: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  text: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  smallText: {
    fontSize: 10,
  },
});
