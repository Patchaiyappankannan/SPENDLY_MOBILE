import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Screen, Title, Card, Segmented, Muted, SectionHeader, IconBadge, ProgressBar, EmptyState } from '../components/ui';
import MonthSwitcher from '../components/MonthSwitcher';
import { useTheme } from '../theme/ThemeContext';
import { useSync } from '../context/SyncContext';
import { font, spacing } from '../theme/tokens';
import { catMeta } from '../constants/categories';
import { formatMoney, friendlyDate, monthKey, monthShort } from '../utils/format';
import { categoryTotals, dailyTotals, monthlyTotals } from '../repositories/txRepo';

export default function StatsScreen() {
  const { c, currency } = useTheme();
  const { version } = useSync();
  const [month, setMonth] = useState(monthKey(new Date()));
  const [type, setType] = useState('expense');
  const [cats, setCats] = useState([]);
  const [daily, setDaily] = useState([]);
  const [trend, setTrend] = useState([]);

  const load = useCallback(async () => {
    setCats(await categoryTotals(month, type));
    setDaily(await dailyTotals(month, type));
    setTrend(await monthlyTotals(month, 6));
  }, [month, type]);
  useFocusEffect(useCallback(() => { load(); }, [load, version]));

  const total = cats.reduce((s, r) => s + r.total, 0);
  const max = Math.max(1, ...trend.flatMap((t) => [t.income, t.expense]));
  const H = 110;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}>
        <Title>Insights</Title>
        <MonthSwitcher month={month} onChange={setMonth} />
        <Segmented value={type} onChange={setType} options={[{ key: 'expense', label: 'Expenses' }, { key: 'income', label: 'Income' }]} />

        <SectionHeader title={type === 'expense' ? 'Where your money went' : 'Monthly income'} />
        <Card>
          {type === 'income' ? (
            <View style={{ marginBottom: cats.length ? spacing.sm : 0 }}>
              <Text style={{ color: c.text, fontSize: font.xl, fontWeight: '800' }}>{formatMoney(total, currency)}</Text>
              <Muted>{cats.reduce((s, r) => s + r.n, 0)} income entries this month</Muted>
            </View>
          ) : null}
          {cats.length ? (
            <>
              {type === 'expense' ? (
                <>
                  <Text style={{ color: c.text, fontSize: font.xl, fontWeight: '800' }}>{formatMoney(total, currency)}</Text>
                  <Muted style={{ marginBottom: 8 }}>{cats.reduce((s, r) => s + r.n, 0)} entries</Muted>
                </>
              ) : null}
              {cats.map((r) => {
                const m = catMeta(type, r.category);
                const pct = total ? (r.total / total) * 100 : 0;
                return (
                  <View key={r.category} style={{ marginTop: 14 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <IconBadge name={m.icon} color={m.color} size={34} />
                      <Text style={{ flex: 1, color: c.text, fontSize: font.md, fontWeight: '600' }}>{r.category}</Text>
                      <Text style={{ color: c.text, fontSize: font.md, fontWeight: '700' }}>{formatMoney(r.total, currency)}</Text>
                      <Text style={{ color: c.textMuted, fontSize: font.sm, width: 40, textAlign: 'right' }}>{pct.toFixed(0)}%</Text>
                    </View>
                    <ProgressBar pct={pct} color={m.color} height={6} />
                  </View>
                );
              })}
            </>
          ) : type === 'income' ? (
            <Muted>No income entries this month.</Muted>
          ) : <EmptyState icon="pie-chart-outline" title="No data for this month" hint="Add entries and they will appear here." />}
        </Card>

        {type === 'income' ? (
          <>
            <SectionHeader title="Daily income" />
            <Card style={{ paddingVertical: 4 }}>
              {daily.length ? daily.map((day) => (
                <View key={day.date} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: c.text, fontSize: font.md, fontWeight: '600' }}>{friendlyDate(day.date)}</Text>
                    <Muted>{day.n} {day.n === 1 ? 'entry' : 'entries'}</Muted>
                  </View>
                  <Text style={{ color: c.income, fontSize: font.md, fontWeight: '700' }}>{formatMoney(day.total, currency)}</Text>
                </View>
              )) : <EmptyState icon="calendar-outline" title="No income for this month" hint="Income entries will appear here by date." />}
            </Card>
          </>
        ) : null}

        <SectionHeader title="Last 6 months" />
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: H + 24 }}>
            {trend.map((t) => (
              <View key={t.month} style={{ alignItems: 'center', flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: H, gap: 4 }}>
                  <View style={{ width: 12, height: Math.max(3, (t.income / max) * H), backgroundColor: c.income, borderRadius: 4 }} />
                  <View style={{ width: 12, height: Math.max(3, (t.expense / max) * H), backgroundColor: c.expense, borderRadius: 4 }} />
                </View>
                <Text style={{ color: t.month === month ? c.text : c.textMuted, fontSize: font.xs, fontWeight: t.month === month ? '700' : '400', marginTop: 6 }}>
                  {monthShort(t.month)}
                </Text>
              </View>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 16, marginTop: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: c.income }} /><Muted>Income</Muted>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: c.expense }} /><Muted>Expenses</Muted>
            </View>
          </View>
        </Card>
      </ScrollView>
    </Screen>
  );
}
