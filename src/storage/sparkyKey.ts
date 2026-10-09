import * as SecureStore from 'expo-secure-store';

// The SparkyFitness API key is a credential, so it goes in the iOS keychain rather than a JSON file.
const KEY = 'sparky-api-key';

export const loadSparkyKey = (): Promise<string | null> => SecureStore.getItemAsync(KEY).catch(() => null);
export const saveSparkyKey = (key: string): Promise<void> => SecureStore.setItemAsync(KEY, key);
export const clearSparkyKey = (): Promise<void> => SecureStore.deleteItemAsync(KEY).catch(() => undefined);
