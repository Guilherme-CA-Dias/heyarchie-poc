"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, AlertCircle, CheckCircle } from "lucide-react";
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

export default function GeneralLedgerPage() {
  const { customerId, customerName } = useAuth();
  const integrationApp = useIntegrationApp();
  const { integrations } = useIntegrations();
  const [isImporting, setIsImporting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
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

  // Load existing journal entries from MongoDB on page load
  useEffect(() => {
    const loadJournalEntries = async () => {
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
      } catch (error) {
        console.error('Error loading journal entries:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadJournalEntries();
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
      const allEntries: JournalEntry[] = [];

      // Filter for integrations that support journal entries
      const journalEntryIntegrations = integrations.filter((integration: any) => 
        ACCOUNTING_INTEGRATIONS.includes(integration.key as any) && integration.connection
      );

      if (journalEntryIntegrations.length === 0) {
        toast.error("No accounting integrations found. Please connect an accounting integration first.");
        setIsImporting(false);
        return;
      }

      // Process each integration
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

          // Paginate through all journal entries
          while (hasMore) {
            const response = await integrationApp
              .connection(integration.connection.id)
              .action('get-journal-entries')
              .run({ cursor });

            if (response.output && Array.isArray(response.output.records)) {
              const entries = response.output.records.map((record: any) => ({
                // Include all fields from the record.fields
                ...record.fields,
                // Include the record-level metadata
                id: record.fields.id || record.id,
                createdTime: record.fields.createdTime || record.createdTime,
                updatedTime: record.fields.updatedTime || record.updatedTime,
                // Include the complete raw fields for reference
                rawFields: record.rawFields,
              }));

              allEntries.push(...entries);
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

          // Save entries to MongoDB
          if (totalEntries > 0) {
            await saveJournalEntries(allEntries, integration.connection.id, integration.key, integration.name);
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
      
      // Refresh counts
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

  // Filter journal entries based on search term (tab filtering is now handled by data loading)
  const filteredJournalEntries = journalEntries.filter((entry) => {
    // Filter by search term only
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

        {/* Journal Entries List */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Journal Entries</CardTitle>
                <p className="text-sm text-gray-500">
                  {isLoading ? "Loading..." : `${totalCount} entries stored`}
                  {searchTerm && ` • ${filteredJournalEntries.length} filtered`}
                  {activeTab !== "all" && ` • ${filteredJournalEntries.length} from ${integrationCounts[activeTab]?.name || activeTab}`}
                </p>
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
                  All ({totalCount})
                </button>
                {availableIntegrations.map((integrationId) => {
                  const integrationData = integrationCounts[integrationId];
                  const integrationName = integrationData?.name || integrationId;
                  const count = integrationData?.count || 0;
                  
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
                      {integrationName} ({count})
                    </button>
                  );
                })}
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
                      key={`${entry.integrationId}-${entry.id}`} 
                      className="border rounded-lg p-4 mb-4"
                      ref={isLastEntry ? lastEntryElementRef : null}
                    >
                      {/* Header */}
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="font-bold text-lg">ID: {entry.id}</p>
                          {entry.integrationName && (
                            <p className="font-medium text-purple-600">Integration: {entry.integrationName}</p>
                          )}
                          {entry.ledgerAccountId && (
                            <p className="font-medium text-blue-600">Ledger Account ID: {entry.ledgerAccountId}</p>
                          )}
                          {entry.memo && (
                            <p className="font-medium text-gray-700">Memo: {entry.memo}</p>
                          )}
                          {!entry.memo && entry.number && (
                            <p className="font-medium text-gray-700">Number: {entry.number}</p>
                          )}
                        </div>
                        <div className="text-right">
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
                              <div key={line.id || index} className="bg-gray-50 p-2 rounded text-sm">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <p><span className="font-medium">ID:</span> {line.id}</p>
                                    {line.description && <p><span className="font-medium">Description:</span> {line.description}</p>}
                                    <p><span className="font-medium">Type:</span> {line.type}</p>
                                    {line.postingType && <p><span className="font-medium">Posting Type:</span> {line.postingType}</p>}
                                    {line.dimension && <p><span className="font-medium">Dimension:</span> {line.dimension}</p>}
                                    {line.accountRef && (
                                      <p><span className="font-medium">Account:</span> {line.accountRef.name} ({line.accountRef.value})</p>
                                    )}
                                  </div>
                                  <div className="text-right">
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
  );
} 