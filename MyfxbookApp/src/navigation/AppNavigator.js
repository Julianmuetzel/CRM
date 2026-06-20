import React from 'react';
import { StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../store/AppContext';
import { colors, fontSize, fontWeight } from '../theme';

import LoadingScreen from '../components/common/LoadingScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import DashboardScreen from '../screens/dashboard/DashboardScreen';
import TradesTabScreen from '../screens/trades/TradesTabScreen';
import AnalyticsScreen from '../screens/analytics/AnalyticsScreen';
import EconomicCalendarScreen from '../screens/calendar/EconomicCalendarScreen';
import MarketSentimentScreen from '../screens/sentiment/MarketSentimentScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarBackground: undefined,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: ({ focused, color, size }) => {
          const icons = {
            Dashboard: focused ? 'home' : 'home-outline',
            Trades: focused ? 'pulse' : 'pulse-outline',
            Analytics: focused ? 'bar-chart' : 'bar-chart-outline',
            Calendar: focused ? 'calendar' : 'calendar-outline',
            Sentiment: focused ? 'trending-up' : 'trending-up-outline',
            Settings: focused ? 'settings' : 'settings-outline',
          };
          return (
            <Ionicons
              name={icons[route.name] || 'ellipse-outline'}
              size={22}
              color={color}
            />
          );
        },
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ tabBarLabel: 'Dashboard' }}
      />
      <Tab.Screen
        name="Trades"
        component={TradesTabScreen}
        options={{ tabBarLabel: 'Trades' }}
      />
      <Tab.Screen
        name="Analytics"
        component={AnalyticsScreen}
        options={{ tabBarLabel: 'Analytics' }}
      />
      <Tab.Screen
        name="Calendar"
        component={EconomicCalendarScreen}
        options={{ tabBarLabel: 'Kalender' }}
      />
      <Tab.Screen
        name="Sentiment"
        component={MarketSentimentScreen}
        options={{ tabBarLabel: 'Sentiment' }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ tabBarLabel: 'Einstellungen' }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { state } = useApp();

  if (state.isLoading) {
    return <LoadingScreen message="Lade FX Tracker Pro..." />;
  }

  return (
    <NavigationContainer
      theme={{
        dark: true,
        colors: {
          primary: colors.primary,
          background: colors.background,
          card: colors.surface,
          text: colors.text,
          border: colors.border,
          notification: colors.loss,
        },
      }}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!state.isAuthenticated ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <Stack.Screen name="Main" component={TabNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    backgroundColor: '#0A0E1A',
    elevation: 0,
    height: 82,
    paddingBottom: 24,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: fontWeight.medium,
  },
});
