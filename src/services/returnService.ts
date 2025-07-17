// src/services/returnService.ts - Updated with Serial Number Support
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
  Return, 
  ReturnForm, 
  ReturnStatus, 
  ReturnCondition, 
  DriveFileReference,
  SerialNumberItem,
  InventoryItemStatus,
  SerialNumberValidation,
  ReturnWithSerialNumber,
  SerialNumberHistory,
  InventoryBatch,
  InventorySource,
} from '../types';
import { inventoryService } from './inventoryService';

export class ReturnService {
  private returnsCollection = collection(db, 'returns');
  private serialNumberItemsCollection = collection(db, 'serialNumberItems');
  private serialNumberHistoryCollection = collection(db, 'serialNumberHistory');
  private inventoryCollection = collection(db, 'inventory');

  // ==================== SERIAL NUMBER VALIDATION ====================

  // Validate serial number and get product information
  async validateSerialNumberForReturn(serialNumber: string): Promise<SerialNumberValidation> {
    return await inventoryService.validateSerialNumber(serialNumber);
  }

  // Get detailed return information with serial number lookup
  async getReturnInfoBySerialNumber(serialNumber: string): Promise<ReturnWithSerialNumber | null> {
    const validation = await this.validateSerialNumberForReturn(serialNumber);
    
    if (!validation.exists || !validation.item) {
      return null;
    }

    const item = validation.item;
    const batch = validation.batch;

    // Check if this item has delivery history
    const deliveryHistory = await inventoryService.getDeliveryHistoryForItem(item.id);
    
    // Get any existing return records for this item
    const existingReturns = await this.getReturnsByItemId(item.id);

    const originalProductInfo = batch ? {
      productName: batch.productName,
      sku: batch.sku,
      batchId: batch.id,
      deliveryDate: deliveryHistory.length > 0 ? deliveryHistory[0].deliveryDate : undefined,
      customerInfo: deliveryHistory.length > 0 ? deliveryHistory[0].customerInfo : undefined,
    } : undefined;

    return {
      returnId: '', // Will be filled when return is created
      serialNumber,
      originalItemId: item.id,
      originalDeliveryId: deliveryHistory.length > 0 ? deliveryHistory[0].deliveryId : undefined,
      returnData: {} as Return, // Will be filled when return is created
      originalProductInfo,
    };
  }

  // Check if serial number can be returned
  async canSerialNumberBeReturned(serialNumber: string): Promise<{
    canReturn: boolean;
    reason?: string;
    item?: SerialNumberItem;
    currentStatus?: InventoryItemStatus;
  }> {
    const validation = await this.validateSerialNumberForReturn(serialNumber);
    
    if (!validation.exists || !validation.item) {
      return {
        canReturn: false,
        reason: 'Serial number not found in system',
      };
    }

    const item = validation.item;
    
    // Check if item is already returned
    if (item.status === InventoryItemStatus.RETURNED) {
      return {
        canReturn: false,
        reason: 'Item is already marked as returned',
        item,
        currentStatus: item.status,
      };
    }

    // Check if item is available (not delivered yet)
    if (item.status === InventoryItemStatus.AVAILABLE) {
      return {
        canReturn: false,
        reason: 'Item has not been delivered yet',
        item,
        currentStatus: item.status,
      };
    }

    // Item can be returned if it's delivered
    if (item.status === InventoryItemStatus.DELIVERED) {
      return {
        canReturn: true,
        item,
        currentStatus: item.status,
      };
    }

    // Reserved items cannot be returned
    if (item.status === InventoryItemStatus.RESERVED) {
      return {
        canReturn: false,
        reason: 'Item is reserved and cannot be returned',
        item,
        currentStatus: item.status,
      };
    }

    return {
      canReturn: false,
      reason: 'Item status does not allow returns',
      item,
      currentStatus: item.status,
    };
  }

  // ==================== RETURN CREATION ====================

  // Create return with serial number (main method)
  async createReturnWithSerialNumber(
    formData: ReturnForm,
    userId: string,
    driveFiles: DriveFileReference[] = []
  ): Promise<{ returnId: string; itemId?: string }> {
    if (!formData.serialNumber) {
      throw new Error('Serial number is required for return creation');
    }

    // Validate serial number
    const canReturn = await this.canSerialNumberBeReturned(formData.serialNumber);
    if (!canReturn.canReturn) {
      throw new Error(canReturn.reason || 'Cannot return this item');
    }

    const item = canReturn.item!;
    
    return runTransaction(db, async (transaction) => {
      // Create return record
      const returnData: Omit<Return, 'id'> = {
        ...formData,
        status: ReturnStatus.RECEIVED,
        receivedDate: new Date().toISOString(),
        receivedBy: userId,
        driveFiles,
        originalItemId: item.id,
        originalDeliveryId: item.deliveryId,
        returnDecision: 'pending',
      };

      const returnRef = doc(this.returnsCollection);
      transaction.set(returnRef, {
        ...returnData,
        receivedDate: Timestamp.now(),
      });

      // Update item status to returned
      const itemRef = doc(this.serialNumberItemsCollection, item.id);
      transaction.update(itemRef, {
        status: InventoryItemStatus.RETURNED,
        returnId: returnRef.id,
        updatedAt: Timestamp.now(),
      });

      // Update batch quantities
      const batchRef = doc(this.inventoryCollection, item.batchId);
      const batchDoc = await transaction.get(batchRef);
      
      if (batchDoc.exists()) {
        const batch = batchDoc.data() as InventoryBatch;
        const updates: Partial<InventoryBatch> = {};

        // Move from delivered to returned
        if (item.status === InventoryItemStatus.DELIVERED) {
          updates.deliveredQuantity = batch.deliveredQuantity - 1;
          updates.returnedQuantity = batch.returnedQuantity + 1;
        }

        transaction.update(batchRef, updates);
      }

      // Create history record
      const historyRef = doc(this.serialNumberHistoryCollection);
      transaction.set(historyRef, {
        serialNumber: formData.serialNumber,
        itemId: item.id,
        action: 'returned',
        actionDate: Timestamp.now(),
        actionBy: userId,
        details: `Item returned - LPN: ${formData.lpnNumber}, Condition: ${formData.condition}`,
        referenceId: returnRef.id,
      });

      return { returnId: returnRef.id, itemId: item.id };
    });
  }

  // Create return for non-existent serial number (create new product first)
  async createReturnForNewProduct(
    formData: ReturnForm,
    userId: string,
    driveFiles: DriveFileReference[] = []
  ): Promise<{ returnId: string; batchId: string; itemId: string }> {
    if (!formData.serialNumber) {
      throw new Error('Serial number is required');
    }

    // Validate that serial number doesn't exist
    const validation = await this.validateSerialNumberForReturn(formData.serialNumber);
    if (validation.exists) {
      throw new Error('Serial number already exists in system');
    }

    return runTransaction(db, async (transaction) => {
      // Create inventory batch for the new product
      const batchData: Omit<InventoryBatch, 'id'> = {
        sku: formData.sku || `NEW-RETURN-${Date.now()}`,
        productName: formData.productName,
        totalQuantity: formData.quantity,
        availableQuantity: 0, // Not available until decision is made
        reservedQuantity: 0,
        deliveredQuantity: 0,
        returnedQuantity: formData.quantity,
        source: InventorySource.FROM_RETURN,
        sourceReference: '', // Will be updated with return ID
        receivedDate: new Date().toISOString(),
        receivedBy: userId,
        batchNotes: `New product created from return - LPN: ${formData.lpnNumber}`,
        serialNumbersAssigned: 1,
        serialNumbersUnassigned: formData.quantity - 1,
      };

      const batchRef = doc(this.inventoryCollection);
      transaction.set(batchRef, {
        ...batchData,
        receivedDate: Timestamp.now(),
      });

      // Create serial number item
      const itemData: Omit<SerialNumberItem, 'id'> = {
        batchId: batchRef.id,
        serialNumber: formData.serialNumber,
        status: InventoryItemStatus.RETURNED,
        assignedDate: new Date().toISOString(),
        assignedBy: userId,
        createdAt: new Date().toISOString(),
        notes: `New item created from return - LPN: ${formData.lpnNumber}`,
      };

      const itemRef = doc(this.serialNumberItemsCollection);
      transaction.set(itemRef, {
        ...itemData,
        createdAt: Timestamp.now(),
        assignedDate: Timestamp.now(),
      });

      // Create additional items if quantity > 1
      const additionalItemIds: string[] = [];
      for (let i = 1; i < formData.quantity; i++) {
        const additionalItemRef = doc(this.serialNumberItemsCollection);
        transaction.set(additionalItemRef, {
          batchId: batchRef.id,
          serialNumber: null,
          status: InventoryItemStatus.RETURNED,
          createdAt: Timestamp.now(),
          notes: `Additional item ${i + 1} from return - LPN: ${formData.lpnNumber}`,
        });
        additionalItemIds.push(additionalItemRef.id);
      }

      // Create return record
      const returnData: Omit<Return, 'id'> = {
        ...formData,
        status: ReturnStatus.RECEIVED,
        receivedDate: new Date().toISOString(),
        receivedBy: userId,
        driveFiles,
        originalItemId: itemRef.id,
        returnDecision: 'pending',
      };

      const returnRef = doc(this.returnsCollection);
      transaction.set(returnRef, {
        ...returnData,
        receivedDate: Timestamp.now(),
      });

      // Update item with return reference
      transaction.update(itemRef, {
        returnId: returnRef.id,
      });

      // Update batch with return reference
      transaction.update(batchRef, {
        sourceReference: returnRef.id,
      });

      // Create history record
      const historyRef = doc(this.serialNumberHistoryCollection);
      transaction.set(historyRef, {
        serialNumber: formData.serialNumber,
        itemId: itemRef.id,
        action: 'returned',
        actionDate: Timestamp.now(),
        actionBy: userId,
        details: `New product created and returned - LPN: ${formData.lpnNumber}`,
        referenceId: returnRef.id,
      });

      return { 
        returnId: returnRef.id, 
        batchId: batchRef.id, 
        itemId: itemRef.id 
      };
    });
  }

  // Legacy create return method (for backward compatibility)
  async createReturn(
    formData: ReturnForm, 
    userId: string, 
    driveFiles: DriveFileReference[] = []
  ): Promise<string> {
    if (formData.serialNumber) {
      // If serial number provided, use new method
      const validation = await this.validateSerialNumberForReturn(formData.serialNumber);
      if (validation.exists) {
        const result = await this.createReturnWithSerialNumber(formData, userId, driveFiles);
        return result.returnId;
      } else {
        const result = await this.createReturnForNewProduct(formData, userId, driveFiles);
        return result.returnId;
      }
    } else {
      // Legacy method without serial number
      const returnData: Omit<Return, 'id'> = {
        ...formData,
        status: ReturnStatus.RECEIVED,
        receivedDate: new Date().toISOString(),
        receivedBy: userId,
        driveFiles,
        returnDecision: 'pending',
      };

      const docRef = await addDoc(this.returnsCollection, {
        ...returnData,
        receivedDate: Timestamp.now(),
      });
      
      return docRef.id;
    }
  }

  // ==================== RETURN DECISION MANAGEMENT ====================

  // Make decision on return: move to inventory or keep in returns
  async makeReturnDecision(
    returnId: string,
    decision: 'move_to_inventory' | 'keep_in_returns',
    userId: string,
    notes?: string
  ): Promise<void> {
    return runTransaction(db, async (transaction) => {
      const returnRef = doc(this.returnsCollection, returnId);
      const returnDoc = await transaction.get(returnRef);
      
      if (!returnDoc.exists()) {
        throw new Error('Return not found');
      }

      const returnData = returnDoc.data() as Return;
      
      if (returnData.returnDecision !== 'pending') {
        throw new Error('Return decision has already been made');
      }

      // Update return record
      transaction.update(returnRef, {
        returnDecision: decision,
        returnDecisionDate: new Date().toISOString(),
        returnDecisionBy: userId,
        returnDecisionNotes: notes,
        status: decision === 'move_to_inventory' ? ReturnStatus.MOVED_TO_INVENTORY : ReturnStatus.KEPT_IN_RETURNS,
        processedDate: new Date().toISOString(),
        processedBy: userId,
      });

      // If moving to inventory, update item status
      if (decision === 'move_to_inventory' && returnData.originalItemId) {
        const itemRef = doc(this.serialNumberItemsCollection, returnData.originalItemId);
        transaction.update(itemRef, {
          status: InventoryItemStatus.AVAILABLE,
          returnId: null,
          updatedAt: Timestamp.now(),
        });

        // Update batch quantities
        const itemDoc = await transaction.get(itemRef);
        if (itemDoc.exists()) {
          const item = itemDoc.data() as SerialNumberItem;
          const batchRef = doc(this.inventoryCollection, item.batchId);
          const batchDoc = await transaction.get(batchRef);
          
          if (batchDoc.exists()) {
            const batch = batchDoc.data() as InventoryBatch;
            transaction.update(batchRef, {
              availableQuantity: batch.availableQuantity + 1,
              returnedQuantity: batch.returnedQuantity - 1,
            });
          }
        }

        // Create history record
        if (returnData.serialNumber) {
          const historyRef = doc(this.serialNumberHistoryCollection);
          transaction.set(historyRef, {
            serialNumber: returnData.serialNumber,
            itemId: returnData.originalItemId,
            action: 'moved_to_inventory',
            actionDate: Timestamp.now(),
            actionBy: userId,
            details: notes || `Return moved to inventory - Decision made`,
            referenceId: returnId,
          });
        }
      } else if (decision === 'keep_in_returns') {
        // Item stays in returned status
        if (returnData.serialNumber && returnData.originalItemId) {
          const historyRef = doc(this.serialNumberHistoryCollection);
          transaction.set(historyRef, {
            serialNumber: returnData.serialNumber,
            itemId: returnData.originalItemId,
            action: 'kept_in_returns',
            actionDate: Timestamp.now(),
            actionBy: userId,
            details: notes || `Return kept in returns section - Decision made`,
            referenceId: returnId,
          });
        }
      }
    });
  }

  // Move return to inventory (legacy method)
  async moveReturnToInventory(returnId: string, userId: string): Promise<string> {
    await this.makeReturnDecision(returnId, 'move_to_inventory', userId);
    return returnId; // Return the same ID for compatibility
  }

  // ==================== QUERY METHODS ====================

  // Get all returns
  async getAllReturns(): Promise<Return[]> {
    const querySnapshot = await getDocs(
      query(this.returnsCollection, orderBy('receivedDate', 'desc'))
    );
    
    return querySnapshot.docs.map(doc => this.mapDocToReturn(doc)) as Return[];
  }

  // Get return by ID
  async getReturnById(id: string): Promise<Return | null> {
    const docRef = doc(this.returnsCollection, id);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return this.mapDocToReturn(docSnap);
    }
    
    return null;
  }

  // Get returns by serial number
  async getReturnsBySerialNumber(serialNumber: string): Promise<Return[]> {
    const q = query(
      this.returnsCollection,
      where('serialNumber', '==', serialNumber),
      orderBy('receivedDate', 'desc')
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => this.mapDocToReturn(doc));
  }

  // Get returns by item ID
  async getReturnsByItemId(itemId: string): Promise<Return[]> {
    const q = query(
      this.returnsCollection,
      where('originalItemId', '==', itemId),
      orderBy('receivedDate', 'desc')
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => this.mapDocToReturn(doc));
  }

  // Get pending returns (awaiting decision)
  async getPendingReturns(): Promise<Return[]> {
    const q = query(
      this.returnsCollection,
      where('returnDecision', '==', 'pending'),
      orderBy('receivedDate', 'desc')
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => this.mapDocToReturn(doc));
  }

  // Get returns by status
  async getReturnsByStatus(status: ReturnStatus): Promise<Return[]> {
    const q = query(
      this.returnsCollection,
      where('status', '==', status),
      orderBy('receivedDate', 'desc')
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => this.mapDocToReturn(doc));
  }

  // Get returns needing decision
  async getReturnsNeedingDecision(): Promise<Return[]> {
    const q = query(
      this.returnsCollection,
      where('returnDecision', '==', 'pending'),
      orderBy('receivedDate', 'asc') // Oldest first
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => this.mapDocToReturn(doc));
  }

  // ==================== SEARCH METHODS ====================

  // Search returns
  async searchReturns(searchTerm: string): Promise<Return[]> {
    const allReturns = await this.getAllReturns();
    const term = searchTerm.toLowerCase();
    
    return allReturns.filter(ret =>
      ret.lpnNumber.toLowerCase().includes(term) ||
      ret.trackingNumber.toLowerCase().includes(term) ||
      ret.productName.toLowerCase().includes(term) ||
      (ret.sku && ret.sku.toLowerCase().includes(term)) ||
      (ret.serialNumber && ret.serialNumber.toLowerCase().includes(term)) ||
      (ret.removalOrderId && ret.removalOrderId.toLowerCase().includes(term))
    );
  }

  // Search returns by serial number pattern
  async searchReturnsBySerialPattern(pattern: string): Promise<Return[]> {
    const q = query(
      this.returnsCollection,
      where('serialNumber', '>=', pattern),
      where('serialNumber', '<=', pattern + '\uf8ff'),
      orderBy('serialNumber'),
      limit(20)
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => this.mapDocToReturn(doc));
  }

  // ==================== STATISTICS METHODS ====================

  // Get return statistics
  async getReturnStatistics(): Promise<{
    totalReturns: number;
    pendingDecisions: number;
    movedToInventory: number;
    keptInReturns: number;
    returnsWithImages: number;
    returnsWithSerialNumbers: number;
    returnsByCondition: Record<ReturnCondition, number>;
    returnsByStatus: Record<ReturnStatus, number>;
    todayReturns: number;
    weeklyReturns: number[];
  }> {
    const allReturns = await this.getAllReturns();
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];
    
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const stats = {
      totalReturns: allReturns.length,
      pendingDecisions: 0,
      movedToInventory: 0,
      keptInReturns: 0,
      returnsWithImages: 0,
      returnsWithSerialNumbers: 0,
      returnsByCondition: {
        [ReturnCondition.INTACT]: 0,
        [ReturnCondition.OPENED]: 0,
        [ReturnCondition.DAMAGED]: 0,
      },
      returnsByStatus: {
        [ReturnStatus.RECEIVED]: 0,
        [ReturnStatus.PROCESSED]: 0,
        [ReturnStatus.MOVED_TO_INVENTORY]: 0,
        [ReturnStatus.KEPT_IN_RETURNS]: 0,
      },
      todayReturns: 0,
      weeklyReturns: [0, 0, 0, 0, 0, 0, 0], // Last 7 days
    };

    allReturns.forEach(ret => {
      // Count by decision
      if (ret.returnDecision === 'pending') stats.pendingDecisions++;
      else if (ret.returnDecision === 'move_to_inventory') stats.movedToInventory++;
      else if (ret.returnDecision === 'keep_in_returns') stats.keptInReturns++;

      // Count images and serial numbers
      if (ret.driveFiles && ret.driveFiles.length > 0) stats.returnsWithImages++;
      if (ret.serialNumber) stats.returnsWithSerialNumbers++;

      // Count by condition
      stats.returnsByCondition[ret.condition]++;

      // Count by status
      stats.returnsByStatus[ret.status]++;

      // Count today's returns
      if (ret.receivedDate.startsWith(todayStr)) stats.todayReturns++;

      // Count weekly returns
      const returnDate = new Date(ret.receivedDate);
      if (returnDate >= weekAgo) {
        const dayIndex = 6 - Math.floor((today.getTime() - returnDate.getTime()) / (24 * 60 * 60 * 1000));
        if (dayIndex >= 0 && dayIndex < 7) {
          stats.weeklyReturns[dayIndex]++;
        }
      }
    });

    return stats;
  }

  // ==================== HELPER METHODS ====================

  // Update return
  async updateReturn(id: string, updates: Partial<Return>): Promise<void> {
    const docRef = doc(this.returnsCollection, id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: Timestamp.now(),
    });
  }

  // Process return (legacy method)
  async processReturn(id: string, userId: string): Promise<void> {
    await this.updateReturn(id, {
      status: ReturnStatus.PROCESSED,
      processedDate: new Date().toISOString(),
      processedBy: userId,
    });
  }

  // Delete return
  async deleteReturn(id: string): Promise<void> {
    return runTransaction(db, async (transaction) => {
      const returnRef = doc(this.returnsCollection, id);
      const returnDoc = await transaction.get(returnRef);
      
      if (!returnDoc.exists()) {
        throw new Error('Return not found');
      }

      const returnData = returnDoc.data() as Return;

      // If return has an associated item, reset its status
      if (returnData.originalItemId) {
        const itemRef = doc(this.serialNumberItemsCollection, returnData.originalItemId);
        const itemDoc = await transaction.get(itemRef);
        
        if (itemDoc.exists()) {
          const item = itemDoc.data() as SerialNumberItem;
          
          // Reset item status based on its previous state
          const newStatus = item.deliveryId ? InventoryItemStatus.DELIVERED : InventoryItemStatus.AVAILABLE;
          
          transaction.update(itemRef, {
            status: newStatus,
            returnId: null,
            updatedAt: Timestamp.now(),
          });

          // Update batch quantities
          const batchRef = doc(this.inventoryCollection, item.batchId);
          const batchDoc = await transaction.get(batchRef);
          
          if (batchDoc.exists()) {
            const batch = batchDoc.data() as InventoryBatch;
            transaction.update(batchRef, {
              returnedQuantity: batch.returnedQuantity - 1,
              availableQuantity: newStatus === InventoryItemStatus.AVAILABLE ? batch.availableQuantity + 1 : batch.availableQuantity,
              deliveredQuantity: newStatus === InventoryItemStatus.DELIVERED ? batch.deliveredQuantity + 1 : batch.deliveredQuantity,
            });
          }
        }
      }

      // Delete the return
      transaction.delete(returnRef);
    });
  }

  // Add images to return
  async addImagesToReturn(
    returnId: string, 
    driveFiles: DriveFileReference[]
  ): Promise<void> {
    const docRef = doc(this.returnsCollection, returnId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      throw new Error('Return not found');
    }

    const currentReturn = docSnap.data() as Return;
    const existingFiles = currentReturn.driveFiles || [];
    
    await updateDoc(docRef, {
      driveFiles: [...existingFiles, ...driveFiles],
      updatedAt: Timestamp.now(),
    });
  }

  // Remove images from return
  async removeImageFromReturn(
    returnId: string, 
    fileId: string
  ): Promise<void> {
    const docRef = doc(this.returnsCollection, returnId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      throw new Error('Return not found');
    }

    const currentReturn = docSnap.data() as Return;
    const updatedFiles = (currentReturn.driveFiles || []).filter(file => file.fileId !== fileId);
    
    await updateDoc(docRef, {
      driveFiles: updatedFiles,
      updatedAt: Timestamp.now(),
    });
  }

  // Get return history for dashboard
  async getReturnHistory(limit: number = 10): Promise<Return[]> {
    const q = query(
      this.returnsCollection,
      orderBy('receivedDate', 'desc'),
      limit(limit)
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => this.mapDocToReturn(doc));
  }

  // Helper function to map Firestore doc to Return object
  private mapDocToReturn(doc: any): Return {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      receivedDate: data.receivedDate?.toDate?.().toISOString() || new Date().toISOString(),
      processedDate: data.processedDate?.toDate?.().toISOString(),
      returnDecisionDate: data.returnDecisionDate?.toDate?.().toISOString(),
    } as Return;
  }
}

export const returnService = new ReturnService();