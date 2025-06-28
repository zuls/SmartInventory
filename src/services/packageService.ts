// src/services/packageService.ts
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Package, ReceivePackageForm, PackageStatus } from '../types';

export class PackageService {
  private collectionRef = collection(db, 'packages');

  // Create a new package
  async createPackage(formData: ReceivePackageForm, userId: string): Promise<string> {
    const packageData = {
      ...formData,
      status: 'received' as PackageStatus,
      receivedDate: new Date().toISOString(),
      receivedBy: userId,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    const docRef = await addDoc(this.collectionRef, packageData);
    return docRef.id;
  }

  // Update package
  async updatePackage(id: string, updates: Partial<Package>): Promise<void> {
    const docRef = doc(db, 'packages', id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: Timestamp.now(),
    });
  }

  // Assign label to package
  async assignLabel(id: string, label: string, userId: string): Promise<void> {
    await this.updatePackage(id, {
      label,
      status: 'ready' as PackageStatus,
      labeledDate: new Date().toISOString(),
      labeledBy: userId,
    });
  }

  // Mark package as dispatched
  async dispatchPackage(id: string, dispatchCarrier: string, userId: string): Promise<void> {
    await this.updatePackage(id, {
      status: 'dispatched' as PackageStatus,
      dispatchDate: new Date().toISOString(),
      dispatchCarrier,
      dispatchedBy: userId,
    });
  }

  // Get all packages
  async getAllPackages(): Promise<Package[]> {
    const querySnapshot = await getDocs(
      query(this.collectionRef, orderBy('receivedDate', 'desc'))
    );
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Package[];
  }

  // Get packages by status
  async getPackagesByStatus(status: PackageStatus): Promise<Package[]> {
    const querySnapshot = await getDocs(
      query(
        this.collectionRef,
        where('status', '==', status),
        orderBy('receivedDate', 'desc')
      )
    );
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Package[];
  }

  // Search packages
  async searchPackages(searchTerm: string): Promise<Package[]> {
    // Note: Firestore doesn't support full-text search natively
    // For production, consider using Algolia or similar service
    const allPackages = await this.getAllPackages();
    
    return allPackages.filter(pkg =>
      pkg.trackingNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pkg.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (pkg.sku && pkg.sku.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (pkg.barcode && pkg.barcode.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }

  // Get today's statistics
  async getTodayStats(): Promise<{
    received: number;
    dispatched: number;
    ready: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    const allPackages = await this.getAllPackages();
    
    return {
      received: allPackages.filter(pkg => 
        pkg.receivedDate?.startsWith(todayStr)
      ).length,
      dispatched: allPackages.filter(pkg => 
        pkg.dispatchDate?.startsWith(todayStr)
      ).length,
      ready: allPackages.filter(pkg => 
        pkg.status === 'ready'
      ).length,
    };
  }
}

export const packageService = new PackageService();