import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Screen, Card, Muted, SectionHeader, ProgressBar, EmptyState, FAB } from '../components/ui';
import MonthSwitcher from '../components/MonthSwitcher';
import TxRow from '../components/TxRow';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';
import { font, radius, spacing } from '../theme/tokens';
import { formatMoney, friendlyDate, monthKey, daysInMonth } from '../utils/format';
import { monthSummary, listByMonth } from '../repositories/txRepo';
import { getBudget } from '../repositories/budgetRepo';
import { getUpcomingReminderCount } from '../repositories/reminderRepo';
import { getSavingsSummary } from '../repositories/savingsRepo';

export default function HomeScreen({ navigation }) {
  const { c, currency } = useTheme();
  const { user } = useAuth();
  const { pending, syncing, version, syncNow } = useSync();
  const [month, setMonth] = useState(monthKey(new Date()));
  const [date, setDate] = useState(null);
  const [sum, setSum] = useState({ income: 0, expense: 0 });
  const [budget, setBudget] = useState(null);
  const [recent, setRecent] = useState([]);
  const [dueReminders, setDueReminders] = useState([]);
  const [savings, setSavings] = useState({ totalSaved: 0, topGoal: null });

  const load = useCallback(async () => {
    setSum(await monthSummary(month, date));
    setBudget(await getBudget(month));
    setRecent((await listByMonth(month, { date })).slice(0, 6));
    setDueReminders(await getUpcomingReminderCount());
    setSavings(await getSavingsSummary());
  }, [month, date]);

  useFocusEffect(useCallback(() => { load(); }, [load, version]));

  const balance = sum.income - sum.expense;
  const isCurrent = month === monthKey(new Date());
  const spentPct = budget ? (sum.expense / budget) * 100 : 0;
  const remaining = budget ? budget - sum.expense : 0;
  const daysLeft = daysInMonth(month) - new Date().getDate() + 1;
  const safeToday = budget && isCurrent && remaining > 0 ? remaining / daysLeft : 0;
  const barColor = spentPct >= 100 ? c.expense : spentPct >= 80 ? c.accent : c.income;
  const first = (user?.name || '').split(' ')[0];

  const Stat = ({ icon, label, value }) => (
    <View style={{ flex: 1, backgroundColor: c.heroChip, borderRadius: radius.md, padding: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Ionicons name={icon} size={14} color={c.heroMuted} />
        <Text style={{ color: c.heroMuted, fontSize: font.xs }}>{label}</Text>
      </View>
      <Text style={{ color: c.heroText, fontSize: font.lg, fontWeight: '700', marginTop: 4 }}>{formatMoney(value, currency)}</Text>
    </View>
  );

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 110 }}
        refreshControl={<RefreshControl refreshing={syncing} onRefresh={syncNow} tintColor={c.primary} />}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Muted>Welcome back</Muted>
            <Text style={{ color: c.text, fontSize: font.xl, fontWeight: '700' }}>{first || 'there'}</Text>
          </View>
          <Pressable onPress={syncNow} style={{
            flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 34, borderRadius: radius.pill,
            backgroundColor: pending ? c.accentSoft : c.incomeSoft,
          }}>
            <Ionicons name={syncing ? 'sync' : pending ? 'time-outline' : 'cloud-done-outline'} size={16} color={pending ? c.accent : c.income} />
            <Text style={{ color: pending ? c.accent : c.income, fontSize: font.xs, fontWeight: '700' }}>
              {syncing ? 'Syncing' : pending ? `${pending} to sync` : 'Backed up'}
            </Text>
          </Pressable>
        </View>

        <MonthSwitcher month={month} onChange={setMonth} date={date} onDateChange={setDate} />

        <View style={{ backgroundColor: c.hero, borderRadius: radius.xl, padding: 20 }}>
          <Text style={{ color: c.heroMuted, fontSize: font.sm }}>Net balance this month</Text>
          <Text style={{ color: c.heroText, fontSize: font.xxl + 4, fontWeight: '800', marginTop: 4, marginBottom: 16 }}>
            {formatMoney(balance, currency)}
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Stat icon="arrow-down-circle-outline" label="Income" value={sum.income} />
            <Stat icon="arrow-up-circle-outline" label="Spent" value={sum.expense} />
          </View>
        </View>

        <Card style={{ marginTop: spacing.lg }}>
          {budget ? (
            <>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                <Text style={{ color: c.text, fontWeight: '700', fontSize: font.md }}>Monthly budget</Text>
                <Muted>{formatMoney(sum.expense, currency)} of {formatMoney(budget, currency)}</Muted>
              </View>
              <ProgressBar pct={spentPct} color={barColor} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
                <Text style={{ color: remaining < 0 ? c.expense : c.textMuted, fontSize: font.sm }}>
                  {remaining < 0 ? `Over by ${formatMoney(-remaining, currency)}` : `${formatMoney(remaining, currency)} left`}
                </Text>
                {safeToday > 0 ? <Text style={{ color: c.text, fontSize: font.sm, fontWeight: '600' }}>Safe to spend today: {formatMoney(safeToday, currency)}</Text> : null}
              </View>
            </>
          ) : (
            <Pressable onPress={() => navigation.navigate('Settings')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Ionicons name="flag-outline" size={22} color={c.accent} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.text, fontWeight: '700', fontSize: font.md }}>Set a monthly budget</Text>
                <Muted>Get a daily safe-to-spend amount and a warning at 80%.</Muted>
              </View>
              <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
            </Pressable>
          )}
        </Card>

        <Card style={{ marginTop: spacing.md }}>
          <Pressable onPress={() => navigation.navigate('Goals')} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Ionicons name="flag-outline" size={19} color={c.income} /><Text style={{ color: c.text, fontSize: font.md, fontWeight: '700' }}>Savings goals</Text></View>
            <Text style={{ color: c.primary, fontSize: font.sm, fontWeight: '700' }}>Open  ›</Text>
          </Pressable>
          <Text style={{ color: c.text, fontSize: font.lg, fontWeight: '800', marginTop: 8 }}>{formatMoney(savings.totalSaved, currency)} saved</Text>
          {savings.topGoal ? <>
            <Muted style={{ marginTop: 2 }}>Leading: {savings.topGoal.name}</Muted>
            <View style={{ marginTop: 8 }}><ProgressBar pct={Math.min(100, Number(savings.topGoal.saved_amount) / Number(savings.topGoal.target_amount) * 100)} color={savings.topGoal.color || c.primary} height={6} /></View>
          </> : <Muted style={{ marginTop: 2 }}>Start a savings goal</Muted>}
        </Card>

        <Card style={{ marginTop: spacing.md }}>
          <Pressable onPress={() => navigation.navigate('LendBorrow')} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Ionicons name="people-outline" size={19} color={c.accent} /><Text style={{ color: c.text, fontSize: font.md, fontWeight: '700' }}>Split, lend & borrow</Text></View>
            <Text style={{ color: c.primary, fontSize: font.sm, fontWeight: '700' }}>Open  ›</Text>
          </Pressable>
        </Card>

        <Card style={{ marginTop: spacing.md }}>
          <Pressable onPress={() => navigation.navigate('Reminders')} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: dueReminders.length ? spacing.sm : 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="notifications-outline" size={19} color={c.accent} />
              <Text style={{ color: c.text, fontSize: font.md, fontWeight: '700' }}>Due in the next 7 days</Text>
            </View>
            <Text style={{ color: c.primary, fontSize: font.sm, fontWeight: '700' }}>{dueReminders.length}  ›</Text>
          </Pressable>
          {dueReminders.slice(0, 3).map((reminder) => (
            <Pressable key={reminder.id} onPress={() => navigation.navigate('AddReminder', { id: reminder.id })}
              style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: c.border, paddingVertical: 9 }}>
              <Text numberOfLines={1} style={{ color: c.text, flex: 1 }}>{reminder.title} · {friendlyDate(reminder.due_date)}</Text>
              {reminder.amount != null ? <Text style={{ color: c.textMuted, marginLeft: 8 }}>{formatMoney(reminder.amount, currency)}</Text> : null}
            </Pressable>
          ))}
        </Card>

        <SectionHeader title="Recent" action={recent.length ? 'See all' : undefined} onAction={() => navigation.navigate('Transactions')} />
        <Card style={{ paddingVertical: 4 }}>
          {recent.length ? recent.map((t, i) => (
            <View key={t.local_id} style={{ borderTopWidth: i ? 1 : 0, borderTopColor: c.border }}>
              <TxRow item={t} showDate onPress={() => navigation.navigate('AddTransaction', { id: t.local_id })} />
            </View>
          )) : (
            <EmptyState title="No entries yet" hint="Add your first expense. It works even without internet."
              actionTitle="Add expense" onAction={() => navigation.navigate('AddTransaction')} />
          )}
        </Card>
      </ScrollView>
      <FAB onPress={() => navigation.navigate('AddTransaction')} />
    </Screen>
  );
}
