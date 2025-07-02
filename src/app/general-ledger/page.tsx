"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, AlertCircle, CheckCircle, BookOpen } from "lucide-react";
import { useAuth } from "@/app/auth-provider";
import { useIntegrationApp, useIntegrations } from "@integration-app/react";
import { toast } from "sonner";
import { ACCOUNTING_INTEGRATIONS } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface JournalEntryLineItem {
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

interface JournalEntry {
  id: string;
  number?: string;
  memo?: string;
  currency: string;
  ledgerAccountId?: string;
  lineItems: JournalEntryLineItem[];
  transactionDate: string;
  createdTime: string;
  updatedTime: string;
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

interface LedgerAccount {
  id: string;
  name: string;
  type: string;
  status: string;
  currentBalance: number;
  currency: string;
  createdTime: string;
  updatedTime: string;
  classification: string;
  connectionId: string;
  integrationId: string;
  integrationName: string;
  userId: string;
  importedAt: string;
  rawFields?: any;
}

export default function GeneralLedgerPage() {
  const { customerId, customerName } = useAuth();
  const integrationApp = useIntegrationApp();
  const { integrations } = useIntegrations();
  const [isImporting, setIsImporting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
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

  // Load existing journal entries and ledger accounts from MongoDB on page load
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
        
        // Fetch first page of entries
        const response = await fetch(`/api/journal-entries?limit=${pageSize}&offset=0`);
        if (response.ok) {
          const data = await response.json();
          setJournalEntries(data.journalEntries || []);
          setHasMore(data.journalEntries.length === pageSize);
        } else {
          console.error('Failed to load journal entries');
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
    } else if (activeTab === "all") {
      // When search is cleared and on "All" tab, reset to paginated view
      setHasMore(journalEntries.length === pageSize);
    } else {
      // When on a specific integration tab, no pagination
      setHasMore(false);
    }
  }, [searchTerm, activeTab, journalEntries.length]);

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

  // Load more journal entries
  const loadMoreEntries = async () => {
    if (isLoadingMore || !hasMore) return;
    
    try {
      setIsLoadingMore(true);
      const nextPage = currentPage + 1;
      const offset = nextPage * pageSize;
      
      const response = await fetch(`/api/journal-entries?limit=${pageSize}&offset=${offset}`);
      if (response.ok) {
        const data = await response.json();
        const newEntries = data.journalEntries || [];
        
        setJournalEntries(prev => [...prev, ...newEntries]);
        setCurrentPage(nextPage);
        setHasMore(newEntries.length === pageSize);
      } else {
        console.error('Failed to load more journal entries');
      }
    } catch (error) {
      console.error('Error loading more journal entries:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Save journal entries to MongoDB
  const saveJournalEntries = async (entries: JournalEntry[], connectionId: string, integrationId: string, integrationName: string) => {
    try {
      const response = await fetch('/api/journal-entries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          journalEntries: entries,
          connectionId,
          integrationId,
          integrationName,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save journal entries');
      }

      const result = await response.json();
      console.log('Saved journal entries:', result);
      return result;
    } catch (error) {
      console.error('Error saving journal entries:', error);
      throw error;
    }
  };

  const handleImportJournalEntries = async () => {
    if (!customerId) {
      toast.error("Please log in to import journal entries");
      return;
    }

    setIsImporting(true);
    setImportResults([]);

    try {
      const results: ImportResult[] = [];

      // Filter for integrations that support journal entries
      const journalEntryIntegrations = integrations.filter((integration: any) => 
        ACCOUNTING_INTEGRATIONS.includes(integration.key as any) && integration.connection
      );

      if (journalEntryIntegrations.length === 0) {
        toast.error("No accounting integrations found. Please connect an accounting integration first.");
        setIsImporting(false);
        return;
      }

      // Process each integration separately
      for (const integration of journalEntryIntegrations) {
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
          let cursor: string | undefined;
          let totalEntries = 0;
          let hasMore = true;
          const integrationEntries: JournalEntry[] = [];

          // Paginate through all journal entries for this integration
          while (hasMore) {
            const response = await integrationApp
              .connection(integration.connection.id)
              .action('get-journal-entries')
              .run({ cursor });

            if (response.output && Array.isArray(response.output.records)) {
              const entries = response.output.records.map((record: any) => {
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
                  console.log(`Sample line items being saved for ${integration.key}:`, lineItems);
                }

                return {
                  // Include all fields from the record.fields except lineItems (we handle them separately)
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

              integrationEntries.push(...entries);
              totalEntries += entries.length;

              // Check if there are more pages
              cursor = response.output.cursor;
              hasMore = !!cursor && entries.length > 0;

              // Optional: Add a small delay to avoid rate limiting
              if (hasMore) {
                await new Promise(resolve => setTimeout(resolve, 100));
              }
            } else {
              hasMore = false;
            }
          }

          // Save entries to MongoDB for this specific integration
          if (totalEntries > 0) {
            console.log(`Saving ${totalEntries} entries for ${integration.key} with connectionId: ${integration.connection.id}`);
            await saveJournalEntries(integrationEntries, integration.connection.id, integration.key, integration.name);
          }

          results.push({
            integrationId: integration.key,
            integrationName: integration.name,
            success: true,
            count: totalEntries,
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
      
      // Reload journal entries from database after import
      const reloadResponse = await fetch(`/api/journal-entries?limit=${pageSize}&offset=0`);
      if (reloadResponse.ok) {
        const data = await reloadResponse.json();
        setJournalEntries(data.journalEntries || []);
        setCurrentPage(0);
        setHasMore(data.journalEntries.length === pageSize);
      }
      
      // Refresh available integrations
      await refreshAvailableIntegrations();

      const totalImported = results.filter(r => r.success).reduce((sum, r) => sum + r.count, 0);
      
      if (totalImported > 0) {
        toast.success(`Successfully imported ${totalImported} journal entries from ${results.filter(r => r.success).length} integration(s)`);
      } else {
        toast.error("No journal entries were imported. Check your integrations.");
      }

    } catch (error) {
      console.error("Error importing journal entries:", error);
      toast.error("Failed to import journal entries");
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

  // Load ledger accounts from MongoDB
  const loadLedgerAccounts = async () => {
    try {
      // Fetch counts first
      const countsResponse = await fetch('/api/ledger-accounts?countOnly=true');
      if (countsResponse.ok) {
        const countsData = await countsResponse.json();
        
        const countsMap: {[key: string]: {count: number, name: string}} = {};
        countsData.counts.forEach((item: any) => {
          countsMap[item.integrationId] = {
            count: item.count,
            name: item.integrationName
          };
        });
        setLedgerAccountCounts(countsMap);
      }
      
      // Fetch all ledger accounts (no pagination)
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
      console.error('Error refreshing available integrations:', error);
    }
  };

  // Load ledger accounts for a specific integration
  const loadLedgerAccountsForIntegration = async (integrationId: string) => {
    try {
      if (integrationId === "all") {
        // Load all ledger accounts (no pagination)
        const response = await fetch('/api/ledger-accounts?limit=1000&offset=0');
        if (response.ok) {
          const data = await response.json();
          setLedgerAccounts(data.ledgerAccounts || []);
        }
      } else {
        // Load ledger accounts for specific integration (no pagination)
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

  const handleImportLedgerAccounts = async () => {
    if (!customerId) {
      toast.error("Please log in to import ledger accounts");
      return;
    }

    setIsImportingLedgerAccounts(true);

    try {
      const results: ImportResult[] = [];

      // Filter for integrations that support ledger accounts
      const ledgerAccountIntegrations = integrations.filter((integration: any) => 
        ACCOUNTING_INTEGRATIONS.includes(integration.key as any) && integration.connection
      );

      if (ledgerAccountIntegrations.length === 0) {
        toast.error("No accounting integrations found. Please connect an accounting integration first.");
        setIsImportingLedgerAccounts(false);
        return;
      }

      // Process each integration separately
      for (const integration of ledgerAccountIntegrations) {
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
          let cursor: string | undefined;
          let totalAccounts = 0;
          let hasMore = true;
          const integrationAccounts: LedgerAccount[] = [];

          // Paginate through all ledger accounts for this integration
          while (hasMore) {
            const response = await integrationApp
              .connection(integration.connection.id)
              .action('get-ledger-accounts')
              .run({ cursor });

            if (response.output && Array.isArray(response.output.records)) {
              const accounts = response.output.records.map((record: any) => {
                const fields = record.fields || {};
                return {
                  id: record.id,
                  name: fields.name || record.name || 'Unknown',
                  type: fields.type || 'Unknown',
                  status: fields.status || 'Unknown',
                  currentBalance: fields.currentBalance || 0,
                  currency: fields.currency || 'USD',
                  createdTime: fields.createdTime || record.createdTime || new Date().toISOString(),
                  updatedTime: fields.updatedTime || record.updatedTime || new Date().toISOString(),
                  classification: fields.classification || 'Unknown',
                  connectionId: integration.connection?.id || '',
                  integrationId: integration.key,
                  integrationName: integration.name,
                  userId: customerId,
                  rawFields: record
                };
              });

              integrationAccounts.push(...accounts);
              totalAccounts += accounts.length;

              // Check if there are more records
              hasMore = response.output.nextCursor && accounts.length > 0;
              cursor = response.output.nextCursor;
            } else {
              hasMore = false;
            }
          }

          // Save accounts for this specific integration
          if (totalAccounts > 0 && integration.connection) {
            console.log(`Saving ${totalAccounts} ledger accounts for ${integration.key} with connectionId: ${integration.connection.id}`);
            await saveLedgerAccounts(integrationAccounts, integration.connection.id, integration.key, integration.name);
          }

          results.push({
            integrationId: integration.key,
            integrationName: integration.name,
            success: true,
            count: totalAccounts,
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

      // Reload ledger accounts from database after import
      await loadLedgerAccounts();
      
      // Reset active tab to "all" after import
      setActiveLedgerAccountTab("all");
      
      // Refresh available integrations in case new ones were added
      await refreshAvailableIntegrations();
      
      const totalImported = results.filter(r => r.success).reduce((sum, r) => sum + r.count, 0);
      
      if (totalImported > 0) {
        toast.success(`Successfully imported ${totalImported} ledger accounts from ${results.filter(r => r.success).length} integration(s)`);
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

  // Filter journal entries based on search term and selected ledger account
  const filteredJournalEntries = journalEntries.filter((entry) => {
    // Filter by selected ledger account
    if (selectedLedgerAccountId) {
      // Check if any line item has the selected ledger account ID
      const hasMatchingLedgerAccount = entry.lineItems?.some((line: any) => 
        line.ledgerAccountId === selectedLedgerAccountId
      );
      if (!hasMatchingLedgerAccount) return false;
    }
    
    // Filter by search term
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    
    // Search in ID
    if (entry.id?.toLowerCase().includes(searchLower)) return true;
    
    // Search in memo
    if (entry.memo?.toLowerCase().includes(searchLower)) return true;
    
    // Search in number
    if (entry.number?.toLowerCase().includes(searchLower)) return true;
    
    // Search in line items descriptions
    if (entry.lineItems?.some((line: any) => 
      line.description?.toLowerCase().includes(searchLower)
    )) return true;
    
    // Search in line items account names
    if (entry.lineItems?.some((line: any) => 
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
          setJournalEntries(data.journalEntries || []);
          setHasMore(data.journalEntries.length === pageSize);
        }
      } else {
        // Load all entries for specific integration (no pagination for filtered views)
        const response = await fetch(`/api/journal-entries?integrationId=${integrationId}&limit=1000&offset=0`);
        if (response.ok) {
          const data = await response.json();
          setJournalEntries(data.journalEntries || []);
          setHasMore(false); // No pagination for filtered views
        }
      }
    } catch (error) {
      console.error('Error loading entries for integration:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="flex flex-col mb-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          General Ledger
        </h1>
        <p className="text-sm text-gray-500">
          Import and manage journal entries from your connected accounting integrations.
        </p>
      </div>

      <div className="space-y-6">
        {/* Import Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <BookOpen className="h-4 w-4" />
                Import Ledger Accounts
              </CardTitle>
              <p className="text-xs text-gray-500">
                Import all ledger accounts from your connected accounting integrations.
              </p>
            </CardHeader>
            <CardContent>
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
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Download className="h-4 w-4" />
                Import Journal Entries
              </CardTitle>
              <p className="text-xs text-gray-500">
                Import all journal entries from your connected accounting integrations.
              </p>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={handleImportJournalEntries}
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
                    Import All Journal Entries
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
                          {result.count} entries
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

        {/* Journal Entries and Ledger Accounts */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Ledger Accounts Sidebar */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <CardTitle className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4" />
                      Ledger Accounts
                    </CardTitle>
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        placeholder="Search..."
                        value={ledgerAccountSearchTerm}
                        onChange={(e) => setLedgerAccountSearchTerm(e.target.value)}
                        className="w-20 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                      />
                      {ledgerAccountSearchTerm && (
                        <button
                          onClick={() => setLedgerAccountSearchTerm("")}
                          className="px-1 py-1 text-gray-500 hover:text-gray-700 text-xs"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">
                      {ledgerAccountSearchTerm ? `${filteredLedgerAccounts.length} filtered` : `${ledgerAccounts.length} accounts loaded`}
                      {selectedLedgerAccountId && " • 1 selected"}
                    </p>
                    {selectedLedgerAccountId && (
                      <button
                        onClick={() => setSelectedLedgerAccountId(null)}
                        className="text-xs text-blue-600 hover:text-blue-800 mt-1"
                      >
                        Clear selection
                      </button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Ledger Account Integration Tabs */}
                {Object.keys(ledgerAccountCounts).length > 0 && (
                  <div className="flex space-x-1 mb-4 border-b">
                    <button
                      onClick={() => {
                        setActiveLedgerAccountTab("all");
                        loadLedgerAccountsForIntegration("all");
                      }}
                      className={cn(
                        "px-2 py-1 text-xs font-medium rounded-t transition-colors",
                        activeLedgerAccountTab === "all"
                          ? "bg-blue-100 text-blue-700 border-b-2 border-blue-700"
                          : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                      )}
                    >
                      All
                    </button>
                    {Object.keys(ledgerAccountCounts).map((integrationId) => {
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
                            "px-2 py-1 text-xs font-medium rounded-t transition-colors",
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
                
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {filteredLedgerAccounts.length > 0 ? (
                    filteredLedgerAccounts.map((account) => (
                      <button
                        key={`${account.integrationId}-${account.id}`}
                        onClick={() => setSelectedLedgerAccountId(account.id)}
                        className={cn(
                          "w-full text-left p-2 rounded text-sm transition-colors",
                          selectedLedgerAccountId === account.id
                            ? "bg-blue-100 text-blue-700 font-medium"
                            : "text-gray-600 hover:bg-gray-100"
                        )}
                      >
                        <div className="font-medium truncate">{account.name}</div>
                        <div className="text-xs text-blue-600 font-mono">
                          ID: {account.id}
                        </div>
                        <div className="text-xs text-gray-500">
                          {account.type} • {account.classification}
                        </div>
                        <div className="text-xs font-medium">
                          {account.currentBalance.toLocaleString('en-US', {
                            style: 'currency',
                            currency: account.currency || 'USD'
                          })}
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="text-center py-4 text-gray-500 text-sm">
                      {ledgerAccountSearchTerm 
                        ? `No ledger accounts found matching "${ledgerAccountSearchTerm}". Try a different search term.`
                        : "No ledger accounts loaded. Import some to get started."
                      }
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Journal Entries List */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Journal Entries</CardTitle>
                    <p className="text-sm text-gray-500">
                      {isLoading ? "Loading..." : `${totalCount} entries stored`}
                      {searchTerm && ` • ${filteredJournalEntries.length} filtered`}
                      {selectedLedgerAccountId && ` • ${filteredJournalEntries.length} from selected account`}
                      {activeTab !== "all" && ` • ${filteredJournalEntries.length} from ${integrationCounts[activeTab]?.name || activeTab}`}
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
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Search entries..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm("")}
                        className="px-2 py-2 text-gray-500 hover:text-gray-700"
                      >
                        ✕
                      </button>
                    )}
                  </div>
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
                      All ({selectedLedgerAccountId ? filteredJournalEntries.length : totalCount})
                    </button>
                    {availableIntegrations.map((integrationId) => {
                      const integrationData = integrationCounts[integrationId];
                      const integrationName = integrationData?.name || integrationId;
                      const originalCount = integrationData?.count || 0;
                      
                      // Calculate filtered count for this integration
                      const filteredCount = selectedLedgerAccountId 
                        ? filteredJournalEntries.filter(entry => entry.integrationId === integrationId).length
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
                    <span className="ml-2">Loading journal entries...</span>
                  </div>
                ) : journalEntries.length > 0 ? (
                  <div className="space-y-3">
                    {filteredJournalEntries.map((entry, index) => {
                      const isLastEntry = index === filteredJournalEntries.length - 1;
                      // Calculate total amount from line items
                      const totalAmount = entry.lineItems?.reduce((sum: number, line: any) => {
                        return sum + (typeof line.amount === 'number' ? line.amount : 0);
                      }, 0) || 0;

                      return (
                        <div 
                          key={`${entry.integrationId}-${entry.id}-${entry.connectionId}`} 
                          className="border rounded-lg p-4 mb-4"
                          ref={isLastEntry ? lastEntryElementRef : null}
                        >
                          {/* Header */}
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex-1">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                  <p className="font-bold text-lg">ID: {entry.id}</p>
                                  {entry.integrationName && (
                                    <p className="font-medium text-purple-600">Integration: {entry.integrationName}</p>
                                  )}
                                </div>
                                <div>
                                  <p className="font-bold text-lg text-blue-600">Ledger Account ID</p>
                                  <p className="font-medium text-blue-600">
                                    {entry.ledgerAccountId || 'N/A'}
                                  </p>
                                </div>
                                <div>
                                  {entry.memo && (
                                    <>
                                      <p className="font-bold text-lg">Memo</p>
                                      <p className="font-medium text-gray-700">{entry.memo}</p>
                                    </>
                                  )}
                                  {!entry.memo && entry.number && (
                                    <>
                                      <p className="font-bold text-lg">Number</p>
                                      <p className="font-medium text-gray-700">{entry.number}</p>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="text-right ml-4">
                              <p className={`font-bold text-lg ${totalAmount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {typeof totalAmount === 'number' && !isNaN(totalAmount)
                                  ? `${totalAmount >= 0 ? '+' : ''}${totalAmount.toLocaleString('en-US', {
                                      style: 'currency',
                                      currency: entry.currency || 'USD'
                                    })}`
                                  : 'N/A'
                                }
                              </p>
                              <p className="text-sm text-gray-500">{entry.currency}</p>
                            </div>
                          </div>

                          {/* Transaction Details */}
                          <div className="grid grid-cols-2 gap-4 mb-3 text-sm">
                            <div>
                              <p><span className="font-medium">Transaction Date:</span> {new Date(entry.transactionDate).toLocaleDateString()}</p>
                              <p><span className="font-medium">Created:</span> {new Date(entry.createdTime).toLocaleString()}</p>
                              <p><span className="font-medium">Updated:</span> {new Date(entry.updatedTime).toLocaleString()}</p>
                            </div>
                            <div>
                              {entry.number && <p><span className="font-medium">Number:</span> {entry.number}</p>}
                              {entry.memo && <p><span className="font-medium">Memo:</span> {entry.memo}</p>}
                            </div>
                          </div>

                          {/* Line Items */}
                          {entry.lineItems && entry.lineItems.length > 0 && (
                            <div className="mb-3">
                              <p className="font-medium mb-2">Line Items ({entry.lineItems.length}):</p>
                              <div className="space-y-2">
                                {entry.lineItems.map((line: any, index: number) => (
                                  <div key={`${entry.id}-${line.id || index}`} className="bg-gray-50 p-3 rounded text-sm">
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                                      <div>
                                        <p className="font-bold text-xs text-gray-500 uppercase">Type</p>
                                        <p className="font-medium">{line.type}</p>
                                        {line.postingType && (
                                          <p className="text-xs text-gray-500">({line.postingType})</p>
                                        )}
                                      </div>
                                      <div className="text-right">
                                        <p className="font-bold text-xs text-gray-500 uppercase">Amount</p>
                                        <p className={`font-medium ${line.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                          {typeof line.amount === 'number' && !isNaN(line.amount)
                                            ? `${line.amount >= 0 ? '+' : ''}${line.amount.toLocaleString('en-US', {
                                                style: 'currency',
                                                currency: entry.currency || 'USD'
                                              })}`
                                            : 'N/A'
                                          }
                                        </p>
                                      </div>
                                    </div>
                                    {(line.description || line.dimension || line.accountRef) && (
                                      <div className="mt-2 pt-2 border-t border-gray-200">
                                        {line.description && (
                                          <p className="text-xs"><span className="font-medium">Description:</span> {line.description}</p>
                                        )}
                                        {line.dimension && (
                                          <p className="text-xs"><span className="font-medium">Dimension:</span> {line.dimension}</p>
                                        )}
                                        {line.accountRef && (
                                          <p className="text-xs"><span className="font-medium">Account:</span> {line.accountRef.name} ({line.accountRef.value})</p>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* All Other Fields */}
                          <div className="text-xs text-gray-600">
                            <p className="font-medium mb-1">All Fields:</p>
                            <pre className="bg-gray-100 p-2 rounded overflow-auto max-h-32">
                              {JSON.stringify(entry, null, 2)}
                            </pre>
                          </div>
                        </div>
                      );
                    })}
                    
                    {/* Loading more indicator */}
                    {isLoadingMore && (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-6 w-6 animate-spin" />
                        <span className="ml-2">Loading more entries...</span>
                      </div>
                    )}
                    
                    {/* End of list indicator */}
                    {!hasMore && filteredJournalEntries.length > 0 && (
                      <p className="text-center text-gray-500 text-sm py-4">
                        No more entries to load
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    {searchTerm 
                      ? `No journal entries found matching "${searchTerm}". Try a different search term.`
                      : "No journal entries found. Import some entries to get started."
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