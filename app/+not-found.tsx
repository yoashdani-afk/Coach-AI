import { View, Text } from 'react-native';
import { Link, Stack } from 'expo-router';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not Found' }} />
      <View className="flex-1 bg-background items-center justify-center px-6">
        <Text className="text-text-primary text-2xl font-bold mb-2">Page not found</Text>
        <Link href="/(tabs)"><Text className="text-primary text-base">Go to Home</Text></Link>
      </View>
    </>
  );
}
