// src/services/packageService.ts
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc, // <-- Make sure 'doc' is here
  getDocs,
  getDoc, // <-- Make sure 'getDoc' is here
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Package, ReceivePackageForm, PackageStatus } from '../types';
import { inventoryService } from './inventoryService'; // Import the inventory service

export class PackageService {
  private collectionRef = collection(db, 'packages');

  // Create a new package and a corresponding inventory batch - UPDATED
  async createPackage(formData: ReceivePackageForm, userId: string): Promise<string> {
    // 1. Create the main package document (as a record of the shipment)
    const packageData = {
      trackingNumber: formData.trackingNumber,
      carrier: formData.carrier,
      productName: formData.productName,
      sku: formData.sku,
      notes: formData.notes,
      status: 'received' as PackageStatus,
      receivedDate: new Date().toISOString(),
      receivedBy: userId,
      createdAt: Timestamp.now(),
    };
    const docRef = await addDoc(this.collectionRef, packageData);

    // 2. Create the corresponding inventory batch with the specified quantity
    await inventoryService.createInventoryFromPackage(
      { id: docRef.id, ...formData }, // Pass the full form data
      formData.quantity,              // Pass the quantity
      userId
    );

    return docRef.id;
  }

  // Update package details
  async updatePackage(id: string, updates: Partial<Package>): Promise<void> {
    const docRef = doc(db, 'packages', id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: Timestamp.now(),
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

  // Search packages
  async searchPackages(searchTerm: string): Promise<Package[]> {
    const allPackages = await this.getAllPackages();

    return allPackages.filter(pkg =>
      pkg.trackingNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pkg.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (pkg.sku && pkg.sku.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }

  // Get today's statistics
  async getTodayStats(): Promise<{
    received: number;
    dispatched: number;
    ready: number;
    total: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const allPackages = await this.getAllPackages();
    const todayStr = today.toISOString().split('T')[0];

    return {
      received: allPackages.filter(pkg =>
        pkg.receivedDate?.startsWith(todayStr)
      ).length,
      // NOTE: You'll need to add dispatchDate to the Package type to use this
      dispatched: 0, // Placeholder
      ready: allPackages.filter(pkg =>
        pkg.status === 'ready'
      ).length,
      total: allPackages.length,
    };
  }
// Get a single package by its ID
// Get a single package by its ID
async getPackageById(id: string): Promise<Package | null> {
  const docRef = doc(this.collectionRef, id);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    const data = docSnap.data();
    // Ensure date fields are converted to string format if they are Timestamps
    const receivedDate = data.receivedDate?.toDate?.()?.toISOString() || data.receivedDate;
    const labeledDate = data.labeledDate?.toDate?.()?.toISOString() || data.labeledDate;
    const dispatchDate = data.dispatchDate?.toDate?.()?.toISOString() || data.dispatchDate;

    return {
      id: docSnap.id,
      ...data,
      receivedDate,
      labeledDate,
      dispatchDate,
    } as unknown as Package; // <-- THIS IS THE FIX
  }
  return null;
}
}


export const packageService = new PackageService();