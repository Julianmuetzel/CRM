import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fontSize, fontWeight, borderRadius } from '../../theme';

export default function StatCard({ label, value, subValue, positive, negative, icon, gradient }) {
  const valueColor = positive ? colors.profit : negative ? colors.loss : colors.text;

  if (gradient) {
    return (
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientCard}
      >
        {icon && <Text style={styles.icon}>{icon}</Text>}
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.value, { color: valueColor }]}>{value}</Text>
        {subValue && <Text style={styles.subValue}>{subValue}</Text>}
      </LinearGradient>
    );
  }

  return (
    <View style={styles.card}>
      {icon && <Text style={styles.icon}>{icon}</Text>}
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color: valueColor }]}>{value}</Text>
      {subValue && <Text style={styles.subValue}>{subValue}</Text>}
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
    flex: 1,
  },
  gradientCard: {
    borderRadius: borderRadius.lg,
    padding: 16,
    flex: 1,
  },
  icon: {
    fontSize: 20,
    marginBottom: 6,
  },
  label: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  value: {
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  subValue: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
});
