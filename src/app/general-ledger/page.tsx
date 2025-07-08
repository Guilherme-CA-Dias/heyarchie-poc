"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, AlertCircle, CheckCircle, BookOpen } from "lucide-react";
import { useAuth } from "@/app/auth-provider";
import { useIntegrationApp, useIntegrations } from "@integration-app/react";
import { toast } from "sonner";
import { ACCOUNTING_INTEGRATIONS, TRANSACTION_TYPES } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface TransactionLineItem {
  id: string;
  description?: string;
  amount: number;
  type: string;
  postingType?: string;
  dimension?: string;
  ledgerAccountId?: string;
  accountRef?: {
    value: string;
    name: string;
  };
}

interface Transaction {
  id: string;
  number?: string;
  memo?: string;
  currency: string;
  ledgerAccountId?: string;
  lineItems: TransactionLineItem[];
  transactionDate: string;
  createdTime: string;
  updatedTime: string;
  integrationId?: string;
  integrationName?: string;
  connectionId?: string;
  classification: string; // Type of transaction
  totalAmount?: number; // Total amount from API
  rawFields?: any;
}

interface LedgerAccount {
  id: string;
  name: string;
  type: string;
  classification?: string;
  integrationId?: string;
  integrationName?: string;
  connectionId?: string;
  rawFields?: any;
}

interface ImportResult {
  integrationId: string;
  integrationName: string;
  success: boolean;
  count: number;
  error?: string;
}

export default function GeneralLedgerPage() {
  const { customerId, customerName } = useAuth();
  const integrationApp = useIntegrationApp();
  const { integrations } = useIntegrations();
  const [isImporting, setIsImporting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [ledgerAccountSearchTerm, setLedgerAccountSearchTerm] = useState("");
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const pageSize = 10;
  const observerRef = useRef<IntersectionObserver | null>(null);
  const lastEntryRef = useRef<HTMLDivElement | null>(null);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [availableIntegrations, setAvailableIntegrations] = useState<string[]>([]);
  const [integrationCounts, setIntegrationCounts] = useState<{[key: string]: {count: number, name: string}}>({});
  const [totalCount, setTotalCount] = useState(0);
  const [ledgerAccounts, setLedgerAccounts] = useState<LedgerAccount[]>([]);
  const [isImportingLedgerAccounts, setIsImportingLedgerAccounts] = useState(false);
  const [selectedLedgerAccountId, setSelectedLedgerAccountId] = useState<string | null>(null);
  const [activeLedgerAccountTab, setActiveLedgerAccountTab] = useState<string>("all");
  const [ledgerAccountCounts, setLedgerAccountCounts] = useState<{[key: string]: {count: number, name: string}}>({});
  const [availableLedgerAccountIntegrations, setAvailableLedgerAccountIntegrations] = useState<string[]>([]);

  // Load existing transactions and ledger accounts from MongoDB on page load
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setCurrentPage(0);
        
        // Fetch counts first
        const countsResponse = await fetch('/api/journal-entries?countOnly=true');
        if (countsResponse.ok) {
          const countsData = await countsResponse.json();
          setTotalCount(countsData.total);
          
          const countsMap: {[key: string]: {count: number, name: string}} = {};
          countsData.counts.forEach((item: any) => {
            countsMap[item.integrationId] = {
              count: item.count,
              name: item.integrationName
            };
          });
          setIntegrationCounts(countsMap);
          setAvailableIntegrations(countsData.counts.map((item: any) => item.integrationId));
        }
        
        // Fetch first page of transactions
        const response = await fetch(`/api/journal-entries?limit=${pageSize}&offset=0`);
        if (response.ok) {
          const data = await response.json();
          const transactions = data.transactions || [];
          setTransactions(transactions);
          // Set hasMore based on whether we got a full page of results
          setHasMore(transactions.length === pageSize);
        } else {
          console.error('Failed to load transactions');
        }

        // Load ledger accounts
        await loadLedgerAccounts();
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Reset pagination when search term changes (tab filtering is now handled by data loading)
  useEffect(() => {
    if (searchTerm) {
      // When searching, we show all filtered results without pagination
      setHasMore(false);
    } else if (activeTab !== "all") {
      // When on a specific integration tab, no pagination
      setHasMore(false);
    }
    // Note: hasMore is managed by loadMoreEntries and initial load, not here
  }, [searchTerm, activeTab]);

  // Intersection observer for infinite scrolling
  const lastEntryElementRef = useCallback((node: HTMLDivElement | null) => {
    if (isLoadingMore || searchTerm || activeTab !== "all") return;
    
    if (observerRef.current) observerRef.current.disconnect();
    
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        loadMoreEntries();
      }
    });
    
    if (node) observerRef.current.observe(node);
  }, [isLoadingMore, hasMore, searchTerm, activeTab]);

  // Load more transactions
  const loadMoreEntries = async () => {
    if (isLoadingMore || !hasMore) return;
    
    try {
      setIsLoadingMore(true);
      const nextPage = currentPage + 1;
      const offset = nextPage * pageSize;
      
      const response = await fetch(`/api/journal-entries?limit=${pageSize}&offset=${offset}`);
      if (response.ok) {
        const data = await response.json();
        const newTransactions = data.transactions || [];
        
        setTransactions(prev => [...prev, ...newTransactions]);
        setCurrentPage(nextPage);
        setHasMore(newTransactions.length === pageSize);
      } else {
        console.error('Failed to load more transactions');
      }
    } catch (error) {
      console.error('Error loading more transactions:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Save transactions to MongoDB
  const saveTransactions = async (transactions: Transaction[], connectionId: string, integrationId: string, integrationName: string) => {
    try {
      const response = await fetch('/api/journal-entries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactions,
          connectionId,
          integrationId,
          integrationName,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save transactions');
      }

      const result = await response.json();
      console.log('Saved transactions:', result);
      return result;
    } catch (error) {
      console.error('Error saving transactions:', error);
      throw error;
    }
  };

  const handleImportTransactions = async () => {
    if (!customerId) {
      toast.error("Please log in to import transactions");
      return;
    }

    setIsImporting(true);
    setImportResults([]);

    try {
      const results: ImportResult[] = [];

      // Filter for integrations that support accounting transactions
      const accountingIntegrations = integrations.filter((integration: any) => 
        ACCOUNTING_INTEGRATIONS.includes(integration.key as any) && integration.connection
      );

      if (accountingIntegrations.length === 0) {
        toast.error("No accounting integrations found. Please connect an accounting integration first.");
        setIsImporting(false);
        return;
      }

      // Use transaction types from constants
      const transactionTypes = TRANSACTION_TYPES;

      // Process each integration separately
      for (const integration of accountingIntegrations) {
        if (!integration.connection) {
          results.push({
            integrationId: integration.key,
            integrationName: integration.name,
            success: false,
            count: 0,
            error: "No active connection found",
          });
          continue;
        }

        try {
          let totalTransactions = 0;
          const integrationTransactions: Transaction[] = [];

          // Import each transaction type
          for (const transactionType of transactionTypes) {
            try {
              let cursor: string | undefined;
              let hasMore = true;

              // Paginate through all transactions for this type
              while (hasMore) {
                const response = await integrationApp
                  .connection(integration.connection.id)
                  .action(transactionType.action)
                  .run({ cursor });

                if (response.output && Array.isArray(response.output.records)) {
                  const transactions = response.output.records.map((record: any) => {
                    // Ensure line items have ledgerAccountId
                    const lineItems = (record.fields.lineItems || []).map((lineItem: any) => ({
                      id: lineItem.id,
                      description: lineItem.description,
                      amount: lineItem.amount,
                      type: lineItem.type,
                      postingType: lineItem.postingType,
                      dimension: lineItem.dimension,
                      ledgerAccountId: lineItem.ledgerAccountId,
                      accountRef: lineItem.accountRef,
                      exchangeRate: lineItem.exchangeRate,
                    }));

                    // Debug: Log the first entry's line items to see the structure
                    if (response.output.records.indexOf(record) === 0) {
                      console.log(`Sample line items being saved for ${integration.key} (${transactionType.classification}):`, lineItems);
                    }

                    return {
                      // Include all fields from the record.fields as-is
                      ...record.fields,
                      // Ensure line items are properly structured with ledgerAccountId
                      lineItems,
                      // Include the record-level metadata
                      id: record.fields.id || record.id,
                      createdTime: record.fields.createdTime || record.createdTime,
                      updatedTime: record.fields.updatedTime || record.updatedTime,
                      // Include the complete raw fields for reference
                      rawFields: record.rawFields,
                    };
                  });

                  integrationTransactions.push(...transactions);
                  totalTransactions += transactions.length;

                  // Check if there are more pages
                  cursor = response.output.cursor;
                  hasMore = !!cursor && transactions.length > 0;

                  // Optional: Add a small delay to avoid rate limiting
                  if (hasMore) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                  }
                } else {
                  hasMore = false;
                }
              }
            } catch (error) {
              console.warn(`Failed to import ${transactionType.classification} for ${integration.key}:`, error);
              // Continue with other transaction types even if one fails
            }
          }

          // Save transactions to MongoDB for this specific integration
          if (totalTransactions > 0 && integration.connection) {
            console.log(`Saving ${totalTransactions} transactions for ${integration.key} with connectionId: ${integration.connection.id}`);
            await saveTransactions(integrationTransactions, integration.connection.id, integration.key, integration.name);
          }

          results.push({
            integrationId: integration.key,
            integrationName: integration.name,
            success: true,
            count: totalTransactions,
          });

        } catch (error) {
          results.push({
            integrationId: integration.key,
            integrationName: integration.name,
            success: false,
            count: 0,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      setImportResults(results);
      
      // Reload transactions from database after import
      const reloadResponse = await fetch(`/api/journal-entries?limit=${pageSize}&offset=0`);
      if (reloadResponse.ok) {
        const data = await reloadResponse.json();
        setTransactions(data.transactions || []);
        setCurrentPage(0);
        setHasMore(data.transactions.length === pageSize);
      }
      
      // Refresh available integrations
      await refreshAvailableIntegrations();

      const totalImported = results.filter(r => r.success).reduce((sum, r) => sum + r.count, 0);
      
      if (totalImported > 0) {
        toast.success(`Successfully imported ${totalImported} transactions from ${results.filter(r => r.success).length} integration(s)`);
      } else {
        toast.error("No transactions were imported. Check your integrations.");
      }

    } catch (error) {
      console.error("Error importing transactions:", error);
      toast.error("Failed to import transactions");
    } finally {
      setIsImporting(false);
    }
  };

  // Save ledger accounts to MongoDB
  const saveLedgerAccounts = async (accounts: LedgerAccount[], connectionId: string, integrationId: string, integrationName: string) => {
    try {
      const response = await fetch('/api/ledger-accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ledgerAccounts: accounts,
          connectionId,
          integrationId,
          integrationName,
          userId: customerId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save ledger accounts');
      }

      const result = await response.json();
      console.log('Saved ledger accounts:', result);
      return result;
    } catch (error) {
      console.error('Error saving ledger accounts:', error);
      throw error;
    }
  };

  const handleImportLedgerAccounts = async () => {
    if (!customerId) {
      toast.error("Please log in to import ledger accounts");
      return;
    }

    setIsImportingLedgerAccounts(true);

    try {
      // Filter for integrations that support ledger accounts
      const ledgerAccountIntegrations = integrations.filter((integration: any) => 
        ACCOUNTING_INTEGRATIONS.includes(integration.key as any) && integration.connection
      );

      if (ledgerAccountIntegrations.length === 0) {
        toast.error("No accounting integrations found. Please connect an accounting integration first.");
        setIsImportingLedgerAccounts(false);
        return;
      }

      let totalAccounts = 0;

      // Process each integration separately
      for (const integration of ledgerAccountIntegrations) {
        if (!integration.connection) continue;

        try {
          let cursor: string | undefined;
          let hasMore = true;
          const integrationAccounts: LedgerAccount[] = [];

          // Paginate through all ledger accounts for this integration
          while (hasMore) {
            const response = await integrationApp
              .connection(integration.connection.id)
              .action('get-ledger-accounts')
              .run({ cursor });

            if (response.output && Array.isArray(response.output.records)) {
              const accounts = response.output.records.map((record: any) => ({
                ...record.fields,
                id: record.fields.id || record.id,
                integrationId: integration.key,
                integrationName: integration.name,
                connectionId: integration.connection?.id,
                rawFields: record.rawFields,
              }));

              integrationAccounts.push(...accounts);
              totalAccounts += accounts.length;

              // Check if there are more pages
              cursor = response.output.cursor;
              hasMore = !!cursor && accounts.length > 0;

              // Optional: Add a small delay to avoid rate limiting
              if (hasMore) {
                await new Promise(resolve => setTimeout(resolve, 100));
              }
            } else {
              hasMore = false;
            }
          }

          // Save accounts to MongoDB for this specific integration
          if (integrationAccounts.length > 0 && integration.connection) {
            await saveLedgerAccounts(integrationAccounts, integration.connection.id, integration.key, integration.name);
          }

        } catch (error) {
          console.error(`Error importing ledger accounts for ${integration.key}:`, error);
        }
      }

      // Reload ledger accounts from database
      await loadLedgerAccounts();

      if (totalAccounts > 0) {
        toast.success(`Successfully imported ${totalAccounts} ledger accounts`);
      } else {
        toast.error("No ledger accounts were imported. Check your integrations.");
      }

    } catch (error) {
      console.error("Error importing ledger accounts:", error);
      toast.error("Failed to import ledger accounts");
    } finally {
      setIsImportingLedgerAccounts(false);
    }
  };

  // Load ledger accounts from MongoDB
  const loadLedgerAccounts = async () => {
    try {
      // First get counts
      const countsResponse = await fetch('/api/ledger-accounts?countOnly=true');
      if (countsResponse.ok) {
        const countsData = await countsResponse.json();
        
        // Update counts
        const countsMap: {[key: string]: {count: number, name: string}} = {};
        countsData.counts?.forEach((item: any) => {
          countsMap[item.integrationId] = {
            count: item.count,
            name: item.integrationName
          };
        });
        setLedgerAccountCounts(countsMap);
        setAvailableLedgerAccountIntegrations(countsData.counts?.map((item: any) => item.integrationId) || []);
      }
      
      // Then get all ledger accounts (no pagination for sidebar)
      const response = await fetch('/api/ledger-accounts?limit=1000&offset=0');
      if (response.ok) {
        const data = await response.json();
        setLedgerAccounts(data.ledgerAccounts || []);
      } else {
        console.error('Failed to load ledger accounts');
      }
    } catch (error) {
      console.error('Error loading ledger accounts:', error);
    }
  };

  // Load ledger accounts for a specific integration
  const loadLedgerAccountsForIntegration = async (integrationId: string) => {
    try {
      if (integrationId === "all") {
        // Load all ledger accounts
        const response = await fetch('/api/ledger-accounts?limit=1000&offset=0');
        if (response.ok) {
          const data = await response.json();
          setLedgerAccounts(data.ledgerAccounts || []);
        }
      } else {
        // Load ledger accounts for specific integration
        const response = await fetch(`/api/ledger-accounts?integrationId=${integrationId}&limit=1000&offset=0`);
        if (response.ok) {
          const data = await response.json();
          setLedgerAccounts(data.ledgerAccounts || []);
        }
      }
    } catch (error) {
      console.error('Error loading ledger accounts for integration:', error);
    }
  };

  // Refresh available integrations
  const refreshAvailableIntegrations = async () => {
    try {
      const countsResponse = await fetch('/api/journal-entries?countOnly=true');
      if (countsResponse.ok) {
        const countsData = await countsResponse.json();
        setTotalCount(countsData.total);
        
        const countsMap: {[key: string]: {count: number, name: string}} = {};
        countsData.counts.forEach((item: any) => {
          countsMap[item.integrationId] = {
            count: item.count,
            name: item.integrationName
          };
        });
        setIntegrationCounts(countsMap);
        setAvailableIntegrations(countsData.counts.map((item: any) => item.integrationId));
      }
    } catch (error) {
      console.error('Error refreshing integrations:', error);
    }
  };

  // Filter transactions based on search term and selected ledger account
  const filteredTransactions = transactions.filter((transaction) => {
    // Filter by selected ledger account
    if (selectedLedgerAccountId) {
      // Check if any line item has the selected ledger account ID
      const hasMatchingLedgerAccount = transaction.lineItems?.some((line: any) => 
        line.ledgerAccountId === selectedLedgerAccountId
      );
      if (!hasMatchingLedgerAccount) return false;
    }
    
    // Filter by search term
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    
    // Search in ID
    if (transaction.id?.toLowerCase().includes(searchLower)) return true;
    
    // Search in memo
    if (transaction.memo?.toLowerCase().includes(searchLower)) return true;
    
    // Search in number
    if (transaction.number?.toLowerCase().includes(searchLower)) return true;
    
    // Search in classification
    if (transaction.classification?.toLowerCase().includes(searchLower)) return true;
    
    // Search in line items descriptions
    if (transaction.lineItems?.some((line: any) => 
      line.description?.toLowerCase().includes(searchLower)
    )) return true;
    
    // Search in line items account names
    if (transaction.lineItems?.some((line: any) => 
      line.accountRef?.name?.toLowerCase().includes(searchLower)
    )) return true;
    
    return false;
  });

  // Filter ledger accounts based on search term
  const filteredLedgerAccounts = ledgerAccounts.filter((account) => {
    if (!ledgerAccountSearchTerm) return true;
    
    const searchLower = ledgerAccountSearchTerm.toLowerCase();
    
    // Search in ID
    if (account.id?.toLowerCase().includes(searchLower)) return true;
    
    // Search in name
    if (account.name?.toLowerCase().includes(searchLower)) return true;
    
    // Search in type
    if (account.type?.toLowerCase().includes(searchLower)) return true;
    
    // Search in classification
    if (account.classification?.toLowerCase().includes(searchLower)) return true;
    
    // Search in integration name
    if (account.integrationName?.toLowerCase().includes(searchLower)) return true;
    
    return false;
  });

  // Load entries for a specific integration
  const loadEntriesForIntegration = async (integrationId: string) => {
    try {
      setIsLoading(true);
      setCurrentPage(0);
      
      if (integrationId === "all") {
        // Load all entries with pagination
        const response = await fetch(`/api/journal-entries?limit=${pageSize}&offset=0`);
        if (response.ok) {
          const data = await response.json();
          setTransactions(data.transactions || []);
          setHasMore(data.transactions.length === pageSize);
        }
      } else {
        // Load all entries for specific integration (no pagination for filtered views)
        const response = await fetch(`/api/journal-entries?integrationId=${integrationId}&limit=1000&offset=0`);
        if (response.ok) {
          const data = await response.json();
          setTransactions(data.transactions || []);
          setHasMore(false); // No pagination for filtered views
        }
      }
    } catch (error) {
      console.error('Error loading entries for integration:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Add this useEffect after the other useEffects
  useEffect(() => {
    // Only trigger on the 'all' tab
    if (activeTab === 'all') {
      if (searchTerm) {
        // Fetch all transactions for searching
        setIsLoading(true);
        fetch('/api/journal-entries?limit=1000&offset=0')
          .then(res => res.json())
          .then(data => {
            setTransactions(data.transactions || []);
            setHasMore(false); // No infinite scroll during search
          })
          .catch(err => {
            console.error('Failed to fetch all transactions for search:', err);
          })
          .finally(() => setIsLoading(false));
      } else {
        // If search is cleared, reload paginated view
        setIsLoading(true);
        fetch(`/api/journal-entries?limit=${pageSize}&offset=0`)
          .then(res => res.json())
          .then(data => {
            setTransactions(data.transactions || []);
            setCurrentPage(0);
            setHasMore((data.transactions || []).length === pageSize);
          })
          .catch(err => {
            console.error('Failed to reload paginated transactions:', err);
          })
          .finally(() => setIsLoading(false));
      }
    }
  }, [searchTerm, activeTab]);

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="flex flex-col mb-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          General Ledger
        </h1>
        <p className="text-sm text-gray-500">
          Import and manage transactions from your connected accounting integrations.
        </p>
      </div>

      <div className="space-y-6">
        {/* Import Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <BookOpen className="h-4 w-4" />
                Import Ledger Accounts
              </CardTitle>
              <p className="text-xs text-gray-500">
                Import all ledger accounts from your connected accounting integrations.
              </p>
            </CardHeader>
            <CardContent className="pt-0">
              <Button 
                onClick={handleImportLedgerAccounts}
                disabled={isImportingLedgerAccounts}
                className="w-full sm:w-auto"
              >
                {isImportingLedgerAccounts ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <BookOpen className="mr-2 h-4 w-4" />
                    Import All Ledger Accounts
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Download className="h-4 w-4" />
                Import Transactions
              </CardTitle>
              <p className="text-xs text-gray-500">
                Import all transactions from your connected accounting integrations.
              </p>
            </CardHeader>
            <CardContent className="pt-0">
              <Button 
                onClick={handleImportTransactions}
                disabled={isImporting}
                className="w-full sm:w-auto"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Import All Transactions
                  </>
                )}
              </Button>
            </CardContent>
          </Card>


        </div>

        {/* Import Results */}
        {importResults.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Import Results</CardTitle>
              <p className="text-sm text-gray-500">
                Results from the latest import operation
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {importResults.map((result, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {result.success ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-red-500" />
                      )}
                      <div>
                        <p className="font-medium">{result.integrationName}</p>
                        {result.error && (
                          <p className="text-sm text-red-500">{result.error}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {result.success && (
                        <Badge variant="secondary">
                          {result.count} transactions
                        </Badge>
                      )}
                      <Badge variant={result.success ? "default" : "destructive"}>
                        {result.success ? "Success" : "Failed"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Transactions and Ledger Accounts */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Ledger Accounts Sidebar */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Ledger Accounts</CardTitle>
                <p className="text-sm text-gray-500">
                  {ledgerAccounts.length} accounts stored
                </p>
                <input
                  type="text"
                  placeholder="Search ledger accounts..."
                  value={ledgerAccountSearchTerm}
                  onChange={(e) => setLedgerAccountSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />

                {/* Ledger Account Integration Tabs */}
                {availableLedgerAccountIntegrations.length > 0 && (
                  <div className="flex space-x-1 mt-4 border-b">
                    <button
                      onClick={() => {
                        setActiveLedgerAccountTab("all");
                        loadLedgerAccountsForIntegration("all");
                      }}
                      className={cn(
                        "px-4 py-2 text-sm font-medium rounded-t-lg transition-colors",
                        activeLedgerAccountTab === "all"
                          ? "bg-blue-100 text-blue-700 border-b-2 border-blue-700"
                          : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                      )}
                    >
                      All ({ledgerAccounts.length})
                    </button>
                    {availableLedgerAccountIntegrations.map((integrationId) => {
                      const integrationData = ledgerAccountCounts[integrationId];
                      const integrationName = integrationData?.name || integrationId;
                      const count = integrationData?.count || 0;
                      
                      return (
                        <button
                          key={integrationId}
                          onClick={() => {
                            setActiveLedgerAccountTab(integrationId);
                            loadLedgerAccountsForIntegration(integrationId);
                          }}
                          className={cn(
                            "px-4 py-2 text-sm font-medium rounded-t-lg transition-colors",
                            activeLedgerAccountTab === integrationId
                              ? "bg-blue-100 text-blue-700 border-b-2 border-blue-700"
                              : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                          )}
                        >
                          {integrationName} ({count})
                        </button>
                      );
                    })}
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {filteredLedgerAccounts.map((account) => (
                    <div
                      key={`${account.integrationId}-${account.id}-${account.connectionId}`}
                      className={cn(
                        "p-3 border rounded-lg cursor-pointer transition-colors",
                        selectedLedgerAccountId === account.id
                          ? "bg-blue-50 border-blue-200"
                          : "hover:bg-gray-50"
                      )}
                      onClick={() => setSelectedLedgerAccountId(account.id)}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{account.name}</p>
                          <p className="text-xs text-gray-500 truncate">ID: {account.id}</p>
                          <p className="text-xs text-gray-500 truncate">Type: {account.type}</p>
                          {account.classification && (
                            <p className="text-xs text-gray-500 truncate">Classification: {account.classification}</p>
                          )}
                          {account.integrationName && (
                            <p className="text-xs text-purple-600 truncate">{account.integrationName}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Transactions List */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Transactions</CardTitle>
                    <p className="text-sm text-gray-500">
                      {isLoading ? "Loading..." : `${totalCount} transactions stored`}
                      {searchTerm && ` • ${filteredTransactions.length} filtered`}
                      {selectedLedgerAccountId && ` • ${filteredTransactions.length} from selected account`}
                      {activeTab !== "all" && ` • ${filteredTransactions.length} from ${integrationCounts[activeTab]?.name || activeTab}`}
                    </p>
                    {selectedLedgerAccountId && (
                      <button
                        onClick={() => setSelectedLedgerAccountId(null)}
                        className="text-xs text-blue-600 hover:text-blue-800 mt-1"
                      >
                        Clear ledger account filter
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="Search transactions..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Integration Tabs */}
                {availableIntegrations.length > 0 && (
                  <div className="flex space-x-1 mt-4 border-b">
                    <button
                      onClick={() => {
                        setActiveTab("all");
                        loadEntriesForIntegration("all");
                      }}
                      className={cn(
                        "px-4 py-2 text-sm font-medium rounded-t-lg transition-colors",
                        activeTab === "all"
                          ? "bg-blue-100 text-blue-700 border-b-2 border-blue-700"
                          : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                      )}
                    >
                      All ({selectedLedgerAccountId ? filteredTransactions.length : totalCount})
                    </button>
                    {availableIntegrations.map((integrationId) => {
                      const integrationData = integrationCounts[integrationId];
                      const integrationName = integrationData?.name || integrationId;
                      const originalCount = integrationData?.count || 0;
                      
                      // Calculate filtered count for this integration
                      const filteredCount = selectedLedgerAccountId 
                        ? filteredTransactions.filter(transaction => transaction.integrationId === integrationId).length
                        : originalCount;
                      
                      return (
                        <button
                          key={integrationId}
                          onClick={() => {
                            setActiveTab(integrationId);
                            loadEntriesForIntegration(integrationId);
                          }}
                          className={cn(
                            "px-4 py-2 text-sm font-medium rounded-t-lg transition-colors",
                            activeTab === integrationId
                              ? "bg-blue-100 text-blue-700 border-b-2 border-blue-700"
                              : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                          )}
                        >
                          {integrationName} ({filteredCount})
                        </button>
                      );
                    })}
                  </div>
                )}
                {/* Debug info */}
                {process.env.NODE_ENV === 'development' && (
                  <div className="text-xs text-gray-400 mt-2">
                    Debug: {availableIntegrations.length} integrations available - {availableIntegrations.join(', ')}
                    <br />
                    Debug: {Object.keys(ledgerAccountCounts).length} ledger account integrations - {Object.keys(ledgerAccountCounts).join(', ')}
                    <br />
                    Debug: {ledgerAccounts.length} ledger accounts loaded
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span className="ml-2">Loading transactions...</span>
                  </div>
                ) : filteredTransactions.length > 0 ? (
                  <div className="space-y-3">
                    {filteredTransactions.map((transaction, index) => {
                      const isLastEntry = index === filteredTransactions.length - 1;

                      return (
                        <div 
                          key={`${transaction.integrationId}-${transaction.id}-${transaction.connectionId}`} 
                          className="border rounded-lg p-4 mb-4"
                          ref={isLastEntry ? lastEntryElementRef : null}
                        >
                          {/* Header */}
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex-1">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <p className="font-bold text-lg">ID: {transaction.id}</p>
                                  {transaction.integrationName && (
                                    <p className="font-medium text-purple-600">Integration: {transaction.integrationName}</p>
                                  )}
                                </div>
                                <div>
                                  {transaction.memo && (
                                    <>
                                      <p className="font-bold text-lg">Memo</p>
                                      <p className="font-medium text-gray-700">{transaction.memo}</p>
                                    </>
                                  )}
                                  {!transaction.memo && transaction.number && (
                                    <>
                                      <p className="font-bold text-lg">Number</p>
                                      <p className="font-medium text-gray-700">{transaction.number}</p>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="text-right ml-4">
                              <p className="font-bold text-lg text-black">
                                {typeof transaction.totalAmount === 'number' && !isNaN(transaction.totalAmount)
                                  ? `${transaction.totalAmount.toLocaleString('en-US', {
                                      style: 'currency',
                                      currency: transaction.currency || 'USD'
                                    })}`
                                  : 'N/A'
                                }
                              </p>
                              <p className="text-sm text-gray-500">{transaction.currency}</p>
                            </div>
                          </div>

                          {/* Transaction Details */}
                          <div className="grid grid-cols-2 gap-4 mb-3 text-sm">
                            <div>
                              <p><span className="font-medium">Transaction Date:</span> {new Date(transaction.transactionDate).toLocaleDateString()}</p>
                              <p><span className="font-medium">Created:</span> {new Date(transaction.createdTime).toLocaleString()}</p>
                              <p><span className="font-medium">Updated:</span> {new Date(transaction.updatedTime).toLocaleString()}</p>
                            </div>
                            <div>
                              {transaction.number && <p><span className="font-medium">Number:</span> {transaction.number}</p>}
                              {transaction.memo && <p><span className="font-medium">Memo:</span> {transaction.memo}</p>}
                              <p><span className="font-medium">Classification:</span> {transaction.classification}</p>
                            </div>
                          </div>

                          {/* Line Items */}
                          {transaction.lineItems && transaction.lineItems.length > 0 && (
                            <div className="mb-3">
                              <p className="font-medium mb-2">Line Items ({transaction.lineItems.length}):</p>
                              <div className="space-y-2">
                                {transaction.lineItems.map((line: any, lineIndex: number) => {
                                  // Create a truly unique key that combines transaction and line identifiers
                                  const uniqueKey = `${transaction.integrationId}-${transaction.id}-${transaction.connectionId}-${line.id || 'no-id'}-${lineIndex}`;
                                  
                                  return (
                                    <div key={uniqueKey} className="bg-gray-50 p-3 rounded text-sm">
                                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                                        <div>
                                          <p className="font-bold text-xs text-gray-500 uppercase">ID</p>
                                          <p className="font-medium">{line.id}</p>
                                        </div>
                                        <div>
                                          <p className="font-bold text-xs text-gray-500 uppercase">Ledger Account ID</p>
                                          <p className="font-medium text-blue-600">
                                            {line.ledgerAccountId || 'N/A'}
                                          </p>
                                        </div>
                                        <div className="flex flex-row items-center justify-between md:block md:space-y-1">
                                          <div>
                                            <p className="font-bold text-xs text-gray-500 uppercase">Type</p>
                                            <p className="font-medium whitespace-normal break-all">{line.type}</p>
                                            {line.postingType && (
                                              <p className="text-xs text-gray-500">({line.postingType})</p>
                                            )}
                                          </div>
                                        </div>
                                        <div className="flex flex-col items-end justify-center md:items-end md:justify-center h-full">
                                          <p className="font-bold text-xs text-gray-500 uppercase">Amount</p>
                                          <p className="font-medium text-black">
                                            {typeof line.amount === 'number' && !isNaN(line.amount)
                                              ? `${line.amount.toLocaleString('en-US', {
                                                  style: 'currency',
                                                  currency: transaction.currency || 'USD'
                                                })}`
                                              : 'N/A'
                                            }
                                          </p>
                                        </div>
                                      </div>
                                      {line.description && (
                                        <div className="mt-2">
                                          <p className="font-bold text-xs text-gray-500 uppercase">Description</p>
                                          <p className="text-sm">{line.description}</p>
                                        </div>
                                      )}
                                      {line.accountRef && (
                                        <div className="mt-2">
                                          <p className="font-bold text-xs text-gray-500 uppercase">Account</p>
                                          <p className="text-sm">{line.accountRef.name} ({line.accountRef.value})</p>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* All Other Fields */}
                          <div className="text-xs text-gray-600">
                            <p className="font-medium mb-1">All Fields:</p>
                            <pre className="bg-gray-100 p-2 rounded overflow-auto max-h-32">
                              {JSON.stringify(transaction, null, 2)}
                            </pre>
                          </div>
                        </div>
                      );
                    })}
                    
                    {/* Loading more indicator */}
                    {isLoadingMore && (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-6 w-6 animate-spin" />
                        <span className="ml-2">Loading more transactions...</span>
                      </div>
                    )}
                    
                    {/* End of list indicator */}
                    {!hasMore && filteredTransactions.length > 0 && (
                      <p className="text-center text-gray-500 text-sm py-4">
                        No more transactions to load
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    {searchTerm 
                      ? `No transactions found matching "${searchTerm}". Try a different search term.`
                      : "No transactions found. Import some transactions to get started."
                    }
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
} 