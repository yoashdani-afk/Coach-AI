import { Stack } from 'expo-router';

export default function DebugLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0D0D0F' } }} />
  );
}
