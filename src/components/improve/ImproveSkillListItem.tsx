import { Pressable, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui';
import type { ImproveSkill } from '@/types/improve';

interface ImproveSkillListItemProps {
  skill: ImproveSkill;
  onPress: () => void;
}

const SUBTITLE_MAX_CHARS = 80;

/** Prefer first sentence; otherwise soft-truncate near 60–80 chars at a word boundary. */
function truncateForSubtitle(text: string, maxChars = SUBTITLE_MAX_CHARS): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';

  const sentenceMatch = cleaned.match(/^(.+?[.!?])(?:\s|$)/);
  const firstSentence = sentenceMatch?.[1]?.trim();
  if (firstSentence && firstSentence.length <= maxChars) {
    return firstSentence;
  }

  const source = firstSentence && firstSentence.length > maxChars ? firstSentence : cleaned;
  if (source.length <= maxChars) return source;

  const slice = source.slice(0, maxChars);
  const lastSpace = slice.lastIndexOf(' ');
  const cut = lastSpace >= 60 ? slice.slice(0, lastSpace) : slice;
  return `${cut.replace(/[.,;:\s]+$/, '')}…`;
}

function skillListSubtitle(skill: ImproveSkill): { text: string; isPlaceholder: boolean } {
  const summary = skill.summary?.trim();
  if (summary) {
    return { text: summary, isPlaceholder: false };
  }

  const explanation = skill.explanation?.trim();
  if (explanation) {
    return { text: truncateForSubtitle(explanation), isPlaceholder: false };
  }

  // Only when there is no content description and no drills.
  if (skill.drills.length === 0) {
    return { text: 'Content coming soon', isPlaceholder: true };
  }

  return { text: '', isPlaceholder: false };
}

export function ImproveSkillListItem({ skill, onPress }: ImproveSkillListItemProps) {
  const subtitle = skillListSubtitle(skill);

  return (
    <Pressable onPress={onPress} className="active:opacity-80">
      <Card variant="outlined" className="flex-row items-center gap-3">
        <View className="flex-1 gap-1.5">
          <Text className="text-text-primary font-semibold text-base">{skill.title}</Text>
          {subtitle.text ? (
            <Text
              className={
                subtitle.isPlaceholder
                  ? 'text-text-muted text-sm italic'
                  : 'text-text-secondary text-sm leading-5'
              }
              numberOfLines={2}
            >
              {subtitle.text}
            </Text>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={18} color="#00C853" />
      </Card>
    </Pressable>
  );
}
