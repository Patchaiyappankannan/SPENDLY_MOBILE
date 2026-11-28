import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, EmptyState, Input, Screen, Title, Muted } from '../components/ui';
import { useTheme } from '../theme/ThemeContext';
import { useSync } from '../context/SyncContext';
import { font, spacing } from '../theme/tokens';
import { formatMoney, friendlyDate } from '../utils/format';
import { getLendBorrowSummary } from '../repositories/lendBorrowRepo';

export default function LendBorrowScreen({ navigation }) {
  const { c, currency } = useTheme();
  const { version } = useSync();
  const [search, setSearch] = useState('');
  const [summary, setSummary] = useState({ people: [], overdue: [], totalToReceive: 0, totalToPay: 0 });
  const load = useCallback(async () => setSummary(await getLendBorrowSummary(search)), [search]);
  useFocusEffect(useCallback(() => { load(); }, [load, version]));

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}>
        <Title>Split, lend & borrow</Title>
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
          <Card style={{ flex: 1, padding: spacing.md }}><Muted>You will receive</Muted><Text style={{ color: c.income, fontSize: font.lg, fontWeight: '800', marginTop: 4 }}>{formatMoney(summary.totalToReceive, currency)}</Text></Card>
          <Card style={{ flex: 1, padding: spacing.md }}><Muted>You need to pay</Muted><Text style={{ color: c.expense, fontSize: font.lg, fontWeight: '800', marginTop: 4 }}>{formatMoney(summary.totalToPay, currency)}</Text></Card>
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
          <Button title="Add person" icon="person-add-outline" variant="secondary" onPress={() => navigation.navigate('AddLendBorrow', { mode: 'person' })} style={{ flex: 1 }} />
          <Button title="Add entry" icon="swap-horizontal-outline" onPress={() => navigation.navigate('AddLendBorrow', { mode: 'entry' })} style={{ flex: 1 }} />
        </View>
        <Button title="Split a bill" icon="people-outline" variant="secondary" onPress={() => navigation.navigate('AddLendBorrow', { mode: 'split' })} style={{ marginTop: spacing.sm }} />
        {!!summary.overdue.length && <>
          <Text style={{ color: c.expense, fontSize: font.lg, fontWeight: '700', marginTop: spacing.xl, marginBottom: spacing.sm }}>Overdue</Text>
          {summary.overdue.slice(0, 5).map((entry) => <Pressable key={entry.id} onPress={() => navigation.navigate('PersonDetail', { id: entry.person_id })}>
            <Card style={{ marginBottom: spacing.sm, padding: spacing.md, borderLeftWidth: 3, borderLeftColor: c.expense }}>
              <Text style={{ color: c.text, fontWeight: '700' }}>{entry.person_name} · {formatMoney(entry.remaining_amount, currency)}</Text>
              <Muted>Due {friendlyDate(entry.due_date)} · {entry.type}</Muted>
            </Card>
          </Pressable>)}
        </>}
        <Text style={{ color: c.text, fontSize: font.lg, fontWeight: '700', marginTop: spacing.xl, marginBottom: spacing.sm }}>People</Text>
        <Input icon="search" placeholder="Search people" value={search} onChangeText={setSearch} />
        {summary.people.length ? summary.people.map((person) => {
          const receive = person.net_balance > 0;
          return <Pressable key={person.id} onPress={() => navigation.navigate('PersonDetail', { id: person.id })}>
            <Card style={{ marginBottom: spacing.sm, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="person" size={20} color={c.primary} />
              </View>
              <View style={{ flex: 1 }}><Text style={{ color: c.text, fontWeight: '700' }}>{person.name}</Text><Muted>{person.phone || 'No phone number'}</Muted></View>
              <View style={{ alignItems: 'flex-end' }}><Text style={{ color: person.net_balance === 0 ? c.textMuted : receive ? c.income : c.expense, fontWeight: '800' }}>{formatMoney(Math.abs(person.net_balance), currency)}</Text><Muted>{person.net_balance === 0 ? 'Settled' : receive ? 'You will get' : 'You owe'}</Muted></View>
            </Card>
          </Pressable>;
        }) : <EmptyState icon="people-outline" title="No people yet" hint="Add a person to track money lent, borrowed, and settled." />}
      </ScrollView>
    </Screen>
  );
}