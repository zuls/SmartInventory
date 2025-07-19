// src/stores/inventoryStore.ts
import { create } from 'zustand';
import { Package, Return, StockLog, DashboardStats } from '../types';

interface InventoryState {
  packages: Package[];
  returns: Return[];
  stockLogs: StockLog[];
  stats: DashboardStats | null;
  loading: boolean;
  error: string | null;
  
  // Actions
  setPackages: (packages: Package[]) => void;
  addPackage: (package_: Package) => void;
  updatePackage: (id: string, updates: Partial<Package>) => void;
  setReturns: (returns: Return[]) => void;
  addReturn: (return_: Return) => void;
  setStockLogs: (logs: StockLog[]) => void;
  addStockLog: (log: StockLog) => void;
  setStats: (stats: DashboardStats) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useInventoryStore = create<InventoryState>((set, get) => ({
  packages: [],
  returns: [],
  stockLogs: [],
  stats: null,
  loading: false,
  error: null,

  setPackages: (packages) => set({ packages }),
  addPackage: (package_) => set({ packages: [...get().packages, package_] }),
  updatePackage: (id, updates) => set({
    packages: get().packages.map(pkg => 
      pkg.id === id ? { ...pkg, ...updates } : pkg
    )
  }),
  setReturns: (returns) => set({ returns }),
  addReturn: (return_) => set({ returns: [...get().returns, return_] }),
  setStockLogs: (stockLogs) => set({ stockLogs }),
  addStockLog: (log) => set({ stockLogs: [...get().stockLogs, log] }),
  setStats: (stats) => set({ stats }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));