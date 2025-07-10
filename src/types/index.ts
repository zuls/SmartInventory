// src/types/index.ts

// ------------- Core Enums -------------

export enum Carrier {
  FEDEX = 'FedEx',
  UPS = 'UPS',
  AMAZON = 'Amazon',
  USPS = 'USPS',
  DHL = 'DHL',
  OTHER = 'Other',
}

export enum PackageStatus {
  RECEIVED = 'received',
  LABELED = 'labeled',
  READY = 'ready',
  DISPATCHED = 'dispatched',
}

export enum ReturnCondition {
  INTACT = 'Intact',
  OPENED = 'Opened',
  DAMAGED = 'Damaged',
}

export enum ReturnStatus {
  RECEIVED = 'received',
  PROCESSED = 'processed',
  MOVED_TO_INVENTORY = 'moved_to_inventory', // Added status
}

export enum InventorySource {
  NEW_ARRIVAL = 'new_arrival',
  FROM_RETURN = 'from_return',
}

export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  EMPLOYEE = 'employee',
}


// ------------- Data Interfaces -------------

export interface DriveFileReference {
  fileId: string;
  fileName: string;
  webViewLink: string;
  fileType: 'image' | 'document' | 'other';
  uploadedAt: string;
  uploadedBy: string;
}

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
  notes?: string;
  // Other fields as needed
}

export interface Return {
  id: string;
  lpnNumber: string;
  trackingNumber: string;
  productName: string;
  sku?: string;
  condition: ReturnCondition;
  quantity: number;
  status: ReturnStatus;
  receivedDate: string;
  receivedBy: string;
  fbaFbm?: 'FBA' | 'FBM';
  removalOrderId?: string;
  serialNumber?: string;
  reason?: string;
  notes?: string;
  processedDate?: string;
  processedBy?: string;
  driveFiles?: DriveFileReference[];
}

export interface InventoryBatch {
  id: string;
  sku: string;
  productName: string;
  totalQuantity: number;
  availableQuantity: number;
  reservedQuantity: number;
  source: InventorySource;
  sourceReference: string; // e.g., Package ID or Return ID
  receivedDate: string;
  receivedBy: string;
  batchNotes?: string;
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

// ------------- Form Interfaces -------------

export interface ReceivePackageForm {
  trackingNumber: string;
  carrier: Carrier;
  productName: string;
  sku?: string;
  barcode?: string;
  quantity: number; // Added for bulk receiving
  notes?: string;
}

export interface ReturnForm {
  lpnNumber: string;
  trackingNumber: string;
  productName: string;
  sku?: string;
  condition: ReturnCondition;
  reason?: string;
  notes?: string;
  quantity: number;
  fbaFbm?: 'FBA' | 'FBM';
  removalOrderId?: string;
  serialNumber?: string;
}

export interface DeliveryForm {
  inventoryBatchId: string;
  productSerialNumber?: string;
  shippingLabelData: ShippingLabelData;
  customerInfo: CustomerInfo;
  deliveryTracking?: string;
}

// ------------- Statistics & Search Interfaces -------------

export interface InventoryStats {
  totalBatches: number;
  totalAvailableItems: number;
  totalReservedItems: number;
  newArrivals: number;
  fromReturns: number;
  uniqueSKUs: number;
}

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