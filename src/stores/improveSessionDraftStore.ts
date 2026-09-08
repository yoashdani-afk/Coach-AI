import { create } from 'zustand';
import { generateImproveSession } from '@/lib/improveSessionGenerator';
import type { PlayerProfile } from '@/types/profile';
import type {
  GeneratedSession,
  SessionInputs,
  SessionTarget,
} from '@/types/improveSession';

interface ImproveSessionDraftState {
  inputs: Partial<SessionInputs>;
  session: GeneratedSession | null;
  setTarget: (target: SessionTarget) => void;
  setSituation: (situation: SessionInputs['situation']) => void;
  setIntensity: (intensity: SessionInputs['intensity']) => void;
  setAge: (age: number) => void;
  setDurationMinutes: (durationMinutes: SessionInputs['durationMinutes']) => void;
  setHasPartner: (hasPartner: boolean) => void;
  resetDraft: () => void;
  generate: (profile: PlayerProfile | null) => GeneratedSession | null;
  regenerate: (profile: PlayerProfile | null) => GeneratedSession | null;
}

const emptyInputs: Partial<SessionInputs> = {};

function isCompleteInputs(inputs: Partial<SessionInputs>): inputs is SessionInputs {
  return (
    inputs.target != null &&
    inputs.situation != null &&
    inputs.intensity != null &&
    typeof inputs.age === 'number' &&
    inputs.durationMinutes != null &&
    typeof inputs.hasPartner === 'boolean'
  );
}

export const useImproveSessionDraftStore = create<ImproveSessionDraftState>((set, get) => ({
  inputs: { ...emptyInputs },
  session: null,

  setTarget: (target) => set((state) => ({ inputs: { ...state.inputs, target } })),
  setSituation: (situation) => set((state) => ({ inputs: { ...state.inputs, situation } })),
  setIntensity: (intensity) => set((state) => ({ inputs: { ...state.inputs, intensity } })),
  setAge: (age) => set((state) => ({ inputs: { ...state.inputs, age } })),
  setDurationMinutes: (durationMinutes) =>
    set((state) => ({ inputs: { ...state.inputs, durationMinutes } })),
  setHasPartner: (hasPartner) => set((state) => ({ inputs: { ...state.inputs, hasPartner } })),

  resetDraft: () => set({ inputs: { ...emptyInputs }, session: null }),

  generate: (profile) => {
    const { inputs } = get();
    if (!isCompleteInputs(inputs)) return null;
    // Location is auto-resolved by the generator — never trust a stale draft value
    const session = generateImproveSession({ ...inputs, location: undefined }, profile);
    set({ session });
    return session;
  },

  regenerate: (profile) => {
    const { inputs, session } = get();
    if (!isCompleteInputs(inputs)) return null;
    const next = generateImproveSession({ ...inputs, location: undefined }, profile);
    set({ session: next });
    void session;
    return next;
  },
}));
