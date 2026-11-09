# Retail Billing / POS System

A professional, production-grade Web-Based Retail POS System built with React, Node.js, Express, and PostgreSQL. It features offline-first capabilities, thermal receipt printing, WhatsApp bill sharing, multi-business isolation, and role-based access control.

## Architecture

- **Frontend**: React, Vite, Tailwind CSS v4, TypeScript
- **Backend**: Node.js, Express, TypeScript, Zod validation
- **Database**: PostgreSQL with Prisma ORM
- **Offline Engine**: IndexedDB (Dexie.js), background sync queue
- **Printing**: Client-side ESC/POS abstraction via native browser printing
- **Authentication**: JWT, HTTP Bearer tokens

## Core Features

- **Multi-Tenant System**: Secure isolation of data between different businesses.
- **Offline-First PWA**: Continue selling offline; transactions queue locally and sync automatically when online.
- **Inventory Management**: Track stock, costs, barcode, categories, and inventory transactions.
- **POS Engine**: Real-time cart calculation, cash handling, idempotent order submission.
- **Receipts**: Support for 58mm & 80mm thermal printers with dynamic layouts.
- **WhatsApp Integration**: Share professional receipts securely without third-party providers.
- **Reports & Analytics**: Server-side aggregated dashboard, sales history, and product reports.
- **Subscriptions**: Tiered plans (Free & Pro), Super Admin lifecycle management, limit enforcement.
- **Role-Based Access**: Owner, Admin, Manager, Cashier, Staff, and platform-level Super Admin.

## Security Overview

This application adheres to production-grade security standards:
- All financial, inventory, and subscription calculations are authoritative on the server.
- Strict middleware enforcement for authentication (`authenticate`) and authorization (`requireBusinessAccess`, `requireSuperAdmin`).
- Concurrency control for stock deductions using optimistic/guard checks.
- Zero client-trusted variables in transaction generation.
- Rate limits applied to authentication endpoints (Brute-force protection).
- Body parsing constraints (2MB max size limits) to mitigate DoS.
- Helmet security headers and CORS origin locks.
- Immutable event and audit logs for sensitive operations.

## Development Setup

### 1. Prerequisites
- Node.js v18+
- PostgreSQL v13+
- NPM or Yarn

### 2. Database & Environment Configuration

**Backend**
```bash
cd backend
cp .env.example .env
```
Update `.env` with your PostgreSQL `DATABASE_URL` and `JWT_SECRET`.

**Frontend**
```bash
cd frontend
cp .env.example .env
```
Update `.env` with your backend `VITE_API_URL` if not using the default `http://localhost:5000/api/v1`.

### 3. Install Dependencies
```bash
cd backend && npm install
cd ../frontend && npm install
```

### 4. Database Setup & Seeding
```bash
cd backend
npx prisma db push
npx ts-node src/utils/seedPlans.ts
```
To set up a Super Admin account, first register normally through the UI, then set `isSuperAdmin = true` directly in PostgreSQL:
```sql
UPDATE "User" SET "isSuperAdmin" = true WHERE email = 'admin@yourdomain.com';
```

### 5. Running the Application
**Backend**
```bash
cd backend
npm run dev
```

**Frontend**
```bash
cd frontend
npm run dev
```

## Production Deployment

### 1. Build
Build the frontend and backend for production.
```bash
cd backend
npm run build

cd ../frontend
npm run build
```

### 2. Database Migration
In a production environment, use Prisma Migrate instead of `db push`:
```bash
npx prisma migrate deploy
```

### 3. Server Initialization
Run the compiled JavaScript files using PM2 or your preferred process manager.
```bash
NODE_ENV=production node dist/server.js
```
Ensure a reverse proxy (e.g., Nginx) is configured to handle HTTPS and serve the frontend static files.

## Documentation Reference
- Check `backend/prisma/schema.prisma` for the full data model.
- Check `frontend/src/db/offlineDb.ts` for IndexedDB schema and offline architecture.

## Maintenance
- **Health Check**: `GET /api/v1/health`
- Automated database backups should be managed externally via your deployment provider.


## Sri Lanka shop operations roadmap

### Added in this completion pass
- **Customer directory**: tenant-isolated customer create/list/search/update/delete APIs and UI; stores phone, email, address, notes, loyalty points and lifetime spend. Customer can be linked to orders in the database.
- **Expense tracking**: tenant-isolated expense create/list/delete APIs and UI; LKR-friendly amount entry, expense category, payment method, date and reference; audit trail for creation and management-only removal.

### Sri Lanka-specific next modules
- Supplier directory and purchase receiving with stock ledger entries
- Customer credit / receivables and partial settlements
- Sales returns, exchanges and refund workflow
- Cashier shifts, opening float, cash drawer closing and variance
- Batch/expiry management, stock transfers and reorder suggestions
- Sinhala + Tamil + English complete interface; locale-aware LKR, date and number formats
- Configurable VAT/tax invoice fields (accountant-controlled rates and registration data)
- LankaQR / PayHere / bank transfer adapter layer (credentials configured by each merchant)
- WhatsApp order confirmations, low-stock alerts and customer statements
- Scheduled encrypted backups, CSV/Excel exports and restore guide

**Database change:** apply the updated Prisma schema to the PostgreSQL database before deploying the new Customers and Expenses endpoints. This pass intentionally did not run build or tests, as requested.