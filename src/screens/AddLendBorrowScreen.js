import React, { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Contacts from 'expo-contacts';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Chip, Input, Muted, Screen } from '../components/ui';
import { useTheme } from '../theme/ThemeContext';
import { useSync } from '../context/SyncContext';
import { font, spacing } from '../theme/tokens';
import { friendlyDate, toDateStr } from '../utils/format';
import { createEntry, createSplitBill, getPerson, listPeople, listPersonEntries, savePerson } from '../repositories/lendBorrowRepo';

const ENTRY_TYPES = [
  { key: 'lent', label: 'I lent' }, { key: 'borrowed', label: 'I borrowed' },
  { key: 'settle_received', label: 'Received' }, { key: 'settle_paid', label: 'Paid back' },
];
const cents = (value) => Math.round(Number(value || 0) * 100);

export default function AddLendBorrowScreen({ navigation, route }) {
  const { c } = useTheme();
  const { changed } = useSync();
  const mode = route.params?.mode || 'entry';
  const editId = route.params?.id;
  const initialType = route.params?.type || 'lent';
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [personNotes, setPersonNotes] = useState('');
  const [people, setPeople] = useState([]);
  const [selectedPerson, setSelectedPerson] = useState(route.params?.personId || '');
  const [selectedPeople, setSelectedPeople] = useState([]);
  const [type, setType] = useState(initialType);
  const [parentEntryId, setParentEntryId] = useState(route.params?.parentEntryId || '');
  const [openEntries, setOpenEntries] = useState([]);
  const [amount, setAmount] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [myShare, setMyShare] = useState('');
  const [customShares, setCustomShares] = useState({});
  const [equalSplit, setEqualSplit] = useState(true);
  const [date, setDate] = useState(toDateStr(new Date()));
  const [dueDate, setDueDate] = useState('');
  const [accountId, setAccountId] = useState('');
  const [note, setNote] = useState('');
  const [proofImage, setProofImage] = useState('');
  const [picker, setPicker] = useState('');
  const [deviceContacts, setDeviceContacts] = useState([]);
  const [contactSearch, setContactSearch] = useState('');
  const [error, setError] = useState('');

  useFocusEffect(useCallback(() => { listPeople().then(setPeople); }, []));

  useEffect(() => {
    if (mode === 'person' && editId) getPerson(editId).then((person) => {
      if (person) { setName(person.name); setPhone(person.phone || ''); setPersonNotes(person.notes || ''); }
    });
    if (route.params?.personId && mode === 'entry') listPersonEntries(route.params.personId).then((entries) => {
      setOpenEntries(entries.filter((entry) => ['lent', 'borrowed'].includes(entry.type) && entry.status !== 'settled' && entry.type === (initialType === 'settle_received' ? 'lent' : 'borrowed')));
    });
  }, [editId, initialType, mode, route.params?.personId]);

  useEffect(() => {
    if (!selectedPerson || mode !== 'entry' || !type.startsWith('settle')) { setOpenEntries([]); setParentEntryId(''); return; }
    const rootType = type === 'settle_received' ? 'lent' : 'borrowed';
    listPersonEntries(selectedPerson).then((entries) => setOpenEntries(entries.filter((entry) => ['lent', 'borrowed'].includes(entry.type) && entry.type === rootType && entry.status !== 'settled')));
  }, [selectedPerson, type, mode]);

  const totalCents = cents(totalAmount);
  const baseShareCents = selectedPeople.length && totalCents > 0 ? Math.floor(totalCents / (selectedPeople.length + 1)) : 0;
  const splitPreview = equalSplit && selectedPeople.length && totalCents > 0
    ? { mine: (baseShareCents + totalCents % (selectedPeople.length + 1)) / 100, each: baseShareCents / 100 }
    : null;

  const chooseContacts = async () => {
    const permission = await Contacts.requestPermissionsAsync();
    if (!permission.granted) return Alert.alert('Contacts permission needed', 'Allow contacts access to pick a person from your device.');
    const fields = [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers];
    const pageSize = 100;
    const contacts = [];
    let pageOffset = 0;
    let hasNextPage = true;
    while (hasNextPage) {
      const result = await Contacts.getContactsAsync({ fields, pageSize, pageOffset });
      contacts.push(...result.data);
      pageOffset += result.data.length;
      hasNextPage = result.hasNextPage && result.data.length > 0;
    }
    setDeviceContacts(contacts.filter((contact) => contact.name));
  };

  const chooseProof = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert('Photo permission needed', 'Allow access to attach proof.');
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.65 });
    if (!result.canceled) setProofImage(result.assets[0].uri);
  };

  const save = async () => {
    setError('');
    try {
      if (mode === 'person') {
        if (!name.trim()) return setError('Enter a person name');
        await savePerson({ name, phone, notes: personNotes }, editId);
      } else if (mode === 'split') {
        if (!selectedPeople.length) return setError('Choose at least one person');
        let own = Number(myShare);
        let participants = selectedPeople.map((id) => ({ personId: id, amount: Number(customShares[id]) || 0 }));
        if (equalSplit && splitPreview) { own = splitPreview.mine; participants = selectedPeople.map((personId) => ({ personId, amount: splitPreview.each })); }
        if (!Number.isFinite(own) || own < 0) return setError('Enter your share');
        await createSplitBill({ totalAmount, myShare: own, people: participants, date, accountId, note });
      } else {
        if (!selectedPerson) return setError('Choose a person');
        if (!Number(amount) || Number(amount) <= 0) return setError('Enter an amount greater than zero');
        if (type.startsWith('settle') && !parentEntryId) return setError('Choose the entry being settled');
        await createEntry({ personId: selectedPerson, type, amount, date, dueDate: ['lent', 'borrowed'].includes(type) ? dueDate : null,
          accountId, parentEntryId: type.startsWith('settle') ? parentEntryId : null, note, proofImage });
      }
      changed();
      navigation.goBack();
    } catch (e) { setError(e.message || 'Could not save this entry'); }
  };

  const title = mode === 'person' ? (editId ? 'Edit person' : 'Add person') : mode === 'split' ? 'Split a bill' : 'Add money entry';
  const dateValue = new Date(`${(picker === 'due' ? dueDate : date) || date}T12:00:00`);
  const contactQuery = contactSearch.trim().toLowerCase();
  const filteredContacts = deviceContacts.filter((contact) => {
    const name = (contact.name || '').toLowerCase();
    const phone = (contact.phoneNumbers || []).map((item) => item.number || '').join(' ').toLowerCase();
    return `${name} ${phone}`.includes(contactQuery);
  });

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, paddingBottom: 0 }}>
          <Text style={{ color: c.text, fontSize: font.xl, fontWeight: '700' }}>{title}</Text>
          <Pressable onPress={() => navigation.goBack()} hitSlop={10}><Ionicons name="close" size={24} color={c.text} /></Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: spacing.lg }} keyboardShouldPersistTaps="handled">
          {mode === 'person' ? <>
            <Input label="Name" value={name} onChangeText={setName} placeholder="Person name" maxLength={100} />
            <Input label="Phone" value={phone} onChangeText={setPhone} placeholder="Optional phone number" keyboardType="phone-pad" maxLength={30} />
            <Input label="Notes" value={personNotes} onChangeText={setPersonNotes} placeholder="Optional" maxLength={300} />
            {!editId ? <Button title="Pick from device contacts" icon="people-outline" variant="secondary" onPress={chooseContacts} style={{ marginBottom: spacing.md }} /> : null}
            {deviceContacts.length ? <Card style={{ maxHeight: 280, padding: spacing.sm, marginBottom: spacing.md }}>
              <Input icon="search-outline" value={contactSearch} onChangeText={setContactSearch} placeholder="Search name or phone" containerStyle={{ marginBottom: spacing.sm }} />
              <ScrollView nestedScrollEnabled>{filteredContacts.length ? filteredContacts.map((contact) => <Pressable key={contact.id} onPress={() => { setName(contact.name); setPhone(contact.phoneNumbers?.[0]?.number || ''); setDeviceContacts([]); setContactSearch(''); }} style={{ padding: 10, borderBottomWidth: 1, borderBottomColor: c.border }}>
                <Text style={{ color: c.text, fontWeight: '600' }}>{contact.name}</Text><Muted>{contact.phoneNumbers?.[0]?.number || 'No phone number'}</Muted>
              </Pressable>) : <Muted style={{ padding: 10 }}>No contacts match your search.</Muted>}</ScrollView>
            </Card> : null}
          </> : mode === 'split' ? <>
            <Input label="Bill total" value={totalAmount} onChangeText={(v) => setTotalAmount(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder="0.00" />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
              <View style={{ flex: 1 }}><Text style={{ color: c.text, fontWeight: '600' }}>Equal split including you</Text><Muted>Remaining shares become amounts owed to you</Muted></View>
              <Switch value={equalSplit} onValueChange={setEqualSplit} trackColor={{ true: c.primary }} />
            </View>
            {!equalSplit ? <Input label="My share" value={myShare} onChangeText={(v) => setMyShare(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder="0.00" /> : splitPreview ? <Muted style={{ marginBottom: spacing.md }}>Your share: {splitPreview.mine.toFixed(2)} · Each selected person: {splitPreview.each.toFixed(2)}</Muted> : null}
            <Muted style={{ fontWeight: '600', marginBottom: 8 }}>People in the split</Muted>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md }}>{people.map((person) => <Chip key={person.id} label={person.name} active={selectedPeople.includes(person.id)} onPress={() => setSelectedPeople((list) => list.includes(person.id) ? list.filter((id) => id !== person.id) : [...list, person.id])} />)}</View>
            {!equalSplit ? selectedPeople.map((personId) => <Input key={personId} label={`${people.find((person) => person.id === personId)?.name || 'Person'} share`} value={customShares[personId] || ''} onChangeText={(v) => setCustomShares((current) => ({ ...current, [personId]: v.replace(/[^0-9.]/g, '') }))} keyboardType="decimal-pad" placeholder="0.00" />) : null}
            <Button title={friendlyDate(date)} icon="calendar-outline" variant="secondary" onPress={() => setPicker('date')} style={{ marginBottom: spacing.md }} />
            <Input label="Account / payment mode" value={accountId} onChangeText={setAccountId} placeholder="Cash, bank, UPI" />
            <Input label="Note" value={note} onChangeText={setNote} placeholder="Optional" />
          </> : <>
            <Muted style={{ fontWeight: '600', marginBottom: 8 }}>Person</Muted>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md }}>{people.map((person) => <Chip key={person.id} label={person.name} active={selectedPerson === person.id} onPress={() => setSelectedPerson(person.id)} />)}</View>
            {!people.length ? <Button title="Add a person first" icon="person-add-outline" variant="secondary" onPress={() => navigation.navigate('AddLendBorrow', { mode: 'person' })} style={{ marginBottom: spacing.md }} /> : null}
            <Muted style={{ fontWeight: '600', marginBottom: 8 }}>Entry type</Muted>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md }}>{ENTRY_TYPES.map((item) => <Chip key={item.key} label={item.label} active={type === item.key} onPress={() => setType(item.key)} />)}</View>
            {type.startsWith('settle') ? <>
              <Muted style={{ fontWeight: '600', marginBottom: 8 }}>Settle which entry?</Muted>
              {openEntries.map((entry) => <Chip key={entry.id} label={`${entry.type} · ${Number(entry.remaining_amount).toFixed(2)} left · ${friendlyDate(entry.date)}`} active={parentEntryId === entry.id} onPress={() => setParentEntryId(entry.id)} />)}
              {!openEntries.length ? <Muted style={{ marginBottom: spacing.md }}>No open entries of this type for this person.</Muted> : null}
            </> : null}
            <Input label="Amount" value={amount} onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder="0.00" />
            <Muted style={{ fontWeight: '600', marginBottom: 8 }}>Entry date</Muted>
            <Button title={friendlyDate(date)} icon="calendar-outline" variant="secondary" onPress={() => setPicker('date')} style={{ marginBottom: spacing.md }} />
            {['lent', 'borrowed'].includes(type) ? <><Muted style={{ fontWeight: '600', marginBottom: 8 }}>Due date (optional)</Muted><Button title={dueDate ? friendlyDate(dueDate) : 'No due date'} icon="calendar-outline" variant="secondary" onPress={() => setPicker('due')} style={{ marginBottom: spacing.md }} /></> : null}
            <Input label="Account / payment mode" value={accountId} onChangeText={setAccountId} placeholder="Cash, bank, UPI" />
            <Input label="Note" value={note} onChangeText={setNote} placeholder="Optional" maxLength={300} />
            <Button title={proofImage ? 'Change proof photo' : 'Attach proof photo'} icon="image-outline" variant="secondary" onPress={chooseProof} style={{ marginBottom: spacing.md }} />
            {proofImage ? <Image source={{ uri: proofImage }} style={{ width: 110, height: 110, borderRadius: 8, marginBottom: spacing.md }} /> : null}
          </>}
          {error ? <Text style={{ color: c.expense, marginBottom: spacing.md }}>{error}</Text> : null}
          <Button title={mode === 'person' ? (editId ? 'Save person' : 'Add person') : mode === 'split' ? 'Save split' : 'Save entry'} onPress={save} />
        </ScrollView>
        {picker ? <DateTimePicker value={dateValue} mode="date" display="default" minimumDate={picker === 'due' ? new Date(`${date}T00:00:00`) : undefined} onChange={(event, chosen) => { const which = picker; setPicker(''); if (event.type !== 'dismissed' && chosen) { if (which === 'due') setDueDate(toDateStr(chosen)); else setDate(toDateStr(chosen)); } }} /> : null}
      </KeyboardAvoidingView>
    </Screen>
  );
}