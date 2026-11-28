import React, { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Title, Input, Segmented, Card, EmptyState, FAB, Muted } from '../components/ui';
import { useTheme } from '../theme/ThemeContext';
import { useSync } from '../context/SyncContext';
import { font, spacing } from '../theme/tokens';
import { formatMoney, friendlyDate } from '../utils/format';
import { currentDateOnly } from '../services/recurrence';
import { completeReminder, deleteReminder, listReminders, skipReminder } from '../repositories/reminderRepo';

export default function RemindersScreen({ navigation }) {
  const { c, currency } = useTheme();
  const { version, changed } = useSync();
  const [tab, setTab] = useState('upcoming');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState([]);
  const load = useCallback(async () => setRows(await listReminders(tab, search)), [tab, search]);
  useFocusEffect(useCallback(() => { load(); }, [load, version]));

  const remove = (row) => Alert.alert('Delete reminder?', 'Its scheduled notification will be cancelled.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => { await deleteReminder(row.id); changed(); load(); } },
  ]);

  return (
    <Screen>
      <View style={{ padding: spacing.lg, paddingBottom: spacing.sm }}>
        <Title>Reminders</Title>
        <Segmented value={tab} onChange={setTab} style={{ marginTop: spacing.md, marginBottom: spacing.md }}
          options={[{ key: 'upcoming', label: 'Upcoming' }, { key: 'overdue', label: 'Overdue' }, { key: 'done', label: 'Done' }]} />
        <Input icon="search" placeholder="Search reminders" value={search} onChangeText={setSearch} containerStyle={{ marginBottom: 0 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.sm, paddingBottom: 100 }}>
        {rows.length ? rows.map((row) => {
          const overdue = row.status === 'pending' && row.due_date < currentDateOnly();
          return (
            <Card key={row.id} style={{ marginBottom: spacing.md, padding: spacing.md, borderLeftWidth: overdue ? 4 : 0, borderLeftColor: c.expense }}>
              <Pressable onPress={() => navigation.navigate('AddReminder', { id: row.id })} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: overdue ? c.expenseSoft : c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={row.status === 'done' ? 'checkmark-circle' : 'notifications-outline'} size={20} color={overdue ? c.expense : c.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.text, fontSize: font.md, fontWeight: '700' }}>{row.title}</Text>
                  <Muted>{row.type.replace('_', ' ')}{row.account ? ` · ${row.account}` : ''}{row.repeat_type !== 'none' ? ` · ${row.repeat_type}` : ''}</Muted>
                </View>
                {row.amount != null ? <Text style={{ color: c.text, fontSize: font.md, fontWeight: '700' }}>{formatMoney(row.amount, currency)}</Text> : null}
              </Pressable>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md }}>
                <Text style={{ color: overdue ? c.expense : c.textMuted, fontSize: font.sm, fontWeight: overdue ? '700' : '400' }}>
                  {row.status === 'done' ? 'Done' : overdue ? `Overdue · ${friendlyDate(row.due_date)}` : `Due ${friendlyDate(row.due_date)}`}
                </Text>
                {row.status === 'pending' ? (
                  <Pressable onPress={() => Alert.alert('Mark as paid?', 'This records an expense when an amount is set.', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Mark as paid', onPress: async () => { await completeReminder(row.id); changed(); load(); } },
                    { text: 'Skip', onPress: async () => { await skipReminder(row.id); changed(); load(); } },
                    { text: 'Delete', style: 'destructive', onPress: () => remove(row) },
                  ])} accessibilityRole="button">
                    <Text style={{ color: c.primary, fontSize: font.sm, fontWeight: '700' }}>Mark paid</Text>
                  </Pressable>
                ) : null}
              </View>
            </Card>
          );
        }) : <EmptyState title={tab === 'done' ? 'No completed reminders' : 'Nothing due'} hint="Add bills, card payments or other due dates." />}
      </ScrollView>
      <FAB onPress={() => navigation.navigate('AddReminder')} />
    </Screen>
  );
}