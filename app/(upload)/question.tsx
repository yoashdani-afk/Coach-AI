import { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Input } from '@/components/ui';
import { SelectCard } from '@/components/profile/SelectCard';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { COACHING_QUESTIONS } from '@/lib/constants';
import { formatDuration, formatFileSize } from '@/lib/format';
import { useUploadStore } from '@/stores/uploadStore';
import type { CoachingQuestionType } from '@/types/analysis';

export default function QuestionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const clip = useUploadStore((s) => s.clip);
  const analysisMode = useUploadStore((s) => s.analysisMode);
  const questionType = useUploadStore((s) => s.questionType);
  const customQuestion = useUploadStore((s) => s.customQuestion);
  const context = useUploadStore((s) => s.context);
  const setQuestionType = useUploadStore((s) => s.setQuestionType);
  const setCustomQuestion = useUploadStore((s) => s.setCustomQuestion);
  const setContext = useUploadStore((s) => s.setContext);
  const playerSelection = useUploadStore((s) => s.playerSelection);

  const [customError, setCustomError] = useState<string | null>(null);

  if (!clip || analysisMode !== 'COACH_ME' || !playerSelection) {
    router.replace('/(upload)');
    return null;
  }

  const isCustom = questionType === 'CUSTOM';
  const customValid = !isCustom || customQuestion.trim().length >= 8;
  const canAnalyze = questionType !== null && customValid;

  const handleAnalyze = () => {
    if (!canAnalyze) {
      if (isCustom) setCustomError('Please enter at least 8 characters for your question.');
      return;
    }
    router.push('/(upload)/analysing');
  };

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title="What would you like help with?"
        subtitle="Ask one specific coaching question about this clip"
        showBack
        onBack={() => router.back()}
      />
      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 100, gap: 20 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Card variant="outlined" className="flex-row items-center gap-3">
          <View className="w-11 h-11 rounded-xl bg-primary-muted items-center justify-center">
            <Ionicons name="videocam" size={22} color="#00C853" />
          </View>
          <View className="flex-1">
            <Text className="text-text-primary font-medium" numberOfLines={1}>
              {clip.fileName ?? 'Selected clip'}
            </Text>
            <Text className="text-text-muted text-sm mt-0.5">
              {formatDuration(clip.durationMs)} · {formatFileSize(clip.fileSizeBytes)}
            </Text>
          </View>
        </Card>

        <View className="gap-3">
          {COACHING_QUESTIONS.map((item) => (
            <SelectCard
              key={item.type}
              label={item.label}
              icon={item.icon}
              selected={questionType === item.type}
              onPress={() => {
                setQuestionType(item.type as CoachingQuestionType);
                setCustomError(null);
              }}
            />
          ))}
        </View>

        {isCustom ? (
          <Input
            label="Your question"
            placeholder="e.g. Should I have taken the shot or passed to the winger?"
            value={customQuestion}
            onChangeText={(text) => {
              setCustomQuestion(text);
              setCustomError(null);
            }}
            multiline
            numberOfLines={4}
            className="min-h-[100px]"
            textAlignVertical="top"
            error={customError ?? undefined}
          />
        ) : null}

        <Input
          label="Help the coach identify you or understand the moment (optional)"
          placeholder="I'm the player in the blue shirt receiving the ball near midfield."
          value={context}
          onChangeText={setContext}
          multiline
          numberOfLines={3}
          className="min-h-[80px]"
          textAlignVertical="top"
        />
      </ScrollView>

      <View
        className="absolute bottom-0 left-0 right-0 px-4 pt-4 bg-background border-t border-border"
        style={{ paddingBottom: insets.bottom + 16 }}
      >
        <Button
          label="Analyze clip"
          onPress={handleAnalyze}
          disabled={!canAnalyze}
          fullWidth
          size="lg"
        />
      </View>
    </View>
  );
}
