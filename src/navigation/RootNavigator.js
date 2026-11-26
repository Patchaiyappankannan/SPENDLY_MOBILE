import React from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import AuthScreen from '../screens/AuthScreen';
import HomeScreen from '../screens/HomeScreen';
import TransactionsScreen from '../screens/TransactionsScreen';
import StatsScreen from '../screens/StatsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import AddTransactionScreen from '../screens/AddTransactionScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const ICONS = {
  Home: ['home', 'home-outline'],
  Transactions: ['list', 'list-outline'],
  Insights: ['stats-chart', 'stats-chart-outline'],
  Settings: ['settings', 'settings-outline'],
};

function Tabs() {
  const { c } = useTheme();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border, height: 62, paddingTop: 6, paddingBottom: 8 },
        tabBarIcon: ({ focused, color, size }) => (
          <Ionicons name={ICONS[route.name][focused ? 0 : 1]} size={size} color={color} />
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Transactions" component={TransactionsScreen} />
      <Tab.Screen name="Insights" component={StatsScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const { c, dark } = useTheme();
  const { user } = useAuth();
  const base = dark ? DarkTheme : DefaultTheme;
  const theme = {
    ...base,
    colors: { ...base.colors, background: c.bg, card: c.surface, text: c.text, border: c.border, primary: c.primary },
  };
  return (
    <NavigationContainer theme={theme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen name="Tabs" component={Tabs} />
            <Stack.Screen name="AddTransaction" component={AddTransactionScreen} options={{ presentation: 'modal' }} />
          </>
        ) : (
          <Stack.Screen name="Auth" component={AuthScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
