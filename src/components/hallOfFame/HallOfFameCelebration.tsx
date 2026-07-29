import { View, Text } from 'react-native';
import { Card } from '@/components/ui';

interface HallOfFameCelebrationProps {
  playTitle?: string;
}

export function HallOfFameCelebration({ playTitle }: HallOfFameCelebrationProps) {
  return (
    <Card variant="elevated" className="border border-primary/40 bg-primary-muted/30 gap-2 items-center py-5">
      <Text className="text-4xl">🏆</Text>
      <Text className="text-primary text-lg font-bold">Hall of Fame Unlocked</Text>
      <Text className="text-text-secondary text-sm text-center leading-5 px-2">
        This play has been added to your Hall of Fame.
      </Text>
      {playTitle ? (
        <Text className="text-text-primary text-base font-semibold text-center mt-1">
          {playTitle}
        </Text>
      ) : null}
    </Card>
  );
}
