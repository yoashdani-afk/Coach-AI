import { ScrollView, View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Button } from '@/components/ui';
import { IMPROVE_CATEGORY_ACCENTS } from '@/components/improve/ImproveCategoryGrid';
import { formatDrillListSubtitle } from '@/lib/improveDrillDisplay';
import { getImproveCategory } from '@/lib/improveContent';
import { useImproveSessionDraftStore } from '@/stores/improveSessionDraftStore';
import { useProfileStore } from '@/stores/profileStore';
import { colors } from '@/theme/colors';
import type { ImproveCategoryId, ImproveDrillDifficulty } from '@/types/improve';
import {
  REHAB_DISCLAIMER,
  SESSION_DURATION_DRILL_COUNTS,
  SESSION_LOCATION_OPTIONS,
  SESSION_SITUATION_OPTIONS,
} from '@/types/improveSession';

const SURFACE = '#141416';
const BORDER = 'rgba(255,255,255,0.08)';
const RADIUS = 20;

type IonName = ComponentProps<typeof Ionicons>['name'];

function DifficultyStars({ difficulty }: { difficulty: ImproveDrillDifficulty }) {
  return (
    <View className="flex-row items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Ionicons
          key={i}
          name={i < difficulty ? 'star' : 'star-outline'}
          size={12}
          color={i < difficulty ? colors.warning : colors.textMuted}
        />
      ))}
    </View>
  );
}

function SessionOverviewCard({
  drillCount,
  structureLabel,
  mainNote,
  locationLabel,
  intensityLabel,
  partnerLabel,
  age,
}: {
  drillCount: number;
  structureLabel: string | null;
  mainNote: string | null;
  locationLabel: string;
  intensityLabel: string;
  partnerLabel: string;
  age: number;
}) {
  return (
    <View
      style={{
        backgroundColor: SURFACE,
        borderWidth: 1,
        borderColor: 'rgba(0,200,83,0.28)',
        borderRadius: RADIUS,
        padding: 16,
        gap: 14,
      }}
    >
      <View className="flex-row items-start gap-3.5">
        <View
          className="items-center justify-center"
          style={{
            width: 52,
            height: 52,
            borderRadius: 16,
            backgroundColor: 'rgba(0,200,83,0.16)',
            borderWidth: 1,
            borderColor: 'rgba(0,200,83,0.35)',
          }}
        >
          <Ionicons name="flash" size={26} color={colors.primary} />
        </View>
        <View className="flex-1 gap-1">
          <Text className="text-text-muted text-[11px] font-semibold uppercase tracking-wider">
            Session overview
          </Text>
          <Text
            className="text-text-primary tracking-tight"
            style={{ fontSize: 22, fontWeight: '700', lineHeight: 26 }}
          >
            {drillCount} drills
            {structureLabel ? (
              <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textSecondary }}>
                {' '}
                ({structureLabel})
              </Text>
            ) : null}
          </Text>
          {mainNote ? (
            <Text className="text-text-muted text-[12px] leading-4">{mainNote}</Text>
          ) : null}
        </View>
      </View>

      <View
        className="flex-row flex-wrap gap-2 pt-1"
        style={{ borderTopWidth: 1, borderTopColor: BORDER }}
      >
        {[
          { icon: 'location-outline' as IonName, label: locationLabel },
          { icon: 'speedometer-outline' as IonName, label: `${intensityLabel} intensity` },
          { icon: 'people-outline' as IonName, label: partnerLabel },
          { icon: 'person-outline' as IonName, label: `Age ${age}` },
        ].map((chip) => (
          <View
            key={chip.label}
            className="flex-row items-center gap-1.5 px-2.5 py-1.5 rounded-full"
            style={{
              backgroundColor: 'rgba(255,255,255,0.05)',
              borderWidth: 1,
              borderColor: BORDER,
            }}
          >
            <Ionicons name={chip.icon} size={13} color={colors.textMuted} />
            <Text className="text-text-secondary text-[12px] font-medium">{chip.label}</Text>
          </View>
        ))}
      </View>

      <Text className="text-text-muted text-[11px] leading-4">
        Durations are approximate — drill times aren’t normalized across the library.
      </Text>
    </View>
  );
}

function RehabDisclaimerCard({ text }: { text: string }) {
  return (
    <View
      style={{
        backgroundColor: 'rgba(255,179,0,0.10)',
        borderWidth: 1,
        borderColor: 'rgba(255,179,0,0.32)',
        borderLeftWidth: 3,
        borderLeftColor: colors.warning,
        borderRadius: RADIUS,
        padding: 14,
        gap: 8,
      }}
    >
      <View className="flex-row items-center gap-2">
        <View
          className="items-center justify-center"
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            backgroundColor: 'rgba(255,179,0,0.18)',
          }}
        >
          <Ionicons name="warning" size={16} color={colors.warning} />
        </View>
        <Text
          style={{ color: colors.warning, fontSize: 13, fontWeight: '700', letterSpacing: 0.2 }}
        >
          Rehab safety notice
        </Text>
      </View>
      <Text className="text-text-secondary text-[13px] leading-5">{text}</Text>
    </View>
  );
}

function SessionNoteCard({ note }: { note: string }) {
  return (
    <View
      style={{
        backgroundColor: SURFACE,
        borderWidth: 1,
        borderColor: BORDER,
        borderRadius: RADIUS,
        paddingHorizontal: 14,
        paddingVertical: 12,
        flexDirection: 'row',
        gap: 10,
        alignItems: 'flex-start',
      }}
    >
      <Ionicons name="information-circle-outline" size={18} color={colors.textMuted} style={{ marginTop: 1 }} />
      <Text className="text-text-secondary text-[13px] leading-5 flex-1">{note}</Text>
    </View>
  );
}

function SessionDrillRow({
  index,
  categoryId,
  title,
  subtitle,
  difficulty,
  creator,
  onPress,
}: {
  index: number;
  categoryId: ImproveCategoryId;
  title: string;
  subtitle: string;
  difficulty: ImproveDrillDifficulty;
  creator: string;
  onPress: () => void;
}) {
  const accent = IMPROVE_CATEGORY_ACCENTS[categoryId];
  const categoryTitle = getImproveCategory(categoryId)?.title ?? categoryId;

  return (
    <Pressable onPress={onPress} className="active:opacity-90" accessibilityRole="button">
      <View
        style={{
          backgroundColor: SURFACE,
          borderWidth: 1,
          borderColor: BORDER,
          borderLeftWidth: 3,
          borderLeftColor: accent,
          borderRadius: RADIUS,
          paddingVertical: 14,
          paddingHorizontal: 14,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <View
          className="items-center justify-center"
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            backgroundColor: `${accent}22`,
          }}
        >
          <Text style={{ color: accent, fontSize: 13, fontWeight: '700' }}>{index + 1}</Text>
        </View>

        <View className="flex-1 gap-1.5">
          <View className="flex-row items-center gap-2 flex-wrap">
            <Text className="text-text-primary font-semibold text-[15px] flex-shrink" numberOfLines={2}>
              {title}
            </Text>
          </View>
          <Text
            style={{ color: accent, fontSize: 10, fontWeight: '700', letterSpacing: 0.6 }}
            className="uppercase"
          >
            {categoryTitle}
          </Text>
          <Text className="text-text-muted text-[12px]">{subtitle}</Text>
          <View className="flex-row items-center gap-2 mt-0.5">
            <DifficultyStars difficulty={difficulty} />
            <Text className="text-text-muted text-[11px]">· {creator}</Text>
          </View>
        </View>

        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </View>
    </Pressable>
  );
}

export default function ImproveSessionResultScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const profile = useProfileStore((s) => s.profile);
  const session = useImproveSessionDraftStore((s) => s.session);
  const regenerate = useImproveSessionDraftStore((s) => s.regenerate);
  const resetDraft = useImproveSessionDraftStore((s) => s.resetDraft);

  if (!session) {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader title="Session" showBack onBack={() => router.back()} />
        <View className="flex-1 items-center justify-center px-8 gap-4">
          <Text className="text-text-secondary text-center leading-6">
            No session generated yet.
          </Text>
          <Button
            label="Build a session"
            onPress={() => router.replace('/improve/session')}
          />
        </View>
      </View>
    );
  }

  const situationLabel =
    SESSION_SITUATION_OPTIONS.find((o) => o.id === session.inputs.situation)?.label ??
    session.inputs.situation;
  const locationLabel =
    session.inputs.location == null
      ? 'Flexible location'
      : (SESSION_LOCATION_OPTIONS.find((o) => o.id === session.inputs.location)?.label ??
        session.inputs.location);
  const expectedMainCount = SESSION_DURATION_DRILL_COUNTS[session.inputs.durationMinutes];
  const isRehab = session.inputs.situation === 'rehab';
  const hasWarmUp = session.drills[0]?.skillId === 'warm-up';
  const isRecoverySession =
    session.inputs.situation === 'recovery-day' || session.inputs.situation === 'rehab';
  let trailingStretchCount = 0;
  if (!isRecoverySession) {
    for (let i = session.drills.length - 1; i >= 0; i -= 1) {
      const item = session.drills[i]!;
      if (item.drill.recoveryFocus === 'stretching' && item.skillId === 'recovery-mobility') {
        trailingStretchCount += 1;
      } else {
        break;
      }
    }
  }
  const mainDrillCount =
    session.drills.length - (hasWarmUp ? 1 : 0) - trailingStretchCount;

  const structureLabel = [hasWarmUp ? 'warm-up' : null, trailingStretchCount > 0 ? `${trailingStretchCount} stretches` : null]
    .filter(Boolean)
    .join(' + ') || null;

  const mainNote =
    mainDrillCount !== expectedMainCount
      ? `Aimed for ${expectedMainCount} main drills · ${mainDrillCount} selected`
      : null;

  const intensityLabel =
    session.inputs.intensity.charAt(0).toUpperCase() + session.inputs.intensity.slice(1);
  const partnerLabel = session.inputs.hasPartner ? 'Partner available' : 'Solo';

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title="Your session"
        subtitle={`${situationLabel} · ${locationLabel} · ~${session.inputs.durationMinutes} min`}
        showBack
        onBack={() => router.back()}
      />
      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 28, gap: 12, paddingTop: 4 }}
        showsVerticalScrollIndicator={false}
      >
        <SessionOverviewCard
          drillCount={session.drills.length}
          structureLabel={structureLabel}
          mainNote={mainNote}
          locationLabel={locationLabel}
          intensityLabel={intensityLabel}
          partnerLabel={partnerLabel}
          age={session.inputs.age}
        />

        {isRehab ? <RehabDisclaimerCard text={REHAB_DISCLAIMER} /> : null}

        {session.notes
          .filter((note) => note !== REHAB_DISCLAIMER)
          .map((note) => (
            <SessionNoteCard key={note} note={note} />
          ))}

        <View className="gap-2.5 mt-1">
          <View className="flex-row items-baseline justify-between px-0.5">
            <Text className="text-text-primary text-[15px] font-bold tracking-tight">Drills</Text>
            <Text className="text-text-muted text-[12px]">
              {session.drills.length} in order
            </Text>
          </View>

          <View className="gap-2.5">
            {session.drills.map((item, index) => (
              <SessionDrillRow
                key={`${item.categoryId}-${item.skillId}-${item.drill.id}-${index}`}
                index={index}
                categoryId={item.categoryId}
                title={item.drill.title}
                subtitle={formatDrillListSubtitle(item.drill)}
                difficulty={item.drill.difficulty}
                creator={item.drill.creator}
                onPress={() =>
                  router.push(`/improve/${item.categoryId}/${item.skillId}/${item.drill.id}`)
                }
              />
            ))}
          </View>
        </View>

        <View className="gap-2.5 mt-2">
          <Button
            label="Regenerate"
            variant="secondary"
            fullWidth
            onPress={() => regenerate(profile)}
          />
          <Button
            label="Start over"
            variant="ghost"
            fullWidth
            onPress={() => {
              resetDraft();
              router.replace('/improve/session');
            }}
          />
        </View>
      </ScrollView>
    </View>
  );
}
