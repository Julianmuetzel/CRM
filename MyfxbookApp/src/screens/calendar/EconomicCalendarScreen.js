import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { colors, fontSize, fontWeight, spacing, borderRadius } from '../../theme';

const IMPACT_COLORS = {
  high: colors.loss,
  medium: colors.warning,
  low: colors.textMuted,
};

const IMPACT_LABELS = {
  high: 'HOCH',
  medium: 'MITTEL',
  low: 'NIEDRIG',
};

function ImpactBadge({ impact }) {
  const c = IMPACT_COLORS[impact] || colors.textMuted;
  return (
    <View style={[styles.impactBadge, { borderColor: c }]}>
      <Text style={[styles.impactText, { color: c }]}>{IMPACT_LABELS[impact] || '?'}</Text>
    </View>
  );
}

function EventCard({ event }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <TouchableOpacity
      style={styles.eventCard}
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.85}
    >
      <View style={styles.eventHeader}>
        <View style={styles.eventTime}>
          <Text style={styles.timeText}>{event.time || '--:--'}</Text>
          <Text style={styles.currencyText}>{event.currency}</Text>
        </View>
        <View style={styles.eventBody}>
          <Text style={styles.eventTitle} numberOfLines={expanded ? undefined : 1}>
            {event.title}
          </Text>
          <ImpactBadge impact={event.impact} />
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={14}
          color={colors.textMuted}
        />
      </View>

      {expanded && (
        <View style={styles.eventDetails}>
          <View style={styles.eventValues}>
            <View style={styles.eventValue}>
              <Text style={styles.valueLabel}>Aktuell</Text>
              <Text style={styles.valueText}>{event.actual || '-'}</Text>
            </View>
            <View style={styles.eventValue}>
              <Text style={styles.valueLabel}>Prognose</Text>
              <Text style={styles.valueText}>{event.forecast || '-'}</Text>
            </View>
            <View style={styles.eventValue}>
              <Text style={styles.valueLabel}>Vorherig</Text>
              <Text style={styles.valueText}>{event.previous || '-'}</Text>
            </View>
          </View>
          {event.description && (
            <Text style={styles.description}>{event.description}</Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

// Mock economic calendar data (in production, fetch from forexfactory or similar)
function getMockCalendarData() {
  const today = new Date();
  const days = [];

  for (let i = -1; i <= 5; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const dateStr = date.toLocaleDateString('de-DE', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
    });

    days.push({
      date: dateStr,
      isToday: i === 0,
      events: [
        {
          id: `${i}-1`,
          time: '08:30',
          currency: 'USD',
          title: 'Non-Farm Payrolls',
          impact: 'high',
          actual: i < 0 ? '227K' : null,
          forecast: '200K',
          previous: '185K',
        },
        {
          id: `${i}-2`,
          time: '10:00',
          currency: 'EUR',
          title: 'EZB Zinsentscheid',
          impact: 'high',
          actual: i < 0 ? '4.00%' : null,
          forecast: '4.00%',
          previous: '4.50%',
        },
        {
          id: `${i}-3`,
          time: '14:00',
          currency: 'GBP',
          title: 'BoE Meeting Minutes',
          impact: 'medium',
          actual: i < 0 ? 'Hawkish' : null,
          forecast: null,
          previous: 'Neutral',
        },
        {
          id: `${i}-4`,
          time: '15:30',
          currency: 'USD',
          title: 'CPI (Core)',
          impact: 'high',
          actual: i < 0 ? '3.2%' : null,
          forecast: '3.1%',
          previous: '3.4%',
        },
        {
          id: `${i}-5`,
          time: '17:00',
          currency: 'CAD',
          title: 'Ivey PMI',
          impact: 'low',
          actual: i < 0 ? '55.2' : null,
          forecast: '54.0',
          previous: '53.8',
        },
      ],
    });
  }
  return days;
}

export default function EconomicCalendarScreen() {
  const [calendarData, setCalendarData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedImpact, setSelectedImpact] = useState('all');
  const [selectedDay, setSelectedDay] = useState(1); // today

  useEffect(() => {
    loadCalendar();
  }, []);

  async function loadCalendar() {
    setLoading(true);
    await new Promise(r => setTimeout(r, 500));
    setCalendarData(getMockCalendarData());
    setLoading(false);
  }

  const today = calendarData[selectedDay];
  const filteredEvents = (today?.events || []).filter(
    e => selectedImpact === 'all' || e.impact === selectedImpact
  );

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0A0E1A', '#111827']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.header}>
          <Text style={styles.title}>Wirtschaftskalender</Text>
          <TouchableOpacity onPress={loadCalendar}>
            <Ionicons name="refresh" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Day Selector */}
        <FlatList
          data={calendarData}
          horizontal
          keyExtractor={(_, idx) => idx.toString()}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.daysList}
          renderItem={({ item, index }) => (
            <TouchableOpacity
              style={[styles.dayBtn, selectedDay === index && styles.dayBtnActive]}
              onPress={() => setSelectedDay(index)}
            >
              {item.isToday && (
                <View style={styles.todayDot} />
              )}
              <Text
                style={[styles.dayBtnText, selectedDay === index && styles.dayBtnTextActive]}
                numberOfLines={1}
              >
                {item.isToday ? 'Heute' : item.date.split(',')[0]}
              </Text>
            </TouchableOpacity>
          )}
        />

        {/* Impact Filter */}
        <View style={styles.impactFilter}>
          {['all', 'high', 'medium', 'low'].map(i => (
            <TouchableOpacity
              key={i}
              style={[styles.impactBtn, selectedImpact === i && styles.impactBtnActive]}
              onPress={() => setSelectedImpact(i)}
            >
              <Text
                style={[
                  styles.impactBtnText,
                  selectedImpact === i && styles.impactBtnTextActive,
                  i !== 'all' && { color: IMPACT_COLORS[i] },
                ]}
              >
                {i === 'all' ? 'Alle' : IMPACT_LABELS[i]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={filteredEvents}
            keyExtractor={item => item.id}
            renderItem={({ item }) => <EventCard event={item} />}
            contentContainerStyle={styles.eventsList}
            ListHeaderComponent={
              today ? (
                <Text style={styles.dateHeader}>{today.date}</Text>
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="calendar-outline" size={40} color={colors.textMuted} />
                <Text style={styles.emptyText}>Keine Events für diesen Tag</Text>
              </View>
            }
            showsVerticalScrollIndicator={false}
          />
        )}
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
  daysList: { paddingHorizontal: spacing.lg, gap: 8, marginBottom: spacing.sm },
  dayBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceElevated,
    position: 'relative',
  },
  dayBtnActive: { backgroundColor: colors.primary },
  dayBtnText: { color: colors.textMuted, fontSize: fontSize.xs, fontWeight: fontWeight.medium },
  dayBtnTextActive: { color: '#fff' },
  todayDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.profit,
  },
  impactFilter: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: 8,
    marginBottom: spacing.md,
  },
  impactBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceElevated,
  },
  impactBtnActive: { borderWidth: 1, borderColor: colors.primary },
  impactBtnText: { color: colors.textMuted, fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  impactBtnTextActive: {},
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  dateHeader: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.md,
    textTransform: 'capitalize',
  },
  eventsList: { padding: spacing.lg, paddingTop: spacing.sm, gap: 8 },
  eventCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 12,
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  eventTime: { alignItems: 'center', minWidth: 48 },
  timeText: { color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  currencyText: { color: colors.primary, fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  eventBody: { flex: 1, gap: 4 },
  eventTitle: { color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  impactBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: borderRadius.full,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  impactText: { fontSize: 9, fontWeight: fontWeight.bold },
  eventDetails: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 8,
  },
  eventValues: { flexDirection: 'row', justifyContent: 'space-around' },
  eventValue: { alignItems: 'center' },
  valueLabel: { color: colors.textMuted, fontSize: 10, marginBottom: 2 },
  valueText: { color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  description: { color: colors.textSecondary, fontSize: fontSize.xs, lineHeight: 16 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { color: colors.textMuted, fontSize: fontSize.sm },
});
