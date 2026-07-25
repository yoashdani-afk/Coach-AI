import { TextInput, View, Text, type TextInputProps } from 'react-native';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  className?: string;
}

export function Input({ label, error, className = '', ...props }: InputProps) {
  return (
    <View className="gap-1.5">
      {label ? <Text className="text-text-secondary text-sm font-medium">{label}</Text> : null}
      <TextInput
        placeholderTextColor="#6B6B73"
        className={`bg-surface-elevated border rounded-xl px-4 py-3.5 text-text-primary text-base ${error ? 'border-danger' : 'border-border'} ${className}`}
        {...props}
      />
      {error ? <Text className="text-danger text-xs">{error}</Text> : null}
    </View>
  );
}
