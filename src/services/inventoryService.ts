// src/services/inventoryService.ts - Corrected Implementation
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
  runTransaction,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  InventoryBatch, 
  InventorySource, 
  DeliveryForm,
  InventoryStats 
} from '../types';

export class InventoryService {
  private inventoryCollection = collection(db, 'inventory');
  private deliveriesCollection = collection(db, 'deliveries');

  // Create inventory batch from package
  async createInventoryFromPackage(
    packageData: any, 
    quantity: number = 1,
    userId: string
  ): Promise<string> {
    const batchData: Omit<InventoryBatch, 'id'> = {
      sku: packageData.sku || `AUTO-${Date.now()}`,
      productName: packageData.productName,
      totalQuantity: quantity,
      availableQuantity: quantity,
      reservedQuantity: 0,
      source: InventorySource.NEW_ARRIVAL,
      sourceReference: packageData.id,
      receivedDate: new Date().toISOString(),
      receivedBy: userId,
      batchNotes: `Created from package ${packageData.trackingNumber}`,
    };

    const docRef = await addDoc(this.inventoryCollection, {
      ...batchData,
      receivedDate: Timestamp.now(),
    });
    
    return docRef.id;
  }

  // Create inventory batch from return
  async createInventoryFromReturn(
    returnData: any,
    quantity: number,
    userId: string
  ): Promise<string> {
    const batchData: Omit<InventoryBatch, 'id'> = {
      sku: returnData.sku || `RETURN-${Date.now()}`,
      productName: returnData.productName,
      totalQuantity: quantity,
      availableQuantity: quantity,
      reservedQuantity: 0,
      source: InventorySource.FROM_RETURN,
      sourceReference: returnData.id,
      receivedDate: new Date().toISOString(),
      receivedBy: userId,
      batchNotes: `Created from return ${returnData.lpnNumber}`,
    };

    const docRef = await addDoc(this.inventoryCollection, {
      ...batchData,
      receivedDate: Timestamp.now(),
    });
    
    return docRef.id;
  }

  // Get inventory summary grouped by SKU
  async getInventorySummaryBySKU(): Promise<any[]> {
    const querySnapshot = await getDocs(
      query(this.inventoryCollection, orderBy('sku'))
    );
    
    const batches = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      receivedDate: doc.data().receivedDate?.toDate?.()?.toISOString() || new Date().toISOString(),
    })) as InventoryBatch[];

    // Group by SKU
    const skuGroups = batches.reduce((acc, batch) => {
      if (!acc[batch.sku]) {
        acc[batch.sku] = {
          sku: batch.sku,
          productName: batch.productName,
          totalAvailable: 0,
          totalReserved: 0,
          batches: [],
          sources: {
            newArrivals: 0,
            fromReturns: 0,
          },
        };
      }
      
      acc[batch.sku].totalAvailable += batch.availableQuantity;
      acc[batch.sku].totalReserved += batch.reservedQuantity;
      acc[batch.sku].batches.push(batch);
      
      if (batch.source === InventorySource.NEW_ARRIVAL) {
        acc[batch.sku].sources.newArrivals += batch.availableQuantity;
      } else {
        acc[batch.sku].sources.fromReturns += batch.availableQuantity;
      }
      
      return acc;
    }, {} as Record<string, any>);

    return Object.values(skuGroups);
  }

  // Get available inventory for specific SKU
  async getAvailableInventoryForSKU(sku: string): Promise<InventoryBatch[]> {
    const querySnapshot = await getDocs(
      query(
        this.inventoryCollection,
        where('sku', '==', sku),
        where('availableQuantity', '>', 0),
        orderBy('receivedDate')
      )
    );
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      receivedDate: doc.data().receivedDate?.toDate?.()?.toISOString() || new Date().toISOString(),
    })) as InventoryBatch[];
  }

  // Get inventory batch by ID
  async getInventoryBatchById(id: string): Promise<InventoryBatch | null> {
    const docRef = doc(db, 'inventory', id);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        receivedDate: data.receivedDate?.toDate?.()?.toISOString() || new Date().toISOString(),
      } as InventoryBatch;
    }
    
    return null;
  }

  // Reserve inventory for delivery
  async reserveInventory(batchId: string, quantity: number): Promise<void> {
    return runTransaction(db, async (transaction) => {
      const batchRef = doc(db, 'inventory', batchId);
      const batchDoc = await transaction.get(batchRef);
      
      if (!batchDoc.exists()) {
        throw new Error('Inventory batch not found');
      }
      
      const batch = batchDoc.data() as InventoryBatch;
      
      if (batch.availableQuantity < quantity) {
        throw new Error('Insufficient inventory available');
      }
      
      transaction.update(batchRef, {
        availableQuantity: batch.availableQuantity - quantity,
        reservedQuantity: batch.reservedQuantity + quantity,
      });
    });
  }

  // Deliver items (remove from inventory)
  async deliverItems(deliveryData: DeliveryForm, userId: string): Promise<string> {
    return runTransaction(db, async (transaction) => {
      const batchRef = doc(db, 'inventory', deliveryData.inventoryBatchId);
      const batchDoc = await transaction.get(batchRef);
      
      if (!batchDoc.exists()) {
        throw new Error('Inventory batch not found');
      }
      
      const batch = batchDoc.data() as InventoryBatch;
      
      if (batch.availableQuantity < 1) {
        throw new Error('No inventory available for delivery');
      }
      
      // Create delivery record
      const deliveryRecord = {
        ...deliveryData,
        deliveryDate: new Date().toISOString(),
        deliveredBy: userId,
        status: 'delivered',
        createdAt: Timestamp.now(),
      };
      
      const deliveryRef = doc(this.deliveriesCollection);
      transaction.set(deliveryRef, deliveryRecord);
      
      // Update inventory
      transaction.update(batchRef, {
        availableQuantity: batch.availableQuantity - 1,
      });
      
      return deliveryRef.id;
    });
  }

  // Search inventory
  async searchInventory(searchTerm: string): Promise<InventoryBatch[]> {
    const allInventory = await this.getAllInventoryBatches();
    
    const term = searchTerm.toLowerCase();
    return allInventory.filter(batch =>
      batch.sku.toLowerCase().includes(term) ||
      batch.productName.toLowerCase().includes(term) ||
      (batch.batchNotes && batch.batchNotes.toLowerCase().includes(term))
    );
  }

  // Search delivered items
  async searchDeliveredItems(searchTerm: string): Promise<any[]> {
    const querySnapshot = await getDocs(this.deliveriesCollection);
    const deliveries = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      deliveryDate: doc.data().deliveryDate || new Date().toISOString(),
    }));
    
    const term = searchTerm.toLowerCase();
    return deliveries.filter(delivery =>
      (delivery.shippingLabelData?.labelNumber && 
       delivery.shippingLabelData.labelNumber.toLowerCase().includes(term)) ||
      (delivery.customerInfo?.name && 
       delivery.customerInfo.name.toLowerCase().includes(term))
    );
  }

  // Get inventory statistics
  async getInventoryStats(): Promise<InventoryStats> {
    const allBatches = await this.getAllInventoryBatches();
    
    return {
      totalBatches: allBatches.length,
      totalAvailableItems: allBatches.reduce((sum, batch) => sum + batch.availableQuantity, 0),
      totalReservedItems: allBatches.reduce((sum, batch) => sum + batch.reservedQuantity, 0),
      newArrivals: allBatches
        .filter(batch => batch.source === InventorySource.NEW_ARRIVAL)
        .reduce((sum, batch) => sum + batch.availableQuantity, 0),
      fromReturns: allBatches
        .filter(batch => batch.source === InventorySource.FROM_RETURN)
        .reduce((sum, batch) => sum + batch.availableQuantity, 0),
      uniqueSKUs: new Set(allBatches.map(batch => batch.sku)).size,
    };
  }

  // Get all inventory batches
  private async getAllInventoryBatches(): Promise<InventoryBatch[]> {
    const querySnapshot = await getDocs(
      query(this.inventoryCollection, orderBy('receivedDate', 'desc'))
    );
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      receivedDate: doc.data().receivedDate?.toDate?.()?.toISOString() || new Date().toISOString(),
    })) as InventoryBatch[];
  }

  // Update inventory batch
  async updateInventoryBatch(id: string, updates: Partial<InventoryBatch>): Promise<void> {
    const docRef = doc(db, 'inventory', id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: Timestamp.now(),
    });
  }

  // Delete inventory batch
  async deleteInventoryBatch(id: string): Promise<void> {
    const docRef = doc(db, 'inventory', id);
    await deleteDoc(docRef);
  }

  // Get low stock items
  async getLowStockItems(threshold: number = 5): Promise<InventoryBatch[]> {
    const allBatches = await this.getAllInventoryBatches();
    return allBatches.filter(batch => batch.availableQuantity <= threshold);
  }

  // Get inventory activity log
  async getInventoryActivityLog(batchId: string): Promise<any[]> {
    // This would require implementing an activity log collection
    // For now, return basic info
    const batch = await this.getInventoryBatchById(batchId);
    if (!batch) return [];
    
    return [
      {
        action: 'Inventory Created',
        timestamp: batch.receivedDate,
        user: batch.receivedBy,
        details: `Source: ${batch.source}`,
      },
    ];
  }
}

export const inventoryService = new InventoryService();