# Content Import Example

This is an application showcasing how you can implement Importing Content and Files into a knowledge base using [Integration.app](https://integration.app). The app is built with Next.js/React.

[Demo](https://content-import-example.vercel.app/)

## Prerequisites

- Node.js 18+
- Integration.app workspace credentials (Workspace Key and Secret). [Get credentials](https://console.integration.app/settings/workspace) from the workspace settings.
- MongoDB connection string (We provide a docker-compose file to spin up a local MongoDB instance. See [Using mongodb via Docker](#using-mongodb-via-docker) for more details.)
- AWS credentials (for S3)

## Project Structure

```
heyarchie-poc/
├── membrane/                          # Integration.app configuration files
│   └── membrane/                      # Membrane configuration
│       ├── actions/                   # API actions for integrations
│       │   ├── download-content-item/ # Content download actions
│       │   ├── find-content-item-by-id/
│       │   ├── get-bills/            # Accounting actions
│       │   ├── get-credit-notes/
│       │   ├── get-invoices/
│       │   ├── get-journal-entries/
│       │   ├── get-ledger-accounts/
│       │   ├── get-payments/
│       │   └── get-sales-receipts/
│       ├── appEventTypes/            # Event type definitions
│       ├── dataSources/              # Data source configurations
│       │   ├── bills/
│       │   ├── content-items/
│       │   ├── credit-notes/
│       │   ├── invoices/
│       │   ├── journal-entries/
│       │   ├── ledger-accounts/
│       │   ├── payments/
│       │   └── sales-receipt/
│       ├── fieldMappings/            # Field mapping configurations
│       ├── flows/                    # Integration flows
│       │   ├── download-content-item/
│       │   ├── download-document/
│       │   ├── receive-bill-events/
│       │   ├── receive-content-item-events/
│       │   ├── receive-credit-note-events/
│       │   ├── receive-invoice-events/
│       │   ├── receive-journal-entry-events/
│       │   ├── receive-ledger-account-events/
│       │   ├── receive-payment-events/
│       │   └── receive-sales-receipt-events/
│       └── integrations/             # Integration configurations
│           ├── box/
│           ├── dropbox/
│           ├── google-drive/
│           ├── microsoft-sharepoint/
│           ├── onedrive/
│           ├── quickbooks/
│           └── xero/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── api/                      # API routes
│   │   │   ├── documents/           # Document management APIs
│   │   │   ├── inngest/             # Background job handling
│   │   │   ├── integration-token/   # Integration authentication
│   │   │   ├── integrations/        # Integration management
│   │   │   ├── journal-entries/     # General ledger transactions API
│   │   │   ├── ledger-accounts/     # Ledger accounts API
│   │   │   └── webhooks/            # Webhook handlers
│   │   ├── general-ledger/          # General ledger page (refactored with modular components)
│   │   │   ├── components/          # Modular components for ledger functionality
│   │   │   ├── hooks/               # Custom hooks for data management
│   │   │   └── types.ts             # Shared TypeScript interfaces
│   │   ├── integrations/            # Integrations management page
│   │   └── knowledge/               # Knowledge base page
│   ├── components/                   # Reusable UI components
│   │   ├── ui/                      # Shadcn UI components
│   │   ├── auth-test.tsx
│   │   └── header.tsx
│   ├── hooks/                       # Custom React hooks
│   ├── inngest/                     # Background job client
│   ├── lib/                         # Utility libraries
│   ├── models/                      # MongoDB models
│   └── types/                       # TypeScript type definitions
├── public/                          # Static assets
├── docker-compose.yml               # Local MongoDB setup
├── membrane.config.yml              # Integration.app workspace config
└── package.json
```

## Important Notes

### Journal Entries vs General Ledger Transactions

**⚠️ Pending Change**: Throughout the codebase, you may see references to "journal entries" in file names, API routes, and database models. These should be understood as **general ledger transactions**. The naming convention is being updated to reflect this more accurately.

- Files like `journal-entries/` in the API routes actually handle general ledger transactions
- Database models like `JournalEntry` represent general ledger transaction records
- The functionality includes importing and managing transactions from accounting integrations (QuickBooks, Xero, etc.)

This naming inconsistency is being addressed in future updates to improve code clarity.

## Setup

### 1. **Clone repository & Install dependencies:**

```bash
npm install
# or
yarn install
```

### 2. **Set up environment variables file:**

```bash
# Copy the sample environment file
cp .env-sample .env
```

### 3. **Add your credentials to the `.env` file:**

> Note: The following credentials are optional but enable additional features:

- **AWS S3**: Enables file download and storage in S3
- **Unstructured.io**: Enables text extraction from PDFs, Word documents, and other file formats

### 4. **Add the Scenario to Your Workspace:**

This application relies on predefined [flows](https://console.integration.app/docs/building/blocks/flows), [actions](https://console.integration.app/docs/building/blocks/actions), and other primitives, all organized within a **Scenario template**

To use the same flows and actions in your workspace, navigate to the [Continuously Import Content to My App Scenario](https://integration.app/scenarios/continuously-import-content-to-my-app) and click the **"Add to App"** button. This will add the required flows and actions, data sources and other primitives to your workspace.

### 5. Configure your apps

The [Continuously Import Content to My App Scenario](https://integration.app/scenarios/continuously-import-content-to-my-app) adds **8 apps** to your workspace and for most apps to work, you'll need to provide configuration parameters. The configuration guide for each apps explains how to get the credentials needed. See video below for an overview of the configuration process:

https://github.com/user-attachments/assets/272197b4-aea9-40ff-a444-ac0fa17f672f

### 6. **Start the development server:**

```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Using mongodb via Docker

### Prerequisites

- Docker and Docker Compose installed on your machine

### Setting up MongoDB

If you want to use MongoDB via Docker, you can do so by running the following command:

```bash
docker-compose up
```

You can now use the `MONGODB_URI` environment variable to connect to the database:

```env
MONGODB_URI=mongodb://admin:password123@localhost:27017/knowledge
```

## Features

### General Ledger Management (Refactored Architecture)

The General Ledger page has been refactored into a modular component architecture for better maintainability:

- **ImportSection**: Handles importing transactions and ledger accounts from integrations
- **LedgerAccountsSidebar**: Displays and filters ledger accounts with sticky positioning
- **TransactionsList**: Main transactions display with search, filtering, and infinite scrolling
- **useTransactions Hook**: Centralized data management for transaction operations
- **Shared Types**: TypeScript interfaces for type safety across components

This modular approach provides:

- Better separation of concerns
- Improved code reusability
- Easier testing and debugging
- Enhanced developer experience

### General Ledger Management

- Import transactions from accounting integrations (QuickBooks, Xero)
- Filter transactions by ledger accounts
- View transaction line items and details
- Search and filter functionality
- Integration-specific transaction views

### Document Management

- Import documents from cloud storage (Google Drive, Dropbox, OneDrive, etc.)
- Real-time document synchronization
- Document search and filtering

### Knowledge Base

- Organize imported content into a searchable knowledge base
- Integration-based content grouping
- Document navigation and viewing

## Todos

- [ ] Get events working for all apps
- [ ] Update naming convention from "journal entries" to "general ledger transactions"
- [ ] Improve TypeScript type safety throughout the codebase

## License

MIT
