// stores/healthStore.ts
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { testHealth } from '@/services/healthCheckService';

interface HealthState {
  status: 'ok' | 'error' | null;
  loading: boolean;
  fetchHealth: () => Promise<void>;
}

export const useHealthStore = create<HealthState>()(
  devtools((set) => ({
    status: null,
    loading: false,
    fetchHealth: async () => {
      set({ loading: true });
      try {
        const res = await testHealth();
        set({ status: res.data.status === 'ok' ? 'ok' : 'error', loading: false });
      } catch (err) {
        set({ status: 'error', loading: false });
      }
    },
  }))
);