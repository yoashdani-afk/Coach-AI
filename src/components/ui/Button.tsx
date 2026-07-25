import {
  ActivityIndicator,
  Pressable,
  Text,
  type PressableProps,
} from 'react-native';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends PressableProps {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  className?: string;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-primary active:opacity-90',
  secondary: 'bg-surface-elevated border border-border active:opacity-90',
  ghost: 'bg-transparent active:bg-surface',
};

const textStyles: Record<ButtonVariant, string> = {
  primary: 'text-background font-semibold',
  secondary: 'text-text-primary font-semibold',
  ghost: 'text-primary font-semibold',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-4 py-2 rounded-lg',
  md: 'px-6 py-3.5 rounded-xl',
  lg: 'px-8 py-4 rounded-xl',
};

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      className={`items-center justify-center flex-row ${variantStyles[variant]} ${sizeStyles[size]} ${fullWidth ? 'w-full' : ''} ${isDisabled ? 'opacity-50' : ''} ${className}`}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#0D0D0F' : '#FFFFFF'} />
      ) : (
        <Text className={`${textStyles[variant]} ${size === 'lg' ? 'text-lg' : 'text-base'}`}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}
