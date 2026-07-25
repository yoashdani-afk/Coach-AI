import { Alert } from 'react-native';

export function showComingSoon(feature: string) {
  Alert.alert(
    'Coming soon',
    `${feature} will be available in the next update.`
  );
}
