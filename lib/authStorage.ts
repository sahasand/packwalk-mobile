import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'packwalk_auth_token';
const MIGRATION_KEY = 'packwalk_migrated_to_secure_store';

export const authStorage = {
  async getToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(TOKEN_KEY);
    } catch {
      return null;
    }
  },

  async setToken(token: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
    } catch {
      // Silently fail
    }
  },

  async clearToken(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    } catch {
      // Silently fail
    }
  },

  /**
   * One-time migration from AsyncStorage to SecureStore.
   * Moves existing token to secure storage and cleans up old storage.
   */
  async migrateFromAsyncStorage(): Promise<void> {
    try {
      // Check if already migrated
      const migrated = await AsyncStorage.getItem(MIGRATION_KEY);
      if (migrated === 'true') return;

      // Check for token in old AsyncStorage location
      const oldToken = await AsyncStorage.getItem(TOKEN_KEY);
      if (oldToken) {
        // Move to SecureStore
        await SecureStore.setItemAsync(TOKEN_KEY, oldToken);
        // Clean up old storage
        await AsyncStorage.removeItem(TOKEN_KEY);
      }

      // Mark migration complete
      await AsyncStorage.setItem(MIGRATION_KEY, 'true');
    } catch {
      // Migration failed, will retry next time
    }
  },
};
