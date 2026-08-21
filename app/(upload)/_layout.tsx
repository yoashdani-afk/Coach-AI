import { Stack } from 'expo-router';

export default function UploadLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0D0D0F' },
        animation: 'slide_from_right',
        gestureEnabled: true,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="mode" />
      <Stack.Screen name="identify" />
      <Stack.Screen name="track-building" options={{ gestureEnabled: false }} />
      <Stack.Screen name="track-preview" />
      <Stack.Screen name="question" />
      <Stack.Screen
        name="analysing"
        options={{ gestureEnabled: false, animation: 'fade' }}
      />
    </Stack>
  );
}
