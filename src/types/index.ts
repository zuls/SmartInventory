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

// Inventory Types
export interface InventoryBatch {
  id: string;
  sku: string;
  productName: string;
  totalQuantity: number;
  availableQuantity: number;
  reservedQuantity: number;
  source: InventorySource;
  sourceReference: string; // Package ID or Return ID
  receivedDate: string;
  receivedBy: string;
  batchNotes?: string;
}

export enum InventorySource {
  NEW_ARRIVAL = 'new_arrival',
  FROM_RETURN = 'from_return',
}

export interface InventoryStats {
  totalBatches: number;
  totalAvailableItems: number;
  totalReservedItems: number;
  newArrivals: number;
  fromReturns: number;
  uniqueSKUs: number;
}

// Delivery Types
export interface DeliveryForm {
  inventoryBatchId: string;
  productSerialNumber?: string;
  shippingLabelData: ShippingLabelData;
  customerInfo: CustomerInfo;
  deliveryTracking?: string;
}

export interface ShippingLabelData {
  labelNumber: string;
  carrier: Carrier;
  trackingNumber?: string;
  destination: string;
  weight?: string;
  dimensions?: string;
  serviceType?: string;
}

export interface CustomerInfo {
  name?: string;
  address?: string;
  email?: string;
  phone?: string;
}

// Return Types
export interface ReturnForm {
  lpnNumber: string;
  trackingNumber: string;
  productName: string;
  sku?: string;
  condition: ReturnCondition;
  reason?: string;
  notes?: string;
  quantity: number;
  removalOrderId?: string;
}

// Search Types
export interface SearchResult {
  id: string;
  type: 'package' | 'return' | 'inventory' | 'delivered';
  title: string;
  subtitle: string;
  status: string;
  date: string;
  relevanceScore: number;
}

export interface SearchFilters {
  type: string;
  status: string;
  dateRange: {
    start: string;
    end: string;
  };
}

// Enhanced Dashboard Stats
export interface DashboardStats {
  todayReceived: number;
  readyForDispatch: number;
  todayDispatched: number;
  pendingReturns: number;
  totalPackages: number;
  totalInventoryItems: number;
  pendingReturnItems: number;
  weeklyTrend: {
    received: number[];
    dispatched: number[];
    returns: number[];
    labels: string[];
  };
}