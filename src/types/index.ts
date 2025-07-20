// src/types/index.ts - Updated with Serial Number Support

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
  MOVED_TO_INVENTORY = 'moved_to_inventory',
  KEPT_IN_RETURNS = 'kept_in_returns', // New status for items kept in returns
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

// New enum for serial number status
export enum SerialNumberStatus {
  UNASSIGNED = 'unassigned',
  ASSIGNED = 'assigned',
  DELIVERED = 'delivered',
  RETURNED = 'returned',
}

// New enum for inventory item status
export enum InventoryItemStatus {
  AVAILABLE = 'available',
  RESERVED = 'reserved',
  DELIVERED = 'delivered',
  RETURNED = 'returned',
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

// New interface for individual inventory items with serial numbers
export interface SerialNumberItem {
  id: string;
  batchId: string; // Reference to the inventory batch
  serialNumber?: string; // Optional, can be assigned later
  status: InventoryItemStatus;
  assignedDate?: string;
  assignedBy?: string;
  deliveryId?: string; // Reference to delivery if delivered
  returnId?: string; // Reference to return if returned
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  deliveryDate?: string;
}

// Updated interface for serial number validation
export interface SerialNumberValidation {
  exists: boolean;
  item?: SerialNumberItem;
  batch?: InventoryBatch;
  productName?: string;
  sku?: string;
  currentStatus?: InventoryItemStatus;
  lastDeliveryDate?: string;
  returnHistory?: Return[];
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
  // Link to created inventory items
  createdInventoryItems?: string[]; // Array of SerialNumberItem IDs
  labeledDate?: string;
  dispatchDate?: string;
  quantity?: number;
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
  serialNumber?: string; // The serial number of the returned item
  reason?: string;
  notes?: string;
  processedDate?: string;
  processedBy?: string;
  driveFiles?: DriveFileReference[];
  // New fields for enhanced return management
  originalItemId?: string; // Reference to the original SerialNumberItem
  originalDeliveryId?: string; // Reference to the original delivery
  returnDecision?: 'move_to_inventory' | 'keep_in_returns' | 'pending';
  returnDecisionDate?: string;
  returnDecisionBy?: string;
  returnDecisionNotes?: string;
}

export interface StockLog {
  id: string;
  timestamp: string;
  type: 'IN' | 'OUT' | 'ADJUSTMENT';
  sku: string;
  productName: string;
  quantityChange: number;
  newQuantity: number;
  user: string;
  notes: string;
  referenceId: string; // e.g., Package ID, Return ID, Delivery ID
  batchId?: string; // Optional reference to inventory batch
  itemId?: string; // Optional reference to specific item
}

// Updated inventory batch interface
export interface InventoryBatch {
  id: string;
  sku: string;
  productName: string;
  totalQuantity: number;
  availableQuantity: number; // Items available for delivery
  reservedQuantity: number; // Items reserved for pending deliveries
  deliveredQuantity: number; // Items that have been delivered
  returnedQuantity: number; // Items that have been returned
  source: InventorySource;
  sourceReference: string; // e.g., Package ID or Return ID
  receivedDate: string;
  receivedBy: string;
  batchNotes?: string;
  // New fields for serial number tracking
  serialNumbersAssigned: number; // Count of items with serial numbers
  serialNumbersUnassigned: number; // Count of items without serial numbers
  items?: SerialNumberItem[]; // Array of individual items in this batch
  updatedAt?: string;
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

// Updated form for bulk receiving
export interface ReceivePackageForm {
  trackingNumber: string;
  carrier: Carrier;
  productName: string;
  sku?: string;
  barcode?: string;
  quantity: number; // Number of individual items to create
  notes?: string;
  // Optional: Pre-fill some serial numbers if available
  serialNumbers?: string[]; // Array of serial numbers (optional)
}

// Updated return form to include serial number scanning
export interface ReturnForm {
  lpnNumber?: string;
  trackingNumber?: string;
  productName?: string;
  sku?: string;
  condition?: ReturnCondition;
  reason?: string;
  notes?: string;
  quantity?: number;
  fbaFbm?: 'FBA' | 'FBM';
  removalOrderId?: string;
  serialNumber?: string;
  returnDecision?: 'move_to_inventory' | 'keep_in_returns';
  returnDecisionNotes?: string;
}

// Updated delivery form to include serial number assignment
export interface DeliveryForm {
  inventoryBatchId: string;
  selectedItemId?: string; // ID of the specific SerialNumberItem to deliver
  productSerialNumber?: string; // Serial number to assign if not already assigned
  shippingLabelData: ShippingLabelData;
  customerInfo: CustomerInfo;
  deliveryTracking?: string;
}

// New form for bulk serial number assignment
export interface BulkSerialNumberForm {
  batchId: string;
  serialNumbers: Array<{
    itemId: string;
    serialNumber: string;
  }>;
  assignedBy: string;
  notes?: string;
}

// New form for serial number search
export interface SerialNumberSearchForm {
  serialNumber: string;
  includeDelivered?: boolean;
  includeReturned?: boolean;
}

// ------------- Statistics & Search Interfaces -------------

// Updated inventory stats
export interface InventoryStats {
  totalBatches: number;
  totalItems: number; // Total individual items
  totalAvailableItems: number;
  totalReservedItems: number;
  totalDeliveredItems: number;
  totalReturnedItems: number;
  newArrivals: number;
  fromReturns: number;
  uniqueSKUs: number;
  // New serial number stats
  itemsWithSerialNumbers: number;
  itemsWithoutSerialNumbers: number;
  serialNumberAssignmentRate: number; // Percentage
}

export interface DashboardStats {
  todayReceived: number;
  readyForDispatch: number;
  todayDispatched: number;
  pendingReturns: number;
  totalPackages: number;
  totalInventoryItems: number;
  pendingReturnItems: number;
  // New serial number stats
  itemsNeedingSerialNumbers: number;
  serialNumbersAssignedToday: number;
  returnedItemsToday: number;
  weeklyTrend: {
    received: number[];
    dispatched: number[];
    returns: number[];
    serialNumbersAssigned: number[];
    labels: string[];
  };
}

export interface SearchResult {
  id: string;
  type: 'package' | 'return' | 'inventory' | 'delivered' | 'serial_number';
  title: string;
  subtitle: string;
  status: string;
  date: string;
  relevanceScore: number;
  // New fields for serial number search
  serialNumber?: string;
  itemId?: string;
  batchId?: string;
}

export interface SearchFilters {
  type: string;
  status: string;
  dateRange: {
    start: string;
    end: string;
  };
  // New filters
  hasSerialNumber?: boolean;
  serialNumberStatus?: SerialNumberStatus;
  inventorySource?: InventorySource;
}

// ------------- New Interfaces for Enhanced Functionality -------------

// Interface for serial number history tracking
export interface SerialNumberHistory {
  id: string;
  serialNumber: string;
  itemId: string;
  action: 'assigned' | 'delivered' | 'returned' | 'moved_to_inventory';
  actionDate: string;
  actionBy: string;
  details?: string;
  referenceId?: string; // Delivery ID, Return ID, etc.
}

// Interface for bulk operations
export interface BulkOperation {
  id: string;
  type: 'serial_number_assignment' | 'bulk_delivery' | 'bulk_return';
  itemIds: string[];
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  createdBy: string;
  createdAt: string;
  completedAt?: string;
  results?: {
    successful: number;
    failed: number;
    errors?: string[];
  };
}

// Interface for delivery with serial number assignment
export interface DeliveryWithSerialNumber {
  deliveryId: string;
  itemId: string;
  serialNumber: string;
  batchId: string;
  productName: string;
  sku: string;
  customerInfo: CustomerInfo;
  shippingLabelData: ShippingLabelData;
  deliveryDate: string;
  deliveredBy: string;
  status: 'pending' | 'delivered' | 'returned';
}

// Interface for return with serial number lookup
export interface ReturnWithSerialNumber {
  returnId: string;
  serialNumber: string;
  originalItemId?: string;
  originalDeliveryId?: string;
  returnData: Return;
  originalProductInfo?: {
    productName: string;
    sku: string;
    batchId: string;
    deliveryDate?: string;
    customerInfo?: CustomerInfo;
  };
}

// Interface for inventory item with full details
export interface InventoryItemWithDetails {
  item: SerialNumberItem;
  batch: InventoryBatch;
  deliveryHistory?: DeliveryWithSerialNumber[];
  returnHistory?: ReturnWithSerialNumber[];
  currentLocation: 'inventory' | 'delivered' | 'returned';
  lastAction?: {
    type: string;
    date: string;
    by: string;
    details?: string;
  };
}

export interface Delivery {
  id: string; // Only ID is mandatory
  itemId?: string;
  batchId?: string;
  serialNumber?: string;
  sku?: string; // ADD THIS
  productName?: string; // ADD THIS
  shippingLabelData?: ShippingLabelData;
  customerInfo?: CustomerInfo;
  deliveredBy?: string;
  status?: 'pending' | 'delivered' | 'returned';
  deliveryDate?: string;
  createdAt?: string;
  updatedAt?: string;
  trackingNumber?: string;
  notes?: string;
}