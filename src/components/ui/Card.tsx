import { View, type ViewProps } from 'react-native';

interface CardProps extends ViewProps {
  variant?: 'default' | 'elevated' | 'outlined';
  className?: string;
}

const variantStyles = {
  default: 'bg-surface',
  elevated: 'bg-surface-elevated',
  outlined: 'bg-surface border border-border',
};

export function Card({ variant = 'default', className = '', children, ...props }: CardProps) {
  return (
    <View className={`rounded-2xl p-4 ${variantStyles[variant]} ${className}`} {...props}>
      {children}
    </View>
  );
}
