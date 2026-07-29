import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui';
import {
  appendChatMessage,
  COACH_WELCOME_MESSAGE,
  createCoachMessage,
  getChatSession,
  SUGGESTED_COACH_QUESTIONS,
  type CoachMessage,
} from '@/chat/CoachMessage';
import { DemoCoach } from '@/chat/DemoCoach';
import type { CoachingReport } from '@/types/analysis';

interface CoachChatProps {
  report: CoachingReport;
}

export function CoachChat({ report }: CoachChatProps) {
  const [messages, setMessages] = useState<CoachMessage[]>(() => getChatSession(report.id));
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const seeded = useRef(false);

  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;

    const session = getChatSession(report.id);
    if (session.length === 0) {
      const welcome = createCoachMessage('coach', COACH_WELCOME_MESSAGE);
      appendChatMessage(report.id, welcome);
      setMessages([welcome]);
    } else {
      setMessages([...session]);
    }
  }, [report.id]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isTyping) return;

    const userMessage = createCoachMessage('user', trimmed);
    appendChatMessage(report.id, userMessage);
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    Keyboard.dismiss();
    setIsTyping(true);

    // Brief pause so the reply feels considered, not instant.
    await new Promise((resolve) => setTimeout(resolve, 650));

    const replyText = DemoCoach.generateResponse(report, trimmed);
    const coachMessage = createCoachMessage('coach', replyText);
    appendChatMessage(report.id, coachMessage);
    setMessages((prev) => [...prev, coachMessage]);
    setIsTyping(false);
  };

  const handleSend = () => {
    void sendMessage(input);
  };

  return (
    <View className="gap-4 mt-2">
      <View className="flex-row items-center gap-2">
        <View className="w-9 h-9 rounded-xl bg-primary-muted items-center justify-center">
          <Ionicons name="chatbubbles" size={18} color="#00C853" />
        </View>
        <View className="flex-1">
          <Text className="text-text-primary text-lg font-bold">Ask Your Coach</Text>
          <Text className="text-text-muted text-xs">Demo coach — responses based on your report</Text>
        </View>
      </View>

      <Card variant="outlined" className="p-0 overflow-hidden">
        <View className="p-4 gap-3 min-h-[160px]">
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
          {isTyping ? (
            <View className="flex-row items-center gap-2 self-start">
              <View className="bg-surface-elevated rounded-2xl rounded-bl-sm px-4 py-3 flex-row items-center gap-2">
                <ActivityIndicator size="small" color="#00C853" />
                <Text className="text-text-muted text-sm">Coach is thinking…</Text>
              </View>
            </View>
          ) : null}
        </View>

        <View className="px-3 pb-3 gap-2 border-t border-border pt-3">
          <View className="flex-row flex-wrap gap-2">
            {SUGGESTED_COACH_QUESTIONS.map((question) => (
              <Pressable
                key={question}
                onPress={() => void sendMessage(question)}
                disabled={isTyping}
                className="bg-surface-elevated border border-border rounded-full px-3 py-1.5 active:opacity-70"
              >
                <Text className="text-text-secondary text-xs">{question}</Text>
              </Pressable>
            ))}
          </View>

          <View className="flex-row items-end gap-2">
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Ask your coach a question…"
              placeholderTextColor="#6B6B73"
              multiline
              maxLength={500}
              editable={!isTyping}
              className="flex-1 bg-surface-elevated border border-border rounded-xl px-4 py-3 text-text-primary text-base max-h-[100px]"
              textAlignVertical="top"
              onSubmitEditing={handleSend}
              returnKeyType="send"
            />
            <Pressable
              onPress={handleSend}
              disabled={!input.trim() || isTyping}
              className={`w-12 h-12 rounded-xl items-center justify-center ${
                input.trim() && !isTyping ? 'bg-primary active:opacity-90' : 'bg-surface-elevated'
              }`}
            >
              <Ionicons
                name="send"
                size={20}
                color={input.trim() && !isTyping ? '#0D0D0F' : '#6B6B73'}
              />
            </Pressable>
          </View>
        </View>
      </Card>
    </View>
  );
}

function MessageBubble({ message }: { message: CoachMessage }) {
  const isUser = message.role === 'user';

  return (
    <View className={`flex-row ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser ? (
        <View className="w-7 h-7 rounded-full bg-primary-muted items-center justify-center mr-2 mt-1">
          <Ionicons name="school-outline" size={14} color="#00C853" />
        </View>
      ) : null}
      <View
        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-primary rounded-br-sm'
            : 'bg-surface-elevated border border-border rounded-bl-sm'
        }`}
      >
        {!isUser ? (
          <Text className="text-primary text-[10px] font-semibold uppercase mb-1 tracking-wide">
            Coach
          </Text>
        ) : null}
        <Text
          className={`text-sm leading-5 ${isUser ? 'text-background font-medium' : 'text-text-primary'}`}
        >
          {message.text}
        </Text>
      </View>
    </View>
  );
}
