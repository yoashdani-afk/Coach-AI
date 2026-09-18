import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Platform } from 'react-native';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

const BLOCKED_USERS_KEY = 'goalx-blocked-user-ids';
const REPORTED_ENTRIES_KEY = 'goalx-reported-hof-entry-ids';

export const PRIVACY_POLICY_URL = 'https://goalx.site/privacy';
/** Apple Standard EULA — acceptable when a custom Terms page is not published yet. */
export const TERMS_OF_USE_URL =
  'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
export const UGC_REPORT_EMAIL = 'dan@blsl.net';
/** FormSubmit form id (from activation email) — avoids naked-email activation loops. */
const FORMSUBMIT_FORM_ID = 'bf9a49e0fc99cd243df86c8d49cd2be1';

async function readIdSet(key: string): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === 'string' && id.length > 0));
  } catch {
    return new Set();
  }
}

async function writeIdSet(key: string, ids: Set<string>): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify([...ids]));
}

export async function getBlockedUserIds(): Promise<Set<string>> {
  return readIdSet(BLOCKED_USERS_KEY);
}

export async function isUserBlocked(userId: string | undefined | null): Promise<boolean> {
  if (!userId) return false;
  const blocked = await getBlockedUserIds();
  return blocked.has(userId);
}

export async function blockUser(userId: string): Promise<void> {
  if (!userId) return;
  const blocked = await getBlockedUserIds();
  blocked.add(userId);
  await writeIdSet(BLOCKED_USERS_KEY, blocked);
}

export async function getReportedEntryIds(): Promise<Set<string>> {
  return readIdSet(REPORTED_ENTRIES_KEY);
}

export async function markEntryReported(entryId: string): Promise<void> {
  if (!entryId) return;
  const reported = await getReportedEntryIds();
  reported.add(entryId);
  await writeIdSet(REPORTED_ENTRIES_KEY, reported);
}

/** Clears local Report/Block hides so Hall of Fame entries show again on this device. */
export async function clearLocalUgcModeration(): Promise<void> {
  await AsyncStorage.multiRemove([BLOCKED_USERS_KEY, REPORTED_ENTRIES_KEY]);
}

export type UgcReportReason =
  | 'Inappropriate content'
  | 'Harassment or bullying'
  | 'Spam or misleading'
  | 'Other';

/**
 * Persist a UGC report to Supabase (source of truth), then email dan@blsl.net.
 * Email uses FormSubmit — first report ever may send an activation link to that inbox.
 */
export async function submitUgcReport(params: {
  entryId: string;
  playerName: string;
  playTitle: string;
  ownerUserId?: string;
  reason: UgcReportReason;
}): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new Error('Reporting is not available right now.');
  }

  const reporterUserId = useAuthStore.getState().user?.id;
  if (!reporterUserId) {
    throw new Error('Sign in to report content.');
  }

  const { error } = await getSupabase().from('ugc_reports').insert({
    reporter_user_id: reporterUserId,
    entry_id: params.entryId,
    owner_user_id: params.ownerUserId ?? null,
    player_name: params.playerName,
    play_title: params.playTitle,
    reason: params.reason,
    platform: Platform.OS,
  });

  if (error) {
    throw new Error(error.message || 'Could not submit report.');
  }

  await markEntryReported(params.entryId);
  await notifyUgcReportEmail(params).catch((err) => {
    console.warn('[UGC] email notify failed', err);
  });
}

async function notifyUgcReportEmail(params: {
  entryId: string;
  playerName: string;
  playTitle: string;
  ownerUserId?: string;
  reason: UgcReportReason;
}): Promise<void> {
  const summary = [
    'GoalX Hall of Fame — content report',
    '',
    `Reason: ${params.reason}`,
    `Play: ${params.playTitle}`,
    `Player name shown: ${params.playerName}`,
    `Entry ID: ${params.entryId}`,
    params.ownerUserId ? `Owner user ID: ${params.ownerUserId}` : null,
    `Platform: ${Platform.OS}`,
    '',
    'Action: review in Supabase → Table Editor → ugc_reports, then remove or keep the Hall of Fame entry.',
  ]
    .filter(Boolean)
    .join('\n');

  const response = await fetch(`https://formsubmit.co/ajax/${FORMSUBMIT_FORM_ID}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      _subject: `[GoalX Report] ${params.reason} — ${params.playTitle}`,
      _template: 'box',
      name: 'GoalX Moderation',
      email: UGC_REPORT_EMAIL,
      message: summary,
      reason: params.reason,
      entry_id: params.entryId,
      play_title: params.playTitle,
      player_name: params.playerName,
      owner_user_id: params.ownerUserId ?? '',
      platform: Platform.OS,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || `Email notify failed (${response.status})`);
  }
}

/** @deprecated Prefer submitUgcReport — mailto does not auto-send. */
export async function openUgcReportEmail(params: {
  entryId: string;
  playerName: string;
  playTitle: string;
  ownerUserId?: string;
  reason: UgcReportReason;
}): Promise<void> {
  const subject = encodeURIComponent(`GoalX Hall of Fame report — ${params.entryId}`);
  const body = encodeURIComponent(
    [
      'I want to report this Hall of Fame entry.',
      '',
      `Reason: ${params.reason}`,
      `Entry ID: ${params.entryId}`,
      `Player name: ${params.playerName}`,
      `Play title: ${params.playTitle}`,
      params.ownerUserId ? `Owner user ID: ${params.ownerUserId}` : null,
      `Platform: ${Platform.OS}`,
      '',
      'Please review and take appropriate action.',
    ]
      .filter(Boolean)
      .join('\n')
  );
  const url = `mailto:${UGC_REPORT_EMAIL}?subject=${subject}&body=${body}`;
  const canOpen = await Linking.canOpenURL(url).catch(() => false);
  if (canOpen) {
    await Linking.openURL(url).catch(() => undefined);
  }
}

export async function openExternalUrl(url: string): Promise<void> {
  await Linking.openURL(url);
}
