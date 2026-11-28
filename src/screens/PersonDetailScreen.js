import React, { useCallback, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Button, Card, Muted, Screen, Title } from '../components/ui';
import { useTheme } from '../theme/ThemeContext';
import { useSync } from '../context/SyncContext';
import { font, spacing } from '../theme/tokens';
import { formatMoney, friendlyDate } from '../utils/format';
import { deletePerson, getPerson, listPersonEntries } from '../repositories/lendBorrowRepo';

const labels = { lent: 'You lent', borrowed: 'You borrowed', settle_received: 'Settlement received', settle_paid: 'Settlement paid' };
const htmlEscape = (value) => String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

export default function PersonDetailScreen({ navigation, route }) {
  const { c, currency } = useTheme();
  const { version, changed } = useSync();
  const [person, setPerson] = useState(null);
  const [entries, setEntries] = useState([]);
  const load = useCallback(async () => { setPerson(await getPerson(route.params.id)); setEntries(await listPersonEntries(route.params.id)); }, [route.params.id]);
  useFocusEffect(useCallback(() => { load(); }, [load, version]));
  if (!person) return <Screen />;
  const openEntries = entries.filter((entry) => ['lent', 'borrowed'].includes(entry.type) && entry.status !== 'settled');
  const addEntry = (type, parentEntryId) => navigation.navigate('AddLendBorrow', { mode: 'entry', personId: person.id, type, parentEntryId });
  const removePerson = () => Alert.alert('Delete person?', 'A person with an unsettled balance cannot be deleted.', [
    { text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => {
      const deleted = await deletePerson(person.id);
      if (!deleted) return Alert.alert('Balance still open', 'Settle all lending and borrowing entries before deleting this person.');
      changed();
      navigation.goBack();
    } },
  ]);

  const shareReminder = async () => {
    const outstanding = Math.abs(person.net_balance);
    if (!outstanding) return Alert.alert('Nothing pending', 'This balance is settled.');
    const direction = person.net_balance > 0 ? 'Please return' : 'I will repay';
    const text = `${direction} ${formatMoney(outstanding, currency)}${person.name ? `, ${person.name}` : ''}${openEntries[0]?.due_date ? ` by ${friendlyDate(openEntries[0].due_date)}` : ''}.`;
    if (person.phone) {
      try { await Linking.openURL(`whatsapp://send?phone=${encodeURIComponent(person.phone)}&text=${encodeURIComponent(text)}`); return; } catch {}
    }
    await Share.share({ message: text });
  };

  const exportPdf = async () => {
    const htmlRows = entries.map((entry) => `<tr><td>${friendlyDate(entry.date)}</td><td>${htmlEscape(labels[entry.type] || entry.type)}</td><td>${formatMoney(entry.amount, currency)}</td><td>${htmlEscape(entry.status)}</td><td>${htmlEscape(entry.note)}</td></tr>`).join('');
    const html = `<html><body style="font-family:Arial;padding:28px;color:#182522"><h1>${htmlEscape(person.name)} statement</h1><p>Net balance: ${formatMoney(Math.abs(person.net_balance), currency)} ${person.net_balance > 0 ? 'to receive' : person.net_balance < 0 ? 'to pay' : 'settled'}</p><table style="width:100%;border-collapse:collapse" border="1" cellpadding="8"><thead><tr><th>Date</th><th>Entry</th><th>Amount</th><th>Status</th><th>Note</th></tr></thead><tbody>${htmlRows}</tbody></table></body></html>`;
    const file = await Print.printToFileAsync({ html });
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', dialogTitle: `${person.name} statement` });
    else Alert.alert('PDF ready', file.uri);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View><Title>{person.name}</Title><Muted>{person.phone || 'No phone number'}</Muted></View>
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <Pressable onPress={() => navigation.navigate('AddLendBorrow', { mode: 'person', id: person.id })} hitSlop={10} accessibilityLabel="Edit person"><Ionicons name="create-outline" size={22} color={c.primary} /></Pressable>
            <Pressable onPress={removePerson} hitSlop={10} accessibilityLabel="Delete person"><Ionicons name="trash-outline" size={22} color={c.expense} /></Pressable>
          </View>
        </View>
        <Card style={{ marginTop: spacing.md }}>
          <Muted>{person.net_balance > 0 ? 'You will get' : person.net_balance < 0 ? 'You need to pay' : 'Settled'}</Muted>
          <Text style={{ color: person.net_balance > 0 ? c.income : person.net_balance < 0 ? c.expense : c.text, fontSize: font.xxl, fontWeight: '800', marginTop: 4 }}>{formatMoney(Math.abs(person.net_balance), currency)}</Text>
        </Card>
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
          <Button title="Lend" icon="arrow-up-circle-outline" onPress={() => addEntry('lent')} style={{ flex: 1 }} />
          <Button title="Borrow" icon="arrow-down-circle-outline" variant="secondary" onPress={() => addEntry('borrowed')} style={{ flex: 1 }} />
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
          <Button title="Share reminder" icon="chatbubble-ellipses-outline" variant="secondary" onPress={shareReminder} style={{ flex: 1 }} />
          <Button title="Export PDF" icon="document-text-outline" variant="secondary" onPress={exportPdf} style={{ flex: 1 }} />
        </View>
        <Text style={{ color: c.text, fontSize: font.lg, fontWeight: '700', marginTop: spacing.xl, marginBottom: spacing.sm }}>Open entries</Text>
        {openEntries.map((entry) => <Card key={entry.id} style={{ marginBottom: spacing.sm, padding: spacing.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: c.text, fontWeight: '700' }}>{labels[entry.type]} · {formatMoney(entry.remaining_amount, currency)} left</Text><Muted>{entry.status.replace('_', ' ')}</Muted></View>
          <Muted style={{ marginTop: 4 }}>{friendlyDate(entry.date)}{entry.due_date ? ` · Due ${friendlyDate(entry.due_date)}` : ''}</Muted>
          {entry.note ? <Muted style={{ marginTop: 3 }}>{entry.note}</Muted> : null}
          <Button title={entry.type === 'lent' ? 'Record settlement received' : 'Record settlement paid'} icon="checkmark-circle-outline" variant="secondary" onPress={() => addEntry(entry.type === 'lent' ? 'settle_received' : 'settle_paid', entry.id)} style={{ marginTop: spacing.sm }} />
        </Card>)}
        <Text style={{ color: c.text, fontSize: font.lg, fontWeight: '700', marginTop: spacing.lg, marginBottom: spacing.sm }}>History</Text>
        <Card style={{ paddingVertical: 4 }}>
          {entries.length ? entries.map((entry, index) => <View key={entry.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderTopWidth: index ? 1 : 0, borderTopColor: c.border }}>
            <Ionicons name={entry.type.startsWith('settle') ? 'checkmark-circle' : 'swap-horizontal'} size={20} color={entry.type.startsWith('settle') ? c.income : c.primary} />
            <View style={{ flex: 1, marginLeft: 9 }}><Text style={{ color: c.text, fontWeight: '600' }}>{labels[entry.type]}</Text><Muted>{friendlyDate(entry.date)}{entry.note ? ` · ${entry.note}` : ''}</Muted></View>
            <Text style={{ color: c.text, fontWeight: '700' }}>{formatMoney(entry.amount, currency)}</Text>
          </View>) : <Muted style={{ paddingVertical: 14 }}>No entries yet.</Muted>}
        </Card>
      </ScrollView>
    </Screen>
  );
}