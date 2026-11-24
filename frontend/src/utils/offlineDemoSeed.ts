import { db, type OfflineProduct } from '../db/offlineDb';

export const DEMO_BUSINESS = {
  id: '1bc28f4b-42e6-40a1-86da-aa9173052762',
  name: 'ADK Supermarket & Retail',
  businessType: 'Supermarket / Grocery',
  phone: '+94 65 222 3456',
  email: 'info@adksuper.lk',
  address: '142 Main Street, Batticaloa',
  city: 'Batticaloa',
  country: 'Sri Lanka',
  currency: 'LKR',
  timezone: 'Asia/Colombo'
};

export const DEMO_USERS: Record<string, any> = {
  'owner@pos.lk': {
    id: 'user-owner-001',
    name: 'Karthik Sivakumar (Owner)',
    email: 'owner@pos.lk',
    status: 'ACTIVE',
    isSuperAdmin: false,
    memberships: [{ businessId: DEMO_BUSINESS.id, role: 'OWNER', business: DEMO_BUSINESS }]
  },
  'manager@pos.lk': {
    id: 'user-manager-002',
    name: 'Ramesh Sundaram (Manager)',
    email: 'manager@pos.lk',
    status: 'ACTIVE',
    isSuperAdmin: false,
    memberships: [{ businessId: DEMO_BUSINESS.id, role: 'MANAGER', business: DEMO_BUSINESS }]
  },
  'cashier@pos.lk': {
    id: 'user-cashier-003',
    name: 'Anjali Devi (Cashier)',
    email: 'cashier@pos.lk',
    status: 'ACTIVE',
    isSuperAdmin: false,
    memberships: [{ businessId: DEMO_BUSINESS.id, role: 'CASHIER', business: DEMO_BUSINESS }]
  },
  'superadmin@pos.lk': {
    id: 'user-superadmin-004',
    name: 'Global Super Admin',
    email: 'superadmin@pos.lk',
    status: 'ACTIVE',
    isSuperAdmin: true,
    memberships: [{ businessId: DEMO_BUSINESS.id, role: 'OWNER', business: DEMO_BUSINESS }]
  }
};

export const DEMO_CATEGORIES = [
  { id: 'cat-bev', name: 'Beverages', description: 'Soft drinks, fruit juice, tea, water' },
  { id: 'cat-snk', name: 'Snacks & Confectionery', description: 'Biscuits, chocolates, crisps' },
  { id: 'cat-dry', name: 'Dairy & Milk', description: 'Milk powder, fresh milk, butter, cheese' },
  { id: 'cat-hsh', name: 'Household & Personal Care', description: 'Soap, detergents, toiletries' }
];

export const DEMO_PRODUCTS: OfflineProduct[] = [
  {
    id: 'prod-001',
    businessId: DEMO_BUSINESS.id,
    name: 'Elephant House Ginger Beer 400ml',
    sku: 'EHB-400',
    barcode: '4791001001015',
    unit: 'Bottle',
    sellingPrice: 220,
    stockQuantity: 85,
    status: 'ACTIVE',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'prod-002',
    businessId: DEMO_BUSINESS.id,
    name: 'Munchee Chocolate Marie 200g',
    sku: 'MCM-200',
    barcode: '4791002002022',
    unit: 'Packet',
    sellingPrice: 180,
    stockQuantity: 140,
    status: 'ACTIVE',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'prod-003',
    businessId: DEMO_BUSINESS.id,
    name: 'Anchor Full Cream Milk Powder 400g',
    sku: 'ANC-400',
    barcode: '4791003003039',
    unit: 'Box',
    sellingPrice: 1150,
    stockQuantity: 45,
    status: 'ACTIVE',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'prod-004',
    businessId: DEMO_BUSINESS.id,
    name: 'Dilmah Premium Ceylon Tea 100g',
    sku: 'DIL-100',
    barcode: '4791004004046',
    unit: 'Box',
    sellingPrice: 450,
    stockQuantity: 60,
    status: 'ACTIVE',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'prod-005',
    businessId: DEMO_BUSINESS.id,
    name: 'Sunlight Lemon Fresh Soap 100g',
    sku: 'SUN-100',
    barcode: '4791005005053',
    unit: 'Bar',
    sellingPrice: 160,
    stockQuantity: 120,
    status: 'ACTIVE',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'prod-006',
    businessId: DEMO_BUSINESS.id,
    name: 'Highland Salted Butter 200g',
    sku: 'HIG-200',
    barcode: '4791006006060',
    unit: 'Tub',
    sellingPrice: 720,
    stockQuantity: 35,
    status: 'ACTIVE',
    updatedAt: new Date().toISOString()
  }
];

export const DEMO_CUSTOMERS = [
  {
    id: 'cust-001',
    name: 'K. Perera',
    phone: '+94 77 123 4567',
    email: 'k.perera@gmail.com',
    address: '45 Lake Road, Batticaloa',
    notes: 'Loyal VIP customer, wholesale bulk buyer',
    loyaltyPoints: 340,
    totalSpent: 48500
  },
  {
    id: 'cust-002',
    name: 'Mohamed Rizwan',
    phone: '+94 71 890 1234',
    email: 'rizwan.trade@yahoo.com',
    address: '12 Hospital Road, Batticaloa',
    notes: 'Prompt payer, preferred payment: Bank Transfer',
    loyaltyPoints: 125,
    totalSpent: 22400
  },
  {
    id: 'cust-003',
    name: 'S. Thangarajah',
    phone: '+94 76 345 6789',
    email: 'sthangarajah@outlook.com',
    address: '88 Central Bar Road, Batticaloa',
    notes: 'Regular retail customer',
    loyaltyPoints: 80,
    totalSpent: 12500
  },
  {
    id: 'cust-004',
    name: 'Nimal Fernando',
    phone: '+94 75 901 2345',
    email: 'nimal.f@gmail.com',
    address: '23 Beach Road, Batticaloa',
    notes: 'Weekly grocery shopper',
    loyaltyPoints: 210,
    totalSpent: 31200
  }
];

export const DEMO_EXPENSES = [
  {
    id: 'exp-001',
    category: 'Utilities (Electricity/Water)',
    description: 'CEB Electricity Bill - Main Store Chiller & Freezers',
    amount: 14500,
    paymentMethod: 'BANK_TRANSFER',
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString()
  },
  {
    id: 'exp-002',
    category: 'Packaging Materials',
    description: '1000x Printed Eco Biodegradable Shopping Carry Bags',
    amount: 6800,
    paymentMethod: 'CASH',
    createdAt: new Date(Date.now() - 86400000).toISOString()
  },
  {
    id: 'exp-003',
    category: 'Internet & Phone',
    description: 'SLT Fibre 100Mbps Broadband & Hotspot for Billing POS',
    amount: 4250,
    paymentMethod: 'CARD',
    createdAt: new Date(Date.now() - 86400000 * 4).toISOString()
  }
];

export const DEMO_SETTINGS = {
  id: 'settings-demo-001',
  businessId: DEMO_BUSINESS.id,
  business: DEMO_BUSINESS,
  receiptPaperWidth: '58mm',
  receiptShowLogo: true,
  receiptShowPhone: true,
  receiptShowEmail: false,
  receiptShowAddress: true,
  receiptShowCustomer: true,
  receiptShowSku: false,
  receiptFooterMessage: 'Goods once sold are exchangeable within 7 days with original receipt.',
  receiptThankYouMessage: 'Thank you for shopping at ADK Supermarket!',
  posAutoPrint: true,
  whatsappEnabled: true,
  whatsappMessageTemplate: 'Hello {business_name} customer, your bill for {date} is {total}. Thank you for visiting us!'
};

export const DEMO_SUPPLIERS = [
  {
    id: 'supp-001',
    name: 'Ceylon Cold Stores PLC (Elephant House)',
    contactPerson: 'Sunil Weerasinghe',
    phone: '+94 11 244 5678',
    email: 'orders@elephanthouse.lk',
    address: '148 Vauxhall Street, Colombo 02'
  },
  {
    id: 'supp-002',
    name: 'Ceylon Biscuits Limited (Munchee)',
    contactPerson: 'Nalin Karunaratne',
    phone: '+94 11 500 0000',
    email: 'sales@muncheelk.com',
    address: 'High Level Road, Makumbura, Pannipitiya'
  },
  {
    id: 'supp-003',
    name: 'Fonterra Brands Lanka (Anchor)',
    contactPerson: 'Dhammika Bandara',
    phone: '+94 11 483 8383',
    email: 'supply@fonterra.com',
    address: 'Biyagama EPZ, Malwana'
  }
];

export const DEMO_PRINTERS = [
  {
    id: 'print-001',
    name: 'Cash Counter 1 - USB 58mm Thermal Receipt Printer',
    type: 'THERMAL_ESC_POS',
    interface: 'USB',
    paperWidth: '58mm',
    isDefault: true,
    status: 'ONLINE'
  },
  {
    id: 'print-002',
    name: 'Store Manager Office - 80mm Network Thermal Printer',
    type: 'THERMAL_ESC_POS',
    interface: 'ETHERNET',
    paperWidth: '80mm',
    isDefault: false,
    status: 'ONLINE'
  }
];

export const DEMO_SUBSCRIPTION = {
  planCode: 'ENTERPRISE',
  planName: 'Enterprise Cloud Plan',
  status: 'ACTIVE',
  productLimit: 10000,
  productCount: 6,
  remaining: 9994,
  startsAt: '2026-01-01T00:00:00.000Z',
  expiresAt: '2030-01-01T00:00:00.000Z',
  isExpired: false,
  isPro: true,
  isFree: false,
  price: 0,
  currency: 'LKR',
  billingDays: 365
};

export const DEMO_SUBSCRIPTION_PLANS = [
  {
    id: 'plan-free',
    code: 'FREE',
    name: 'Free Trial',
    price: 0,
    currency: 'LKR',
    billingPeriod: '14 Days',
    productLimit: 15,
    features: ['Basic POS checkout', 'Up to 15 products', 'Offline mode support']
  },
  {
    id: 'plan-pro',
    code: 'PRO',
    name: 'Retail Professional',
    price: 4500,
    currency: 'LKR',
    billingPeriod: 'Monthly',
    productLimit: 1000,
    features: ['Unlimited sales', 'Up to 1,000 products', 'Barcode scanning', 'Thermal receipt printing', 'WhatsApp receipts', 'Inventory alerts']
  },
  {
    id: 'plan-enterprise',
    code: 'ENTERPRISE',
    name: 'Enterprise Cloud',
    price: 9500,
    currency: 'LKR',
    billingPeriod: 'Monthly',
    productLimit: 10000,
    features: ['Multi-store management', 'Up to 10,000 products', 'Advanced reports & export', 'Dedicated offline sync engine', 'Priority WhatsApp API']
  }
];

export async function seedDemoDataToDexie(businessId = DEMO_BUSINESS.id) {
  try {
    const count = await db.products.where('businessId').equals(businessId).count();
    if (count === 0) {
      await db.products.bulkPut(DEMO_PRODUCTS.map(p => ({ ...p, businessId })));
      console.log('🌱 Seeded 6 demo retail products into offline IndexedDB database.');
    }
  } catch (err) {
    console.warn('Could not seed demo products to Dexie:', err);
    // Ensure table write fallback
    try {
      await db.products.bulkPut(DEMO_PRODUCTS);
    } catch {}
  }
}
