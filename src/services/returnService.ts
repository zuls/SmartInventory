// src/services/returnService.ts
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
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
// Ensure DriveFileReference is imported from types
import { Return, ReturnForm, ReturnStatus, ReturnCondition, DriveFileReference } from '../types'; 
import { inventoryService } from './inventoryService';

export class ReturnService {
  private returnsCollection = collection(db, 'returns');

  // Create a new return - UPDATED SIGNATURE
  async createReturn(
    formData: ReturnForm, 
    userId: string, 
    driveFiles: DriveFileReference[] = [] // Add the 3rd argument with a default value
  ): Promise<string> {
    
    const returnData: Omit<Return, 'id'> = {
      ...formData,
      status: ReturnStatus.RECEIVED,
      receivedDate: new Date().toISOString(),
      receivedBy: userId,
      driveFiles: driveFiles, // Include the drive files in the object to be saved
    };

    const docRef = await addDoc(this.returnsCollection, {
      ...returnData,
      receivedDate: Timestamp.now(),
    });
    
    return docRef.id;
  }
  
  // NEW FUNCTION to move a processed return into inventory
  async moveReturnToInventory(returnId: string, userId: string): Promise<string> {
    const returnDoc = await this.getReturnById(returnId);

    if (!returnDoc) {
      throw new Error("Return not found.");
    }
    if (returnDoc.status === ReturnStatus.MOVED_TO_INVENTORY) {
      throw new Error("This item has already been moved to inventory.");
    }

    const inventoryId = await inventoryService.createInventoryFromReturn(
      returnDoc,
      returnDoc.quantity,
      userId
    );

    await this.updateReturn(returnId, {
      status: ReturnStatus.MOVED_TO_INVENTORY,
      processedBy: userId,
      processedDate: new Date().toISOString(),
    });
    
    return inventoryId;
  }

  // Get all returns
  async getAllReturns(): Promise<Return[]> {
    const querySnapshot = await getDocs(
      query(this.returnsCollection, orderBy('receivedDate', 'desc'))
    );
    
    return querySnapshot.docs.map(doc => this.mapDocToReturn(doc)) as Return[];
  }

  // Get return by ID
  async getReturnById(id: string): Promise<Return | null> {
    const docRef = doc(db, 'returns', id);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return this.mapDocToReturn(docSnap);
    }
    
    return null;
  }

  // Update return
  async updateReturn(id: string, updates: Partial<Return>): Promise<void> {
    const docRef = doc(db, 'returns', id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: Timestamp.now(),
    });
  }

  // Process return
  async processReturn(id: string, userId: string): Promise<void> {
    await this.updateReturn(id, {
      status: ReturnStatus.PROCESSED,
      processedDate: new Date().toISOString(),
      processedBy: userId,
    });
  }

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
  
  // Get pending returns
  async getPendingReturns(): Promise<Return[]> {
    const q = query(this.returnsCollection, where('status', '==', ReturnStatus.RECEIVED));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => this.mapDocToReturn(doc));
  }
  
  // Delete return
  async deleteReturn(id: string): Promise<void> {
    const docRef = doc(db, 'returns', id);
    await deleteDoc(docRef);
  }

  // Helper function to map Firestore doc to Return object
  private mapDocToReturn(doc: any): Return {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      receivedDate: data.receivedDate?.toDate?.().toISOString() || new Date().toISOString(),
      processedDate: data.processedDate?.toDate?.().toISOString(),
    } as Return;
  }
}

export const returnService = new ReturnService();