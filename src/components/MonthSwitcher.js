import React, { useState } from 'react';
import { View, Text, Pressable, Modal, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { font, radius } from '../theme/tokens';
import { monthLabel, shiftMonth, monthKey, parseDate, toDateStr, friendlyDate } from '../utils/format';

export default function MonthSwitcher({ month, onChange, showCalendar = true, date = null, onDateChange = null }) {
  const { c } = useTheme();
  const [showPicker, setShowPicker] = useState(false);
  const isCurrent = month === monthKey(new Date());
  const Btn = ({ name, onPress, disabled }) => (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={8} style={{
      width: 36, height: 36, borderRadius: radius.md, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
      alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.4 : 1,
    }}>
      <Ionicons name={name} size={18} color={c.text} />
    </Pressable>
  );
  const pickMonth = (event, selectedDate) => {
    if (Platform.OS === 'android') setShowPicker(false);
    if (event.type === 'dismissed' || !selectedDate) return;
    if (onDateChange) {
      onDateChange(toDateStr(selectedDate));
      onChange(monthKey(selectedDate));
    } else {
      onChange(monthKey(selectedDate));
    }
  };

  const picker = (
    <DateTimePicker
      value={date ? parseDate(date) : new Date()}
      mode="date"
      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
      maximumDate={new Date()}
      onChange={pickMonth}
      style={Platform.OS === 'ios' ? { width: '100%' } : undefined}
    />
  );

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 12 }}>
        <Btn name="chevron-back" onPress={() => { if (onDateChange) onDateChange(null); onChange(shiftMonth(month, -1)); }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36 }}>
          <Pressable onPress={() => showCalendar && setShowPicker(true)} hitSlop={showCalendar ? 8 : 0}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 36 }}>
            {showCalendar ? <Ionicons name="calendar-outline" size={18} color={c.primary} /> : null}
            <Text style={{ color: c.text, fontSize: font.lg, fontWeight: '700' }}>{date ? friendlyDate(date) : monthLabel(month)}</Text>
          </Pressable>
          {date && onDateChange ? (
            <Pressable onPress={() => onDateChange(null)} hitSlop={8}
              accessibilityRole="button" accessibilityLabel="Reset date filter"
              style={{ height: 30, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: c.primarySoft }}>
              <Text style={{ color: c.primary, fontSize: font.xs, fontWeight: '700' }}>Reset</Text>
            </Pressable>
          ) : null}
        </View>
        <Btn name="chevron-forward" onPress={() => { if (onDateChange) onDateChange(null); onChange(shiftMonth(month, 1)); }} disabled={isCurrent} />
      </View>

      {Platform.OS === 'android' && showPicker ? picker : null}
      {Platform.OS === 'ios' ? (
        <Modal visible={showPicker} transparent animationType="slide" onRequestClose={() => setShowPicker(false)}>
          <Pressable style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' }}
            onPress={() => setShowPicker(false)}>
            <Pressable onPress={() => {}} style={{ backgroundColor: c.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingTop: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 }}>
                {date && onDateChange ? (
                  <Pressable onPress={() => { onDateChange(null); setShowPicker(false); }} hitSlop={8}>
                    <Text style={{ color: c.expense, fontSize: font.md, fontWeight: '700' }}>All month</Text>
                  </Pressable>
                ) : <View />}
                <Pressable onPress={() => setShowPicker(false)} hitSlop={8}>
                  <Text style={{ color: c.primary, fontSize: font.md, fontWeight: '700' }}>Done</Text>
                </Pressable>
              </View>
              {picker}
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  );
}
