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
## Feature completion pack (Sri Lanka retail)

This repository now includes these additive modules in the application:

- **Customer profiles:** tenant-scoped CRUD/search, contact data, loyalty and lifetime sales fields. Checkout API can associate a sale with a customer and increases that customer's lifetime spend.
- **Expense book:** LKR operating expense records, categories, dates, payment method, references and summary totals; management-only deletion and audit trail on create.
- **Suppliers:** supplier contact directory and business-scoped supplier endpoints.
- **Stock receiving / purchases:** receive product quantities against a supplier, capture invoice reference and unit cost, update product stock/cost, create inventory ledger transactions and audit the receipt.
- **Cashier shifts:** opening float, active shift view and closing cash variance capture.
- **Sales returns:** full-order return once per completed sale, optionally restocking all order lines; creates inventory movements, marks sale/payment refunded and writes an audit event.
- **WhatsApp:** wa.me sharing remains available; optional WhatsApp Cloud API text sender now uses environment credentials (no credentials committed).
- **Language foundation:** English/Tamil/Sinhala translation dictionary and persisted language preference selector.
- **Navigation:** Customers, Expenses, Suppliers, Purchases, Sales Returns and Cashier Shift routes.

### Database rollout
The schema additions are in `backend/prisma/schema.prisma`. An additive SQL script is included at `backend/prisma/migrations/20261109_retail_completion/migration.sql`. Back up production data and apply the migration before deploying these routes. Keep merchant API secrets only in environment variables.

### Important operational boundaries
- Returns currently support **full-order returns**, not partial item/quantity returns. Confirm physical goods before choosing restock.
- Cash shift expected cash is a basic cash-payment aggregation; it is not yet a full denomination-count/cash-drawer accounting system.
- WhatsApp Cloud API needs Meta business verification/phone-number setup, approved templates for business-initiated messages, and merchant-specific configuration. The current API sender handles text messages only; receipt media/PDF automation needs a separately configured media upload flow.
- VAT/tax invoice rates and registration data must be configured with a Sri Lankan accountant; this app does not claim automatic tax compliance.
- Offline sales synchronization and conflict handling still need real-world device/network validation before production use.
- The language dictionary is a foundation; not every existing screen's static English text has been translated yet.

### Recommended production completion backlog
1. Partial returns, item-level refunds and credit notes.
2. Supplier purchase orders, payment settlement and supplier balances.
3. Customer credit ledger, installment/partial settlement and statements.
4. Shift-to-payment linkage, denomination count, cash variance reports and manager approvals.
5. Branch/warehouse transfers, batch/expiry and serial/lot tracking.
6. Complete translated UI (all screens/forms/validation/receipts) in Tamil and Sinhala.
7. LankaQR / PayHere merchant payment adapters and reconciliation webhooks.
8. Automated WhatsApp receipt/media delivery, opt-in records and template management.
9. Automated backups, restore drills, exports, audit retention and role permissions review.
10. Monitoring, production deployment configuration, accessibility and device/browser acceptance.
