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
import { Return, ReturnForm, ReturnStatus, ReturnCondition } from '../types';

export class ReturnService {
  private returnsCollection = collection(db, 'returns');

  // Create a new return
  async createReturn(formData: ReturnForm, userId: string): Promise<string> {
    const returnData: Omit<Return, 'id'> = {
      lpnNumber: formData.lpnNumber,
      trackingNumber: formData.trackingNumber,
      productName: formData.productName,
      sku: formData.sku,
      condition: formData.condition,
      reason: formData.reason,
      notes: formData.notes,
      quantity: formData.quantity,
      removalOrderId: formData.removalOrderId,
      status: ReturnStatus.RECEIVED,
      receivedDate: new Date().toISOString(),
      receivedBy: userId,
    };

    const docRef = await addDoc(this.returnsCollection, {
      ...returnData,
      receivedDate: Timestamp.now(),
    });
    
    return docRef.id;
  }

  // Get all returns
  async getAllReturns(): Promise<Return[]> {
    const querySnapshot = await getDocs(
      query(this.returnsCollection, orderBy('receivedDate', 'desc'))
    );
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      receivedDate: doc.data().receivedDate?.toDate?.()?.toISOString() || new Date().toISOString(),
      processedDate: doc.data().processedDate?.toDate?.()?.toISOString(),
    })) as Return[];
  }

  // Get return by ID
  async getReturnById(id: string): Promise<Return | null> {
    const docRef = doc(db, 'returns', id);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        receivedDate: data.receivedDate?.toDate?.()?.toISOString() || new Date().toISOString(),
        processedDate: data.processedDate?.toDate?.()?.toISOString(),
      } as Return;
    }
    
    return null;
  }

  // Update return
  async updateReturn(id: string, updates: Partial<Return>): Promise<void> {
    const docRef = doc(db, 'returns', id);
    
    const updateData = { ...updates };
    if (updates.processedDate) {
      updateData.processedDate = Timestamp.fromDate(new Date(updates.processedDate));
    }
    
    await updateDoc(docRef, {
      ...updateData,
      updatedAt: Timestamp.now(),
    });
  }

  // Process return (mark as processed)
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
      (ret.removalOrderId && ret.removalOrderId.toLowerCase().includes(term))
    );
  }

  // Get returns by status
  async getReturnsByStatus(status: ReturnStatus): Promise<Return[]> {
    const querySnapshot = await getDocs(
      query(
        this.returnsCollection,
        where('status', '==', status),
        orderBy('receivedDate', 'desc')
      )
    );
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      receivedDate: doc.data().receivedDate?.toDate?.()?.toISOString() || new Date().toISOString(),
      processedDate: doc.data().processedDate?.toDate?.()?.toISOString(),
    })) as Return[];
  }

  // Get pending returns
  async getPendingReturns(): Promise<Return[]> {
    return this.getReturnsByStatus(ReturnStatus.RECEIVED);
  }

  // Get today's return statistics
  async getTodayReturnStats(): Promise<{
    received: number;
    processed: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    const allReturns = await this.getAllReturns();
    
    return {
      received: allReturns.filter(ret => 
        ret.receivedDate && ret.receivedDate.startsWith(todayStr)
      ).length,
      processed: allReturns.filter(ret => 
        ret.processedDate && ret.processedDate.startsWith(todayStr)
      ).length,
    };
  }

  // Get returns by condition
  async getReturnsByCondition(condition: ReturnCondition): Promise<Return[]> {
    const querySnapshot = await getDocs(
      query(
        this.returnsCollection,
        where('condition', '==', condition),
        orderBy('receivedDate', 'desc')
      )
    );
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      receivedDate: doc.data().receivedDate?.toDate?.()?.toISOString() || new Date().toISOString(),
      processedDate: doc.data().processedDate?.toDate?.()?.toISOString(),
    })) as Return[];
  }

  // Delete return
  async deleteReturn(id: string): Promise<void> {
    const docRef = doc(db, 'returns', id);
    await deleteDoc(docRef);
  }

  // Get return statistics
  async getReturnStatistics(): Promise<{
    totalReturns: number;
    pendingReturns: number;
    processedReturns: number;
    conditionBreakdown: Record<ReturnCondition, number>;
  }> {
    const allReturns = await this.getAllReturns();
    
    const conditionBreakdown = allReturns.reduce((acc, ret) => {
      acc[ret.condition] = (acc[ret.condition] || 0) + 1;
      return acc;
    }, {} as Record<ReturnCondition, number>);
    
    return {
      totalReturns: allReturns.length,
      pendingReturns: allReturns.filter(ret => ret.status === ReturnStatus.RECEIVED).length,
      processedReturns: allReturns.filter(ret => ret.status === ReturnStatus.PROCESSED).length,
      conditionBreakdown,
    };
  }
}

export const returnService = new ReturnService();