import { Pressable, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui';
import { ImproveSkillProgressBadge } from '@/components/improve/ImproveSkillProgressBadge';
import type { ImproveSkill } from '@/types/improve';

interface ImproveSkillListItemProps {
  categoryId: string;
  skill: ImproveSkill;
  onPress: () => void;
}

export function ImproveSkillListItem({ categoryId, skill, onPress }: ImproveSkillListItemProps) {
  return (
    <Pressable onPress={onPress} className="active:opacity-80">
      <Card variant="outlined" className="flex-row items-center gap-3">
        <View className="flex-1 gap-1.5">
          <Text className="text-text-primary font-semibold text-base">{skill.title}</Text>
          <ImproveSkillProgressBadge categoryId={categoryId} skillId={skill.id} />
          {skill.summary ? (
            <Text className="text-text-secondary text-sm leading-5" numberOfLines={2}>
              {skill.summary}
            </Text>
          ) : (
            <Text className="text-text-muted text-sm italic">Content coming soon</Text>
          )}
        </View>
        <Ionicons name="chevron-forward" size={18} color="#00C853" />
      </Card>
    </Pressable>
  );
}
