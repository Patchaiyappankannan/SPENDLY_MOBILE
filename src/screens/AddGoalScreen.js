import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { Button, Chip, Input, Muted, Screen } from '../components/ui';
import { useTheme } from '../theme/ThemeContext';
import { useSync } from '../context/SyncContext';
import { font, spacing } from '../theme/tokens';
import { friendlyDate, toDateStr } from '../utils/format';
import { addGoalContribution, getGoal, saveGoal } from '../repositories/savingsRepo';

const ICONS = ['flag', 'bicycle', 'airplane', 'shield-checkmark', 'phone-portrait', 'home', 'school', 'heart'];
const COLORS = ['#2F7A68', '#3478A8', '#D18A2E', '#B45161', '#7659A6', '#47865A'];

export default function AddGoalScreen({ navigation, route }) {
  const { c, currency } = useTheme();
  const { changed } = useSync();
  const id = route.params?.id;
  const goalId = route.params?.goalId;
  const mode = route.params?.mode;
  const contributionMode = !!goalId && (mode === 'add' || mode === 'withdraw');
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [startingAmount, setStartingAmount] = useState('');
  const [amount, setAmount] = useState('');
  const [contributionDate, setContributionDate] = useState(toDateStr(new Date()));
  const [accountId, setAccountId] = useState('');
  const [notes, setNotes] = useState('');
  const [icon, setIcon] = useState('flag');
  const [color, setColor] = useState(COLORS[0]);
  const [status, setStatus] = useState('active');
  const [remindMonthly, setRemindMonthly] = useState(false);
  const [datePicker, setDatePicker] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (contributionMode) getGoal(goalId).then((goal) => { if (goal) setName(goal.name); });
    else if (id) getGoal(id).then((goal) => {
      if (!goal) return;
      setName(goal.name); setTargetAmount(String(goal.target_amount)); setTargetDate(goal.target_date || '');
      setNotes(goal.notes || ''); setIcon(goal.icon || 'flag'); setColor(goal.color || COLORS[0]); setRemindMonthly(!!goal.remind_monthly);
      setStatus(goal.status || 'active');
    });
  }, [id, goalId, contributionMode]);

  const save = async () => {
    setError('');
    try {
      if (contributionMode) {
        if (!Number(amount) || Number(amount) <= 0) return setError('Enter an amount greater than zero');
        await addGoalContribution(goalId, { amount, type: mode, accountId, date: contributionDate, note: notes });
      } else {
        if (!name.trim()) return setError('Enter a goal name');
        if (!Number(targetAmount) || Number(targetAmount) <= 0) return setError('Enter a target greater than zero');
        await saveGoal({ name, targetAmount, targetDate, startingAmount: id ? 0 : startingAmount, accountId, notes, icon, color, remindMonthly, status }, id);
      }
      changed();
      navigation.goBack();
    } catch (e) { setError(e.message || 'Could not save this goal'); }
  };

  const title = contributionMode ? (mode === 'add' ? 'Contribute to goal' : 'Withdraw from goal') : (id ? 'Edit goal' : 'New savings goal');
  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, paddingBottom: 0 }}>
          <Text style={{ color: c.text, fontSize: font.xl, fontWeight: '700' }}>{title}</Text>
          <Pressable onPress={() => navigation.goBack()} hitSlop={10}><Ionicons name="close" size={24} color={c.text} /></Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: spacing.lg }} keyboardShouldPersistTaps="handled">
          {contributionMode ? <>
            <Muted style={{ marginBottom: spacing.md }}>{name}</Muted>
            <Input label={`Amount (${currency})`} value={amount} onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder="0.00" />
            <Button title={friendlyDate(contributionDate)} icon="calendar-outline" variant="secondary" onPress={() => setDatePicker(true)} style={{ marginBottom: spacing.md }} />
            <Input label="Account / payment mode" value={accountId} onChangeText={setAccountId} placeholder="Cash, bank, UPI" />
            <Input label="Note" value={notes} onChangeText={setNotes} placeholder="Optional" maxLength={300} />
          </> : <>
            <Input label="Goal name" value={name} onChangeText={setName} placeholder="Emergency fund, new bike" maxLength={80} />
            <Input label={`Target amount (${currency})`} value={targetAmount} onChangeText={(v) => setTargetAmount(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder="0.00" />
            {!id ? <Input label="Starting amount (optional)" value={startingAmount} onChangeText={(v) => setStartingAmount(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder="0.00" /> : null}
            <Muted style={{ fontWeight: '600', marginBottom: 8 }}>Target date</Muted>
            <Button title={targetDate ? friendlyDate(targetDate) : 'No target date'} icon="calendar-outline" variant="secondary" onPress={() => setDatePicker(true)} style={{ marginBottom: spacing.lg }} />
            <Muted style={{ fontWeight: '600', marginBottom: 8 }}>Icon</Muted>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.lg }}>
              {ICONS.map((value) => <Chip key={value} label="" icon={value} active={icon === value} onPress={() => setIcon(value)} />)}
            </View>
            <Muted style={{ fontWeight: '600', marginBottom: 8 }}>Color</Muted>
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: spacing.lg }}>
              {COLORS.map((value) => <Pressable key={value} onPress={() => setColor(value)} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: value, borderWidth: color === value ? 3 : 0, borderColor: c.text, alignItems: 'center', justifyContent: 'center' }}>{color === value ? <Ionicons name="checkmark" size={18} color="#fff" /> : null}</Pressable>)}
            </View>
            <Input label="Notes" value={notes} onChangeText={setNotes} placeholder="Optional details" maxLength={300} />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
              <View style={{ flex: 1, paddingRight: 12 }}><Text style={{ color: c.text, fontWeight: '600' }}>Monthly reminder</Text><Muted>Local notification, works offline</Muted></View>
              <Switch value={remindMonthly} onValueChange={setRemindMonthly} trackColor={{ true: c.primary }} />
            </View>
          </>}
          {error ? <Text style={{ color: c.expense, marginBottom: spacing.md }}>{error}</Text> : null}
          <Button title={contributionMode ? (mode === 'add' ? 'Add contribution' : 'Withdraw funds') : (id ? 'Save changes' : 'Create goal')} onPress={save} />
        </ScrollView>
        {datePicker ? <DateTimePicker value={new Date(`${(contributionMode ? contributionDate : targetDate) || toDateStr(new Date())}T12:00:00`)} mode="date" display="default" minimumDate={contributionMode ? undefined : new Date()} onChange={(event, date) => { setDatePicker(false); if (event.type !== 'dismissed' && date) { if (contributionMode) setContributionDate(toDateStr(date)); else setTargetDate(toDateStr(date)); } }} /> : null}
      </KeyboardAvoidingView>
    </Screen>
  );
}