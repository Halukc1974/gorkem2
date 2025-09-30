// Karar Destek Sistemi - Veri Modelleri ve Servisleri
import { supabaseService } from './supabase';

// Veri modelleri
export interface CorrespondenceMetadata {
  id: number;
  content: string;
  metadata: any;
  embedding: string;
  internal_no: string;
  letter_date: string;
  type_of_corr: string;
  short_desc: string;
  sp_id: string;
  ref_letters: string;
  reply_letter: string;
  severity_rate: string;
  letter_no: string;
  incout: string;
  keywords: string;
  weburl: string;
  created: string;
  last_modified: string;
}

export interface AIAnalysis {
  summary: string;
  similar_docs: string[];
  action_suggestions: string[];
  template_suggestions: string[];
  text_completion: string;
  risk_analysis: {
    level: string;
    factors: string[];
    recommendations: string[];
  };
  sentiment_analysis: {
    overall: string;
    score: number;
    key_phrases: string[];
  };
  generated_at: string;
}

export interface SearchFilters {
  dateFrom?: string;
  dateTo?: string;
  type_of_corr?: string;
  inc_out?: string;
  severity_rate?: string;
  keywords?: string[];
  letter_no?: string;
  short_desc?: string;
  sp_id?: string;
}

export interface SearchResult {
  data: CorrespondenceMetadata[];
  total: number;
  hasMore: boolean;
}

export interface AIAnalysis {
  summary: string;
  similar_docs: string[];
  action_suggestions: string[];
  template_suggestions: string[];
  text_completion: string;
  risk_analysis: {
    level: string;
    factors: string[];
    recommendations: string[];
  };
  sentiment_analysis: {
    overall: string;
    score: number;
    key_phrases: string[];
  };
  generated_at: string;
}

// Servis sınıfı
export class DecisionSupportService {
  private tableName = 'documents';

  // Tüm yazışmaları getir
  async getAllCorrespondence(limit: number = 50, offset: number = 0): Promise<SearchResult> {
    const { data, error, count } = await supabaseService.getClient()
      .from(this.tableName)
      .select('*', { count: 'exact' })
      .order('letter_date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return {
      data: data || [],
      total: count || 0,
      hasMore: (count || 0) > offset + limit
    };
  }

  // Gelişmiş arama fonksiyonu
  async searchCorrespondence(
    query: string = '',
    filters: SearchFilters = {},
    limit: number = 50,
    offset: number = 0
  ): Promise<SearchResult> {
    let supabaseQuery = supabaseService.getClient()
      .from(this.tableName)
      .select('*', { count: 'exact' });

    // Metin arama - tüm alanlarda, her kelime için ayrı ayrı
    if (query.trim()) {
      const searchTerms = query.trim().split(' ').filter(term => term.length > 0);
      if (searchTerms.length === 1) {
        // Tek kelime için tüm alanlarda ara
        const searchTerm = searchTerms[0];
        supabaseQuery = supabaseQuery.or(
          `short_desc.ilike.%${searchTerm}%,content.ilike.%${searchTerm}%,letter_no.ilike.%${searchTerm}%,keywords.ilike.%${searchTerm}%`
        );
      } else {
        // Birden fazla kelime için OR ile ara (daha basit)
        const orConditions = searchTerms.map(term =>
          `short_desc.ilike.%${term}%`
        ).join(',');
        supabaseQuery = supabaseQuery.or(orConditions);
      }
    }

    // Filtreler
    if (filters.dateFrom) {
      supabaseQuery = supabaseQuery.gte('letter_date', filters.dateFrom);
    }
    if (filters.dateTo) {
      supabaseQuery = supabaseQuery.lte('letter_date', filters.dateTo);
    }
    if (filters.type_of_corr && filters.type_of_corr !== 'all') {
      supabaseQuery = supabaseQuery.eq('type_of_corr', filters.type_of_corr);
    }
    if (filters.inc_out && filters.inc_out !== 'all') {
      supabaseQuery = supabaseQuery.eq('incout', filters.inc_out);
    }
    if (filters.severity_rate && filters.severity_rate !== 'all') {
      supabaseQuery = supabaseQuery.eq('severity_rate', filters.severity_rate);
    }
    if (filters.letter_no) {
      supabaseQuery = supabaseQuery.ilike('letter_no', `%${filters.letter_no}%`);
    }
    if (filters.short_desc) {
      supabaseQuery = supabaseQuery.ilike('short_desc', `%${filters.short_desc}%`);
    }
    if (filters.sp_id) {
      supabaseQuery = supabaseQuery.ilike('sp_id', `%${filters.sp_id}%`);
    }

    // Anahtar kelime filtresi
    if (filters.keywords) {
      supabaseQuery = supabaseQuery.ilike('keywords', `%${filters.keywords}%`);
    }

    const { data, error, count } = await supabaseQuery
      .order('letter_date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return {
      data: data || [],
      total: count || 0,
      hasMore: (count || 0) > offset + limit
    };
  }

  // Vektör tabanlı arama
  async searchCorrespondenceVector(
    query: string,
    filters: SearchFilters = {},
    limit: number = 50,
    offset: number = 0
  ): Promise<SearchResult> {
    try {
      console.log('🔍 Vektör arama başlatılıyor:', query);

      // Önce embedding'li kayıt var mı kontrol et
      const { data: sampleData } = await supabaseService.getClient()
        .from(this.tableName)
        .select('id')
        .not('embedding', 'is', null)
        .limit(1);

      if (!sampleData || sampleData.length === 0) {
        // Embedding yok, text arama kullan
        console.log('⚠️ Veritabanında embedding bulunamadı, text arama kullanılıyor');
        return this.searchCorrespondence(query, filters, limit, offset);
      }

      // Embedding var, vector search dene
      const queryEmbedding = await this.generateEmbedding(query);
      console.log('📊 Oluşturulan embedding uzunluğu:', queryEmbedding.length);

      const vectorResults = await supabaseService.vectorSearch(queryEmbedding, {
        maxResults: limit,
        filters: {
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
          type_of_corr: filters.type_of_corr,
          severity_rate: filters.severity_rate,
          inc_out: filters.inc_out,
          internal_no: filters.letter_no,
          keywords: filters.keywords
        }
      });

      if (vectorResults.length > 0) {
        console.log('✅ Vektör arama başarılı:', vectorResults.length, 'sonuç');
        // VectorSearchResult'u CorrespondenceMetadata'ya dönüştür
        const convertedResults: CorrespondenceMetadata[] = vectorResults.map(result => ({
          id: result.id,
          content: result.content || '',
          metadata: result.metadata || {},
          embedding: Array.isArray(result.embedding) ? JSON.stringify(result.embedding) : result.embedding || '',
          internal_no: result.internal_no || '',
          letter_date: result.letter_date || '',
          type_of_corr: result.type_of_corr || '',
          short_desc: result.short_desc || '',
          sp_id: result.sp_id || '',
          ref_letters: result.ref_letters || '',
          reply_letter: result.reply_letter || '',
          severity_rate: result.severity_rate || '',
          letter_no: result.letter_no || '',
          incout: result['incout'] || '',
          keywords: result.keywords || '',
          weburl: result.weburl || '',
          created: result.created || new Date().toISOString(),
          last_modified: result.last_modified || new Date().toISOString()
        }));
        return {
          data: convertedResults,
          total: convertedResults.length,
          hasMore: false
        };
      }

      // Vector search sonuç vermedi, text arama fallback
      console.log('⚠️ Vektör arama sonuç vermedi, text arama fallback kullanılıyor');
      return this.searchCorrespondence(query, filters, limit, offset);

    } catch (error) {
      console.error('Vector search error:', error);
      // Hata durumunda text arama fallback
      console.log('⚠️ Vektör arama hatası, text arama fallback kullanılıyor');
      return this.searchCorrespondence(query, filters, limit, offset);
    }
  }

  // Basit embedding oluşturma (demo amaçlı - gerçek uygulamada AI servis kullanılmalı)
  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      // Önce OpenAI API key'ini kontrol et
      const userSettings = (window as any).__USER_SETTINGS__;
      const openaiApiKey = userSettings?.openai?.apiKey;

      if (openaiApiKey && openaiApiKey.trim()) {
        console.log('🤖 OpenAI embedding API kullanılıyor...');
        return await this.generateOpenAIEmbedding(text, openaiApiKey);
      }

      console.log('⚠️ OpenAI API key bulunamadı, basit hash tabanlı embedding kullanılıyor');
      return this.generateSimpleEmbedding(text);
    } catch (error) {
      console.error('Embedding oluşturma hatası:', error);
      console.log('⚠️ Hata nedeniyle basit hash tabanlı embedding kullanılıyor');
      return this.generateSimpleEmbedding(text);
    }
  }

  // OpenAI embedding API kullanarak embedding oluştur
  private async generateOpenAIEmbedding(text: string, apiKey: string): Promise<number[]> {
    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          input: text,
          model: 'text-embedding-3-small', // 1536 boyutlu embedding
          encoding_format: 'float'
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const embedding = data.data[0].embedding;

      console.log('✅ OpenAI embedding başarıyla oluşturuldu');
      return embedding;
    } catch (error) {
      console.error('OpenAI embedding hatası:', error);
      throw error;
    }
  }

  // Basit hash tabanlı embedding (fallback)
  private generateSimpleEmbedding(text: string): number[] {
    const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    const embedding = new Array(1536).fill(0);

    // Her kelime için basit bir hash değeri oluştur
    words.forEach((word, wordIndex) => {
      let hash = 0;
      for (let i = 0; i < word.length; i++) {
        hash = ((hash << 5) - hash) + word.charCodeAt(i);
        hash = hash & hash; // 32-bit integer'a çevir
      }

      // Hash değerini embedding'e dağıt
      const baseIndex = (Math.abs(hash) + wordIndex * 31) % 1536;
      for (let i = 0; i < Math.min(word.length, 10); i++) {
        const index = (baseIndex + i) % 1536;
        embedding[index] += (word.charCodeAt(i % word.length) / 255.0) * 0.1;
      }
    });

    // Normalize et (magnitude 1 yap)
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      for (let i = 0; i < embedding.length; i++) {
        embedding[i] /= magnitude;
      }
    }

    return embedding;
  }

  // Belirli bir yazışmayı getir
  async getCorrespondenceById(id: string): Promise<CorrespondenceMetadata | null> {
    const { data, error } = await supabaseService.getClient()
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  // Yeni yazışma ekle
  async addCorrespondence(metadata: Omit<CorrespondenceMetadata, 'id' | 'createdAt' | 'updatedAt'>): Promise<CorrespondenceMetadata> {
    const { data, error } = await supabaseService.getClient()
      .from(this.tableName)
      .insert([{
        ...metadata,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Yazışmayı güncelle
  async updateCorrespondence(id: string, updates: Partial<CorrespondenceMetadata>): Promise<CorrespondenceMetadata> {
    const { data, error } = await supabaseService.getClient()
      .from(this.tableName)
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // AI analiz sonucu kaydet
  async saveAIAnalysis(id: string, analysis: AIAnalysis): Promise<void> {
    const { error } = await supabaseService.getClient()
      .from(this.tableName)
      .update({
        ai_analysis: analysis,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;
  }

  // Benzer yazışmaları bul (basit keyword eşleşmesi)
  async findSimilarCorrespondence(keywords: string[], excludeId?: string): Promise<CorrespondenceMetadata[]> {
    if (!keywords || keywords.length === 0) return [];

    const keywordConditions = keywords.map(k => `keywords.cs.{${k}}`).join(',');
    let query = supabaseService.getClient()
      .from(this.tableName)
      .select('*')
      .or(keywordConditions)
      .order('letter_date', { ascending: false })
      .limit(5);

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  // Raporlama verileri
  async getCorrespondenceStats(): Promise<{
    total: number;
    byMonth: { month: string; count: number }[];
    byType: { type: string; count: number }[];
    byProject: { project: string; count: number }[];
    pendingDecisions: number;
    overdueDecisions: number;
  }> {
    const { data, error } = await supabaseService.getClient()
      .from(this.tableName)
      .select('*');

    if (error) throw error;

    const stats = {
      total: data?.length || 0,
      byMonth: [] as { month: string; count: number }[],
      byType: [] as { type: string; count: number }[],
      byProject: [] as { project: string; count: number }[],
      pendingDecisions: 0,
      overdueDecisions: 0
    };

    // Aylık dağılım
    const monthMap = new Map<string, number>();
    const typeMap = new Map<string, number>();
    const projectMap = new Map<string, number>();

    data?.forEach((item: CorrespondenceMetadata) => {
      // Aylık
      const month = item.letter_date.substring(0, 7); // YYYY-MM
      monthMap.set(month, (monthMap.get(month) || 0) + 1);

      // Tip
      typeMap.set(item.type_of_corr, (typeMap.get(item.type_of_corr) || 0) + 1);

      // Proje - sp_id'yi proje olarak kullan
      projectMap.set(item.sp_id, (projectMap.get(item.sp_id) || 0) + 1);

      // Bekleyen kararlar - reply_letter boş ise bekliyor olarak kabul et
      if (!item.reply_letter || item.reply_letter.trim() === '') {
        stats.pendingDecisions++;
        // 10 günden fazla bekleyen
        const letterDate = new Date(item.letter_date);
        const daysDiff = (Date.now() - letterDate.getTime()) / (1000 * 60 * 60 * 24);
        if (daysDiff > 10) {
          stats.overdueDecisions++;
        }
      }
    });

    stats.byMonth = Array.from(monthMap.entries()).map(([month, count]) => ({ month, count }));
    stats.byType = Array.from(typeMap.entries()).map(([type, count]) => ({ type, count }));
    stats.byProject = Array.from(projectMap.entries()).map(([project, count]) => ({ project, count }));

    return stats;
  }

  // AI analiz fonksiyonları - Şimdilik mock implementation, API seçimi ile genişletilebilir
  async analyzeCorrespondence(content: string, apiType: 'deepseek' | 'openai' = 'deepseek'): Promise<AIAnalysis> {
    // Mock delay to simulate AI processing
    await new Promise(resolve => setTimeout(resolve, 1500));

    console.log(`🤖 AI Analiz başlatılıyor: ${apiType.toUpperCase()} API ile`);

    // Basit keyword analizi
    const keywords = this.extractKeywords(content);
    const sentiment = this.analyzeSentiment(content);
    const riskLevel = this.assessRisk(content, keywords);

    return {
      summary: this.generateSummary(content),
      similar_docs: [], // Bu kısım findSimilarCorrespondence ile doldurulacak
      action_suggestions: this.generateActionSuggestions(content, keywords),
      template_suggestions: this.suggestTemplates(keywords),
      text_completion: this.generateTextCompletion(content),
      risk_analysis: {
        level: riskLevel,
        factors: this.identifyRiskFactors(content, keywords),
        recommendations: this.generateRiskRecommendations(riskLevel)
      },
      sentiment_analysis: {
        overall: sentiment.label,
        score: sentiment.score,
        key_phrases: this.extractKeyPhrases(content)
      },
      generated_at: new Date().toISOString()
    };
  }

  private extractKeywords(content: string): string[] {
    // Basit keyword extraction - gerçek NLP ile değiştirilecek
    const commonKeywords = [
      'proje', 'izin', 'çed', 'rapor', 'onay', 'ihale', 'sözleşme',
      'ödeme', 'fatura', 'gecikme', 'ihbar', 'şikayet', 'talep'
    ];

    return commonKeywords.filter(keyword =>
      content.toLowerCase().includes(keyword)
    );
  }

  private analyzeSentiment(content: string): { label: string; score: number } {
    // Basit sentiment analysis - gerçek NLP ile değiştirilecek
    const positiveWords = ['onay', 'olumlu', 'başarılı', 'tamam', 'uygun'];
    const negativeWords = ['gecikme', 'şikayet', 'ihbar', 'red', 'problem'];

    const positiveCount = positiveWords.filter(word => content.toLowerCase().includes(word)).length;
    const negativeCount = negativeWords.filter(word => content.toLowerCase().includes(word)).length;

    if (positiveCount > negativeCount) {
      return { label: 'Pozitif', score: 75 };
    } else if (negativeCount > positiveCount) {
      return { label: 'Negatif', score: 25 };
    } else {
      return { label: 'Nötr', score: 50 };
    }
  }

  private assessRisk(content: string, keywords: string[]): string {
    // Basit risk assessment
    const highRiskKeywords = ['ihbar', 'gecikme', 'şikayet', 'yasal', 'ceza'];
    const hasHighRisk = highRiskKeywords.some(keyword => keywords.includes(keyword));

    if (hasHighRisk) return 'Yüksek';
    if (keywords.includes('talep') || keywords.includes('ödeme')) return 'Orta';
    return 'Düşük';
  }

  private generateSummary(content: string): string {
    // Basit özetleme - gerçek AI ile değiştirilecek
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
    return sentences.slice(0, 2).join('. ') + '...';
  }

  private generateActionSuggestions(content: string, keywords: string[]): string[] {
    const suggestions: string[] = [];

    if (keywords.includes('izin')) {
      suggestions.push('İlgili izin belgelerini hazırlayın');
      suggestions.push('Zaman çizelgesini kontrol edin');
    }

    if (keywords.includes('ödeme')) {
      suggestions.push('Muhasebe departmanıyla koordinasyon sağlayın');
      suggestions.push('Ödeme şartlarını inceleyin');
    }

    if (keywords.includes('gecikme')) {
      suggestions.push('Gecikme nedenlerini analiz edin');
      suggestions.push('Telafi planı hazırlayın');
    }

    if (suggestions.length === 0) {
      suggestions.push('İlgili departmanlarla durumu paylaşın');
      suggestions.push('Yasal gereklilikleri kontrol edin');
    }

    return suggestions;
  }

  private suggestTemplates(keywords: string[]): string[] {
    const templates: string[] = [];

    if (keywords.includes('izin')) {
      templates.push('İzin Başvuru Şablonu');
      templates.push('İzin Takip Yazısı Şablonu');
    }

    if (keywords.includes('cevap')) {
      templates.push('Standart Cevap Şablonu');
      templates.push('Bilgilendirme Yazısı Şablonu');
    }

    if (keywords.includes('talep')) {
      templates.push('Talep Yazısı Şablonu');
      templates.push('İstek Dilekçesi Şablonu');
    }

    if (templates.length === 0) {
      templates.push('Genel Yazışma Şablonu');
    }

    return templates;
  }

  private generateTextCompletion(content: string): string {
    // Basit metin tamamlama
    return content + '\n\nDevam eden süreç hakkında daha detaylı bilgi almak için lütfen bizimle iletişime geçiniz.';
  }

  private identifyRiskFactors(content: string, keywords: string[]): string[] {
    const factors: string[] = [];

    if (keywords.includes('gecikme')) factors.push('Zaman baskısı');
    if (keywords.includes('yasal')) factors.push('Yasal riskler');
    if (keywords.includes('ödeme')) factors.push('Mali etkiler');
    if (keywords.includes('ihbar')) factors.push('İhbar riski');

    if (factors.length === 0) {
      factors.push('Genel iş süreci riskleri');
    }

    return factors;
  }

  private generateRiskRecommendations(riskLevel: string): string[] {
    const recommendations: string[] = [];

    if (riskLevel === 'Yüksek') {
      recommendations.push('Hızlı aksiyon alınmalı');
      recommendations.push('Yönetim onayına sunulmalı');
      recommendations.push('Hukuk departmanı ile görüşülmeli');
    } else if (riskLevel === 'Orta') {
      recommendations.push('Düzenli takip yapılmalı');
      recommendations.push('İlgili taraflarla iletişim sürdürülmeli');
    } else {
      recommendations.push('Standart prosedürlere göre ilerlenmeli');
    }

    return recommendations;
  }

  private extractKeyPhrases(content: string): string[] {
    // Basit key phrase extraction
    const phrases = content.match(/"([^"]*)"/g) || [];
    return phrases.slice(0, 3).map(p => p.replace(/"/g, ''));
  }
}

// Singleton instance
export const decisionSupportService = new DecisionSupportService();