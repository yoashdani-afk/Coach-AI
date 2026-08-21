import { View, Text } from 'react-native';
import { Input } from '@/components/ui';
import {
  calculateAge,
  isAgeInValidBand,
  isValidIsoDateString,
  MAX_PLAYER_AGE,
  MIN_PLAYER_AGE,
} from '@/lib/profileUtils';

export interface DateOfBirthParts {
  day: string;
  month: string;
  year: string;
}

export function datePartsFromIso(iso: string): DateOfBirthParts {
  if (!isValidIsoDateString(iso)) {
    return { day: '', month: '', year: '' };
  }
  const [year, month, day] = iso.split('-');
  return { day, month, year };
}

export function isoFromDateParts(parts: DateOfBirthParts): string {
  const { day, month, year } = parts;
  if (day.length !== 2 || month.length !== 2 || year.length !== 4) return '';
  return `${year}-${month}-${day}`;
}

function dobError(iso: string): string | undefined {
  if (!iso) return undefined;
  if (!isValidIsoDateString(iso)) return 'Enter a valid date (DD / MM / YYYY)';
  if (!isAgeInValidBand(iso)) {
    const age = calculateAge(iso);
    if (!Number.isFinite(age)) return 'Enter a valid date';
    return `Age must be between ${MIN_PLAYER_AGE} and ${MAX_PLAYER_AGE} (currently ${age})`;
  }
  return undefined;
}

interface DateOfBirthInputProps {
  value: DateOfBirthParts;
  onChange: (parts: DateOfBirthParts) => void;
}

export function DateOfBirthInput({ value, onChange }: DateOfBirthInputProps) {
  const iso = isoFromDateParts(value);
  const error = dobError(iso);
  const age = iso && isValidIsoDateString(iso) ? calculateAge(iso) : null;

  const update = (field: keyof DateOfBirthParts, raw: string, maxLen: number) => {
    const digits = raw.replace(/[^0-9]/g, '').slice(0, maxLen);
    onChange({ ...value, [field]: digits });
  };

  return (
    <View className="gap-1.5">
      <Text className="text-text-secondary text-sm font-medium">Date of birth *</Text>
      <View className="flex-row gap-3">
        <View className="flex-1">
          <Input
            label="Day"
            placeholder="DD"
            value={value.day}
            onChangeText={(day) => update('day', day, 2)}
            keyboardType="number-pad"
            maxLength={2}
          />
        </View>
        <View className="flex-1">
          <Input
            label="Month"
            placeholder="MM"
            value={value.month}
            onChangeText={(month) => update('month', month, 2)}
            keyboardType="number-pad"
            maxLength={2}
          />
        </View>
        <View className="flex-[1.4]">
          <Input
            label="Year"
            placeholder="YYYY"
            value={value.year}
            onChangeText={(year) => update('year', year, 4)}
            keyboardType="number-pad"
            maxLength={4}
          />
        </View>
      </View>
      {error ? <Text className="text-danger text-xs">{error}</Text> : null}
      {age != null && !error ? (
        <Text className="text-text-muted text-xs">Age: {age}</Text>
      ) : null}
    </View>
  );
}

export function isDateOfBirthValid(parts: DateOfBirthParts): boolean {
  const iso = isoFromDateParts(parts);
  return iso.length > 0 && isValidIsoDateString(iso) && isAgeInValidBand(iso);
}
