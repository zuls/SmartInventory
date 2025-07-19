// src/services/inventoryService.ts - Corrected Version
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
  Timestamp,
  runTransaction,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  InventoryBatch, 
  InventorySource, 
  DeliveryForm,
  InventoryStats,
  SerialNumberItem,
  InventoryItemStatus,
  SerialNumberValidation,
  SerialNumberHistory,
  BulkSerialNumberForm,
  DeliveryWithSerialNumber,
  InventoryItemWithDetails,
  BulkOperation,
  ReceivePackageForm, // <-- FIX: Added missing import
  Return,
} from '../types';

export class InventoryService {
  private inventoryCollection = collection(db, 'inventory');
  private serialNumberItemsCollection = collection(db, 'serialNumberItems');
  private deliveriesCollection = collection(db, 'deliveries');
  private serialNumberHistoryCollection = collection(db, 'serialNumberHistory');
  private bulkOperationsCollection = collection(db, 'bulkOperations');

  // ==================== BULK INVENTORY CREATION ====================
  
  async createInventoryFromPackage(
    packageData: ReceivePackageForm & { id: string }, // <-- FIX: Corrected type for packageData
    quantity: number = 1,
    userId: string,
    preAssignedSerialNumbers: string[] = []
  ): Promise<{ batchId: string; itemIds: string[] }> {
    const batch = writeBatch(db);
    
    const batchData: Omit<InventoryBatch, 'id'> = {
      sku: packageData.sku || `AUTO-${Date.now()}`,
      productName: packageData.productName,
      totalQuantity: quantity,
      availableQuantity: quantity,
      reservedQuantity: 0,
      deliveredQuantity: 0,
      returnedQuantity: 0,
      source: InventorySource.NEW_ARRIVAL,
      sourceReference: packageData.id,
      receivedDate: new Date().toISOString(),
      receivedBy: userId,
      batchNotes: `Created from package ${packageData.trackingNumber}`,
      serialNumbersAssigned: preAssignedSerialNumbers.length,
      serialNumbersUnassigned: quantity - preAssignedSerialNumbers.length,
    };

    const batchRef = doc(this.inventoryCollection);
    batch.set(batchRef, {
      ...batchData,
      receivedDate: Timestamp.now(),
    });

    const itemIds: string[] = [];
    for (let i = 0; i < quantity; i++) {
      const itemRef = doc(this.serialNumberItemsCollection);
      const hasSerialNumber = i < preAssignedSerialNumbers.length;
      
      const itemData: Omit<SerialNumberItem, 'id'> = {
        batchId: batchRef.id,
        serialNumber: hasSerialNumber ? preAssignedSerialNumbers[i] : undefined,
        status: InventoryItemStatus.AVAILABLE,
        assignedDate: hasSerialNumber ? new Date().toISOString() : undefined,
        assignedBy: hasSerialNumber ? userId : undefined,
        createdAt: new Date().toISOString(),
        notes: `Item ${i + 1} of ${quantity} from package ${packageData.trackingNumber}`,
      };

      batch.set(itemRef, {
        ...itemData,
        createdAt: Timestamp.now(),
        assignedDate: hasSerialNumber ? Timestamp.now() : undefined, // <-- FIX: Changed null to undefined
      });

      itemIds.push(itemRef.id);

      if (hasSerialNumber) {
        const historyRef = doc(this.serialNumberHistoryCollection);
        batch.set(historyRef, {
          serialNumber: preAssignedSerialNumbers[i],
          itemId: itemRef.id,
          action: 'assigned',
          actionDate: Timestamp.now(),
          actionBy: userId,
          details: `Serial number assigned during package creation`,
          referenceId: packageData.id,
        });
      }
    }

    await batch.commit();
    
    return { batchId: batchRef.id, itemIds };
  }

  async createInventoryFromReturn(
    returnData: Return, // <-- FIX: Corrected type for returnData
    quantity: number,
    userId: string,
    serialNumber?: string
  ): Promise<{ batchId: string; itemIds: string[] }> {
    const batch = writeBatch(db);
    
    const batchData: Omit<InventoryBatch, 'id'> = {
      sku: returnData.sku || `RETURN-${Date.now()}`,
      productName: returnData.productName,
      totalQuantity: quantity,
      availableQuantity: quantity,
      reservedQuantity: 0,
      deliveredQuantity: 0,
      returnedQuantity: 0,
      source: InventorySource.FROM_RETURN,
      sourceReference: returnData.id,
      receivedDate: new Date().toISOString(),
      receivedBy: userId,
      batchNotes: `Created from return ${returnData.lpnNumber}`,
      serialNumbersAssigned: serialNumber ? 1 : 0,
      serialNumbersUnassigned: serialNumber ? quantity - 1 : quantity,
    };

    const batchRef = doc(this.inventoryCollection);
    batch.set(batchRef, {
      ...batchData,
      receivedDate: Timestamp.now(),
    });

    const itemIds: string[] = [];
    for (let i = 0; i < quantity; i++) {
      const itemRef = doc(this.serialNumberItemsCollection);
      const hasSerialNumber = i === 0 && serialNumber;
      
      const itemData: Omit<SerialNumberItem, 'id'> = {
        batchId: batchRef.id,
        serialNumber: hasSerialNumber ? serialNumber : undefined,
        status: InventoryItemStatus.RETURNED,
        assignedDate: hasSerialNumber ? new Date().toISOString() : undefined,
        assignedBy: hasSerialNumber ? userId : undefined,
        returnId: returnData.id,
        createdAt: new Date().toISOString(),
        notes: `Item ${i + 1} of ${quantity} from return ${returnData.lpnNumber}`,
      };

      batch.set(itemRef, {
        ...itemData,
        createdAt: Timestamp.now(),
        assignedDate: hasSerialNumber ? Timestamp.now() : undefined, // <-- FIX: Changed null to undefined
      });

      itemIds.push(itemRef.id);
    }

    await batch.commit();
    
    return { batchId: batchRef.id, itemIds };
  }

  // ==================== SERIAL NUMBER MANAGEMENT ====================

  async validateSerialNumber(serialNumber: string): Promise<SerialNumberValidation> {
    const q = query(
      this.serialNumberItemsCollection,
      where('serialNumber', '==', serialNumber),
      limit(1)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return { exists: false };
    }

    const itemDoc = querySnapshot.docs[0];
    const item = {
      id: itemDoc.id,
      ...itemDoc.data(),
      createdAt: itemDoc.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      assignedDate: itemDoc.data().assignedDate?.toDate?.()?.toISOString(),
    } as SerialNumberItem;

    const batch = await this.getInventoryBatchById(item.batchId);
    
    // FIX: getReturnHistoryForItem is not implemented, returning empty array for now
    const returnHistory: Return[] = []; 
    
    return {
      exists: true,
      item,
      batch: batch || undefined,
      productName: batch?.productName,
      sku: batch?.sku,
      currentStatus: item.status,
      returnHistory,
    };
  }

  async assignSerialNumber(
    itemId: string,
    serialNumber: string,
    userId: string,
    notes?: string
  ): Promise<void> {
    const validation = await this.validateSerialNumber(serialNumber);
    if (validation.exists) {
      throw new Error(`Serial number ${serialNumber} already exists in the system`);
    }

    await runTransaction(db, async (transaction) => { // <-- FIX: Added await
      const itemRef = doc(this.serialNumberItemsCollection, itemId);
      const itemDoc = await transaction.get(itemRef);
      
      if (!itemDoc.exists()) {
        throw new Error('Item not found');
      }

      const item = itemDoc.data() as SerialNumberItem;
      
      if (item.serialNumber) {
        throw new Error('Item already has a serial number assigned');
      }

      transaction.update(itemRef, {
        serialNumber,
        assignedDate: Timestamp.now(),
        assignedBy: userId,
        notes: notes || item.notes,
      });

      const batchRef = doc(this.inventoryCollection, item.batchId);
      const batchDoc = await transaction.get(batchRef); // <-- FIX: Added await
      
      if (batchDoc.exists()) {
        const batch = batchDoc.data() as InventoryBatch;
        transaction.update(batchRef, {
          serialNumbersAssigned: (batch.serialNumbersAssigned || 0) + 1, // <-- FIX: Handle potential undefined value
          serialNumbersUnassigned: (batch.serialNumbersUnassigned || 0) - 1, // <-- FIX: Handle potential undefined value
        });
      }

      const historyRef = doc(this.serialNumberHistoryCollection);
      transaction.set(historyRef, {
        serialNumber,
        itemId,
        action: 'assigned',
        actionDate: Timestamp.now(),
        actionBy: userId,
        details: notes || `Serial number assigned to item`,
      });
    });
  }
  
  async bulkAssignSerialNumbers(
    formData: BulkSerialNumberForm
  ): Promise<{ successful: number; failed: number; errors: string[] }> {
    const results = {
      successful: 0,
      failed: 0,
      errors: [] as string[],
    };

    const bulkOpData: Omit<BulkOperation, 'id'> = {
      type: 'serial_number_assignment',
      itemIds: formData.serialNumbers.map(sn => sn.itemId),
      status: 'in_progress',
      createdBy: formData.assignedBy,
      createdAt: new Date().toISOString(),
    };
    const bulkOpRef = await addDoc(this.bulkOperationsCollection, bulkOpData);

    for (const { itemId, serialNumber } of formData.serialNumbers) {
      try {
        await this.assignSerialNumber(itemId, serialNumber, formData.assignedBy, formData.notes);
        results.successful++;
      } catch (error) {
        results.failed++;
        results.errors.push(`Item ${itemId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    await updateDoc(doc(this.bulkOperationsCollection, bulkOpRef.id), {
      status: 'completed',
      completedAt: Timestamp.now(),
      results,
    });

    return results;
  }

  // ==================== DELIVERY MANAGEMENT ====================

  async getAvailableItemsForDelivery(sku: string): Promise<SerialNumberItem[]> {
    const batchQuery = query(
      this.inventoryCollection,
      where('sku', '==', sku),
      where('availableQuantity', '>', 0)
    );
    
    const batchSnapshot = await getDocs(batchQuery);
    if (batchSnapshot.empty) {
      return [];
    }

    const batchIds = batchSnapshot.docs.map(doc => doc.id);

    const itemsQuery = query(
      this.serialNumberItemsCollection,
      where('batchId', 'in', batchIds),
      where('status', '==', InventoryItemStatus.AVAILABLE),
      orderBy('createdAt')
    );

    const itemsSnapshot = await getDocs(itemsQuery);
    
    return itemsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      assignedDate: doc.data().assignedDate?.toDate?.()?.toISOString(),
    })) as SerialNumberItem[];
  }

  async deliverItemWithSerialNumber(
    deliveryData: DeliveryForm,
    userId: string
  ): Promise<DeliveryWithSerialNumber> {
    return runTransaction(db, async (transaction) => {
      let selectedItem: SerialNumberItem;
      let itemRef;

      if (deliveryData.selectedItemId) {
        itemRef = doc(this.serialNumberItemsCollection, deliveryData.selectedItemId);
        const itemDoc = await transaction.get(itemRef);
        
        if (!itemDoc.exists()) {
          throw new Error('Selected item not found');
        }
        
        selectedItem = {
          id: itemDoc.id,
          ...itemDoc.data(),
        } as SerialNumberItem;
      } else {
        const batchRef = doc(this.inventoryCollection, deliveryData.inventoryBatchId);
        const batchDoc = await transaction.get(batchRef);
        
        if (!batchDoc.exists()) {
          throw new Error('Inventory batch not found');
        }

        const batch = batchDoc.data() as InventoryBatch;
        if (batch.availableQuantity < 1) {
          throw new Error('No items available for delivery');
        }

        const availableItemsQuery = query(
          this.serialNumberItemsCollection,
          where('batchId', '==', deliveryData.inventoryBatchId),
          where('status', '==', InventoryItemStatus.AVAILABLE),
          limit(1)
        );
        const availableItemsSnapshot = await getDocs(availableItemsQuery);
        if (availableItemsSnapshot.empty) {
          throw new Error('No available items found');
        }
        const itemDoc = availableItemsSnapshot.docs[0];
        selectedItem = { id: itemDoc.id, ...itemDoc.data() } as SerialNumberItem;
        itemRef = itemDoc.ref;
      }

      if (deliveryData.productSerialNumber && !selectedItem.serialNumber) {
        const validation = await this.validateSerialNumber(deliveryData.productSerialNumber);
        if (validation.exists) {
          throw new Error(`Serial number ${deliveryData.productSerialNumber} already exists`);
        }

        transaction.update(itemRef, {
          serialNumber: deliveryData.productSerialNumber,
          assignedDate: Timestamp.now(),
          assignedBy: userId,
        });
        selectedItem.serialNumber = deliveryData.productSerialNumber;
      }

      if (!selectedItem.serialNumber && !deliveryData.productSerialNumber) {
        throw new Error('Item must have a serial number before delivery');
      }

      const deliveryRef = doc(collection(db, 'deliveries'));
      const deliveryRecord = {
        itemId: selectedItem.id,
        batchId: selectedItem.batchId,
        serialNumber: selectedItem.serialNumber || deliveryData.productSerialNumber,
        ...deliveryData,
        deliveredBy: userId,
        status: 'delivered',
        createdAt: Timestamp.now(),
      };
      transaction.set(deliveryRef, deliveryRecord);

      transaction.update(itemRef, {
        status: InventoryItemStatus.DELIVERED,
        deliveryId: deliveryRef.id,
        updatedAt: Timestamp.now(),
      });

      const batchRef = doc(this.inventoryCollection, selectedItem.batchId);
      transaction.update(batchRef, {
        availableQuantity: (await transaction.get(batchRef)).data()?.availableQuantity - 1,
        deliveredQuantity: (await transaction.get(batchRef)).data()?.deliveredQuantity + 1,
      });

      const historyRef = doc(this.serialNumberHistoryCollection);
      transaction.set(historyRef, {
        serialNumber: selectedItem.serialNumber || deliveryData.productSerialNumber,
        itemId: selectedItem.id,
        action: 'delivered',
        actionDate: Timestamp.now(),
        actionBy: userId,
        details: `Item delivered to ${deliveryData.customerInfo.name || 'customer'}`,
        referenceId: deliveryRef.id,
      });

      const batchData = (await transaction.get(batchRef)).data() as InventoryBatch;
      
      return {
        deliveryId: deliveryRef.id,
        itemId: selectedItem.id,
        serialNumber: selectedItem.serialNumber || deliveryData.productSerialNumber!,
        batchId: selectedItem.batchId,
        productName: batchData.productName,
        sku: batchData.sku,
        customerInfo: deliveryData.customerInfo,
        shippingLabelData: deliveryData.shippingLabelData,
        deliveryDate: new Date().toISOString(),
        deliveredBy: userId,
        status: 'delivered',
      };
    });
  }

  // ==================== SEARCH & QUERY METHODS ====================

  async getInventorySummaryBySKU(): Promise<any[]> {
    const querySnapshot = await getDocs(
      query(this.inventoryCollection, orderBy('sku'))
    );
    
    const batches = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      receivedDate: doc.data().receivedDate?.toDate?.()?.toISOString() || new Date().toISOString(),
    })) as InventoryBatch[];

    const skuGroups = batches.reduce((acc, batch) => {
      if (!acc[batch.sku]) {
        acc[batch.sku] = {
          sku: batch.sku,
          productName: batch.productName,
          totalAvailable: 0,
          totalReserved: 0,
          totalDelivered: 0,
          totalReturned: 0,
          totalItems: 0,
          itemsWithSerialNumbers: 0,
          itemsWithoutSerialNumbers: 0,
          batches: [],
          sources: {
            newArrivals: 0,
            fromReturns: 0,
          },
        };
      }
      
      acc[batch.sku].totalAvailable += batch.availableQuantity;
      acc[batch.sku].totalReserved += batch.reservedQuantity;
      acc[batch.sku].totalDelivered += batch.deliveredQuantity;
      acc[batch.sku].totalReturned += batch.returnedQuantity;
      acc[batch.sku].totalItems += batch.totalQuantity;
      acc[batch.sku].itemsWithSerialNumbers += batch.serialNumbersAssigned;
      acc[batch.sku].itemsWithoutSerialNumbers += batch.serialNumbersUnassigned;
      acc[batch.sku].batches.push(batch);
      
      if (batch.source === InventorySource.NEW_ARRIVAL) {
        acc[batch.sku].sources.newArrivals += batch.totalQuantity;
      } else {
        acc[batch.sku].sources.fromReturns += batch.totalQuantity;
      }
      
      return acc;
    }, {} as Record<string, any>);

    return Object.values(skuGroups);
  }
  
    async searchInventory(searchTerm: string): Promise<InventoryBatch[]> {
    const allInventory = await this.getAllInventoryBatches();
    
    const term = searchTerm.toLowerCase();
    return allInventory.filter(batch =>
      batch.sku.toLowerCase().includes(term) ||
      batch.productName.toLowerCase().includes(term) ||
      (batch.batchNotes && batch.batchNotes.toLowerCase().includes(term))
    );
  }

  async searchDeliveredItems(searchTerm: string): Promise<any[]> {
    const querySnapshot = await getDocs(this.deliveriesCollection);
    const deliveries = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      deliveryDate: doc.data().deliveryDate || new Date().toISOString(),
    }));
    
    const term = searchTerm.toLowerCase();
    return deliveries.filter(delivery =>
      (delivery.serialNumber && delivery.serialNumber.toLowerCase().includes(term)) ||
      (delivery.shippingLabelData?.labelNumber && 
       delivery.shippingLabelData.labelNumber.toLowerCase().includes(term)) ||
      (delivery.customerInfo?.name && 
       delivery.customerInfo.name.toLowerCase().includes(term))
    );
  }
  
    async getInventoryStats(): Promise<InventoryStats> {
    const [batchSnapshot, itemSnapshot] = await Promise.all([
      getDocs(this.inventoryCollection),
      getDocs(this.serialNumberItemsCollection),
    ]);

    const batches = batchSnapshot.docs.map(doc => doc.data() as InventoryBatch);
    const items = itemSnapshot.docs.map(doc => doc.data() as SerialNumberItem);

    const totalItems = items.length;
    const availableItems = items.filter(item => item.status === InventoryItemStatus.AVAILABLE).length;
    const reservedItems = items.filter(item => item.status === InventoryItemStatus.RESERVED).length;
    const deliveredItems = items.filter(item => item.status === InventoryItemStatus.DELIVERED).length;
    const returnedItems = items.filter(item => item.status === InventoryItemStatus.RETURNED).length;
    const itemsWithSerialNumbers = items.filter(item => item.serialNumber).length;
    const itemsWithoutSerialNumbers = items.filter(item => !item.serialNumber).length;

    return {
      totalBatches: batches.length,
      totalItems,
      totalAvailableItems: availableItems,
      totalReservedItems: reservedItems,
      totalDeliveredItems: deliveredItems,
      totalReturnedItems: returnedItems,
      newArrivals: batches
        .filter(batch => batch.source === InventorySource.NEW_ARRIVAL)
        .reduce((sum, batch) => sum + batch.totalQuantity, 0),
      fromReturns: batches
        .filter(batch => batch.source === InventorySource.FROM_RETURN)
        .reduce((sum, batch) => sum + batch.totalQuantity, 0),
      uniqueSKUs: new Set(batches.map(batch => batch.sku)).size,
      itemsWithSerialNumbers,
      itemsWithoutSerialNumbers,
      serialNumberAssignmentRate: totalItems > 0 ? (itemsWithSerialNumbers / totalItems) * 100 : 0,
    };
  }
  
    async getAllInventoryBatches(): Promise<InventoryBatch[]> {
    const querySnapshot = await getDocs(
      query(this.inventoryCollection, orderBy('receivedDate', 'desc'))
    );
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      receivedDate: doc.data().receivedDate?.toDate?.()?.toISOString() || new Date().toISOString(),
    })) as InventoryBatch[];
  }
  
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
  
  async getItemsByBatchId(batchId: string): Promise<SerialNumberItem[]> {
    const q = query(
      this.serialNumberItemsCollection,
      where('batchId', '==', batchId),
      orderBy('createdAt')
    );

    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      assignedDate: doc.data().assignedDate?.toDate?.()?.toISOString(),
    })) as SerialNumberItem[];
  }
}

export const inventoryService = new InventoryService();