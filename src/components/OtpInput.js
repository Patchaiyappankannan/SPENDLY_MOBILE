import React, { useRef } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { font, spacing } from '../theme/tokens';

export default function OtpInput({ value, onChange, length = 6, disabled = false }) {
  const { c } = useTheme();
  const inputRef = useRef(null);
  const digits = String(value || '').slice(0, length).split('');
  return (
    <Pressable onPress={() => inputRef.current?.focus()} accessibilityRole="button" accessibilityLabel="Enter six digit verification code">
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.sm }}>
        {Array.from({ length }, (_, index) => (
          <View key={index} style={{ width: 44, height: 54, borderWidth: 1, borderColor: c.border, borderRadius: 8, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: c.text, fontSize: font.xl, fontWeight: '700' }}>{digits[index] || ''}</Text>
          </View>
        ))}
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={(text) => onChange(text.replace(/\D/g, '').slice(0, length))}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          maxLength={length}
          editable={!disabled}
          accessibilityLabel="Verification code"
          style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
        />
      </View>
    </Pressable>
  );
}
