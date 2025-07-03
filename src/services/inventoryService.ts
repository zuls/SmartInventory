// src/services/packageService.ts - Enhanced Implementation
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  Package, 
  ReceivePackageForm, 
  PackageStatus, 
  Carrier,
  DashboardStats 
} from '../types';

export class PackageService {
  private packagesCollection = collection(db, 'packages');

  // Create a new package
  async createPackage(formData: ReceivePackageForm, userId: string): Promise<string> {
    const packageData: Omit<Package, 'id'> = {
      ...formData,
      status: PackageStatus.RECEIVED,
      receivedDate: new Date().toISOString(),
      receivedBy: userId,
      driveFiles: [],
    };

    const docRef = await addDoc(this.packagesCollection, {
      ...packageData,
      receivedDate: Timestamp.now(),
    });
    
    return docRef.id;
  }

  // Get all packages
  async getAllPackages(): Promise<Package[]> {
    const querySnapshot = await getDocs(
      query(this.packagesCollection, orderBy('receivedDate', 'desc'))
    );
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      receivedDate: doc.data().receivedDate?.toDate?.()?.toISOString() || new Date().toISOString(),
      labeledDate: doc.data().labeledDate?.toDate?.()?.toISOString(),
      dispatchDate: doc.data().dispatchDate?.toDate?.()?.toISOString(),
    })) as Package[];
  }

  // Get package by ID
  async getPackageById(id: string): Promise<Package | null> {
    const docRef = doc(db, 'packages', id);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        receivedDate: data.receivedDate?.toDate?.()?.toISOString() || new Date().toISOString(),
        labeledDate: data.labeledDate?.toDate?.()?.toISOString(),
        dispatchDate: data.dispatchDate?.toDate?.()?.toISOString(),
      } as Package;
    }
    
    return null;
  }

  // Update package
  async updatePackage(id: string, updates: Partial<Package>): Promise<void> {
    const docRef = doc(db, 'packages', id);
    
    // Convert date strings to Timestamps where needed
    const updateData = { ...updates };
    if (updates.labeledDate) {
      updateData.labeledDate = Timestamp.fromDate(new Date(updates.labeledDate));
    }
    if (updates.dispatchDate) {
      updateData.dispatchDate = Timestamp.fromDate(new Date(updates.dispatchDate));
    }
    
    await updateDoc(docRef, updateData);
  }

  // Delete package
  async deletePackage(id: string): Promise<void> {
    const docRef = doc(db, 'packages', id);
    await deleteDoc(docRef);
  }

  // Get packages by status
  async getPackagesByStatus(status: PackageStatus): Promise<Package[]> {
    const querySnapshot = await getDocs(
      query(
        this.packagesCollection,
        where('status', '==', status),
        orderBy('receivedDate', 'desc')
      )
    );
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      receivedDate: doc.data().receivedDate?.toDate?.()?.toISOString() || new Date().toISOString(),
      labeledDate: doc.data().labeledDate?.toDate?.()?.toISOString(),
      dispatchDate: doc.data().dispatchDate?.toDate?.()?.toISOString(),
    })) as Package[];
  }

  // Get packages by carrier
  async getPackagesByCarrier(carrier: Carrier): Promise<Package[]> {
    const querySnapshot = await getDocs(
      query(
        this.packagesCollection,
        where('carrier', '==', carrier),
        orderBy('receivedDate', 'desc')
      )
    );
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      receivedDate: doc.data().receivedDate?.toDate?.()?.toISOString() || new Date().toISOString(),
      labeledDate: doc.data().labeledDate?.toDate?.()?.toISOString(),
      dispatchDate: doc.data().dispatchDate?.toDate?.()?.toISOString(),
    })) as Package[];
  }

  // Search packages
  async searchPackages(searchTerm: string): Promise<Package[]> {
    const allPackages = await this.getAllPackages();
    
    const term = searchTerm.toLowerCase();
    return allPackages.filter(pkg =>
      pkg.trackingNumber.toLowerCase().includes(term) ||
      pkg.productName.toLowerCase().includes(term) ||
      (pkg.sku && pkg.sku.toLowerCase().includes(term)) ||
      (pkg.barcode && pkg.barcode.toLowerCase().includes(term)) ||
      (pkg.label && pkg.label.toLowerCase().includes(term)) ||
      (pkg.notes && pkg.notes.toLowerCase().includes(term))
    );
  }

  // Label package
  async labelPackage(id: string, label: string, userId: string): Promise<void> {
    await this.updatePackage(id, {
      status: PackageStatus.LABELED,
      label,
      labeledDate: new Date().toISOString(),
      labeledBy: userId,
    });
  }

  // Mark package as ready for dispatch
  async markAsReady(id: string, userId: string): Promise<void> {
    await this.updatePackage(id, {
      status: PackageStatus.READY,
      labeledBy: userId,
    });
  }

  // Dispatch package
  async dispatchPackage(
    id: string, 
    dispatchCarrier: string, 
    userId: string
  ): Promise<void> {
    await this.updatePackage(id, {
      status: PackageStatus.DISPATCHED,
      dispatchDate: new Date().toISOString(),
      dispatchCarrier,
      dispatchedBy: userId,
    });
  }

  // Get today's package statistics
  async getTodayStats(): Promise<{
    received: number;
    labeled: number;
    ready: number;
    dispatched: number;
    total: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    const allPackages = await this.getAllPackages();
    
    return {
      received: allPackages.filter(pkg => 
        pkg.receivedDate && pkg.receivedDate.startsWith(todayStr)
      ).length,
      labeled: allPackages.filter(pkg => 
        pkg.labeledDate && pkg.labeledDate.startsWith(todayStr)
      ).length,
      ready: allPackages.filter(pkg => 
        pkg.status === PackageStatus.READY
      ).length,
      dispatched: allPackages.filter(pkg => 
        pkg.dispatchDate && pkg.dispatchDate.startsWith(todayStr)
      ).length,
      total: allPackages.length,
    };
  }

  // Get packages received today
  async getTodayPackages(): Promise<Package[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = Timestamp.fromDate(today);

    const querySnapshot = await getDocs(
      query(
        this.packagesCollection,
        where('receivedDate', '>=', todayTimestamp),
        orderBy('receivedDate', 'desc')
      )
    );
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      receivedDate: doc.data().receivedDate?.toDate?.()?.toISOString() || new Date().toISOString(),
      labeledDate: doc.data().labeledDate?.toDate?.()?.toISOString(),
      dispatchDate: doc.data().dispatchDate?.toDate?.()?.toISOString(),
    })) as Package[];
  }

  // Get packages by date range
  async getPackagesByDateRange(startDate: string, endDate: string): Promise<Package[]> {
    const start = Timestamp.fromDate(new Date(startDate));
    const end = Timestamp.fromDate(new Date(endDate + 'T23:59:59'));

    const querySnapshot = await getDocs(
      query(
        this.packagesCollection,
        where('receivedDate', '>=', start),
        where('receivedDate', '<=', end),
        orderBy('receivedDate', 'desc')
      )
    );
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      receivedDate: doc.data().receivedDate?.toDate?.()?.toISOString() || new Date().toISOString(),
      labeledDate: doc.data().labeledDate?.toDate?.()?.toISOString(),
      dispatchDate: doc.data().dispatchDate?.toDate?.()?.toISOString(),
    })) as Package[];
  }

  // Get weekly trends
  async getWeeklyTrends(): Promise<{
    received: number[];
    dispatched: number[];
    labels: string[];
  }> {
    const today = new Date();
    const weekData = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayPackages = await this.getPackagesByDateRange(dateStr, dateStr);
      
      weekData.push({
        date: dateStr,
        received: dayPackages.length,
        dispatched: dayPackages.filter(pkg => pkg.status === PackageStatus.DISPATCHED).length,
        label: date.toLocaleDateString('en-US', { weekday: 'short' }),
      });
    }
    
    return {
      received: weekData.map(d => d.received),
      dispatched: weekData.map(d => d.dispatched),
      labels: weekData.map(d => d.label),
    };
  }

  // Get carrier statistics
  async getCarrierStats(): Promise<{
    carrier: string;
    count: number;
    percentage: number;
  }[]> {
    const allPackages = await this.getAllPackages();
    const carrierCounts = allPackages.reduce((acc, pkg) => {
      acc[pkg.carrier] = (acc[pkg.carrier] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const total = allPackages.length;
    
    return Object.entries(carrierCounts).map(([carrier, count]) => ({
      carrier,
      count,
      percentage: Math.round((count / total) * 100),
    })).sort((a, b) => b.count - a.count);
  }

  // Get packages needing attention
  async getPackagesNeedingAttention(): Promise<{
    pendingLabels: Package[];
    readyForDispatch: Package[];
    overduePackages: Package[];
  }> {
    const allPackages = await this.getAllPackages();
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    
    return {
      pendingLabels: allPackages.filter(pkg => pkg.status === PackageStatus.RECEIVED),
      readyForDispatch: allPackages.filter(pkg => pkg.status === PackageStatus.READY),
      overduePackages: allPackages.filter(pkg => 
        pkg.status !== PackageStatus.DISPATCHED && 
        new Date(pkg.receivedDate) < twoDaysAgo
      ),
    };
  }

  // Bulk operations
  async bulkUpdatePackages(
    packageIds: string[], 
    updates: Partial<Package>
  ): Promise<void> {
    const updatePromises = packageIds.map(id => this.updatePackage(id, updates));
    await Promise.all(updatePromises);
  }

  // Real-time package updates
  subscribeToPackageUpdates(callback: (packages: Package[]) => void): () => void {
    const unsubscribe = onSnapshot(
      query(this.packagesCollection, orderBy('receivedDate', 'desc')),
      (snapshot) => {
        const packages = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          receivedDate: doc.data().receivedDate?.toDate?.()?.toISOString() || new Date().toISOString(),
          labeledDate: doc.data().labeledDate?.toDate?.()?.toISOString(),
          dispatchDate: doc.data().dispatchDate?.toDate?.()?.toISOString(),
        })) as Package[];
        
        callback(packages);
      },
      (error) => {
        console.error('Error in package subscription:', error);
      }
    );
    
    return unsubscribe;
  }

  // Check for duplicate tracking numbers
  async checkDuplicateTracking(trackingNumber: string): Promise<boolean> {
    const querySnapshot = await getDocs(
      query(
        this.packagesCollection,
        where('trackingNumber', '==', trackingNumber),
        limit(1)
      )
    );
    
    return !querySnapshot.empty;
  }

  // Get package activity log
  async getPackageActivityLog(id: string): Promise<{
    action: string;
    timestamp: string;
    user: string;
    details?: string;
  }[]> {
    const pkg = await this.getPackageById(id);
    if (!pkg) return [];
    
    const activities = [];
    
    // Received
    activities.push({
      action: 'Package Received',
      timestamp: pkg.receivedDate,
      user: pkg.receivedBy,
      details: `Carrier: ${pkg.carrier}`,
    });
    
    // Labeled
    if (pkg.labeledDate && pkg.labeledBy) {
      activities.push({
        action: 'Package Labeled',
        timestamp: pkg.labeledDate,
        user: pkg.labeledBy,
        details: pkg.label ? `Label: ${pkg.label}` : undefined,
      });
    }
    
    // Dispatched
    if (pkg.dispatchDate && pkg.dispatchedBy) {
      activities.push({
        action: 'Package Dispatched',
        timestamp: pkg.dispatchDate,
        user: pkg.dispatchedBy,
        details: pkg.dispatchCarrier ? `Carrier: ${pkg.dispatchCarrier}` : undefined,
      });
    }
    
    return activities.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }
}

export const packageService = new PackageService();