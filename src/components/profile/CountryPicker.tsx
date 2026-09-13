import { useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COUNTRIES, filterCountries, findCountryByName, type Country } from '@/lib/countries';

interface CountryPickerProps {
  label: string;
  value: string;
  onChange: (countryName: string) => void;
  placeholder?: string;
}

export function CountryPicker({
  label,
  value,
  onChange,
  placeholder = 'Select a country',
}: CountryPickerProps) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = useMemo(() => findCountryByName(value), [value]);
  const results = useMemo(() => filterCountries(query), [query]);

  const openPicker = () => {
    setQuery('');
    setOpen(true);
  };

  const selectCountry = (country: Country) => {
    onChange(country.name);
    setOpen(false);
  };

  return (
    <View className="gap-1.5">
      {label ? <Text className="text-text-secondary text-sm font-medium">{label}</Text> : null}
      <Pressable
        onPress={openPicker}
        className="bg-surface-elevated border border-border rounded-xl px-4 py-3.5 flex-row items-center active:opacity-80"
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        {selected ? (
          <Text className="text-2xl mr-3">{selected.flag}</Text>
        ) : (
          <Ionicons name="flag-outline" size={20} color="#6B6B73" style={{ marginRight: 12 }} />
        )}
        <Text
          className={`flex-1 text-base ${
            selected || value.trim() ? 'text-text-primary' : 'text-text-muted'
          }`}
          numberOfLines={1}
        >
          {selected?.name ?? (value.trim() || placeholder)}
        </Text>
        <Ionicons name="chevron-down" size={18} color="#A0A0A8" />
      </Pressable>

      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(false)}
      >
        <KeyboardAvoidingView
          className="flex-1 bg-background"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ paddingTop: Platform.OS === 'android' ? insets.top : 8 }}
        >
          <View className="px-5 pt-3 pb-3 flex-row items-center border-b border-border">
            <Text className="text-text-primary text-lg font-semibold flex-1">
              {label || 'Select a country'}
            </Text>
            <Pressable
              onPress={() => setOpen(false)}
              className="w-10 h-10 items-center justify-center rounded-full bg-surface"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={22} color="#FFFFFF" />
            </Pressable>
          </View>

          <View className="px-5 py-3">
            <View className="bg-surface-elevated border border-border rounded-xl px-3 flex-row items-center">
              <Ionicons name="search" size={18} color="#6B6B73" />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search countries"
                placeholderTextColor="#6B6B73"
                autoFocus
                autoCorrect={false}
                className="flex-1 px-3 py-3.5 text-text-primary text-base"
              />
              {query.length > 0 ? (
                <Pressable onPress={() => setQuery('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color="#6B6B73" />
                </Pressable>
              ) : null}
            </View>
          </View>

          <FlatList
            data={results}
            keyExtractor={(item) => item.code}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingBottom: insets.bottom + 24,
            }}
            ListEmptyComponent={
              <Text className="text-text-muted text-center py-8">No countries match your search.</Text>
            }
            renderItem={({ item }) => {
              const isSelected = selected?.code === item.code;
              return (
                <Pressable
                  onPress={() => selectCountry(item)}
                  className={`flex-row items-center px-3 py-3.5 rounded-xl mb-1 active:opacity-80 ${
                    isSelected ? 'bg-primary-muted border border-primary' : 'bg-transparent'
                  }`}
                >
                  <Text className="text-2xl mr-3">{item.flag}</Text>
                  <Text
                    className={`flex-1 text-base font-medium ${
                      isSelected ? 'text-primary' : 'text-text-primary'
                    }`}
                  >
                    {item.name}
                  </Text>
                  {isSelected ? <Ionicons name="checkmark-circle" size={20} color="#00C853" /> : null}
                </Pressable>
              );
            }}
            initialNumToRender={20}
            windowSize={10}
          />

          <Text className="text-text-muted text-xs text-center pb-2 px-5">
            {results.length} of {COUNTRIES.length} countries
          </Text>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
