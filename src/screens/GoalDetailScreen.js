import React, { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Muted, ProgressBar, Screen, Title } from '../components/ui';
import { useTheme } from '../theme/ThemeContext';
import { useSync } from '../context/SyncContext';
import { font, spacing } from '../theme/tokens';
import { formatMoney, friendlyDate } from '../utils/format';
import { deleteGoal, getGoal, listGoalContributions, saveGoal } from '../repositories/savingsRepo';

function monthsRemaining(date) {
  if (!date) return null;
  const end = new Date(`${date}T00:00:00`);
  const today = new Date();
  const months = (end.getFullYear() - today.getFullYear()) * 12 + end.getMonth() - today.getMonth();
  return Math.max(1, months + (end.getDate() > today.getDate() ? 1 : 0));
}

export default function GoalDetailScreen({ navigation, route }) {
  const id = route.params.id;
  const { c, currency } = useTheme();
  const { version, changed } = useSync();
  const [goal, setGoal] = useState(null);
  const [history, setHistory] = useState([]);
  const load = useCallback(async () => { setGoal(await getGoal(id)); setHistory(await listGoalContributions(id)); }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load, version]));
  if (!goal) return <Screen />;
  const saved = Number(goal.saved_amount) || 0;
  const pct = Math.min(100, Math.round(saved / Number(goal.target_amount) * 100));
  const months = monthsRemaining(goal.target_date);
  const monthly = months ? Math.max(0, Number(goal.target_amount) - saved) / months : null;

  const actions = () => Alert.alert(goal.name, 'Manage this savings goal', [
    { text: 'Contribute', onPress: () => navigation.navigate('AddGoal', { goalId: id, mode: 'add' }) },
    { text: 'Withdraw', onPress: () => navigation.navigate('AddGoal', { goalId: id, mode: 'withdraw' }) },
    { text: 'Edit goal', onPress: () => navigation.navigate('AddGoal', { id }) },
    { text: goal.status === 'paused' ? 'Resume' : 'Pause', onPress: async () => { await saveGoal({ ...goal, targetAmount: goal.target_amount, targetDate: goal.target_date, remindMonthly: !!goal.remind_monthly, status: goal.status === 'paused' ? 'active' : 'paused' }, id); changed(); load(); } },
    { text: 'Delete goal', style: 'destructive', onPress: () => Alert.alert('Delete this goal?', 'Contribution history will remain on this device.', [
      { text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { await deleteGoal(id); changed(); navigation.goBack(); } },
    ]) },
    { text: 'Cancel', style: 'cancel' },
  ]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title>{goal.name}</Title>
          <Pressable onPress={actions} hitSlop={10}><Ionicons name="ellipsis-horizontal" size={24} color={c.text} /></Pressable>
        </View>
        <Card style={{ marginTop: spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: `${goal.color}22`, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={goal.icon || 'flag'} size={23} color={goal.color || c.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.text, fontSize: font.xl, fontWeight: '800' }}>{formatMoney(saved, currency)}</Text>
              <Muted>of {formatMoney(goal.target_amount, currency)}</Muted>
            </View>
            <Text style={{ color: c.primary, fontWeight: '800' }}>{pct}%</Text>
          </View>
          <View style={{ marginTop: spacing.md }}><ProgressBar pct={pct} color={goal.color || c.primary} height={10} /></View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
            <Muted>{formatMoney(Math.max(0, Number(goal.target_amount) - saved), currency)} to go</Muted>
            <Muted>{goal.target_date ? `By ${friendlyDate(goal.target_date)}` : goal.status}</Muted>
          </View>
        </Card>
        {goal.status === 'completed' ? <Card style={{ marginTop: spacing.md, backgroundColor: c.incomeSoft, alignItems: 'center' }}>
          <Ionicons name="trophy" size={30} color={c.income} /><Text style={{ color: c.income, fontWeight: '800', marginTop: 5 }}>Goal reached</Text>
        </Card> : null}
        {monthly != null ? <Card style={{ marginTop: spacing.md }}>
          <Muted>Monthly saving needed</Muted>
          <Text style={{ color: c.text, fontSize: font.lg, fontWeight: '800', marginTop: 4 }}>{formatMoney(monthly, currency)} / month</Text>
          <Muted>Based on {months} remaining calendar month{months === 1 ? '' : 's'}.</Muted>
        </Card> : null}
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
          <Button title="Contribute" icon="add-circle-outline" onPress={() => navigation.navigate('AddGoal', { goalId: id, mode: 'add' })} style={{ flex: 1 }} />
          <Button title="Withdraw" icon="remove-circle-outline" variant="secondary" onPress={() => navigation.navigate('AddGoal', { goalId: id, mode: 'withdraw' })} style={{ flex: 1 }} />
        </View>
        <Text style={{ color: c.text, fontSize: font.lg, fontWeight: '700', marginTop: spacing.xl, marginBottom: spacing.sm }}>Contribution history</Text>
        <Card style={{ paddingVertical: 4 }}>
          {history.length ? history.map((entry, index) => (
            <View key={entry.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderTopWidth: index ? 1 : 0, borderTopColor: c.border }}>
              <Ionicons name={entry.type === 'add' ? 'arrow-down-circle' : 'arrow-up-circle'} size={22} color={entry.type === 'add' ? c.income : c.accent} />
              <View style={{ flex: 1, marginLeft: 10 }}><Text style={{ color: c.text, fontWeight: '600' }}>{entry.type === 'add' ? 'Added' : 'Withdrawn'} · {entry.account_id || 'No account'}</Text><Muted>{friendlyDate(entry.date)}{entry.note ? ` · ${entry.note}` : ''}</Muted></View>
              <Text style={{ color: entry.type === 'add' ? c.income : c.expense, fontWeight: '700' }}>{entry.type === 'add' ? '+' : '-'}{formatMoney(entry.amount, currency)}</Text>
            </View>
          )) : <Muted style={{ paddingVertical: 14 }}>No contributions yet.</Muted>}
        </Card>
      </ScrollView>
    </Screen>
  );
}