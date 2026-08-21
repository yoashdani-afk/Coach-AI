import { useEffect } from 'react';
import { useRouter } from 'expo-router';

/** Legacy route — redirects to unified track preview. */
export default function TrackBuildingScreen() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/(upload)/track-preview');
  }, [router]);
  return null;
}
