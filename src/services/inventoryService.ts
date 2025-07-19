// src/services/inventoryService.ts - Updated with Serial Number Support
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
  writeBatch,
  arrayUnion,
  arrayRemove,
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
} from '../types';

export class InventoryService {
  private inventoryCollection = collection(db, 'inventory');
  private serialNumberItemsCollection = collection(db, 'serialNumberItems');
  private deliveriesCollection = collection(db, 'deliveries');
  private serialNumberHistoryCollection = collection(db, 'serialNumberHistory');
  private bulkOperationsCollection = collection(db, 'bulkOperations');

  // ==================== BULK INVENTORY CREATION ====================
  
  // Create inventory batch from package with multiple items
  async createInventoryFromPackage(
    packageData: any, 
    quantity: number = 1,
    userId: string,
    preAssignedSerialNumbers: string[] = []
  ): Promise<{ batchId: string; itemIds: string[] }> {
    const batch = writeBatch(db);
    
    // Create the inventory batch
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

    // Create individual serial number items
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
        assignedDate: hasSerialNumber ? Timestamp.now() : null,
      });

      itemIds.push(itemRef.id);

      // Create history record if serial number was assigned
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

  // Create inventory batch from return
  async createInventoryFromReturn(
    returnData: any,
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

    // Create individual items
    const itemIds: string[] = [];
    for (let i = 0; i < quantity; i++) {
      const itemRef = doc(this.serialNumberItemsCollection);
      const hasSerialNumber = i === 0 && serialNumber; // First item gets the serial number
      
      const itemData: Omit<SerialNumberItem, 'id'> = {
        batchId: batchRef.id,
        serialNumber: hasSerialNumber ? serialNumber : undefined,
        status: InventoryItemStatus.RETURNED, // Initially marked as returned
        assignedDate: hasSerialNumber ? new Date().toISOString() : undefined,
        assignedBy: hasSerialNumber ? userId : undefined,
        returnId: returnData.id,
        createdAt: new Date().toISOString(),
        notes: `Item ${i + 1} of ${quantity} from return ${returnData.lpnNumber}`,
      };

      batch.set(itemRef, {
        ...itemData,
        createdAt: Timestamp.now(),
        assignedDate: hasSerialNumber ? Timestamp.now() : null,
      });

      itemIds.push(itemRef.id);
    }

    await batch.commit();
    
    return { batchId: batchRef.id, itemIds };
  }

  // ==================== SERIAL NUMBER MANAGEMENT ====================

  // Check if serial number exists in the system
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

    // Get batch information
    const batch = await this.getInventoryBatchById(item.batchId);
    
    // Get return history if applicable
    const returnHistory = await this.getReturnHistoryForItem(item.id);
    
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

  // Assign serial number to an item
  async assignSerialNumber(
    itemId: string,
    serialNumber: string,
    userId: string,
    notes?: string
  ): Promise<void> {
    // Check if serial number already exists
    const validation = await this.validateSerialNumber(serialNumber);
    if (validation.exists) {
      throw new Error(`Serial number ${serialNumber} already exists in the system`);
    }

    return runTransaction(db, async (transaction) => {
      const itemRef = doc(this.serialNumberItemsCollection, itemId);
      const itemDoc = await transaction.get(itemRef);
      
      if (!itemDoc.exists()) {
        throw new Error('Item not found');
      }

      const item = itemDoc.data() as SerialNumberItem;
      
      if (item.serialNumber) {
        throw new Error('Item already has a serial number assigned');
      }

      // Update the item
      transaction.update(itemRef, {
        serialNumber,
        assignedDate: Timestamp.now(),
        assignedBy: userId,
        notes: notes || item.notes,
      });

      // Update batch statistics
      const batchRef = doc(this.inventoryCollection, item.batchId);
      const batchDoc = await transaction.get(batchRef);
      
      if (batchDoc.exists()) {
        const batch = batchDoc.data() as InventoryBatch;
        transaction.update(batchRef, {
          serialNumbersAssigned: batch.serialNumbersAssigned + 1,
          serialNumbersUnassigned: batch.serialNumbersUnassigned - 1,
        });
      }

      // Create history record
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

  // Bulk assign serial numbers
  async bulkAssignSerialNumbers(
    formData: BulkSerialNumberForm
  ): Promise<{ successful: number; failed: number; errors: string[] }> {
    const results = {
      successful: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Create bulk operation record
    const bulkOpRef = doc(this.bulkOperationsCollection);
    await addDoc(this.bulkOperationsCollection, {
      type: 'serial_number_assignment',
      itemIds: formData.serialNumbers.map(sn => sn.itemId),
      status: 'in_progress',
      createdBy: formData.assignedBy,
      createdAt: Timestamp.now(),
    });

    // Process each serial number assignment
    for (const { itemId, serialNumber } of formData.serialNumbers) {
      try {
        await this.assignSerialNumber(itemId, serialNumber, formData.assignedBy, formData.notes);
        results.successful++;
      } catch (error) {
        results.failed++;
        results.errors.push(`Item ${itemId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Update bulk operation status
    await updateDoc(bulkOpRef, {
      status: 'completed',
      completedAt: Timestamp.now(),
      results,
    });

    return results;
  }

  // ==================== DELIVERY MANAGEMENT ====================

  // Get available items for delivery (with or without serial numbers)
  async getAvailableItemsForDelivery(sku: string): Promise<SerialNumberItem[]> {
    // First get the batch
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

    // Get available items from these batches
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

  // Deliver item with serial number assignment
  async deliverItemWithSerialNumber(
    deliveryData: DeliveryForm,
    userId: string
  ): Promise<DeliveryWithSerialNumber> {
    return runTransaction(db, async (transaction) => {
      let selectedItem: SerialNumberItem;
      let itemRef: any;

      if (deliveryData.selectedItemId) {
        // Specific item selected
        itemRef = doc(this.serialNumberItemsCollection, deliveryData.selectedItemId);
        const itemDoc = await transaction.get(itemRef);
        
        if (!itemDoc.exists()) {
          throw new Error('Selected item not found');
        }
        
        selectedItem = {
          id: itemDoc.id,
          ...itemDoc.data(),
          createdAt: itemDoc.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          assignedDate: itemDoc.data().assignedDate?.toDate?.()?.toISOString(),
        } as SerialNumberItem;
      } else {
        // Find available item from batch
        const batchRef = doc(this.inventoryCollection, deliveryData.inventoryBatchId);
        const batchDoc = await transaction.get(batchRef);
        
        if (!batchDoc.exists()) {
          throw new Error('Inventory batch not found');
        }

        const batch = batchDoc.data() as InventoryBatch;
        if (batch.availableQuantity < 1) {
          throw new Error('No items available for delivery');
        }

        // Find an available item
        const availableItems = await this.getAvailableItemsForDelivery(batch.sku);
        if (availableItems.length === 0) {
          throw new Error('No available items found');
        }

        selectedItem = availableItems[0];
        itemRef = doc(this.serialNumberItemsCollection, selectedItem.id);
      }

      // Assign serial number if provided and not already assigned
      if (deliveryData.productSerialNumber && !selectedItem.serialNumber) {
        // Check if serial number already exists
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

      // Ensure item has serial number before delivery
      if (!selectedItem.serialNumber && !deliveryData.productSerialNumber) {
        throw new Error('Item must have a serial number before delivery');
      }

      // Create delivery record
      const deliveryRef = doc(this.deliveriesCollection);
      const deliveryRecord = {
        itemId: selectedItem.id,
        batchId: selectedItem.batchId,
        serialNumber: selectedItem.serialNumber || deliveryData.productSerialNumber,
        shippingLabelData: deliveryData.shippingLabelData,
        customerInfo: deliveryData.customerInfo,
        deliveryTracking: deliveryData.deliveryTracking,
        deliveryDate: new Date().toISOString(),
        deliveredBy: userId,
        status: 'delivered',
        createdAt: Timestamp.now(),
      };

      transaction.set(deliveryRef, deliveryRecord);

      // Update item status
      transaction.update(itemRef, {
        status: InventoryItemStatus.DELIVERED,
        deliveryId: deliveryRef.id,
        updatedAt: Timestamp.now(),
      });

      // Update batch quantities
      const batchRef = doc(this.inventoryCollection, selectedItem.batchId);
      const batchDoc = await transaction.get(batchRef);
      
      if (batchDoc.exists()) {
        const batch = batchDoc.data() as InventoryBatch;
        transaction.update(batchRef, {
          availableQuantity: batch.availableQuantity - 1,
          deliveredQuantity: batch.deliveredQuantity + 1,
        });
      }

      // Create history record
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

      // Get batch info for return
      const batch = batchDoc.data() as InventoryBatch;
      
      return {
        deliveryId: deliveryRef.id,
        itemId: selectedItem.id,
        serialNumber: selectedItem.serialNumber || deliveryData.productSerialNumber!,
        batchId: selectedItem.batchId,
        productName: batch.productName,
        sku: batch.sku,
        customerInfo: deliveryData.customerInfo,
        shippingLabelData: deliveryData.shippingLabelData,
        deliveryDate: new Date().toISOString(),
        deliveredBy: userId,
        status: 'delivered',
      };
    });
  }

  // ==================== RETURN MANAGEMENT ====================

  // Move returned item back to inventory
  async moveReturnedItemToInventory(
    itemId: string,
    userId: string,
    notes?: string
  ): Promise<void> {
    return runTransaction(db, async (transaction) => {
      const itemRef = doc(this.serialNumberItemsCollection, itemId);
      const itemDoc = await transaction.get(itemRef);
      
      if (!itemDoc.exists()) {
        throw new Error('Item not found');
      }

      const item = itemDoc.data() as SerialNumberItem;
      
      if (item.status !== InventoryItemStatus.RETURNED) {
        throw new Error('Item is not in returned status');
      }

      // Update item status
      transaction.update(itemRef, {
        status: InventoryItemStatus.AVAILABLE,
        returnId: null,
        updatedAt: Timestamp.now(),
        notes: notes || item.notes,
      });

      // Update batch quantities
      const batchRef = doc(this.inventoryCollection, item.batchId);
      const batchDoc = await transaction.get(batchRef);
      
      if (batchDoc.exists()) {
        const batch = batchDoc.data() as InventoryBatch;
        transaction.update(batchRef, {
          availableQuantity: batch.availableQuantity + 1,
          returnedQuantity: batch.returnedQuantity - 1,
        });
      }

      // Create history record
      if (item.serialNumber) {
        const historyRef = doc(this.serialNumberHistoryCollection);
        transaction.set(historyRef, {
          serialNumber: item.serialNumber,
          itemId: itemId,
          action: 'moved_to_inventory',
          actionDate: Timestamp.now(),
          actionBy: userId,
          details: notes || `Item moved from returns back to inventory`,
        });
      }
    });
  }

  // ==================== SEARCH & QUERY METHODS ====================

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

    // Get item counts for each batch
    const batchesWithItems = await Promise.all(
      batches.map(async (batch) => {
        const itemCounts = await this.getItemCountsForBatch(batch.id);
        return { ...batch, ...itemCounts };
      })
    );

    // Group by SKU
    const skuGroups = batchesWithItems.reduce((acc, batch) => {
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

  // Get item counts for a specific batch
  async getItemCountsForBatch(batchId: string): Promise<{
    totalItems: number;
    availableItems: number;
    deliveredItems: number;
    returnedItems: number;
    itemsWithSerialNumbers: number;
    itemsWithoutSerialNumbers: number;
  }> {
    const itemsQuery = query(
      this.serialNumberItemsCollection,
      where('batchId', '==', batchId)
    );

    const itemsSnapshot = await getDocs(itemsQuery);
    const items = itemsSnapshot.docs.map(doc => doc.data() as SerialNumberItem);

    return {
      totalItems: items.length,
      availableItems: items.filter(item => item.status === InventoryItemStatus.AVAILABLE).length,
      deliveredItems: items.filter(item => item.status === InventoryItemStatus.DELIVERED).length,
      returnedItems: items.filter(item => item.status === InventoryItemStatus.RETURNED).length,
      itemsWithSerialNumbers: items.filter(item => item.serialNumber).length,
      itemsWithoutSerialNumbers: items.filter(item => !item.serialNumber).length,
    };
  }

  // Search inventory items by serial number
  async searchInventoryBySerialNumber(searchTerm: string): Promise<InventoryItemWithDetails[]> {
    const q = query(
      this.serialNumberItemsCollection,
      where('serialNumber', '>=', searchTerm),
      where('serialNumber', '<=', searchTerm + '\uf8ff'),
      limit(20)
    );

    const snapshot = await getDocs(q);
    const items = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      assignedDate: doc.data().assignedDate?.toDate?.()?.toISOString(),
    })) as SerialNumberItem[];

    // Get detailed information for each item
    const itemsWithDetails = await Promise.all(
      items.map(async (item) => {
        const batch = await this.getInventoryBatchById(item.batchId);
        const deliveryHistory = await this.getDeliveryHistoryForItem(item.id);
        const returnHistory = await this.getReturnHistoryForItem(item.id);

        return {
          item,
          batch: batch!,
          deliveryHistory,
          returnHistory,
          currentLocation: this.getCurrentLocation(item.status),
          lastAction: await this.getLastActionForItem(item.id),
        };
      })
    );

    return itemsWithDetails;
  }

  // Get items that need serial numbers
  async getItemsNeedingSerialNumbers(limit: number = 50): Promise<SerialNumberItem[]> {
    const q = query(
      this.serialNumberItemsCollection,
      where('serialNumber', '==', null),
      orderBy('createdAt'),
      limit(limit)
    );

    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    })) as SerialNumberItem[];
  }

  // ==================== UTILITY METHODS ====================

  // Get inventory batch by ID
  async getInventoryBatchById(id: string): Promise<InventoryBatch | null> {
    const docRef = doc(this.inventoryCollection, id);
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

  // Get delivery history for an item
  async getDeliveryHistoryForItem(itemId: string): Promise<DeliveryWithSerialNumber[]> {
    const q = query(
      this.deliveriesCollection,
      where('itemId', '==', itemId),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      deliveryId: doc.id,
      ...doc.data(),
      deliveryDate: doc.data().deliveryDate || new Date().toISOString(),
    })) as DeliveryWithSerialNumber[];
  }

  // Get return history for an item
  async getReturnHistoryForItem(itemId: string): Promise<any[]> {
    // This would need to be implemented based on your return service
    // For now, returning empty array
    return [];
  }

  // Get last action for an item
  async getLastActionForItem(itemId: string): Promise<any> {
    const q = query(
      this.serialNumberHistoryCollection,
      where('itemId', '==', itemId),
      orderBy('actionDate', 'desc'),
      limit(1)
    );

    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    const data = doc.data();
    
    return {
      type: data.action,
      date: data.actionDate?.toDate?.()?.toISOString() || new Date().toISOString(),
      by: data.actionBy,
      details: data.details,
    };
  }

  // Get current location based on status
  getCurrentLocation(status: InventoryItemStatus): 'inventory' | 'delivered' | 'returned' {
    switch (status) {
      case InventoryItemStatus.AVAILABLE:
      case InventoryItemStatus.RESERVED:
        return 'inventory';
      case InventoryItemStatus.DELIVERED:
        return 'delivered';
      case InventoryItemStatus.RETURNED:
        return 'returned';
      default:
        return 'inventory';
    }
  }

  // Get updated inventory statistics
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

  // Legacy methods for backward compatibility
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

  // Search inventory (legacy method)
  async searchInventory(searchTerm: string): Promise<InventoryBatch[]> {
    const allInventory = await this.getAllInventoryBatches();
    
    const term = searchTerm.toLowerCase();
    return allInventory.filter(batch =>
      batch.sku.toLowerCase().includes(term) ||
      batch.productName.toLowerCase().includes(term) ||
      (batch.batchNotes && batch.batchNotes.toLowerCase().includes(term))
    );
  }

  // Search delivered items (legacy method)
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

  // Get available inventory for SKU (legacy method)
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

  // Reserve inventory (legacy method)
  async reserveInventory(batchId: string, quantity: number): Promise<void> {
    return runTransaction(db, async (transaction) => {
      const batchRef = doc(this.inventoryCollection, batchId);
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

      // Also update individual items to reserved status
      const itemsQuery = query(
        this.serialNumberItemsCollection,
        where('batchId', '==', batchId),
        where('status', '==', InventoryItemStatus.AVAILABLE),
        limit(quantity)
      );

      const itemsSnapshot = await getDocs(itemsQuery);
      itemsSnapshot.docs.forEach(itemDoc => {
        transaction.update(itemDoc.ref, {
          status: InventoryItemStatus.RESERVED,
          updatedAt: Timestamp.now(),
        });
      });
    });
  }

  // Deliver items (legacy method - updated to use new serial number system)
  async deliverItems(deliveryData: DeliveryForm, userId: string): Promise<string> {
    const delivery = await this.deliverItemWithSerialNumber(deliveryData, userId);
    return delivery.deliveryId;
  }

  // Update inventory batch
  async updateInventoryBatch(id: string, updates: Partial<InventoryBatch>): Promise<void> {
    const docRef = doc(this.inventoryCollection, id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: Timestamp.now(),
    });
  }

  // Delete inventory batch
  async deleteInventoryBatch(id: string): Promise<void> {
    return runTransaction(db, async (transaction) => {
      const batchRef = doc(this.inventoryCollection, id);
      const batchDoc = await transaction.get(batchRef);
      
      if (!batchDoc.exists()) {
        throw new Error('Inventory batch not found');
      }

      // Delete all associated items
      const itemsQuery = query(
        this.serialNumberItemsCollection,
        where('batchId', '==', id)
      );

      const itemsSnapshot = await getDocs(itemsQuery);
      itemsSnapshot.docs.forEach(itemDoc => {
        transaction.delete(itemDoc.ref);
      });

      // Delete the batch
      transaction.delete(batchRef);
    });
  }

  // Get low stock items
  async getLowStockItems(threshold: number = 5): Promise<InventoryBatch[]> {
    const querySnapshot = await getDocs(
      query(
        this.inventoryCollection,
        where('availableQuantity', '<=', threshold),
        orderBy('availableQuantity')
      )
    );
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      receivedDate: doc.data().receivedDate?.toDate?.()?.toISOString() || new Date().toISOString(),
    })) as InventoryBatch[];
  }

  // Get inventory activity log
  async getInventoryActivityLog(batchId: string): Promise<any[]> {
    // Get all items in this batch
    const itemsQuery = query(
      this.serialNumberItemsCollection,
      where('batchId', '==', batchId)
    );

    const itemsSnapshot = await getDocs(itemsQuery);
    const itemIds = itemsSnapshot.docs.map(doc => doc.id);

    if (itemIds.length === 0) {
      return [];
    }

    // Get history for all items in this batch
    const historyQuery = query(
      this.serialNumberHistoryCollection,
      where('itemId', 'in', itemIds),
      orderBy('actionDate', 'desc')
    );

    const historySnapshot = await getDocs(historyQuery);
    
    return historySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      actionDate: doc.data().actionDate?.toDate?.()?.toISOString() || new Date().toISOString(),
    }));
  }

  // ==================== ADDITIONAL HELPER METHODS ====================

  // Get serial number history for an item
  async getSerialNumberHistory(itemId: string): Promise<SerialNumberHistory[]> {
    const q = query(
      this.serialNumberHistoryCollection,
      where('itemId', '==', itemId),
      orderBy('actionDate', 'desc')
    );

    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      actionDate: doc.data().actionDate?.toDate?.()?.toISOString() || new Date().toISOString(),
    })) as SerialNumberHistory[];
  }

  // Get item by serial number
  async getItemBySerialNumber(serialNumber: string): Promise<SerialNumberItem | null> {
    const q = query(
      this.serialNumberItemsCollection,
      where('serialNumber', '==', serialNumber),
      limit(1)
    );

    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return {
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      assignedDate: doc.data().assignedDate?.toDate?.()?.toISOString(),
    } as SerialNumberItem;
  }

  // Get items by batch ID
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

  // Update item status
  async updateItemStatus(
    itemId: string,
    status: InventoryItemStatus,
    userId: string,
    notes?: string
  ): Promise<void> {
    return runTransaction(db, async (transaction) => {
      const itemRef = doc(this.serialNumberItemsCollection, itemId);
      const itemDoc = await transaction.get(itemRef);
      
      if (!itemDoc.exists()) {
        throw new Error('Item not found');
      }

      const item = itemDoc.data() as SerialNumberItem;
      const oldStatus = item.status;

      // Update item
      transaction.update(itemRef, {
        status,
        updatedAt: Timestamp.now(),
        notes: notes || item.notes,
      });

      // Update batch quantities if status changed
      if (oldStatus !== status) {
        const batchRef = doc(this.inventoryCollection, item.batchId);
        const batchDoc = await transaction.get(batchRef);
        
        if (batchDoc.exists()) {
          const batch = batchDoc.data() as InventoryBatch;
          const updates: Partial<InventoryBatch> = {};

          // Decrease old status count
          switch (oldStatus) {
            case InventoryItemStatus.AVAILABLE:
              updates.availableQuantity = batch.availableQuantity - 1;
              break;
            case InventoryItemStatus.RESERVED:
              updates.reservedQuantity = batch.reservedQuantity - 1;
              break;
            case InventoryItemStatus.DELIVERED:
              updates.deliveredQuantity = batch.deliveredQuantity - 1;
              break;
            case InventoryItemStatus.RETURNED:
              updates.returnedQuantity = batch.returnedQuantity - 1;
              break;
          }

          // Increase new status count
          switch (status) {
            case InventoryItemStatus.AVAILABLE:
              updates.availableQuantity = (updates.availableQuantity || batch.availableQuantity) + 1;
              break;
            case InventoryItemStatus.RESERVED:
              updates.reservedQuantity = (updates.reservedQuantity || batch.reservedQuantity) + 1;
              break;
            case InventoryItemStatus.DELIVERED:
              updates.deliveredQuantity = (updates.deliveredQuantity || batch.deliveredQuantity) + 1;
              break;
            case InventoryItemStatus.RETURNED:
              updates.returnedQuantity = (updates.returnedQuantity || batch.returnedQuantity) + 1;
              break;
          }

          transaction.update(batchRef, updates);
        }

        // Create history record if item has serial number
        if (item.serialNumber) {
          const historyRef = doc(this.serialNumberHistoryCollection);
          transaction.set(historyRef, {
            serialNumber: item.serialNumber,
            itemId: itemId,
            action: `status_changed_to_${status}`,
            actionDate: Timestamp.now(),
            actionBy: userId,
            details: notes || `Status changed from ${oldStatus} to ${status}`,
          });
        }
      }
    });
  }

  // Get items that need attention (no serial number and available for delivery)
  async getItemsNeedingAttention(): Promise<{
    needingSerialNumbers: SerialNumberItem[];
    readyForDelivery: SerialNumberItem[];
    lowStockBatches: InventoryBatch[];
  }> {
    const [needingSerialNumbers, readyForDelivery, lowStockBatches] = await Promise.all([
      this.getItemsNeedingSerialNumbers(20),
      this.getItemsReadyForDelivery(20),
      this.getLowStockItems(10),
    ]);

    return {
      needingSerialNumbers,
      readyForDelivery,
      lowStockBatches,
    };
  }

  // Get items ready for delivery (have serial numbers and are available)
  async getItemsReadyForDelivery(limit: number = 50): Promise<SerialNumberItem[]> {
    const q = query(
      this.serialNumberItemsCollection,
      where('status', '==', InventoryItemStatus.AVAILABLE),
      where('serialNumber', '!=', null),
      orderBy('serialNumber'),
      limit(limit)
    );

    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      assignedDate: doc.data().assignedDate?.toDate?.()?.toISOString(),
    })) as SerialNumberItem[];
  }

  // Batch operations status
  async getBulkOperationStatus(operationId: string): Promise<BulkOperation | null> {
    const docRef = doc(this.bulkOperationsCollection, operationId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data(),
        createdAt: docSnap.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        completedAt: docSnap.data().completedAt?.toDate?.()?.toISOString(),
      } as BulkOperation;
    }
    
    return null;
  }
}

export const inventoryService = new InventoryService();