# NSC Employee — HR & Payroll Management System

A full-stack HR & Payroll system built with **Next.js 16**, **Supabase (PostgreSQL)**, and custom JWT authentication.

---

## Features

- **Admin Panel** — Dashboard, Employee Management, Work Approval, Leave Management, Payroll Generator, Reports, Notifications, Settings
- **Employee Portal** — Dashboard, Work Entry, Leave Apply, Payslip (PDF download), Notifications
- **Custom Auth** — Username/password login, bcrypt hashing, JWT sessions, login lockout (5 attempts → 15-min cooldown)
- **Role-based access** — Admin and Employee roles with server-side protection
- **PDF Payslips** — Download payslips via jsPDF
- **Excel Reports** — Export HR reports via xlsx
- **File Uploads** — Supabase Storage for work proof attachments

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Database | Supabase (PostgreSQL) |
| Auth | Custom JWT + bcryptjs |
| Styling | CSS custom properties (design tokens) |
| Forms | React Hook Form + Zod |
| Charts | Recharts |
| PDF | jsPDF + jspdf-autotable |
| Excel | xlsx |
| Storage | Supabase Storage |

---

## Setup

### 1. Clone and install dependencies

```bash
cd nsc-hr
npm install
```

### 2. Create a Supabase project

Go to [supabase.com](https://supabase.com), create a new project, and grab:
- Project URL
- Anon (public) key
- Service role key (Settings → API)

### 3. Configure environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local` and fill in your Supabase credentials and a strong JWT secret:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
JWT_SECRET=your-32-char-random-string-here
```

### 4. Run the database schema

In Supabase dashboard → SQL Editor, run the contents of:
```
supabase/schema.sql
```

### 5. Seed demo data

In Supabase SQL Editor, run:
```
supabase/seed.sql
```

This creates:
- 1 admin user: `admin` / `admin123`
- 8 employee users: `rahul` / `emp123` (and others)
- Sample work entries, leave requests, payroll records, notifications

### 6. Create Supabase Storage bucket

In Supabase dashboard → Storage, create a new bucket:
- Name: `nsc-hr-uploads`
- Public: **Yes** (so uploaded proof files are viewable)

### 7. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Demo Credentials

| Role | Username | Password |
|---|---|---|
| Admin | `admin` | `admin123` |
| Employee | `rahul` | `emp123` |

---

## Project Structure

```
nsc-hr/
├── app/
│   ├── admin/              # Admin panel pages
│   │   ├── dashboard/
│   │   ├── employees/
│   │   ├── work-approval/
│   │   ├── leave/
│   │   ├── payroll/
│   │   ├── reports/
│   │   ├── notifications/
│   │   └── settings/
│   ├── employee/           # Employee portal pages
│   │   ├── dashboard/
│   │   ├── work-entry/
│   │   ├── leave/
│   │   ├── payslip/
│   │   └── notifications/
│   ├── api/                # API routes
│   │   ├── auth/
│   │   ├── employees/
│   │   ├── work-entries/
│   │   ├── leaves/
│   │   ├── payroll/
│   │   ├── notifications/
│   │   ├── settings/
│   │   ├── reports/
│   │   └── upload/
│   ├── login/
│   └── globals.css
├── components/
│   ├── ui/                 # Shared UI components
│   └── admin/              # Admin-specific components
│   └── employee/           # Employee-specific components
├── lib/
│   ├── auth.ts             # JWT + bcrypt auth helpers
│   ├── supabase.ts         # Supabase client
│   ├── utils.ts            # Utility functions
│   └── hooks.ts            # React hooks
├── types/
│   └── index.ts            # TypeScript interfaces
├── supabase/
│   ├── schema.sql          # Database schema
│   └── seed.sql            # Demo seed data
├── middleware.ts            # Route protection
└── .env.example
```

---

## Database Tables

All tables use the `NSC_HR_` prefix:

| Table | Purpose |
|---|---|
| `NSC_HR_users` | Login credentials + role |
| `NSC_HR_employees` | Employee profiles |
| `NSC_HR_work_entries` | Work log submissions |
| `NSC_HR_leave_requests` | Leave applications |
| `NSC_HR_leave_balances` | Annual leave quotas |
| `NSC_HR_payroll` | Monthly payroll records |
| `NSC_HR_notifications` | In-app notifications |
| `NSC_HR_settings` | App configuration |
| `NSC_HR_activity_logs` | Audit trail |

---

## API Routes

| Method | Route | Description |
|---|---|---|
| POST | `/api/auth/login` | Login with username/password |
| POST | `/api/auth/logout` | Clear session |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/auth/change-password` | Change password |
| GET/POST | `/api/employees` | List / create employees |
| GET/PUT/DELETE | `/api/employees/[id]` | Get / update / delete employee |
| GET/POST | `/api/work-entries` | List / submit work entries |
| PUT | `/api/work-entries/[id]` | Approve / reject entry |
| GET/POST | `/api/leaves` | List / apply for leave |
| PUT | `/api/leaves/[id]` | Approve / reject leave |
| GET | `/api/leaves/balance` | Get leave balances |
| GET/POST | `/api/payroll` | List / generate payroll |
| PUT | `/api/payroll/[id]` | Mark paid / adjust payroll |
| GET/POST | `/api/notifications` | List / broadcast notifications |
| PUT | `/api/notifications/[id]` | Mark notification read |
| POST | `/api/notifications/read-all` | Mark all as read |
| GET/PUT | `/api/settings` | Get / update settings |
| GET | `/api/reports` | Generate reports |
| POST | `/api/upload` | Upload file to Supabase Storage |
