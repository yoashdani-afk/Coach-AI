import { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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

type DobField = 'day' | 'month' | 'year';

type Option = { value: string; label: string };

const MONTH_OPTIONS: Option[] = [
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

function pad2(n: number | string): string {
  return String(n).padStart(2, '0');
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function yearOptions(asOf: Date = new Date()): Option[] {
  const maxYear = asOf.getFullYear() - MIN_PLAYER_AGE;
  const minYear = asOf.getFullYear() - MAX_PLAYER_AGE;
  const items: Option[] = [];
  for (let y = maxYear; y >= minYear; y -= 1) {
    items.push({ value: String(y), label: String(y) });
  }
  return items;
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
  if (!isValidIsoDateString(iso)) return 'Pick a valid date';
  if (!isAgeInValidBand(iso)) {
    const age = calculateAge(iso);
    if (!Number.isFinite(age)) return 'Pick a valid date';
    return `Age must be between ${MIN_PLAYER_AGE} and ${MAX_PLAYER_AGE} (currently ${age})`;
  }
  return undefined;
}

interface DateOfBirthInputProps {
  value: DateOfBirthParts;
  onChange: (parts: DateOfBirthParts) => void;
  hideLabel?: boolean;
}

function DropdownField({
  label,
  display,
  placeholder,
  open,
  onPress,
}: {
  label: string;
  display: string;
  placeholder: string;
  open: boolean;
  onPress: () => void;
}) {
  const filled = display.length > 0;
  return (
    <View className="gap-1.5">
      <Text className="text-text-secondary text-sm font-medium">{label}</Text>
      <Pressable
        onPress={onPress}
        className={`bg-surface-elevated border rounded-xl px-3 py-3.5 flex-row items-center active:opacity-80 ${
          open ? 'border-primary' : 'border-border'
        }`}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Text
          className={`flex-1 text-base mr-1 ${filled ? 'text-text-primary' : 'text-text-muted'}`}
          numberOfLines={1}
        >
          {filled ? display : placeholder}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color="#A0A0A8" />
      </Pressable>
    </View>
  );
}

export function DateOfBirthInput({ value, onChange, hideLabel = false }: DateOfBirthInputProps) {
  const [openField, setOpenField] = useState<DobField | null>(null);

  const years = useMemo(() => yearOptions(), []);

  const dayOptions = useMemo(() => {
    const y = Number(value.year) || new Date().getFullYear() - 16;
    const m = Number(value.month) || 1;
    const maxDay = daysInMonth(y, m);
    const items: Option[] = [];
    for (let d = 1; d <= maxDay; d += 1) {
      const padded = pad2(d);
      items.push({ value: padded, label: padded });
    }
    return items;
  }, [value.year, value.month]);

  const monthLabel = MONTH_OPTIONS.find((m) => m.value === value.month)?.label ?? '';

  const commit = (next: DateOfBirthParts) => {
    const y = Number(next.year);
    const m = Number(next.month);
    let d = Number(next.day);
    if (next.day && Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)) {
      const maxDay = daysInMonth(y, m);
      if (d > maxDay) d = maxDay;
      onChange({
        day: pad2(d),
        month: next.month ? pad2(m) : '',
        year: next.year,
      });
      return;
    }
    onChange({
      day: next.day ? pad2(next.day) : '',
      month: next.month ? pad2(next.month) : '',
      year: next.year,
    });
  };

  const toggleField = (field: DobField) => {
    setOpenField((current) => (current === field ? null : field));
  };

  const selectOption = (field: DobField, optionValue: string) => {
    commit({ ...value, [field]: optionValue });
    setOpenField(null);
  };

  const options =
    openField === 'day' ? dayOptions : openField === 'month' ? MONTH_OPTIONS : openField === 'year' ? years : [];

  const selectedValue =
    openField === 'day' ? value.day : openField === 'month' ? value.month : openField === 'year' ? value.year : '';

  const listTitle =
    openField === 'day' ? 'Select day' : openField === 'month' ? 'Select month' : openField === 'year' ? 'Select year' : '';

  const iso = isoFromDateParts(value);
  const error = dobError(iso);
  const age = iso && isValidIsoDateString(iso) ? calculateAge(iso) : null;

  return (
    <View className="gap-3">
      {!hideLabel ? (
        <Text className="text-text-secondary text-sm font-medium">Date of birth *</Text>
      ) : null}

      <View className="flex-row gap-3">
        <View className="flex-1">
          <DropdownField
            label="Day"
            display={value.day}
            placeholder="DD"
            open={openField === 'day'}
            onPress={() => toggleField('day')}
          />
        </View>
        <View className="flex-[1.35]">
          <DropdownField
            label="Month"
            display={monthLabel}
            placeholder="Month"
            open={openField === 'month'}
            onPress={() => toggleField('month')}
          />
        </View>
        <View className="flex-1">
          <DropdownField
            label="Year"
            display={value.year}
            placeholder="YYYY"
            open={openField === 'year'}
            onPress={() => toggleField('year')}
          />
        </View>
      </View>

      {openField ? (
        <View className="bg-surface-elevated border border-border rounded-2xl overflow-hidden">
          <Text className="text-text-muted text-xs px-4 pt-3 pb-1">{listTitle}</Text>
          <ScrollView style={{ maxHeight: 280 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {options.map((item) => {
              const isSelected = selectedValue === item.value;
              return (
                <Pressable
                  key={item.value}
                  onPress={() => selectOption(openField, item.value)}
                  className={`flex-row items-center px-4 py-3.5 active:opacity-80 ${
                    isSelected ? 'bg-primary-muted' : ''
                  }`}
                >
                  <Text
                    className={`flex-1 text-base font-medium ${
                      isSelected ? 'text-primary' : 'text-text-primary'
                    }`}
                  >
                    {item.label}
                  </Text>
                  {isSelected ? <Ionicons name="checkmark-circle" size={20} color="#00C853" /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

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
