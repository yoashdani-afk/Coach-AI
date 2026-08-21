import { Pressable, View, Text, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui';
import { formatDrillListSubtitle } from '@/lib/improveDrillDisplay';
import type { ImproveDrill } from '@/types/improve';

interface ImproveDrillListProps {
  categoryId: string;
  skillId: string;
  drills: ImproveDrill[];
}

export function ImproveDrillList({ categoryId, skillId, drills }: ImproveDrillListProps) {
  const router = useRouter();

  if (drills.length === 0) {
    return (
      <Card variant="outlined">
        <Text className="text-text-muted text-sm italic">Drills coming soon.</Text>
      </Card>
    );
  }

  return (
    <View className="gap-3">
      {drills.map((drill) => (
        <Pressable
          key={drill.id}
          onPress={() => router.push(`/improve/${categoryId}/${skillId}/${drill.id}`)}
          className="active:opacity-80"
        >
          <Card variant="outlined" className="flex-row items-center gap-3">
            <View className="flex-1 gap-1">
              <Text className="text-text-primary font-semibold text-base">{drill.title}</Text>
              <Text className="text-text-muted text-sm">{formatDrillListSubtitle(drill)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#00C853" />
          </Card>
        </Pressable>
      ))}
    </View>
  );
}
