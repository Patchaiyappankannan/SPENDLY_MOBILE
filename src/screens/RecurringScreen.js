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
import { addDueOccurrence, deleteRecurring, listRecurring, setRecurringActive, skipRecurringOccurrence } from '../repositories/recurringRepo';

export default function RecurringScreen({ navigation }) {
  const { c, currency } = useTheme();
  const { version, changed } = useSync();
  const [tab, setTab] = useState('active');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState([]);

  const load = useCallback(async () => setRows(await listRecurring({ active: tab === 'active', search })), [tab, search]);
  useFocusEffect(useCallback(() => { load(); }, [load, version]));

  const actions = (row) => Alert.alert(row.title, 'Choose an action', [
    { text: row.is_active ? 'Pause' : 'Resume', onPress: async () => { await setRecurringActive(row.id, !row.is_active); changed(); load(); } },
    { text: 'Skip next due', onPress: async () => { await skipRecurringOccurrence(row.id); changed(); load(); } },
    { text: 'Edit', onPress: () => navigation.navigate('AddRecurring', { id: row.id }) },
    { text: 'Delete rule', style: 'destructive', onPress: () => Alert.alert('Delete recurring rule?', 'Past transactions will be kept.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteRecurring(row.id); changed(); load(); } },
    ]) },
    { text: 'Cancel', style: 'cancel' },
  ]);

  return (
    <Screen>
      <View style={{ padding: spacing.lg, paddingBottom: spacing.sm }}>
        <Title>Recurring expenses</Title>
        <Segmented value={tab} onChange={setTab} style={{ marginTop: spacing.md, marginBottom: spacing.md }}
          options={[{ key: 'active', label: 'Active' }, { key: 'paused', label: 'Paused' }]} />
        <Input icon="search" placeholder="Search title, category or account" value={search} onChangeText={setSearch} containerStyle={{ marginBottom: 0 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.sm, paddingBottom: 100 }}>
        {rows.length ? rows.map((row) => {
          const due = row.next_due_date <= currentDateOnly();
          return (
            <Card key={row.id} style={{ marginBottom: spacing.md, padding: spacing.md }}>
              <Pressable onPress={() => actions(row)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="repeat" size={20} color={c.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.text, fontSize: font.md, fontWeight: '700' }}>{row.title}</Text>
                  <Muted>{row.category} · {row.account || 'No account'} · {row.frequency}</Muted>
                </View>
                <Text style={{ color: c.text, fontSize: font.md, fontWeight: '700' }}>{formatMoney(row.amount, currency)}</Text>
              </Pressable>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md }}>
                <Muted>Next: {friendlyDate(row.next_due_date)}{row.total_installments ? ` · ${Math.min(row.paid_installments, row.total_installments)}/${row.total_installments} paid` : ''}</Muted>
                {!row.auto_add && due && row.is_active ? (
                  <Pressable onPress={async () => { await addDueOccurrence(row.id); changed(); load(); }} accessibilityRole="button">
                    <Text style={{ color: c.primary, fontSize: font.sm, fontWeight: '700' }}>Add due</Text>
                  </Pressable>
                ) : <Text style={{ color: row.auto_add ? c.income : c.accent, fontSize: font.xs, fontWeight: '700' }}>{row.auto_add ? 'AUTO-ADD' : 'CONFIRM'}</Text>}
              </View>
            </Card>
          );
        }) : <EmptyState title={tab === 'active' ? 'No active rules' : 'No paused rules'} hint="Add a rule for rent, subscriptions or installments." />}
      </ScrollView>
      <FAB onPress={() => navigation.navigate('AddRecurring')} />
    </Screen>
  );
}