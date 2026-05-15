import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authStorage } from '@/lib/authStorage';
import { resetBackgroundTaskContext } from '@/app/(walker)/active-walk';

// Types
export type UserType = 'owner' | 'walker';

export interface Dog {
  id: string;
  name: string;
  breed: string;
  age: number;
  weight: number;
  photo: string;
  notes?: string;
}

export interface Walker {
  id: string;
  name: string;
  avatar: string;
  rating: number;
  reviewCount: number;
  rate: number;
  distance: string;
  bio: string;
  verified: boolean;
  totalWalks: number;
}

export interface Walk {
  id: string;
  walkerId: string;
  walkerName: string;
  walkerAvatar: string;
  dogIds: string[];
  date: string;
  time: string;
  duration: number;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  price: number;
  tip?: number;
  notes?: string;
  // Owner info for walker view
  ownerId?: string;
  ownerName?: string;
  ownerAvatar?: string;
  dogNames?: string[];
  location?: string;
}

export interface WalkRequest {
  id: string;
  ownerId: string;
  ownerName: string;
  ownerAvatar: string;
  dogNames: string[];
  date: string;
  time: string;
  duration: number;
  price: number;
  location: string;
  notes?: string;
  createdAt: string;
}

export interface ActiveWalk {
  id: string;
  ownerId: string;
  ownerName: string;
  ownerAvatar: string;
  dogNames: string[];
  startTime: string;
  duration: number;
  price: number;
  location: {
    latitude: number;
    longitude: number;
  };
  route: Array<{ latitude: number; longitude: number }>;
  photos: string[];
  notes?: string;
}

export interface Earning {
  id: string;
  walkId: string;
  ownerName: string;
  date: string;
  amount: number;
  tip: number;
  status: 'pending' | 'paid';
}

export interface Availability {
  [day: string]: {
    enabled: boolean;
    startTime: string;
    endTime: string;
  };
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  type: UserType;
  dogs: Dog[];
}

export interface WalkerProfile {
  id: string;
  name: string;
  email: string;
  avatar: string;
  phone?: string;
  bio: string;
  rate: number;
  rating: number;
  reviewCount: number;
  totalWalks: number;
  totalEarnings: number;
  verified: boolean;
  availability: Availability;
  services: string[];
}

interface AppState {
  // Auth
  isLoggedIn: boolean;
  hasOnboarded: boolean;
  user: User | null;
  userType: UserType;

  // Selected items for navigation
  selectedWalker: Walker | null;
  selectedDog: Dog | null;
  selectedWalk: Walk | null;

  // Booking flow
  bookingData: {
    walkerId?: string;
    dogIds: string[];
    date?: string;
    time?: string;
    duration: number;
    walkType: 'standard' | 'extended' | 'puppy';
    notes?: string;
  };

  // Walker-specific state
  walkerProfile: WalkerProfile | null;
  walkRequests: WalkRequest[];
  activeWalk: ActiveWalk | null;
  earnings: Earning[];
  walkerUpcomingWalks: Walk[];

  // Actions
  setLoggedIn: (value: boolean) => void;
  setHasOnboarded: (value: boolean) => void;
  setUser: (user: User | null) => void;
  setUserType: (type: UserType) => void;
  setSelectedWalker: (walker: Walker | null) => void;
  setSelectedDog: (dog: Dog | null) => void;
  setSelectedWalk: (walk: Walk | null) => void;
  updateBookingData: (data: Partial<AppState['bookingData']>) => void;
  resetBookingData: () => void;
  logout: () => void;

  // Walker actions
  setWalkerProfile: (profile: WalkerProfile | null) => void;
  setWalkRequests: (requests: WalkRequest[]) => void;
  acceptWalkRequest: (requestId: string) => void;
  declineWalkRequest: (requestId: string) => void;
  setActiveWalk: (walk: ActiveWalk | null) => void;
  updateActiveWalkLocation: (location: { latitude: number; longitude: number }) => void;
  addActiveWalkPhoto: (photoUri: string) => void;
  completeActiveWalk: () => void;
  setEarnings: (earnings: Earning[]) => void;
  setWalkerUpcomingWalks: (walks: Walk[]) => void;
  updateWalkerAvailability: (availability: Availability) => void;
}

const initialBookingData = {
  dogIds: [],
  duration: 30,
  walkType: 'standard' as const,
};

const defaultAvailability: Availability = {
  monday: { enabled: true, startTime: '09:00', endTime: '17:00' },
  tuesday: { enabled: true, startTime: '09:00', endTime: '17:00' },
  wednesday: { enabled: true, startTime: '09:00', endTime: '17:00' },
  thursday: { enabled: true, startTime: '09:00', endTime: '17:00' },
  friday: { enabled: true, startTime: '09:00', endTime: '17:00' },
  saturday: { enabled: false, startTime: '10:00', endTime: '14:00' },
  sunday: { enabled: false, startTime: '10:00', endTime: '14:00' },
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Initial state
      isLoggedIn: false,
      hasOnboarded: false,
      user: null,
      userType: 'owner',
      selectedWalker: null,
      selectedDog: null,
      selectedWalk: null,
      bookingData: initialBookingData,

      // Walker state
      walkerProfile: null,
      walkRequests: [],
      activeWalk: null,
      earnings: [],
      walkerUpcomingWalks: [],

      // Actions
      setLoggedIn: (value) => set({ isLoggedIn: value }),
      setHasOnboarded: (value) => set({ hasOnboarded: value }),
      setUser: (user) => set({ user }),
      setUserType: (type) => set({ userType: type }),
      setSelectedWalker: (walker) => set({ selectedWalker: walker }),
      setSelectedDog: (dog) => set({ selectedDog: dog }),
      setSelectedWalk: (walk) => set({ selectedWalk: walk }),
      updateBookingData: (data) =>
        set((state) => ({
          bookingData: { ...state.bookingData, ...data },
        })),
      resetBookingData: () => set({ bookingData: initialBookingData }),
      logout: () => {
        // Clear auth token from storage
        authStorage.clearToken();

        // Reset background task context to prevent location data leak
        resetBackgroundTaskContext();

        // Reset app state (persisted fields will also be cleared in storage)
        set({
          isLoggedIn: false,
          hasOnboarded: false,
          user: null,
          userType: 'owner',
          selectedWalker: null,
          selectedDog: null,
          selectedWalk: null,
          bookingData: initialBookingData,
          walkerProfile: null,
          walkRequests: [],
          activeWalk: null,
          earnings: [],
          walkerUpcomingWalks: [],
        });
      },

      // Walker actions
      setWalkerProfile: (profile) => set({ walkerProfile: profile }),
      setWalkRequests: (requests) => set({ walkRequests: requests }),
      acceptWalkRequest: (requestId) =>
        set((state) => ({
          walkRequests: state.walkRequests.filter((r) => r.id !== requestId),
        })),
      declineWalkRequest: (requestId) =>
        set((state) => ({
          walkRequests: state.walkRequests.filter((r) => r.id !== requestId),
        })),
      setActiveWalk: (walk) => set({ activeWalk: walk }),
      updateActiveWalkLocation: (location) =>
        set((state) => ({
          activeWalk: state.activeWalk
            ? {
                ...state.activeWalk,
                location,
                route: [...state.activeWalk.route, location],
              }
            : null,
        })),
      addActiveWalkPhoto: (photoUri) =>
        set((state) => ({
          activeWalk: state.activeWalk
            ? {
                ...state.activeWalk,
                photos: [...state.activeWalk.photos, photoUri],
              }
            : null,
        })),
      completeActiveWalk: () => set({ activeWalk: null }),
      setEarnings: (earnings) => set({ earnings }),
      setWalkerUpcomingWalks: (walks) => set({ walkerUpcomingWalks: walks }),
      updateWalkerAvailability: (availability) =>
        set((state) => ({
          walkerProfile: state.walkerProfile
            ? { ...state.walkerProfile, availability }
            : null,
        })),
    }),
    {
      name: 'packwalk-app-store',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist essential fields that should survive app restart
      partialize: (state) => ({
        hasOnboarded: state.hasOnboarded,
        userType: state.userType,
      }),
    }
  )
);

export default useAppStore;
