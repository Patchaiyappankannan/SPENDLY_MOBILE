import React, { useEffect } from 'react';
import { createNavigationContainerRef, NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';
import AuthScreen from '../screens/AuthScreen';
import HomeScreen from '../screens/HomeScreen';
import TransactionsScreen from '../screens/TransactionsScreen';
import StatsScreen from '../screens/StatsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import AddTransactionScreen from '../screens/AddTransactionScreen';
import RecurringScreen from '../screens/RecurringScreen';
import AddRecurringScreen from '../screens/AddRecurringScreen';
import RemindersScreen from '../screens/RemindersScreen';
import AddReminderScreen from '../screens/AddReminderScreen';
import GoalsScreen from '../screens/GoalsScreen';
import GoalDetailScreen from '../screens/GoalDetailScreen';
import AddGoalScreen from '../screens/AddGoalScreen';
import LendBorrowScreen from '../screens/LendBorrowScreen';
import PersonDetailScreen from '../screens/PersonDetailScreen';
import AddLendBorrowScreen from '../screens/AddLendBorrowScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import VerifyOtpScreen from '../screens/VerifyOtpScreen';
import NewPasswordScreen from '../screens/NewPasswordScreen';
import ChangeEmailScreen from '../screens/ChangeEmailScreen';
import SecuritySettingsScreen from '../screens/SecuritySettingsScreen';
import SetPinScreen from '../screens/SetPinScreen';
import ResetPinScreen from '../screens/ResetPinScreen';
import * as Notifications from 'expo-notifications';
import { completeReminder } from '../repositories/reminderRepo';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const navigationRef = createNavigationContainerRef();

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
  const { changed } = useSync();
  useEffect(() => {
    if (!user) return undefined;
    const openReminder = async (response) => {
      const data = response?.notification?.request?.content?.data || {};
      if (!navigationRef.isReady()) return;
      if (data.reminderId) {
        if (response.actionIdentifier === 'mark-paid') {
          await completeReminder(data.reminderId);
          changed();
          navigationRef.navigate('Reminders');
        } else navigationRef.navigate('AddReminder', { id: data.reminderId });
      } else if (data.goalId) navigationRef.navigate('GoalDetail', { id: data.goalId });
      else if (data.personId) navigationRef.navigate('PersonDetail', { id: data.personId });
      else return;
      Notifications.clearLastNotificationResponseAsync().catch(() => {});
    };
    const listener = Notifications.addNotificationResponseReceivedListener(openReminder);
    Notifications.getLastNotificationResponseAsync().then(openReminder).catch(() => {});
    return () => listener.remove();
  }, [user, changed]);
  const base = dark ? DarkTheme : DefaultTheme;
  const theme = {
    ...base,
    colors: { ...base.colors, background: c.bg, card: c.surface, text: c.text, border: c.border, primary: c.primary },
  };
  return (
    <NavigationContainer ref={navigationRef} theme={theme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen name="Tabs" component={Tabs} />
            <Stack.Screen name="AddTransaction" component={AddTransactionScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="Recurring" component={RecurringScreen} />
            <Stack.Screen name="AddRecurring" component={AddRecurringScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="Reminders" component={RemindersScreen} />
            <Stack.Screen name="AddReminder" component={AddReminderScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="Goals" component={GoalsScreen} />
            <Stack.Screen name="GoalDetail" component={GoalDetailScreen} />
            <Stack.Screen name="AddGoal" component={AddGoalScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="LendBorrow" component={LendBorrowScreen} />
            <Stack.Screen name="PersonDetail" component={PersonDetailScreen} />
            <Stack.Screen name="AddLendBorrow" component={AddLendBorrowScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="SecuritySettings" component={SecuritySettingsScreen} />
            <Stack.Screen name="ChangeEmail" component={ChangeEmailScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="SetPin" component={SetPinScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="ResetPin" component={ResetPinScreen} options={{ presentation: 'modal' }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Auth" component={AuthScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
            <Stack.Screen name="VerifyOtp" component={VerifyOtpScreen} />
            <Stack.Screen name="NewPassword" component={NewPasswordScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
