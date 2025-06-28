// src/types/index.ts
export interface Package {
  id: string;
  trackingNumber: string;
  carrier: Carrier;
  productName: string;
  sku?: string;
  barcode?: string;
  status: PackageStatus;
  receivedDate: string;
  receivedBy: string;
  label?: string;
  labeledDate?: string;
  labeledBy?: string;
  dispatchDate?: string;
  dispatchCarrier?: string;
  dispatchedBy?: string;
  notes?: string;
  driveFiles?: DriveFileReference[];
}

export interface Return {
  id: string;
  originalTrackingNumber: string;
  condition: ReturnCondition;
  reason?: string;
  notes?: string;
  returnDate: string;
  processedBy: string;
  status: ReturnStatus;
}

export interface StockLog {
  id: string;
  date: string;
  morningCount?: number;
  eveningCount?: number;
  morningRecordedAt?: string;
  eveningRecordedAt?: string;
  recordedBy: string;
  notes?: string;
}

export interface User {
  uid: string;
  email: string;
  displayName?: string;
  role: UserRole;
  lastLogin: string;
  preferences?: UserPreferences;
}

export interface UserPreferences {
  theme: 'light' | 'dark';
  defaultCarrier?: Carrier;
  notifications: {
    email: boolean;
    push: boolean;
  };
}

export interface DriveFileReference {
  fileId: string;
  fileName: string;
  webViewLink: string;
  fileType: 'image' | 'document' | 'other';
  uploadedAt: string;
  uploadedBy: string;
}

export enum PackageStatus {
  RECEIVED = 'received',
  LABELED = 'labeled', 
  READY = 'ready',
  DISPATCHED = 'dispatched',
}

export enum Carrier {
  FEDEX = 'FedEx',
  UPS = 'UPS', 
  AMAZON = 'Amazon',
  USPS = 'USPS',
  DHL = 'DHL',
  OTHER = 'Other',
}

export enum ReturnCondition {
  INTACT = 'Intact',
  OPENED = 'Opened',
  DAMAGED = 'Damaged',
}

export enum ReturnStatus {
  PENDING = 'pending',
  PROCESSED = 'processed',
}

export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager', 
  EMPLOYEE = 'employee',
}

export interface DashboardStats {
  todayReceived: number;
  readyForDispatch: number;
  todayDispatched: number;
  pendingReturns: number;
  totalPackages: number;
  weeklyTrend: {
    received: number[];
    dispatched: number[];
    labels: string[];
  };
}

export interface ReceivePackageForm {
  trackingNumber: string;
  carrier: Carrier;
  productName: string;
  sku?: string;
  barcode?: string;
  notes?: string;
}