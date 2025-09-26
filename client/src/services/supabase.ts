// Supabase Database Service
// import { createClient, SupabaseClient } from '@supabase/supabase-js'; // Duplicate import removed
// ...existing code...
// Supabase Database Service
import { createClient, SupabaseClient } from '@supabase/supabase-js';

interface SupabaseConfig {
  url: string;
  anonKey: string;
}

// Kullanıcı ayarları tipi
export interface UserSettings {
  supabase: { url: string; anonKey: string };
  deepseek: { apiKey: string };
  openai: { apiKey: string };
  vectorThreshold?: number;
  vectorWeight?: number;
  textWeight?: number;
  textScoreMethod?: 'overlap' | 'simple';
  enableAI?: boolean;
}

interface DocumentRecord {
  id: number;                    // bigint - primary key
  content?: string;              // text - belge içeriği
  metadata?: Record<string, any>; // jsonb - ek metadata
  embedding?: any;               // USER-DEFINED - vector embedding
  internal_no?: string;          // text - dahili numara
  letter_date?: string;          // date - mektup tarihi
  type_of_corr?: string;         // text - yazışma türü
  short_desc?: string;           // text - kısa açıklama
  sp_id?: string;                // text - özel ID
  ref_letters?: string;          // text - referans mektuplar
  reply_letter?: string;         // text - cevap mektubu
  severity_rate?: string;        // text - önem derecesi
  letter_no?: string;            // text - mektup numarası
  "incout"?: string;           // text - gelen/giden (özel field name)
  keywords?: string;             // text - anahtar kelimeler
  weburl?: string;              // text - web URL
}

interface SearchFilters {
  dateFrom?: string;             // letter_date için
  dateTo?: string;               // letter_date için
  type_of_corr?: string;         // yazışma türü
  severity_rate?: string;        // önem derecesi
  inc_out?: string;              // gelen/giden
  keywords?: string[];           // anahtar kelimeler
  internal_no?: string;          // dahili numara
  sortBy?: 'letter_date' | 'similarity' | 'severity_rate' | 'short_desc' | 'letter_no';
  sortOrder?: 'asc' | 'desc';
}

interface VectorSearchResult extends DocumentRecord {
  similarity?: number;           // Cosine similarity score
  searchType?: 'vector' | 'text' | 'hybrid';
}

// Configurable defaults
const DEFAULTS = {
  TEXT_SEARCH_LIMIT: 200, // reduced from 1000 to avoid overwhelming results
  MANUAL_VECTOR_FETCH_LIMIT: 1000,
  VECTOR_THRESHOLD: 0.3 // lowered vector similarity threshold to be more permissive
  ,VECTOR_FALLBACK_COUNT: 10 // default fallback when no items pass threshold
};

interface HybridSearchOptions {
  vectorThreshold?: number;      // 0.8 default
  vectorWeight?: number;         // 0.7 default
  textWeight?: number;           // 0.3 default
  maxResults?: number;           // 100 default
}

class SupabaseService {
  // Tüm belgelerin ilişkilerini (letter_no ve ref_letters) çek
  async getAllDocumentRelations(): Promise<Array<{ letter_no: string; ref_letters: string }>> {
    if (!this.client) throw new Error('Supabase istemcisi başlatılmamış');
    const { data, error } = await this.client
      .from('documents')
      .select('letter_no, ref_letters');
    if (error) throw error;
    // letter_no ve ref_letters alanlarını normalize et
    return (data || []).map((row: any) => ({
      letter_no: row.letter_no,
      ref_letters: row.ref_letters
    }));
  }
  private client: SupabaseClient | null = null;
  private config: SupabaseConfig | null = null;
  private currentUserId: string | null = null;

  // URL doğrulama yardımcı fonksiyonu
  private isValidUrl(url: string): boolean {
    try {
      // URL'nin boş olmadığını ve geçerli format olduğunu kontrol et
      if (!url || url.trim() === '') {
        return false;
      }
      
      // URL constructor ile doğrulama yap
      new URL(url);
      
      // Supabase URL formatını kontrol et (https ile başlamalı ve supabase.co içermeli)
      const urlObj = new URL(url);
      return urlObj.protocol === 'https:' && 
             (urlObj.hostname.includes('supabase.co') || urlObj.hostname.includes('localhost'));
    } catch {
      return false;
    }
  }

  // Konfigürasyon ayarlama
  configure(config: SupabaseConfig) {
    // URL doğrulaması yap
    if (!this.isValidUrl(config.url)) {
      console.error('❌ Geçersiz Supabase URL:', config.url);
      throw new Error(`Geçersiz Supabase URL: ${config.url}. URL https:// ile başlamalı ve geçerli bir format olmalıdır.`);
    }

    // Anon key doğrulaması yap
    if (!config.anonKey || config.anonKey.trim() === '') {
      console.error('❌ Geçersiz Supabase Anon Key');
      throw new Error('Supabase Anon Key boş olamaz.');
    }

    // Aynı config ile zaten client varsa yeniden oluşturma
    if (this.config && 
        this.config.url === config.url && 
        this.config.anonKey === config.anonKey && 
        this.client) {
      return; // Zaten doğru client var
    }

    try {
      this.config = config;
      this.client = createClient(config.url, config.anonKey);
    } catch (error) {
      console.error('❌ Supabase client oluşturulurken hata:', error);
      throw new Error(`Supabase client oluşturulamadı: ${error}`);
    }
  }

  // Kullanıcı kimliği ayarlama
  setUserId(userId: string | null) {
    this.currentUserId = userId;
    console.log('Supabase service: Kullanıcı kimliği ayarlandı', userId);
  }

  // Client erişimi için getter
  getClient(): SupabaseClient {
    if (!this.client) {
      throw new Error('Supabase bağlantısı başlatılmamış. Önce configureServices() çağrılmalı.');
    }
    return this.client;
  }

  // Kullanıcı ayarlarını kaydet
  async saveUserSettings(settings: UserSettings): Promise<UserSettings | null> {
    try {
      if (!this.client) {
        throw new Error('Supabase istemcisi başlatılmamış');
      }

      if (!this.currentUserId) {
        console.log('Kullanıcı giriş yapmamış, ayarlar localStorage\'a kaydedilecek');
        return null;
      }

      const { data, error } = await this.client.rpc('update_user_settings', {
        p_user_id: this.currentUserId,
        p_settings: settings
      });

      if (error) {
        throw error;
      }

      console.log('✅ Kullanıcı ayarları Supabase\'e kaydedildi');
      return data;
    } catch (error) {
      console.error('Kullanıcı ayarları kaydedilemedi:', error);
      return null;
    }
  }

  // Kullanıcı ayarlarını yükle
  async loadUserSettings(): Promise<UserSettings | null> {
    try {
      if (!this.client) {
        throw new Error('Supabase istemcisi başlatılmamış');
      }

      if (!this.currentUserId) {
        console.log('Kullanıcı giriş yapmamış, ayarlar localStorage\'dan yüklenecek');
        return null;
      }

      const { data, error } = await this.client.rpc('get_or_create_user_settings', {
        p_user_id: this.currentUserId
      });

      if (error) {
        throw error;
      }

      console.log('✅ Kullanıcı ayarları Supabase\'den yüklendi');
      return data || null;
    } catch (error) {
      console.error('Kullanıcı ayarları yüklenemedi:', error);
      return null;
    }
  }

  // Bağlantı testi
  async testConnection(): Promise<boolean> {
    try {
      if (!this.client) {
        throw new Error('Supabase konfigürasyonu yapılmamış');
      }

      const { data, error } = await this.client
        .from('documents')
        .select('count')
        .limit(1);

      return !error;
    } catch (error) {
      console.error('Supabase bağlantı hatası:', error);
      return false;
    }
  }

  // Yapılandırılmış belge arama
  async searchDocuments(
    query: string, 
    filters?: SearchFilters & {
      page?: number;
      pageSize?: number;
    }
  ): Promise<{ data: DocumentRecord[]; count: number }> {
    try {
      if (!this.client) {
        throw new Error('Supabase istemcisi başlatılmamış');
      }

      let queryBuilder = this.client
        .from('documents')
        .select('*', { count: 'exact' });

      // Full-text search
      if (query.trim()) {
        console.log(`🔍 Text search sorgusu: "${query}"`);
        
        queryBuilder = queryBuilder.or(
          `content.ilike.%${query}%,` +
          `short_desc.ilike.%${query}%,` +
          `keywords.ilike.%${query}%,` +
          `letter_no.ilike.%${query}%,` +
          `internal_no.ilike.%${query}%,` +
          `ref_letters.ilike.%${query}%`
        );
      }

      // Filtreler uygulama
      if (filters?.dateFrom) {
        queryBuilder = queryBuilder.gte('letter_date', filters.dateFrom);
      }

      if (filters?.dateTo) {
        queryBuilder = queryBuilder.lte('letter_date', filters.dateTo);
      }

      if (filters?.type_of_corr) {
        queryBuilder = queryBuilder.eq('type_of_corr', filters.type_of_corr);
      }

      if (filters?.severity_rate) {
        queryBuilder = queryBuilder.eq('severity_rate', filters.severity_rate);
      }

      if (filters?.inc_out) {
        queryBuilder = queryBuilder.eq('incout', filters.inc_out);
      }

      if (filters?.internal_no) {
        queryBuilder = queryBuilder.ilike('internal_no', `%${filters.internal_no}%`);
      }

      if (filters?.keywords && filters.keywords.length > 0) {
        const keywordSearch = filters.keywords.map(keyword => 
          `keywords.ilike.%${keyword}%`
        ).join(',');
        queryBuilder = queryBuilder.or(keywordSearch);
      }

      // Sonuçları sırala
      const sortBy = filters?.sortBy || 'letter_date';
      const sortOrder = filters?.sortOrder || 'desc';
      
      // Sıralama uygula
      queryBuilder = queryBuilder.order(sortBy, { ascending: sortOrder === 'asc' });

      // Sayfalama uygula
      if (typeof filters?.page === 'number' && typeof filters?.pageSize === 'number') {
        const start = filters.page * filters.pageSize;
        const end = start + filters.pageSize - 1;
        queryBuilder = queryBuilder.range(start, end);
      }

      const { data, error, count } = await queryBuilder;

      if (error) {
        throw error;
      }

      console.log(`📊 Text search: ${data?.length || 0} sonuç bulundu (toplam: ${count})`);
      return { 
        data: data || [], 
        count: count || 0 
      };

    } catch (error) {
      console.error('Supabase arama hatası:', error);
      throw new Error('Veritabanı araması başarısız oldu');
    }
  }

  // Gelişmiş arama - PostgreSQL full-text search
  async advancedSearch(
    query: string,
    options?: {
      searchType?: 'plain' | 'phrase' | 'websearch';
      language?: 'turkish' | 'english';
      similarityThreshold?: number;
    }
  ): Promise<DocumentRecord[]> {
    try {
      if (!this.client) {
        throw new Error('Supabase istemcisi başlatılmamış');
      }

      const searchType = options?.searchType || 'websearch';
      const language = options?.language || 'turkish';
      const threshold = options?.similarityThreshold || 0.1;

      // PostgreSQL full-text search with ranking
      const { data, error } = await this.client.rpc('search_documents', {
        search_query: query,
        search_type: searchType,
        search_language: language,
        similarity_threshold: threshold
      });

      if (error) {
        throw error;
      }

      return data || [];

    } catch (error) {
      console.error('Gelişmiş arama hatası:', error);
      throw new Error('Gelişmiş arama başarısız oldu');
    }
  }

  // Yazışma türü listesi alma
  async getCorrespondenceTypes(): Promise<string[]> {
    try {
      if (!this.client) {
        throw new Error('Supabase istemcisi başlatılmamış');
      }

      const { data, error } = await this.client
        .from('documents')
        .select('type_of_corr')
        .not('type_of_corr', 'is', null);

      if (error) {
        throw error;
      }

      // Benzersiz yazışma türleri
      const types = Array.from(new Set(data.map((item: any) => item.type_of_corr)));
      return types.filter(Boolean);

    } catch (error) {
      console.error('Yazışma türü listesi alınamadı:', error);
      return [];
    }
  }

  // Önem derecesi listesi alma
  async getSeverityRates(): Promise<string[]> {
    try {
      if (!this.client) {
        throw new Error('Supabase istemcisi başlatılmamış');
      }

      const { data, error } = await this.client
        .from('documents')
        .select('severity_rate')
        .not('severity_rate', 'is', null);

      if (error) {
        throw error;
      }

      // Benzersiz önem dereceleri
      const rates = Array.from(new Set(data.map((item: any) => item.severity_rate)));
      return rates.filter(Boolean);

    } catch (error) {
      console.error('Önem derecesi listesi alınamadı:', error);
      return [];
    }
  }

  // Anahtar kelime listesi alma
  async getKeywords(): Promise<string[]> {
    try {
      if (!this.client) {
        throw new Error('Supabase istemcisi başlatılmamış');
      }

      const { data, error } = await this.client
        .from('documents')
        .select('keywords')
        .not('keywords', 'is', null);

      if (error) {
        throw error;
      }

      // Keywords'ü virgül ile ayırıp benzersiz yap
            let allKeywords: string[] = [];
      
      for (const item of data) {
        if (item.keywords && typeof item.keywords === 'string') {
          const keywords = item.keywords.split(',').map((k: string) => k.trim());
          allKeywords.push(...keywords);
        }
      }

      return Array.from(new Set(allKeywords)).filter(Boolean);

    } catch (error) {
      console.error('Anahtar kelime listesi alınamadı:', error);
      return [];
    }
  }

  // Benzer belgeleri bulma
  async findSimilarDocuments(
    documentId: string,
    limit: number = 10
  ): Promise<DocumentRecord[]> {
    try {
      if (!this.client) {
        throw new Error('Supabase istemcisi başlatılmamış');
      }

      const { data, error } = await this.client.rpc('find_similar_documents', {
        target_document_id: documentId,
        similarity_limit: limit
      });

      if (error) {
        throw error;
      }

      return data || [];

    } catch (error) {
      console.error('Benzer belge arama hatası:', error);
      return [];
    }
  }

  // Arama istatistikleri
  async getSearchStats(): Promise<{
    totalDocuments: number;
    correspondenceTypeCounts: Record<string, number>;
    severityRateCounts: Record<string, number>;
    recentDocuments: number;
    incomingOutgoing: Record<string, number>;
  }> {
    try {
      if (!this.client) {
        throw new Error('Supabase istemcisi başlatılmamış');
      }

      // Toplam belge sayısı
      const { count: totalDocuments } = await this.client
        .from('documents')
        .select('*', { count: 'exact', head: true });

      // Son 7 gündeki belgeler
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      
      const { count: recentDocuments } = await this.client
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .gte('letter_date', weekAgo.toISOString().split('T')[0]);

      // Yazışma türü istatistikleri
      const { data: typeData } = await this.client
        .from('documents')
        .select('type_of_corr')
        .not('type_of_corr', 'is', null);

      const correspondenceTypeCounts = typeData?.reduce((acc: any, item: any) => {
        const type = item.type_of_corr;
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {}) || {};

      // Önem derecesi istatistikleri
      const { data: severityData } = await this.client
        .from('documents')
        .select('severity_rate')
        .not('severity_rate', 'is', null);

      const severityRateCounts = severityData?.reduce((acc: any, item: any) => {
        const rate = item.severity_rate;
        acc[rate] = (acc[rate] || 0) + 1;
        return acc;
      }, {}) || {};

      // Gelen/Giden istatistikleri
      const { data: incOutData } = await this.client
        .from('documents')
        .select('incout')
        .not('incout', 'is', null);

      const incomingOutgoing = incOutData?.reduce((acc: any, item: any) => {
        const direction = item['incout'];
        acc[direction] = (acc[direction] || 0) + 1;
        return acc;
      }, {}) || {};

      return {
        totalDocuments: totalDocuments || 0,
        correspondenceTypeCounts,
        severityRateCounts,
        recentDocuments: recentDocuments || 0,
        incomingOutgoing
      };

    } catch (error) {
      console.error('İstatistik alınamadı:', error);
      return {
        totalDocuments: 0,
        correspondenceTypeCounts: {},
        severityRateCounts: {},
        recentDocuments: 0,
        incomingOutgoing: {}
      };
    }
  }

  // Vector Similarity Search - PostgreSQL pgvector kullanarak
  async vectorSearch(
    queryEmbedding: number[], 
    options: {
      threshold?: number;
      maxResults?: number;
      filters?: SearchFilters;
    } = {}
  ): Promise<VectorSearchResult[]> {
    try {
      if (!this.client) {
        throw new Error('Supabase istemcisi başlatılmamış');
      }

      // Debug log: embedding'in gönderilip gönderilmediğini doğrulamak için
      try {
        console.log('supabase.vectorSearch received embedding:', Array.isArray(queryEmbedding) ? `array(length=${queryEmbedding.length})` : typeof queryEmbedding);
      } catch (e) {
        // ignore logging errors
      }

  const { threshold = DEFAULTS.VECTOR_THRESHOLD, maxResults = 500, filters } = options;

      // PostgreSQL vector similarity query
      // cosine similarity kullanarak embedding karşılaştırması ve filtreleme
  const { data, error } = await this.client.rpc('match_documents_filtered', {
        query_embedding: queryEmbedding,
        similarity_threshold: threshold,
        match_count: maxResults,
        date_from: filters?.dateFrom || null,
        date_to: filters?.dateTo || null,
        correspondence_type: filters?.type_of_corr || null,
        severity_rate_filter: filters?.severity_rate || null,
        inc_out_filter: filters?.inc_out || null,
        internal_no_filter: filters?.internal_no || null,
        keywords_filter: filters?.keywords || null,
        sort_by: filters?.sortBy || 'letter_date',
        sort_order: filters?.sortOrder || 'desc'
      });

      if (error) {
        // Provide clearer guidance in logs for deploy/runtime issues
        console.warn('Vector search RPC hatası (match_documents_filtered). Bu RPC fonksiyonu veritabanında eksik veya erişim hatası var. Manuel similarity hesaplamasına geçiliyor. RPC error:', error);
        return await this.manualVectorSearch(queryEmbedding, options);
      }

      const results: VectorSearchResult[] = (data || []).map((doc: any) => ({
        ...doc,
        similarity: doc.similarity || 0,
        searchType: 'vector' as const
      }));

      console.log(`📊 Vector search: ${results.length} sonuç, threshold: ${threshold}`);
      return results;

    } catch (error) {
      console.error('Vector search hatası:', error);
      return await this.manualVectorSearch(queryEmbedding, options);
    }
  }

  // Manuel vector similarity hesaplama (RPC yoksa)
  private async manualVectorSearch(
    queryEmbedding: number[], 
    options: {
      threshold?: number;
      maxResults?: number;
      filters?: SearchFilters;
    } = {}
  ): Promise<VectorSearchResult[]> {
    try {
  const { threshold = DEFAULTS.VECTOR_THRESHOLD, maxResults = 500, filters } = options;

  // Tüm belgeleri embedding ile çek
      let query = this.client!
        .from('documents')
        .select('*')
        .not('embedding', 'is', null)
        .limit(DEFAULTS.MANUAL_VECTOR_FETCH_LIMIT); // configurable fetch limit

      // Filtreleri uygula
      if (filters) {
        if (filters.dateFrom) query = query.gte('letter_date', filters.dateFrom);
        if (filters.dateTo) query = query.lte('letter_date', filters.dateTo);
        if (filters.type_of_corr) query = query.eq('type_of_corr', filters.type_of_corr);
        if (filters.severity_rate) query = query.eq('severity_rate', filters.severity_rate);
        if (filters.inc_out) query = query.eq('incout', filters.inc_out);
        if (filters.internal_no) query = query.ilike('internal_no', `%${filters.internal_no}%`);
        if (filters.keywords && filters.keywords.length > 0) {
          const keywordSearch = filters.keywords.map(keyword => 
            `keywords.ilike.%${keyword}%`
          ).join(',');
          query = query.or(keywordSearch);
        }
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      // Manuel similarity hesaplama - tüm kayıtlar için similarity hesapla
      const allResultsUnfiltered: VectorSearchResult[] = [];
      console.log(`🔍 Manuel vector search başlıyor: ${data?.length || 0} kayıt, threshold: ${threshold}`);

      for (const doc of data || []) {
        if (!doc.embedding) continue;

        try {
          // Embedding string'den array'e çevir
          const docEmbedding = typeof doc.embedding === 'string'
            ? JSON.parse(doc.embedding)
            : doc.embedding;

          const similarity = this.calculateCosineSimilarity(queryEmbedding, docEmbedding);

          allResultsUnfiltered.push({
            ...doc,
            similarity,
            searchType: 'vector' as const
          });
        } catch (parseError) {
          console.warn(`Embedding parse hatası doc ${doc.id}:`, parseError);
          continue;
        }
      }

      // Similarity'ye göre sırala ve sınırla
      const sortBy = filters?.sortBy || 'letter_date';
      const sortOrder = filters?.sortOrder || 'desc';
      // Eğer sortBy similarity isteniyorsa ona göre sırala; değilse tarih vb. alanlara göre
      if (sortBy === 'similarity') {
        allResultsUnfiltered.sort((a, b) => sortOrder === 'desc' ? (b.similarity || 0) - (a.similarity || 0) : (a.similarity || 0) - (b.similarity || 0));
      } else {
        allResultsUnfiltered.sort((a, b) => {
          const valueA = a[sortBy as keyof VectorSearchResult] || '';
          const valueB = b[sortBy as keyof VectorSearchResult] || '';

          if (sortBy === 'letter_date') {
            const dateA = new Date(valueA as string).getTime();
            const dateB = new Date(valueB as string).getTime();
            return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
          }

          return sortOrder === 'desc'
            ? String(valueB).localeCompare(String(valueA))
            : String(valueA).localeCompare(String(valueB));
        });
      }

      // Filtrelenmiş (eşik üzeri) sonuçlar
      const resultsAboveThreshold = allResultsUnfiltered.filter(r => (r.similarity || 0) >= threshold);

      if (resultsAboveThreshold.length > 0) {
        console.log(`📊 Manuel vector search: ${resultsAboveThreshold.length} sonuç (eşik aşıldı), threshold: ${threshold}`);
        return resultsAboveThreshold.slice(0, maxResults);
      }

  // Eğer hiçbir kayıt eşiği aşmadıysa, boş dizi döndür (fallback kaldırıldı)
  console.log(`⚠️ Manuel vector search: hiçbir kayıt eşiği aşmadı. 0 sonuç döndürülüyor. threshold: ${threshold}`);
  return [];

    } catch (error) {
      console.error('Manuel vector search hatası:', error);
      return [];
    }
  }

  // Hybrid Search - Vector + Text search kombinasyonu
  async hybridSearch(
    query: string,
    queryEmbedding: number[],
    options: HybridSearchOptions & { filters?: SearchFilters } = {},
    textOptions: { textScoreMethod?: 'overlap' | 'simple' } = {}
  ): Promise<VectorSearchResult[]> {
    try {
      const {
        vectorThreshold = 0.5, // Daha düşürüldü
        vectorWeight = 0.3, // Vector search'i azalttık
        textWeight = 0.7, // Text search'i artırdık
        maxResults = 500, // Daha fazla sınır
        filters
      } = options;

      console.log(`🔀 Hybrid search başlatılıyor: "${query}"`);

      // Paralel olarak vector ve text search yap
      const [vectorResults, textResults] = await Promise.all([
        this.vectorSearch(queryEmbedding, { 
          threshold: vectorThreshold, 
          maxResults: Math.floor(maxResults * 0.6),
          filters 
        }),
        this.searchDocuments(query, filters)
      ]);

      console.log(`Vector: ${vectorResults.length}, Text: ${textResults.data?.length || 0} results`);

      // Sonuçları birleştir ve skorla
      const combinedResults = new Map<number, VectorSearchResult>();

      // Vector sonuçlarını ekle
      vectorResults.forEach(doc => {
        const vectorScore = (doc.similarity || 0) * vectorWeight;
        combinedResults.set(doc.id, {
          ...doc,
          similarity: vectorScore,
          searchType: 'hybrid' as const
        });
      });

      // Prepare tokenization for token-overlap scoring
      const tokenize = (s?: string) => {
        if (!s) return [] as string[];
        return s
          .toLowerCase()
          .replace(/[^ -]/g, ' ') // remove non-ascii for simplicity
          .replace(/[^a-z0-9\s]/g, ' ')
          .split(/\s+/)
          .filter(Boolean);
      };

      const queryTokens = tokenize(query);

      // Text sonuçlarını ekle veya skorunu güncelle
      (textResults.data || []).forEach(doc => {
        let textScore = 0.5 * textWeight;
        if (textOptions.textScoreMethod === 'overlap') {
          const textToScore = `${doc.short_desc || ''} ${doc.content || ''} ${doc.keywords || ''}`;
          const tokens = tokenize(textToScore);
          if (tokens.length > 0 && queryTokens.length > 0) {
            const tokenSet = new Set(tokens);
            const overlap = queryTokens.reduce((acc, t) => acc + (tokenSet.has(t) ? 1 : 0), 0);
            // normalized overlap (0..1)
            const normalized = overlap / Math.max(queryTokens.length, 1);
            // scale by textWeight and a base multiplier
            textScore = normalized * textWeight;
          } else {
            textScore = 0;
          }
        } else {
          // simple legacy method
          textScore = 0.5 * textWeight;
        }

        const existing = combinedResults.get(doc.id);
        if (existing) {
          existing.similarity = (existing.similarity || 0) + textScore;
        } else {
          combinedResults.set(doc.id, {
            ...doc,
            similarity: textScore,
            searchType: 'hybrid' as const
          });
        }
      });

      // Final sonuçları sırala
      const finalResults = Array.from(combinedResults.values())
        .sort((a, b) => (b.similarity || 0) - (a.similarity || 0))
        .slice(0, maxResults);

      console.log(`🎯 Hybrid final: ${finalResults.length} sonuç`);
      return finalResults;

    } catch (error) {
      console.error('Hybrid search hatası:', error);
      // Fallback: sadece text search
      const textResults = await this.searchDocuments(query, options.filters);
      return (textResults.data || []).map(doc => ({
        ...doc,
        similarity: 0.5,
        searchType: 'text' as const
      }));
    }
  }

  // Cosine similarity hesaplama
  private calculateCosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      return 0;
    }

    const dotProduct = vec1.reduce((sum, a, i) => sum + a * vec2[i], 0);
    const magnitude1 = Math.sqrt(vec1.reduce((sum, a) => sum + a * a, 0));
    const magnitude2 = Math.sqrt(vec2.reduce((sum, a) => sum + a * a, 0));
    
    if (magnitude1 === 0 || magnitude2 === 0) {
      return 0;
    }
    
    return dotProduct / (magnitude1 * magnitude2);
  }
}

// Singleton instance
export const supabaseService = new SupabaseService();

// Export types
export type { DocumentRecord, SearchFilters, VectorSearchResult, HybridSearchOptions };
