import { Redirect } from 'expo-router';

/** Legacy route — Hall of Fame now lives on the tab bar. */
export default function HallOfFameRedirect() {
  return <Redirect href="/(tabs)/hall-of-fame" />;
}
