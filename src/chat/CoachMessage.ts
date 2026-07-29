export type CoachMessageRole = 'user' | 'coach';

export interface CoachMessage {
  id: string;
  role: CoachMessageRole;
  text: string;
  createdAt: number;
}

const sessions = new Map<string, CoachMessage[]>();

export function getChatSession(reportId: string): CoachMessage[] {
  if (!sessions.has(reportId)) {
    sessions.set(reportId, []);
  }
  return sessions.get(reportId)!;
}

export function appendChatMessage(reportId: string, message: CoachMessage): void {
  const session = getChatSession(reportId);
  session.push(message);
  sessions.set(reportId, session);
}

export function createCoachMessage(role: CoachMessageRole, text: string): CoachMessage {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    text,
    createdAt: Date.now(),
  };
}

export const SUGGESTED_COACH_QUESTIONS = [
  'Why was that the wrong decision?',
  'What should I have done instead?',
  'How could I have created more space?',
  'Was my first touch good?',
  'What drill should I practise?',
] as const;

export const COACH_WELCOME_MESSAGE =
  "I've reviewed this clip against your report. Ask about the decision, the touch, or how to train it — I'll break down what happened, why it mattered, and what to work on next.";
