import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import { db, type OfflineProduct } from '../db/offlineDb';
import {
  DEMO_BUSINESS,
  DEMO_USERS,
  DEMO_CATEGORIES,
  DEMO_PRODUCTS,
  DEMO_CUSTOMERS,
  DEMO_EXPENSES,
  DEMO_SETTINGS,
  DEMO_SUPPLIERS,
  DEMO_PRINTERS,
  DEMO_SUBSCRIPTION,
  DEMO_SUBSCRIPTION_PLANS,
  seedDemoDataToDexie
} from '../utils/offlineDemoSeed';

// Persistent localStorage state keys
const CUSTOMERS_KEY = 'pos_standalone_customers';
const EXPENSES_KEY = 'pos_standalone_expenses';
const SETTINGS_KEY = 'pos_standalone_settings';
const SHIFT_KEY = 'offline_active_shift';
const PRINTERS_KEY = 'pos_standalone_printers';

function getStored<T>(key: string, fallback: T): T {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : fallback;
  } catch {
    return fallback;
  }
}

function setStored<T>(key: string, val: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {}
}

export async function handleStandaloneRequest(config: AxiosRequestConfig): Promise<AxiosResponse> {
  const method = (config.method || 'get').toLowerCase();
  const rawUrl = config.url || '';
  // Normalize URL by removing baseURL prefix or leading slashes
  const cleanUrl = rawUrl.replace(/^https?:\/\/[^/]+/, '').replace(/^\/api\/v1/, '').replace(/^\//, '');
  const urlPath = cleanUrl.split('?')[0];
  const params = config.params || {};
  let body: any = {};
  if (config.data) {
    try {
      body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
    } catch {
      body = config.data;
    }
  }

  // --- AUTH ENDPOINTS ---
  if (urlPath === 'auth/login' && method === 'post') {
    const email = (body.email || '').toLowerCase().trim();
    const matchedUser = DEMO_USERS[email] || {
      id: `user-${Date.now()}`,
      name: email.split('@')[0] || 'Store User',
      email,
      status: 'ACTIVE',
      isSuperAdmin: email.includes('superadmin'),
      memberships: [{
        businessId: DEMO_BUSINESS.id,
        role: email.includes('cashier') ? 'CASHIER' : email.includes('manager') ? 'MANAGER' : 'OWNER',
        business: DEMO_BUSINESS
      }]
    };
    const token = `standalone-jwt-${Date.now()}`;
    localStorage.setItem('token', token);
    localStorage.setItem('cached_user', JSON.stringify(matchedUser));
    localStorage.setItem('activeBusinessId', DEMO_BUSINESS.id);
    await seedDemoDataToDexie(DEMO_BUSINESS.id);

    return createSuccessResponse(config, {
      token,
      user: matchedUser,
      business: DEMO_BUSINESS
    }, 'Login successful');
  }

  if (urlPath === 'auth/me' && method === 'get') {
    const cached = getStored('cached_user', DEMO_USERS['owner@pos.lk']);
    return createSuccessResponse(config, { user: cached }, 'Session valid');
  }

  if (urlPath === 'auth/register' && method === 'post') {
    const newUser = {
      id: `user-reg-${Date.now()}`,
      name: body.name || 'Store Owner',
      email: body.email,
      status: 'ACTIVE',
      isSuperAdmin: false,
      memberships: [{
        businessId: DEMO_BUSINESS.id,
        role: 'OWNER',
        business: { ...DEMO_BUSINESS, name: body.businessName || DEMO_BUSINESS.name }
      }]
    };
    const token = `standalone-jwt-${Date.now()}`;
    localStorage.setItem('token', token);
    localStorage.setItem('cached_user', JSON.stringify(newUser));
    localStorage.setItem('activeBusinessId', DEMO_BUSINESS.id);

    return createSuccessResponse(config, {
      token,
      user: newUser,
      business: DEMO_BUSINESS
    }, 'Registration successful');
  }

  // --- PRODUCTS & INVENTORY ---
  if (urlPath === 'products' && method === 'get') {
    let prods: OfflineProduct[] = [];
    try {
      prods = await db.products.toArray();
      if (prods.length === 0) {
        await seedDemoDataToDexie();
        prods = await db.products.toArray();
      }
    } catch {
      prods = [...DEMO_PRODUCTS];
    }
    if (prods.length === 0) {
      prods = [...DEMO_PRODUCTS];
    }

    // Apply Search
    if (params.search && typeof params.search === 'string') {
      const q = params.search.toLowerCase().trim();
      prods = prods.filter(p =>
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.barcode && p.barcode.toLowerCase().includes(q)) ||
        (p.sku && p.sku.toLowerCase().includes(q))
      );
    }

    // Apply Status Filter
    if (params.status) {
      prods = prods.filter(p => p.status === params.status);
    }

    const total = prods.length;
    const page = Number(params.page) || 1;
    const limit = Number(params.limit || params.pageSize) || 50;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const start = (page - 1) * limit;
    const paged = prods.slice(start, start + limit);

    return createSuccessResponse(config, {
      products: paged,
      pagination: {
        total,
        totalPages,
        page,
        limit
      }
    });
  }

  if (urlPath === 'products/stock-value' && method === 'get') {
    let prods: OfflineProduct[] = [];
    try {
      prods = await db.products.toArray();
    } catch {
      prods = [...DEMO_PRODUCTS];
    }
    const result = prods.reduce((acc, p) => {
      const q = Number(p.stockQuantity || 0);
      acc.units += q;
      acc.costValue += q * (p.sellingPrice * 0.7); // Estimated cost
      acc.retailValue += q * p.sellingPrice;
      return acc;
    }, { units: 0, costValue: 0, retailValue: 0 });

    return createSuccessResponse(config, {
      ...result,
      productCount: prods.length,
      currency: 'LKR'
    });
  }

  if (urlPath.startsWith('products/barcode/') && method === 'get') {
    const code = decodeURIComponent(urlPath.replace('products/barcode/', '')).trim();
    let product = null;
    try {
      product = await db.products.where('barcode').equals(code).first();
      if (!product) {
        product = await db.products.where('sku').equals(code).first();
      }
    } catch {}
    if (!product) {
      product = DEMO_PRODUCTS.find(p => p.barcode === code || p.sku === code);
    }
    if (!product) {
      return createErrorResponse(config, 404, 'Product not found with this barcode');
    }
    return createSuccessResponse(config, product);
  }

  if (urlPath.endsWith('/status') && method === 'patch') {
    const id = urlPath.split('/')[1];
    const newStatus = body.status || 'ACTIVE';
    try {
      await db.products.update(id, { status: newStatus, updatedAt: new Date().toISOString() });
    } catch {}
    return createSuccessResponse(config, { id, status: newStatus }, 'Status updated');
  }

  if (urlPath.endsWith('/adjust-stock') && method === 'post') {
    const id = urlPath.split('/')[1];
    const delta = Number(body.quantity || 0);
    try {
      const existing = await db.products.get(id);
      if (existing) {
        const newQty = Math.max(0, (existing.stockQuantity || 0) + delta);
        await db.products.update(id, { stockQuantity: newQty, updatedAt: new Date().toISOString() });
        return createSuccessResponse(config, { ...existing, stockQuantity: newQty }, 'Stock adjusted');
      }
    } catch {}
    return createSuccessResponse(config, { id, stockQuantity: 50 }, 'Stock adjusted');
  }

  if (urlPath === 'products' && method === 'post') {
    const newProd: OfflineProduct = {
      id: `prod-${Date.now()}`,
      businessId: DEMO_BUSINESS.id,
      name: body.name || 'New Product',
      sku: body.sku || null,
      barcode: body.barcode || null,
      unit: body.unit || 'Piece',
      sellingPrice: Number(body.sellingPrice || 0),
      stockQuantity: Number(body.stockQuantity || 0),
      status: body.status || 'ACTIVE',
      updatedAt: new Date().toISOString()
    };
    try {
      await db.products.put(newProd);
    } catch {}
    return createSuccessResponse(config, newProd, 'Product created successfully');
  }

  if (urlPath.startsWith('products/') && method === 'patch') {
    const id = urlPath.split('/')[1];
    try {
      const existing = await db.products.get(id);
      const updated = { ...existing, ...body, updatedAt: new Date().toISOString() };
      await db.products.put(updated);
      return createSuccessResponse(config, updated, 'Product updated successfully');
    } catch {
      return createSuccessResponse(config, { id, ...body }, 'Product updated');
    }
  }

  // --- CATEGORIES ---
  if (urlPath === 'categories' && method === 'get') {
    return createSuccessResponse(config, DEMO_CATEGORIES);
  }

  // --- CUSTOMERS ---
  if (urlPath === 'customers' && method === 'get') {
    const list = getStored(CUSTOMERS_KEY, DEMO_CUSTOMERS);
    return createSuccessResponse(config, list);
  }

  if (urlPath === 'customers' && method === 'post') {
    const list = getStored(CUSTOMERS_KEY, DEMO_CUSTOMERS);
    const newCust = {
      id: `cust-${Date.now()}`,
      name: body.name || 'New Customer',
      phone: body.phone || '',
      email: body.email || '',
      address: body.address || '',
      notes: body.notes || '',
      loyaltyPoints: 0,
      totalSpent: 0
    };
    list.unshift(newCust);
    setStored(CUSTOMERS_KEY, list);
    return createSuccessResponse(config, newCust, 'Customer created successfully');
  }

  if (urlPath.startsWith('customers/') && method === 'patch') {
    const id = urlPath.split('/')[1];
    const list = getStored(CUSTOMERS_KEY, DEMO_CUSTOMERS);
    const idx = list.findIndex(c => c.id === id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...body };
      setStored(CUSTOMERS_KEY, list);
      return createSuccessResponse(config, list[idx], 'Customer updated');
    }
    return createSuccessResponse(config, { id, ...body }, 'Customer updated');
  }

  if (urlPath.startsWith('customers/') && method === 'delete') {
    const id = urlPath.split('/')[1];
    let list = getStored(CUSTOMERS_KEY, DEMO_CUSTOMERS);
    list = list.filter(c => c.id !== id);
    setStored(CUSTOMERS_KEY, list);
    return createSuccessResponse(config, { id }, 'Customer deleted');
  }

  // --- EXPENSES ---
  if (urlPath === 'expenses' && method === 'get') {
    const list = getStored(EXPENSES_KEY, DEMO_EXPENSES);
    const totalAmount = list.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    return createSuccessResponse(config, { expenses: list, totalAmount });
  }

  if (urlPath === 'expenses' && method === 'post') {
    const list = getStored(EXPENSES_KEY, DEMO_EXPENSES);
    const newExp = {
      id: `exp-${Date.now()}`,
      category: body.category || 'General',
      description: body.description || '',
      amount: Number(body.amount || 0),
      paymentMethod: body.paymentMethod || 'CASH',
      createdAt: new Date().toISOString()
    };
    list.unshift(newExp);
    setStored(EXPENSES_KEY, list);
    return createSuccessResponse(config, newExp, 'Expense recorded');
  }

  // --- SHIFTS ---
  if (urlPath === 'shifts/current' && method === 'get') {
    const active = getStored<any>(SHIFT_KEY, null);
    return createSuccessResponse(config, active);
  }

  if (urlPath === 'shifts/open' && method === 'post') {
    const shift = {
      id: `shift-${Date.now()}`,
      openedAt: new Date().toISOString(),
      openingCash: Number(body.openingCash || 5000),
      status: 'OPEN',
      totalSales: 0,
      cashSales: 0,
      cardSales: 0
    };
    setStored(SHIFT_KEY, shift);
    return createSuccessResponse(config, shift, 'Shift opened');
  }

  if (urlPath.includes('/close') && method === 'post') {
    const current = getStored<any>(SHIFT_KEY, {});
    const closed = {
      ...current,
      closedAt: new Date().toISOString(),
      closingCash: Number(body.closingCash || 0),
      status: 'CLOSED'
    };
    localStorage.removeItem(SHIFT_KEY);
    return createSuccessResponse(config, closed, 'Shift closed');
  }

  // --- ORDERS & CHECKOUT ---
  if (urlPath === 'orders/preview' && method === 'post') {
    const items = body.items || [];
    let subtotal = 0;
    const allProducts = await db.products.toArray().catch(() => []);
    const validatedItems = items.map((it: any) => {
      const foundProd = allProducts.find((p: any) => p.id === it.productId) || 
                        DEMO_PRODUCTS.find((p: any) => p.id === it.productId);
      const price = Number(it.sellingPrice ?? it.unitPrice ?? it.price ?? foundProd?.sellingPrice ?? 0);
      const qty = Number(it.quantity || 1);
      const lineDiscount = Number(it.lineDiscount || 0);
      const lineTotal = Math.max(0, price * qty - lineDiscount);
      subtotal += lineTotal;
      return {
        productId: it.productId,
        name: it.name || foundProd?.name || 'Product',
        quantity: qty,
        unitPrice: price,
        lineDiscount,
        netLineTotal: lineTotal,
        subtotal: lineTotal
      };
    });
    const orderDiscount = Number(body.orderDiscountAmount || body.orderDiscount || 0);
    const grandTotal = Math.max(0, subtotal - orderDiscount);

    return createSuccessResponse(config, {
      items: validatedItems,
      validatedItems,
      subtotal,
      orderDiscount,
      discountAmount: orderDiscount,
      tax: 0,
      grandTotal,
      totalItems: items.length,
      totalQuantity: items.reduce((acc: number, it: any) => acc + Number(it.quantity || 1), 0)
    }, 'Cart validated successfully');
  }

  if (urlPath === 'orders' && method === 'post') {
    const items = body.items || [];
    const allProducts = await db.products.toArray().catch(() => []);
    let subtotal = 0;
    const orderItems = items.map((it: any) => {
      const foundProd = allProducts.find((p: any) => p.id === it.productId) || 
                        DEMO_PRODUCTS.find((p: any) => p.id === it.productId);
      const price = Number(it.sellingPrice ?? it.unitPrice ?? it.price ?? foundProd?.sellingPrice ?? 0);
      const qty = Number(it.quantity || 1);
      const lineDiscount = Number(it.lineDiscount || 0);
      const lineTotal = Math.max(0, price * qty - lineDiscount);
      subtotal += lineTotal;
      return {
        id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        productId: it.productId,
        name: it.name || foundProd?.name || 'Product',
        quantity: qty,
        unitPrice: price,
        lineDiscount,
        lineTotal,
        netLineTotal: lineTotal,
        finalTotal: lineTotal,
        subtotal: lineTotal
      };
    });
    const orderDiscount = Number(body.orderDiscountAmount || body.orderDiscount || 0);
    const calculatedGrandTotal = Math.max(0, subtotal - orderDiscount);
    const grandTotal = Number(body.grandTotal || calculatedGrandTotal);
    const orderNumber = `INV-${Date.now().toString().slice(-6)}`;
    const orderId = `ord-${Date.now()}`;
    const order = {
      id: orderId,
      orderNumber,
      clientTransactionId: config.headers?.['x-idempotency-key'] || orderId,
      businessId: DEMO_BUSINESS.id,
      status: 'COMPLETED',
      completedAt: new Date().toISOString(),
      subtotal,
      discountAmount: orderDiscount,
      grandTotal,
      paymentMethod: body.paymentMethod || 'CASH',
      payments: [{ method: body.paymentMethod || 'CASH', amount: grandTotal }],
      items: orderItems,
      business: DEMO_BUSINESS,
      cashier: { name: 'Karthik Sivakumar' }
    };

    // Save to localOrders Dexie
    try {
      await db.localOrders.put({
        clientTransactionId: order.clientTransactionId,
        businessId: DEMO_BUSINESS.id,
        tempOrderNumber: orderNumber,
        grandTotal,
        completedAt: order.completedAt,
        status: 'SYNCED',
        serverOrderId: orderId,
        snapshot: order
      });
      // Deduct product stock
      for (const it of items) {
        if (it.productId) {
          const p = await db.products.get(it.productId);
          if (p) {
            const nextStock = Math.max(0, (p.stockQuantity || 0) - (it.quantity || 1));
            await db.products.update(it.productId, { stockQuantity: nextStock });
          }
        }
      }
    } catch {}

    return createSuccessResponse(config, order, 'Order processed successfully');
  }

  if (urlPath.endsWith('/receipt') && method === 'get') {
    const id = urlPath.split('/')[1];
    let order: any = null;
    try {
      const local = await db.localOrders.where('serverOrderId').equals(id).first();
      if (local && local.snapshot) {
        order = local.snapshot;
      }
    } catch {}
    if (!order) {
      order = {
        id,
        orderNumber: `INV-${Date.now().toString().slice(-6)}`,
        completedAt: new Date().toISOString(),
        grandTotal: 1540,
        payments: [{ method: 'CASH', amount: 1540 }],
        items: [
          { name: 'Elephant House Ginger Beer 400ml', quantity: 2, unitPrice: 220, subtotal: 440 },
          { name: 'Anchor Full Cream Milk Powder 400g', quantity: 1, unitPrice: 1100, subtotal: 1100 }
        ],
        business: DEMO_BUSINESS,
        cashier: { name: 'Karthik Sivakumar' }
      };
    }
    return createSuccessResponse(config, order);
  }

  if (urlPath === 'orders' && method === 'get') {
    let list: any[] = [];
    try {
      const local = await db.localOrders.toArray();
      list = local.map(l => ({
        id: l.serverOrderId || l.clientTransactionId,
        orderNumber: l.tempOrderNumber,
        completedAt: l.completedAt,
        grandTotal: l.grandTotal,
        status: 'COMPLETED',
        itemCount: l.snapshot?.items?.length || 1,
        paymentMethod: l.snapshot?.paymentMethod || 'CASH'
      })).reverse();
    } catch {}
    return createSuccessResponse(config, list);
  }

  // --- DASHBOARD ---
  if (urlPath === 'dashboard/summary' && method === 'get') {
    let todaySales = 0;
    let todayOrders = 0;
    let todayItemsSold = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    try {
      const local = await db.localOrders.toArray();
      todayOrders = local.length;
      todaySales = local.reduce((sum, o) => sum + (o.grandTotal || 0), 0);
      todayItemsSold = local.reduce((sum, o) => sum + (o.snapshot?.items?.length || 1), 0);

      const prods = await db.products.toArray();
      lowStockCount = prods.filter(p => (p.stockQuantity || 0) > 0 && (p.stockQuantity || 0) <= 5).length;
      outOfStockCount = prods.filter(p => (p.stockQuantity || 0) <= 0).length;
    } catch {}

    // Provide friendly non-zero defaults for initial empty state display
    if (todayOrders === 0) {
      todaySales = 12450;
      todayOrders = 8;
      todayItemsSold = 19;
    }

    return createSuccessResponse(config, {
      todaySales,
      todayOrders,
      todayItemsSold,
      averageOrderValue: todayOrders > 0 ? Math.round(todaySales / todayOrders) : 0,
      lowStockCount,
      outOfStockCount
    });
  }

  if (urlPath === 'dashboard/recent-sales' && method === 'get') {
    let list: any[] = [];
    try {
      const local = await db.localOrders.toArray();
      list = local.map(l => ({
        id: l.serverOrderId || l.clientTransactionId,
        orderNumber: l.tempOrderNumber,
        completedAt: l.completedAt,
        grandTotal: l.grandTotal,
        status: 'COMPLETED',
        itemCount: l.snapshot?.items?.length || 2,
        paymentMethod: l.snapshot?.paymentMethod || 'CASH'
      })).reverse().slice(0, 5);
    } catch {}
    if (list.length === 0) {
      list = [
        {
          id: 'ord-demo-1',
          orderNumber: 'INV-882314',
          completedAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
          grandTotal: 1840,
          status: 'COMPLETED',
          itemCount: 3,
          paymentMethod: 'CASH'
        },
        {
          id: 'ord-demo-2',
          orderNumber: 'INV-882313',
          completedAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
          grandTotal: 3450,
          status: 'COMPLETED',
          itemCount: 4,
          paymentMethod: 'CARD'
        }
      ];
    }
    return createSuccessResponse(config, list);
  }

  if (urlPath === 'dashboard/low-stock' && method === 'get') {
    let low: any[] = [];
    try {
      const prods = await db.products.toArray();
      low = prods.filter(p => (p.stockQuantity || 0) <= 5);
    } catch {}
    return createSuccessResponse(config, low);
  }

  // --- SETTINGS ---
  if (urlPath === 'settings' && method === 'get') {
    const s = getStored(SETTINGS_KEY, DEMO_SETTINGS);
    return createSuccessResponse(config, s);
  }

  if (urlPath === 'settings' && method === 'patch') {
    const current = getStored(SETTINGS_KEY, DEMO_SETTINGS);
    const updated = { ...current, ...body };
    setStored(SETTINGS_KEY, updated);
    return createSuccessResponse(config, updated, 'Settings updated');
  }

  // --- SUBSCRIPTIONS ---
  if (urlPath === 'subscription' && method === 'get') {
    return createSuccessResponse(config, DEMO_SUBSCRIPTION);
  }

  if (urlPath === 'subscription/plans' && method === 'get') {
    return createSuccessResponse(config, DEMO_SUBSCRIPTION_PLANS);
  }

  if (urlPath === 'subscription/history' && method === 'get') {
    return createSuccessResponse(config, [
      {
        id: 'inv-001',
        planName: 'Enterprise Cloud',
        amount: 0,
        currency: 'LKR',
        status: 'PAID',
        createdAt: new Date(Date.now() - 86400000 * 30).toISOString()
      }
    ]);
  }

  if (urlPath.startsWith('subscription/admin') && method === 'get') {
    return createSuccessResponse(config, [
      {
        id: DEMO_BUSINESS.id,
        businessName: DEMO_BUSINESS.name,
        ownerEmail: 'owner@pos.lk',
        planCode: 'ENTERPRISE',
        status: 'ACTIVE',
        productCount: 6,
        productLimit: 10000,
        createdAt: new Date().toISOString()
      }
    ]);
  }

  // --- PRINTERS ---
  if (urlPath === 'printers' && method === 'get') {
    const list = getStored(PRINTERS_KEY, DEMO_PRINTERS);
    return createSuccessResponse(config, list);
  }

  if (urlPath === 'printers' && method === 'post') {
    const list = getStored(PRINTERS_KEY, DEMO_PRINTERS);
    const newP = { id: `print-${Date.now()}`, ...body, status: 'ONLINE' };
    list.push(newP);
    setStored(PRINTERS_KEY, list);
    return createSuccessResponse(config, newP, 'Printer saved');
  }

  if (urlPath.startsWith('printers/') && method === 'delete') {
    const id = urlPath.split('/')[1];
    let list = getStored(PRINTERS_KEY, DEMO_PRINTERS);
    list = list.filter(p => p.id !== id);
    setStored(PRINTERS_KEY, list);
    return createSuccessResponse(config, { id }, 'Printer deleted');
  }

  // --- REPORTS ---
  if (urlPath.startsWith('reports/')) {
    return createSuccessResponse(config, {
      totalRevenue: 45800,
      totalOrders: 18,
      cashTotal: 28400,
      cardTotal: 14200,
      qrTotal: 3200,
      byPaymentMethod: [
        { method: 'CASH', total: 28400, count: 12 },
        { method: 'CARD', total: 14200, count: 4 },
        { method: 'QR', total: 3200, count: 2 }
      ],
      topProducts: [
        { name: 'Elephant House Ginger Beer 400ml', quantity: 24, total: 5280 },
        { name: 'Munchee Chocolate Marie 200g', quantity: 18, total: 3240 }
      ]
    });
  }

  // --- SUPPLIERS & INVENTORY AUDIT ---
  if (urlPath === 'suppliers' && method === 'get') {
    return createSuccessResponse(config, DEMO_SUPPLIERS);
  }

  if (urlPath === 'inventory/movements' && method === 'get') {
    return createSuccessResponse(config, [
      {
        id: 'mov-001',
        productName: 'Elephant House Ginger Beer 400ml',
        delta: -2,
        reason: 'POS Sale #INV-882314',
        createdAt: new Date().toISOString()
      }
    ]);
  }

  if (urlPath === 'purchases' && method === 'get') {
    return createSuccessResponse(config, []);
  }

  if (urlPath === 'returns' && method === 'get') {
    return createSuccessResponse(config, []);
  }

  // --- SYNC ---
  if (urlPath.startsWith('sync')) {
    return createSuccessResponse(config, { success: true, count: 0, data: { id: `srv-${Date.now()}` } });
  }

  // Fallback 200 OK for any unmapped route to guarantee zero UI crashes
  return createSuccessResponse(config, { ok: true });
}

function createSuccessResponse(config: AxiosRequestConfig, data: any, message: string = 'Success'): AxiosResponse {
  return {
    data: {
      success: true,
      message,
      data
    },
    status: 200,
    statusText: 'OK',
    headers: {},
    config: config as any,
    request: {}
  };
}

function createErrorResponse(config: AxiosRequestConfig, status: number, message: string): Promise<AxiosResponse> {
  const errorObj = {
    success: false,
    error: {
      code: status === 404 ? 'NOT_FOUND' : 'BAD_REQUEST',
      message
    }
  };
  return Promise.reject({
    response: {
      status,
      statusText: 'Error',
      data: errorObj,
      headers: {},
      config: config as any
    },
    message
  });
}
