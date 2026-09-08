import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage, type StateStorage } from 'zustand/middleware';

/** No-op storage for Node SSR where `window` / AsyncStorage are unavailable. */
const ssrSafeStorage: StateStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

/**
 * Zustand JSON storage that uses AsyncStorage in the browser/native runtime
 * and a no-op adapter during Expo web SSR (Node has no `window`).
 */
export function createAppJSONStorage() {
  return createJSONStorage(() =>
    typeof window === 'undefined' ? ssrSafeStorage : AsyncStorage
  );
}
