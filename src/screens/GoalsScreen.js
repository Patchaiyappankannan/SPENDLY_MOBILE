import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Card, EmptyState, FAB, Input, ProgressBar, Screen, Segmented, Title, Muted } from '../components/ui';
import { useTheme } from '../theme/ThemeContext';
import { useSync } from '../context/SyncContext';
import { font, spacing } from '../theme/tokens';
import { formatMoney, friendlyDate } from '../utils/format';
import { getSavingsSummary, listGoals } from '../repositories/savingsRepo';

const daysLeft = (date) => date ? Math.ceil((new Date(`${date}T00:00:00`).getTime() - new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00').getTime()) / 86400000) : null;

export default function GoalsScreen({ navigation }) {
  const { c, currency } = useTheme();
  const { version } = useSync();
  const [status, setStatus] = useState('active');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({ totalSaved: 0, topGoal: null });
  const load = useCallback(async () => {
    setRows(await listGoals(status, search));
    setSummary(await getSavingsSummary());
  }, [status, search]);
  useFocusEffect(useCallback(() => { load(); }, [load, version]));

  return (
    <Screen>
      <View style={{ padding: spacing.lg, paddingBottom: spacing.sm }}>
        <Title>Savings goals</Title>
        <Card style={{ marginTop: spacing.md, padding: spacing.md }}>
          <Muted>Total saved across active goals</Muted>
          <Text style={{ color: c.text, fontSize: font.xl, fontWeight: '800', marginTop: 4 }}>{formatMoney(summary.totalSaved, currency)}</Text>
          {summary.topGoal ? <Muted style={{ marginTop: 4 }}>Leading: {summary.topGoal.name}</Muted> : null}
        </Card>
        <Segmented value={status} onChange={setStatus} style={{ marginTop: spacing.md, marginBottom: spacing.md }}
          options={[{ key: 'active', label: 'Active' }, { key: 'paused', label: 'Paused' }, { key: 'completed', label: 'Done' }]} />
        <Input icon="search" placeholder="Search goals" value={search} onChangeText={setSearch} containerStyle={{ marginBottom: 0 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.sm, paddingBottom: 100 }}>
        {rows.length ? rows.map((goal) => {
          const saved = Number(goal.saved_amount) || 0;
          const pct = Math.min(100, Math.round((saved / Number(goal.target_amount)) * 100));
          const left = daysLeft(goal.target_date);
          return (
            <Pressable key={goal.id} onPress={() => navigation.navigate('GoalDetail', { id: goal.id })}>
              <Card style={{ marginBottom: spacing.md, padding: spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: `${goal.color}22`, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={goal.icon || 'flag'} size={21} color={goal.color || c.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: c.text, fontSize: font.md, fontWeight: '700' }}>{goal.name}</Text>
                    <Muted>{formatMoney(saved, currency)} of {formatMoney(goal.target_amount, currency)}</Muted>
                  </View>
                  <Text style={{ color: c.primary, fontWeight: '800' }}>{pct}%</Text>
                </View>
                <ProgressBar pct={pct} color={goal.color || c.primary} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 9 }}>
                  <Muted>{formatMoney(Math.max(0, Number(goal.target_amount) - saved), currency)} remaining</Muted>
                  <Muted>{left == null ? 'No target date' : left < 0 ? 'Past target date' : `${left} days left`}</Muted>
                </View>
                {goal.target_date ? <Muted style={{ marginTop: 3 }}>Target {friendlyDate(goal.target_date)}</Muted> : null}
              </Card>
            </Pressable>
          );
        }) : <EmptyState icon="flag-outline" title="No goals here yet" hint="Create a goal and track each contribution offline." />}
      </ScrollView>
      <FAB onPress={() => navigation.navigate('AddGoal')} />
    </Screen>
  );
}