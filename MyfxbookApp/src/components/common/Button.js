import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fontSize, fontWeight, borderRadius } from '../../theme';

export default function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
  textStyle,
}) {
  const isDisabled = disabled || loading;

  if (variant === 'gradient') {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={isDisabled}
        activeOpacity={0.8}
        style={[styles.wrapper, isDisabled && styles.disabled, style]}
      >
        <LinearGradient
          colors={['#3B82F6', '#6366F1']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradient}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={[styles.gradientText, textStyle]}>{title}</Text>
          )}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  const variantStyles = {
    primary: { bg: colors.primary, text: '#fff' },
    secondary: { bg: colors.surfaceElevated, text: colors.text },
    danger: { bg: colors.loss, text: '#fff' },
    success: { bg: colors.profit, text: '#fff' },
    outline: { bg: 'transparent', text: colors.primary, border: colors.primary },
    ghost: { bg: 'transparent', text: colors.textSecondary },
  };

  const v = variantStyles[variant] || variantStyles.primary;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      style={[
        styles.button,
        { backgroundColor: v.bg },
        v.border && { borderWidth: 1, borderColor: v.border },
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.text} size="small" />
      ) : (
        <Text style={[styles.text, { color: v.text }, textStyle]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  gradient: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  gradientText: {
    color: '#fff',
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  disabled: {
    opacity: 0.5,
  },
});
