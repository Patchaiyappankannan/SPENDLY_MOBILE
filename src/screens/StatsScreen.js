import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
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
  const [date, setDate] = useState(null);
  const [type, setType] = useState('expense');
  const [cats, setCats] = useState([]);
  const [daily, setDaily] = useState([]);
  const [trend, setTrend] = useState([]);

  const load = useCallback(async () => {
    setCats(await categoryTotals(month, type, date));
    setDaily(await dailyTotals(month, type, date));
    setTrend(await monthlyTotals(month, 6));
  }, [month, type, date]);
  useFocusEffect(useCallback(() => { load(); }, [load, version]));

  const total = cats.reduce((s, r) => s + r.total, 0);

  const donutSize = 180;
  const radius = 68;
  const circumference = 2 * Math.PI * radius;
  let segmentOffset = 0;

  const waveWidth = 300;
  const waveHeight = 120;
  const wavePadding = 8;
  const maxWave = Math.max(1, ...trend.flatMap((item) => [item.income, item.expense]));
  const wavePoint = (value, index) => {
    const x = wavePadding + (index * (waveWidth - wavePadding * 2)) / Math.max(1, trend.length - 1);
    const y = waveHeight - wavePadding - (value / maxWave) * (waveHeight - wavePadding * 2);
    return [x, y];
  };
  const wavePath = (values) => {
    if (!values.length) return '';
    const points = values.map((value, index) => wavePoint(value, index));
    if (points.length === 1) return `M ${points[0][0]} ${points[0][1]}`;
    let path = `M ${points[0][0]} ${points[0][1]}`;
    for (let i = 1; i < points.length; i++) {
      const [x0, y0] = points[i - 1];
      const [x1, y1] = points[i];
      const middle = (x0 + x1) / 2;
      path += ` C ${middle} ${y0}, ${middle} ${y1}, ${x1} ${y1}`;
    }
    return path;
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}>
        <Title>Insights</Title>
        <MonthSwitcher month={month} onChange={setMonth} date={date} onDateChange={setDate} />
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
              <View style={{ alignItems: 'center', marginTop: spacing.sm, marginBottom: spacing.md }}>
                <View style={{ width: donutSize, height: donutSize, alignItems: 'center', justifyContent: 'center' }}>
                  <Svg width={donutSize} height={donutSize} viewBox={`0 0 ${donutSize} ${donutSize}`}>
                    <Circle cx={donutSize / 2} cy={donutSize / 2} r={radius} fill="none" stroke={c.surfaceAlt} strokeWidth="18" />
                    {cats.map((item) => {
                      const meta = catMeta(type, item.category);
                      const segment = total ? (item.total / total) * circumference : 0;
                      const offset = segmentOffset;
                      segmentOffset += segment;
                      return (
                        <Circle key={item.category} cx={donutSize / 2} cy={donutSize / 2} r={radius}
                          fill="none" stroke={meta.color} strokeWidth="18" strokeLinecap="round"
                          strokeDasharray={`${segment} ${circumference - segment}`} strokeDashoffset={-offset}
                          transform={`rotate(-90 ${donutSize / 2} ${donutSize / 2})`} />
                      );
                    })}
                  </Svg>
                  <View style={{ position: 'absolute', alignItems: 'center' }}>
                    <Text style={{ color: c.text, fontSize: font.xl, fontWeight: '800' }}>{formatMoney(total, currency)}</Text>
                    <Muted>{type === 'expense' ? 'Spent' : 'Income'}</Muted>
                  </View>
                </View>
              </View>
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
            <SectionHeader title="Income received by date" />
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
          <View style={{ height: waveHeight + 24, alignItems: 'center' }}>
            <Svg width={waveWidth} height={waveHeight} viewBox={`0 0 ${waveWidth} ${waveHeight}`}>
              {[0, 1, 2, 3].map((line) => {
                const y = wavePadding + (line * (waveHeight - wavePadding * 2)) / 3;
                return <Path key={line} d={`M ${wavePadding} ${y} H ${waveWidth - wavePadding}`} stroke={c.border} strokeWidth="1" />;
              })}
              <Path d={wavePath(trend.map((item) => item.income))} fill="none" stroke={c.income} strokeWidth="3" strokeLinecap="round" />
              <Path d={wavePath(trend.map((item) => item.expense))} fill="none" stroke={c.expense} strokeWidth="3" strokeLinecap="round" />
            </Svg>
            <View style={{ width: waveWidth, flexDirection: 'row', justifyContent: 'space-between' }}>
              {trend.map((item) => (
                <Text key={item.month} style={{ color: item.month === month ? c.text : c.textMuted, fontSize: font.xs, fontWeight: item.month === month ? '700' : '400' }}>
                  {monthShort(item.month)}
                </Text>
              ))}
            </View>
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
