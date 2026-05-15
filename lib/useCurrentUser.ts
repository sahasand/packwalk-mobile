import { useEffect } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useAppStore, type User, type Dog } from '@/stores/appStore';
import { authStorage } from '@/lib/authStorage';

/**
 * Hook that fetches the current user profile from Convex and syncs to Zustand store.
 * Use this in screens that need access to the authenticated user's data.
 */
export function useCurrentUser() {
  const { setUser, setUserType, setLoggedIn, isLoggedIn, user: storeUser } = useAppStore();

  // Only query if we think we're logged in (pass "skip" to skip the query)
  const profile = useQuery(
    api.me.getProfile,
    isLoggedIn ? {} : 'skip'
  );

  useEffect(() => {
    if (profile?.user) {
      const convexUser = profile.user;

      // Map Convex user to store User type
      const mappedUser: User = {
        id: convexUser._id,
        name: convexUser.name,
        email: convexUser.email,
        avatar: convexUser.avatarUrl ?? convexUser.avatarFileId ?? '',
        type: convexUser.userType as 'owner' | 'walker',
        dogs: (profile.dogs ?? []).map((dog): Dog => ({
          id: dog._id,
          name: dog.name,
          breed: dog.breed ?? '',
          age: dog.age ?? 0,
          weight: 0, // Not in Convex schema
          photo: dog.photoFileId ?? '',
          notes: dog.specialNotes,
        })),
      };

      // Only update if data has changed
      if (
        !storeUser ||
        storeUser.id !== mappedUser.id ||
        storeUser.name !== mappedUser.name ||
        storeUser.email !== mappedUser.email ||
        storeUser.avatar !== mappedUser.avatar
      ) {
        setUser(mappedUser);
      }

      // Sync user type
      if (convexUser.userType === 'owner' || convexUser.userType === 'walker') {
        setUserType(convexUser.userType);
      }
    }
  }, [profile, setUser, setUserType, storeUser]);

  return {
    user: profile?.user,
    dogs: profile?.dogs,
    walkerProfile: profile?.walkerProfile,
    isLoading: profile === undefined,
    isAuthenticated: profile?.user !== undefined,
  };
}

export default useCurrentUser;
