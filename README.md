# Calendar Scheduler

A production-ready appointment scheduling application built with Next.js 14, designed for deployment on Vercel with Neon PostgreSQL. Features Microsoft Outlook integration, email notifications, admin authentication, and webhook support.

![Calendar Scheduler](https://via.placeholder.com/800x400?text=Calendar+Scheduler)

## Features

### User Booking Interface
- **3-Step Booking Flow**: Select meeting type → Choose date/time → Enter details
- **Real-time Availability**: Shows only available slots based on business hours and existing bookings
- **Outlook Calendar Integration**: Checks actual calendar availability when connected
- **Mobile Responsive**: Works seamlessly on all devices
- **Confirmation Emails**: Automatic email notifications to both client and admin

### Admin Dashboard
- **Secure Authentication**: JWT-based admin login with password protection
- **Multi-User Support**: Add and manage multiple admin users
- **Password Reset Flow**: Email-based password reset with temporary passwords
- **Forced Password Change**: New users must set their own password on first login
- **Branding Customization**: Business name, logo, and color scheme
- **Calendar Settings**: Business hours and timezone configuration
- **Meeting Type Management**: Create, edit, and delete meeting types with custom durations
- **Microsoft Outlook Connection**: OAuth 2.0 integration for calendar sync

### Integrations
- **Microsoft Graph API**: Full Outlook calendar read/write access
- **Email Notifications**: Via Resend (or Microsoft Graph)
- **Webhooks**: Notify external services on booking events
- **Neon PostgreSQL**: Serverless Postgres for data persistence

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS
- **Database**: Neon PostgreSQL (Serverless)
- **Authentication**: JWT with HTTP-only cookies
- **Email**: Resend API
- **Calendar**: Microsoft Graph API
- **Deployment**: Vercel

## Quick Start

### Prerequisites

- Node.js 18+
- Vercel account
- Neon account (for PostgreSQL)
- Microsoft Azure account (for Outlook integration)
- Resend account (for emails)

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd scheduler-app
npm install
```

### 2. Set Up Neon PostgreSQL

1. Go to [Neon Console](https://console.neon.tech)
2. Create a new project
3. Copy the connection string from the dashboard
4. Add to your `.env.local`:
   ```
   DATABASE_URL=postgresql://user:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require
   ```

### 3. Run Database Migrations

```bash
# Create a .env.local with your DATABASE_URL first, then:
npx dotenv -e .env.local -- npm run db:migrate
```

This creates all necessary tables:
- `admin_users` - Admin authentication
- `scheduler_config` - Business settings
- `meeting_types` - Available meeting types
- `bookings` - Customer bookings
- `microsoft_tokens` - OAuth tokens
- `webhook_subscriptions` - External webhooks

### 4. Set Up Microsoft Azure AD

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** → **App registrations**
3. Click **New registration**:
   - Name: `Calendar Scheduler`
   - Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**
   - Redirect URI: `https://your-app.vercel.app/api/auth/callback` (Web)
4. After creation, note the **Application (client) ID**
5. Go to **Certificates & secrets** → **New client secret**
   - Note the secret value immediately (it won't be shown again)
6. Go to **API permissions** → **Add a permission** → **Microsoft Graph** → **Delegated permissions**:
   - `User.Read`
   - `Calendars.ReadWrite`
   - `Mail.Send`
   - `offline_access`
7. Click **Grant admin consent** (if you're an admin)

### 5. Set Up Resend

1. Sign up at [Resend](https://resend.com)
2. Create an API key
3. Verify your domain (or use the sandbox for testing)

### 6. Configure Environment Variables

Create a `.env.local` file (copy from `.env.example`):

```env
# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Neon PostgreSQL
DATABASE_URL=postgresql://user:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require

# Microsoft Azure AD
MICROSOFT_CLIENT_ID=your-azure-client-id
MICROSOFT_CLIENT_SECRET=your-azure-client-secret
MICROSOFT_TENANT_ID=common
MICROSOFT_REDIRECT_URI=http://localhost:3000/api/auth/callback

# Email
RESEND_API_KEY=re_your_api_key
EMAIL_FROM=noreply@yourdomain.com

# Authentication
JWT_SECRET=generate-a-32-char-random-string
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_INITIAL_PASSWORD=change-this-immediately

# Features
ENABLE_EMAIL_NOTIFICATIONS=true
ENABLE_CALENDAR_SYNC=true
ENABLE_WEBHOOKS=false

# Webhooks (optional)
WEBHOOK_SECRET=your-webhook-secret
EXTERNAL_WEBHOOK_URL=
```

### 7. Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the booking page and [http://localhost:3000/admin](http://localhost:3000/admin) for the admin panel.

### 8. Deploy to Vercel

```bash
vercel
```

Or connect your GitHub repo to Vercel for automatic deployments.

**Important**: Add your Neon DATABASE_URL to Vercel environment variables, or use the [Neon Vercel Integration](https://vercel.com/integrations/neon) for automatic configuration.

## Database Schema

The application uses the following PostgreSQL tables:

```sql
-- Admin users for authentication
admin_users (id, email, name, password_hash, must_reset_password, reset_token, reset_token_expires, created_by, created_at, last_login)

-- Global scheduler configuration (single row)
scheduler_config (business_name, logo, colors, hours, timezone, outlook_connected)

-- Meeting types available for booking
meeting_types (id, name, duration, description, color, sort_order, is_active)

-- All customer bookings
bookings (id, date, time, duration, meeting_type, client_name, client_email, notes, status)

-- Microsoft OAuth tokens (single row)
microsoft_tokens (access_token, refresh_token, expires_at, scope)

-- External webhook subscriptions
webhook_subscriptions (id, url, events, secret, is_active)
```

### Upgrading from Previous Versions

If you have an existing installation, run the migration script in your Neon SQL Editor:

```sql
-- Add new columns for user management
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS name VARCHAR(255);
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS must_reset_password BOOLEAN DEFAULT FALSE;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS reset_token VARCHAR(64);
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP WITH TIME ZONE;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES admin_users(id) ON DELETE SET NULL;

-- Update existing user to have a name
UPDATE admin_users SET name = 'Admin' WHERE name IS NULL;
```

## Configuration

### Admin Panel

1. Navigate to `/admin`
2. Login with your admin credentials (default from env vars)
3. **Change your password immediately** in a production environment

### Connecting Outlook

1. Go to Admin → Outlook tab
2. Click "Connect with Microsoft"
3. Sign in with your Microsoft account
4. Grant the requested permissions
5. You'll be redirected back with a success message

### Customizing Branding

1. Go to Admin → Branding tab
2. Set your business name
3. Upload a logo (base64 stored)
4. Choose primary and accent colors

### Setting Up Meeting Types

1. Go to Admin → Meeting Types tab
2. Click "Add Meeting Type"
3. Configure name, duration, description, and color
4. Save your changes

## API Reference

### Public Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/config` | Get public scheduler configuration |
| GET | `/api/availability?date=YYYY-MM-DD&duration=30` | Get available time slots |
| POST | `/api/bookings` | Create a new booking |

### Admin Endpoints (Require Authentication)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Admin login |
| POST | `/api/auth/logout` | Admin logout |
| GET | `/api/auth/verify` | Verify auth token |
| POST | `/api/auth/change-password` | Change admin password |
| POST | `/api/auth/forgot-password` | Request password reset email |
| POST | `/api/auth/reset-password` | Reset password with token |
| POST | `/api/auth/set-password` | Set new password (forced reset) |
| PUT | `/api/config` | Update configuration |
| GET | `/api/bookings` | List all bookings |
| DELETE | `/api/bookings/[id]` | Cancel a booking |
| GET | `/api/admin/users` | List all admin users |
| POST | `/api/admin/users` | Create new admin user |
| DELETE | `/api/admin/users/[id]` | Delete admin user |

### OAuth Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/auth/microsoft` | Initiate Microsoft OAuth |
| GET | `/api/auth/callback` | OAuth callback handler |
| POST | `/api/auth/microsoft/disconnect` | Disconnect Microsoft account |

### Webhook Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/webhooks/microsoft` | Receive Microsoft Graph notifications |
| GET/POST/DELETE | `/api/webhooks/subscribe` | Manage webhook subscriptions |

## Webhook Events

When webhooks are enabled, the following events are sent to your configured URL:

```typescript
{
  event: 'booking.created' | 'booking.cancelled' | 'booking.updated',
  data: {
    booking: BookedSlot,
    config: { businessName, timezone }
  },
  timestamp: string,
  signature: string // HMAC-SHA256 of payload
}
```

Verify webhooks using the `X-Webhook-Signature` header.

## Security Considerations

1. **Change default admin password** immediately after first deployment
2. **Use strong JWT_SECRET** - generate with `openssl rand -base64 32`
3. **Keep client secrets secure** - never commit to version control
4. **Enable HTTPS** - Vercel provides this automatically
5. **Regularly rotate secrets** - especially Microsoft client secrets
6. **Use Neon's connection pooling** - enabled by default for serverless

## Troubleshooting

### "Failed to connect Outlook"
- Verify redirect URI matches exactly in Azure AD
- Check that all permissions are granted
- Ensure client secret hasn't expired

### "No available times"
- Check business hours in admin settings
- Verify the date isn't a weekend
- Check if slots are already booked

### "Email not received"
- Verify Resend API key is correct
- Check spam folder
- Ensure domain is verified in Resend (for production)

### Token refresh issues
- The cron job runs every 6 hours to refresh tokens
- If tokens expire, reconnect Outlook in admin panel

### Database connection issues
- Verify DATABASE_URL is correct
- Check Neon dashboard for connection limits
- Ensure SSL mode is enabled (`?sslmode=require`)

## Development

### Project Structure

```
scheduler-app/
├── app/
│   ├── api/
│   │   ├── auth/           # Authentication endpoints
│   │   ├── bookings/       # Booking CRUD
│   │   ├── config/         # Configuration
│   │   ├── availability/   # Time slot availability
│   │   ├── webhooks/       # Webhook handlers
│   │   └── cron/           # Scheduled tasks
│   ├── admin/
│   │   └── page.tsx        # Admin dashboard
│   ├── page.tsx            # Booking interface
│   ├── layout.tsx          # Root layout
│   └── globals.css         # Global styles
├── lib/
│   ├── db/
│   │   ├── client.ts       # Neon database client
│   │   ├── schema.sql      # Database schema
│   │   └── migrate.ts      # Migration script
│   ├── auth.ts             # Authentication utilities
│   ├── email.ts            # Email service
│   ├── microsoft-graph.ts  # Microsoft Graph API
│   ├── storage.ts          # Database operations
│   ├── types.ts            # TypeScript definitions
│   └── webhooks.ts         # Webhook utilities
├── .env.example            # Environment template
├── next.config.js          # Next.js configuration
├── tailwind.config.js      # Tailwind configuration
├── tsconfig.json           # TypeScript configuration
├── vercel.json             # Vercel configuration
└── package.json            # Dependencies
```

### Adding New Features

1. Create API route in `app/api/`
2. Add types to `lib/types.ts`
3. Update database schema in `lib/db/schema.sql`
4. Run migrations: `npm run db:migrate`
5. Update UI components as needed
6. Add environment variables to `.env.example`

### Running Migrations

```bash
# Local development
npx dotenv -e .env.local -- npm run db:migrate

# Or set DATABASE_URL directly
DATABASE_URL=your-connection-string npm run db:migrate
```

## License

MIT License - feel free to use this for personal or commercial projects.

## Support

For issues and feature requests, please create an issue on GitHub.

---

Built with ❤️ using Next.js, Vercel, and Neon
