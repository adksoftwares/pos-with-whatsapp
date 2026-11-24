import { db, type OfflineProduct } from '../db/offlineDb';

export const DEMO_BUSINESS = {
  id: '1bc28f4b-42e6-40a1-86da-aa9173052762',
  name: 'ADK Supermarket & Retail',
  businessType: 'Supermarket / Grocery',
  phone: '+94 65 222 3456',
  email: 'info@adksuper.lk',
  address: '142 Main Street, Batticaloa',
  currency: 'LKR',
  timezone: 'Asia/Colombo'
};

export const DEMO_USERS = {
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

export async function seedDemoDataToDexie(businessId = DEMO_BUSINESS.id) {
  try {
    const count = await db.products.where('businessId').equals(businessId).count();
    if (count === 0) {
      await db.products.bulkPut(DEMO_PRODUCTS.map(p => ({ ...p, businessId })));
      console.log('🌱 Seeded 6 demo retail products into offline IndexedDB database.');
    }
  } catch (err) {
    console.warn('Could not seed demo products to Dexie:', err);
  }
}
