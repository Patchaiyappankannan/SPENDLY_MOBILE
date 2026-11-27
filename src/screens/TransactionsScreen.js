import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, SectionList } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Screen, Title, Input, Segmented, Card, EmptyState, FAB } from '../components/ui';
import MonthSwitcher from '../components/MonthSwitcher';
import TxRow from '../components/TxRow';
import { useTheme } from '../theme/ThemeContext';
import { useSync } from '../context/SyncContext';
import { font, spacing } from '../theme/tokens';
import { monthKey, friendlyDate, formatMoney } from '../utils/format';
import { listByMonth } from '../repositories/txRepo';

export default function TransactionsScreen({ navigation }) {
  const { c, currency } = useTheme();
  const { version } = useSync();
  const [month, setMonth] = useState(monthKey(new Date()));
  const [type, setType] = useState('all');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState([]);

  const load = useCallback(async () => {
    setRows(await listByMonth(month, { type: type === 'all' ? undefined : type, search: search.trim() || undefined }));
  }, [month, type, search]);
  useFocusEffect(useCallback(() => { load(); }, [load, version]));

  const sections = useMemo(() => {
    const map = {};
    rows.forEach((r) => {
      (map[r.date] = map[r.date] || { date: r.date, net: 0, data: [] });
      map[r.date].data.push(r);
      map[r.date].net += r.type === 'income' ? r.amount : -r.amount;
    });
    return Object.values(map).sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [rows]);

  return (
    <Screen>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
        <Title>Transactions</Title>
        <MonthSwitcher month={month} onChange={setMonth} showCalendar={false} />
        <Input icon="search" placeholder="Search note or category" value={search} onChangeText={setSearch}
          containerStyle={{ marginBottom: spacing.md }} />
        <Segmented value={type} onChange={setType} style={{ marginBottom: spacing.sm }}
          options={[{ key: 'all', label: 'All' }, { key: 'expense', label: 'Expenses' }, { key: 'income', label: 'Income' }]} />
      </View>
      <SectionList
        sections={sections}
        keyExtractor={(i) => i.local_id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 110 }}
        ListEmptyComponent={<EmptyState title="Nothing here" hint="No entries match this month or filter." />}
        renderSectionHeader={({ section }) => (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.lg, marginBottom: 4 }}>
            <Text style={{ color: c.textMuted, fontSize: font.sm, fontWeight: '700' }}>{friendlyDate(section.date)}</Text>
            <Text style={{ color: c.textMuted, fontSize: font.sm }}>{formatMoney(section.net, currency)}</Text>
          </View>
        )}
        renderItem={({ item, index, section }) => (
          <Card style={{
            paddingVertical: 0, borderRadius: 0,
            borderTopLeftRadius: index === 0 ? 16 : 0, borderTopRightRadius: index === 0 ? 16 : 0,
            borderBottomLeftRadius: index === section.data.length - 1 ? 16 : 0, borderBottomRightRadius: index === section.data.length - 1 ? 16 : 0,
            borderTopWidth: index ? 1 : 0, borderTopColor: c.border,
          }}>
            <TxRow item={item} onPress={() => navigation.navigate('AddTransaction', { id: item.local_id })} />
          </Card>
        )}
      />
      <FAB onPress={() => navigation.navigate('AddTransaction')} />
    </Screen>
  );
}
