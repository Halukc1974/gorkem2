import { useQuery } from '@tanstack/react-query';
import { supabaseService, type DocumentRecord } from '../services/supabase';

/**
 * Sortable fields in the InfoCenter view
 */
export type SortableFields = 'letter_no' | 'letter_date' | 'short_desc' | 'severity_rate' | 'keywords';

/**
 * Normalized document format for the InfoCenter view
 */
export interface InfoCenterDocument {
  letter_no: string;
  letter_date: string;
  short_desc: string;
  ref_letters: string;
  severity_rate: string;
  keywords: string;
  web_url: string | null;
  content: string; // Eklenen alan: tooltip'te gösterilecek içerik
}

export interface InfoCenterPageOptions {
  pageIndex: number;
  pageSize: number;
  search?: string;
  sortField?: SortableFields;
  sortOrder?: 'asc' | 'desc';
}

export interface InfoCenterPageResult {
  rows: InfoCenterDocument[];
  total: number;
}

/**
 * Custom hook for fetching paginated and sorted documents for the InfoCenter view
 */
export function useInfoCenterPage(opts: InfoCenterPageOptions) {
  const { pageIndex, pageSize, search, sortField, sortOrder } = opts;

  return useQuery<InfoCenterPageResult, Error>({
    queryKey: [
      'info-center-page',
      pageIndex,
      pageSize,
      search ?? null,
      sortField ?? 'letter_date',
      sortOrder ?? 'desc'
    ],
    queryFn: async () => {
      const testResult = await supabaseService.testConnection();
      if (!testResult) {
        throw new Error('Supabase connection failed');
      }

      try {
        // Get documents using the service with server-side pagination and sorting
        const { data: documents, count } = await supabaseService.searchDocuments(search ?? '', {
          page: pageIndex,
          pageSize: pageSize,
          sortBy: (sortField ?? 'letter_date') as any,
          sortOrder: sortOrder ?? 'desc'
        });
        
        // Map to client format
        const rows = documents.map((doc: DocumentRecord): InfoCenterDocument => ({
          letter_no: doc.letter_no ?? '',
          letter_date: doc.letter_date ?? '',
          short_desc: doc.short_desc ?? '',
          ref_letters: doc.ref_letters ?? '',
          severity_rate: doc.severity_rate ?? '',
          keywords: doc.keywords ?? '',
          web_url: doc.weburl ?? null,
          content: doc.content ?? doc.content ?? '' // Ekliyoruz: tooltip'te gösterilecek içerik alanı
        }));

        // Return total from database for accurate count
        return {
          rows,
          total: count || 0  // Using the total count from the database
        };
      } catch (error) {
        console.error('Error fetching documents:', error);
        throw error instanceof Error ? error : new Error('Failed to fetch documents');
      }
    },
    staleTime: 30 * 1000
  });
}