import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, borderRadius, shadows } from '../../theme';

export default function Card({ children, style, elevated = false }) {
  return (
    <View style={[styles.card, elevated && styles.elevated, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 16,
  },
  elevated: {
    ...shadows.md,
    backgroundColor: colors.surfaceElevated,
  },
});
