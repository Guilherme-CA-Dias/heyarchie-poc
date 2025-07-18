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
│   │   │   │   ├── ImportSection.tsx           # Import functionality with notification system
│   │   │   │   ├── LedgerAccountsSidebar.tsx  # Ledger accounts filtering sidebar
│   │   │   │   ├── TransactionsList.tsx       # Main transactions container
│   │   │   │   ├── TransactionsListHeader.tsx # Header with search, tabs, and view toggle
│   │   │   │   ├── LineItemsView.tsx          # Flattened line items display
│   │   │   │   ├── FullView.tsx               # Complete transaction details view
│   │   │   │   └── LoadingState.tsx           # Loading component with context
│   │   │   ├── hooks/               # Custom hooks for data management
│   │   │   │   └── useTransactions.ts         # Centralized transaction data management
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

The General Ledger page has been refactored into a modular component architecture for better maintainability and user experience:

#### **Core Components:**

- **ImportSection**: Handles importing transactions and ledger accounts from integrations with smart notification system
- **LedgerAccountsSidebar**: Displays and filters ledger accounts with sticky positioning and auto-refresh
- **TransactionsList**: Main transactions container orchestrating all transaction-related functionality
- **TransactionsListHeader**: Header component with search, integration tabs, and view toggle
- **LineItemsView**: Flattened line items display with dimension fields and classification
- **FullView**: Complete transaction details view with all line items and metadata
- **LoadingState**: Context-aware loading component with transaction count display

#### **Data Management:**

- **useTransactions Hook**: Centralized data management for transaction operations with infinite scrolling
- **Shared Types**: TypeScript interfaces for type safety across all components

#### **Key Features:**

- **Smart Loading**: Shows transaction counts while loading specific integration tabs
- **Auto-refresh**: Automatically updates data after import operations
- **Dimension Fields**: Displays customer, project, class, item, and location dimensions
- **Classification Support**: Shows transaction classification in line items view
- **Infinite Scrolling**: Efficient pagination for large transaction datasets
- **Real-time Search**: Instant filtering across all transaction fields

#### **Architecture Benefits:**

- **Separation of Concerns**: Each component has a single, focused responsibility
- **Code Reusability**: Components can be easily reused or modified independently
- **Maintainability**: Smaller, focused components are easier to debug and enhance
- **Performance**: Optimized rendering with proper React patterns
- **Developer Experience**: Clear component boundaries and TypeScript safety

### General Ledger Management

- **Import & Sync**: Import transactions from accounting integrations (QuickBooks, Xero) with real-time synchronization
- **Smart Filtering**: Filter transactions by ledger accounts with instant updates
- **Dual View Modes**:
  - **Line Items View**: Flattened display of individual line items with dimension fields
  - **Full View**: Complete transaction details with all metadata and line items
- **Advanced Search**: Real-time search across transaction IDs, memos, numbers, classifications, and line item descriptions
- **Integration Tabs**: Switch between "All" and specific integration views (QuickBooks, Xero, etc.)
- **Dimension Support**: Display customer, project, class, item, and location dimensions from accounting systems
- **Classification Display**: Show transaction classification in both view modes
- **Infinite Scrolling**: Efficient pagination for large transaction datasets
- **Auto-refresh**: Automatic data updates after import operations

### Document Management

- Import documents from cloud storage (Google Drive, Dropbox, OneDrive, etc.)
- Real-time document synchronization
- Document search and filtering

### Knowledge Base

- Organize imported content into a searchable knowledge base
- Integration-based content grouping
- Document navigation and viewing

## Todos

- [ ] Update naming convention from "journal entries" to "general ledger transactions"
- [ ] Improve TypeScript type safety throughout the codebase

## License

MIT
