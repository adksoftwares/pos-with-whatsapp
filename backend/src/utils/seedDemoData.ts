import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding demo data for all roles and store operations...');
  const passwordHash = await bcrypt.hash('Password123!', 10);

  // 1. Super Admin
  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@pos.lk' },
    update: { isSuperAdmin: true },
    create: {
      name: 'Global Super Admin',
      email: 'superadmin@pos.lk',
      passwordHash,
      isSuperAdmin: true,
      status: 'ACTIVE'
    }
  });
  console.log('✅ Super Admin created:', superAdmin.email);

  // 2. Business Owner
  const owner = await prisma.user.upsert({
    where: { email: 'owner@pos.lk' },
    update: {},
    create: {
      name: 'Karthik Sivakumar (Owner)',
      email: 'owner@pos.lk',
      passwordHash,
      status: 'ACTIVE'
    }
  });

  // 3. Manager
  const manager = await prisma.user.upsert({
    where: { email: 'manager@pos.lk' },
    update: {},
    create: {
      name: 'Ramesh Sundaram (Manager)',
      email: 'manager@pos.lk',
      passwordHash,
      status: 'ACTIVE'
    }
  });

  // 4. Cashier
  const cashier = await prisma.user.upsert({
    where: { email: 'cashier@pos.lk' },
    update: {},
    create: {
      name: 'Anjali Devi (Cashier)',
      email: 'cashier@pos.lk',
      passwordHash,
      status: 'ACTIVE'
    }
  });

  // 5. Business
  let business = await prisma.business.findFirst({
    where: { ownerId: owner.id }
  });

  if (!business) {
    business = await prisma.business.create({
      data: {
        name: 'ADK Supermarket & Retail',
        businessType: 'Supermarket / Grocery',
        phone: '+94 65 222 3456',
        email: 'info@adksuper.lk',
        address: '142 Main Street',
        city: 'Batticaloa',
        country: 'Sri Lanka',
        currency: 'LKR',
        timezone: 'Asia/Colombo',
        ownerId: owner.id
      }
    });
  }
  console.log('✅ Business ready:', business.name);

  // Ensure Memberships
  await prisma.businessMembership.upsert({
    where: { userId_businessId: { userId: owner.id, businessId: business.id } },
    update: { role: Role.OWNER },
    create: { userId: owner.id, businessId: business.id, role: Role.OWNER }
  });

  await prisma.businessMembership.upsert({
    where: { userId_businessId: { userId: manager.id, businessId: business.id } },
    update: { role: Role.MANAGER },
    create: { userId: manager.id, businessId: business.id, role: Role.MANAGER }
  });

  await prisma.businessMembership.upsert({
    where: { userId_businessId: { userId: cashier.id, businessId: business.id } },
    update: { role: Role.CASHIER },
    create: { userId: cashier.id, businessId: business.id, role: Role.CASHIER }
  });

  await prisma.businessMembership.upsert({
    where: { userId_businessId: { userId: superAdmin.id, businessId: business.id } },
    update: { role: Role.OWNER },
    create: { userId: superAdmin.id, businessId: business.id, role: Role.OWNER }
  });

  // Business Settings
  await prisma.businessSettings.upsert({
    where: { businessId: business.id },
    update: {},
    create: {
      businessId: business.id,
      receiptPaperWidth: '80mm',
      receiptShowLogo: true,
      receiptShowPhone: true,
      receiptShowAddress: true,
      receiptShowCustomer: true,
      whatsappEnabled: true,
      receiptFooterMessage: 'Thank you for shopping at ADK Supermarket!'
    }
  });

  // Activate Pro Subscription
  const proPlan = await prisma.plan.findUnique({ where: { code: 'PRO' } });
  if (proPlan) {
    const existingSub = await prisma.subscription.findFirst({
      where: { businessId: business.id, status: 'ACTIVE' }
    });
    if (!existingSub) {
      const now = new Date();
      const expiresAt = new Date();
      expiresAt.setDate(now.getDate() + 365);
      await prisma.subscription.create({
        data: {
          businessId: business.id,
          planId: proPlan.id,
          status: 'ACTIVE',
          startsAt: now,
          expiresAt
        }
      });
    }
  }

  // Categories
  const categoriesData = [
    { name: 'Beverages', description: 'Soft drinks, fruit juices, and water' },
    { name: 'Snacks & Confectionery', description: 'Biscuits, chocolates, crisps' },
    { name: 'Dairy & Milk', description: 'Fresh milk, milk powder, butter, cheese' },
    { name: 'Household & Personal Care', description: 'Soaps, detergents, cleaning supplies' }
  ];

  const catMap: Record<string, string> = {};
  for (const c of categoriesData) {
    const cat = await prisma.category.upsert({
      where: { businessId_name: { businessId: business.id, name: c.name } },
      update: {},
      create: { businessId: business.id, name: c.name, description: c.description }
    });
    catMap[c.name] = cat.id;
  }

  // Sample Products
  const productsData = [
    {
      name: 'Elephant House Ginger Beer 400ml',
      sku: 'EHB-01',
      barcode: '1001',
      category: 'Beverages',
      sellingPrice: 220,
      costPrice: 175,
      stockQuantity: 50,
      company: 'Elephant House'
    },
    {
      name: 'Munchee Chocolate Marie 200g',
      sku: 'MCH-02',
      barcode: '1002',
      category: 'Snacks & Confectionery',
      sellingPrice: 180,
      costPrice: 145,
      stockQuantity: 65,
      company: 'Munchee'
    },
    {
      name: 'Anchor Full Cream Milk Powder 400g',
      sku: 'ANC-03',
      barcode: '1003',
      category: 'Dairy & Milk',
      sellingPrice: 1150,
      costPrice: 980,
      stockQuantity: 30,
      company: 'Fonterra Anchor'
    },
    {
      name: 'Dilmah Premium Ceylon Tea 100g',
      sku: 'DLM-04',
      barcode: '1004',
      category: 'Beverages',
      sellingPrice: 380,
      costPrice: 300,
      stockQuantity: 40,
      company: 'Dilmah'
    },
    {
      name: 'Sunlight Lemon Fresh Soap 100g',
      sku: 'SUN-05',
      barcode: '1005',
      category: 'Household & Personal Care',
      sellingPrice: 160,
      costPrice: 125,
      stockQuantity: 85,
      company: 'Unilever'
    },
    {
      name: 'Highland Salted Butter 200g',
      sku: 'HLD-06',
      barcode: '1006',
      category: 'Dairy & Milk',
      sellingPrice: 850,
      costPrice: 720,
      stockQuantity: 22,
      company: 'Highland'
    }
  ];

  for (const p of productsData) {
    const existing = await prisma.product.findFirst({
      where: { businessId: business.id, barcode: p.barcode }
    });
    if (!existing) {
      await prisma.product.create({
        data: {
          businessId: business.id,
          name: p.name,
          sku: p.sku,
          barcode: p.barcode,
          categoryId: catMap[p.category],
          sellingPrice: p.sellingPrice,
          costPrice: p.costPrice,
          stockQuantity: p.stockQuantity,
          lowStockThreshold: 10,
          company: p.company
        }
      });
    }
  }
  console.log('✅ Products seeded');

  // Customers
  const customersData = [
    { name: 'Kumaranathan K.', phone: '0771234567', email: 'kumaran@gmail.com', address: 'Kallady, Batticaloa' },
    { name: 'Fatima Zahra', phone: '0719876543', email: 'fatima.z@gmail.com', address: 'Kattankudy' },
    { name: 'Nimal Perera', phone: '0755554321', email: 'nimal@yahoo.com', address: 'Colombo 03' }
  ];

  for (const cust of customersData) {
    const existing = await prisma.customer.findFirst({
      where: { businessId: business.id, phone: cust.phone }
    });
    if (!existing) {
      await prisma.customer.create({
        data: {
          businessId: business.id,
          name: cust.name,
          phone: cust.phone,
          email: cust.email,
          address: cust.address,
          totalSpent: 4500,
          loyaltyPoints: 45
        }
      });
    }
  }
  console.log('✅ Customers seeded');

  // Suppliers
  const suppliersData = [
    { name: 'Ceylon Agro Distributions Ltd', contactName: 'Rohan Jayasinghe', phone: '0112345678', email: 'orders@ceylonagro.lk' },
    { name: 'Maliban & Munchee Direct Wholesale', contactName: 'Kolitha Dias', phone: '0118765432', email: 'sales@biscuitdirect.lk' }
  ];

  for (const s of suppliersData) {
    const existing = await prisma.supplier.findFirst({
      where: { businessId: business.id, name: s.name }
    });
    if (!existing) {
      await prisma.supplier.create({
        data: {
          businessId: business.id,
          name: s.name,
          phone: s.phone,
          email: s.email,
          notes: `Contact: ${s.contactName}`
        }
      });
    }
  }
  console.log('✅ Suppliers seeded');

  console.log('\n🎉 ALL DEMO ACCOUNTS AND DATA READY!');
  console.log('Credentials:');
  console.log('  1. Super Admin: superadmin@pos.lk / Password123!');
  console.log('  2. Owner:       owner@pos.lk / Password123!');
  console.log('  3. Manager:     manager@pos.lk / Password123!');
  console.log('  4. Cashier:     cashier@pos.lk / Password123!');
}

main()
  .catch((e) => {
    console.error('Error seeding demo data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
