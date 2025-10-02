// DeepSeek AI API Service
interface DeepSeekConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

interface SearchDecision {
  searchType: 'neo4j' | 'supabase' | 'both';
  reasoning: string;
  confidence: number;
  suggestedFilters?: {
    dateRange?: { from: string; to: string };
    categories?: string[];
    tags?: string[];
    fileTypes?: string[];
  };
  queryOptimization?: {
    originalQuery: string;
    optimizedQuery: string;
    keywords: string[];
  };
}

interface DeepSeekResponse {
  choices: Array<{
    message: {
      content: string;
      role: 'assistant';
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

class DeepSeekService {
  private config: DeepSeekConfig | null = null;

  // Konfigürasyon ayarlama
  configure(config: DeepSeekConfig) {
    this.config = {
      baseUrl: 'https://api.deepseek.com/v1',
      model: 'deepseek-chat',
      ...config
    };
  }

  // Arama stratejisi belirleme
  async determineSearchStrategy(
    userQuery: string,
    availableCategories: string[] = [],
    availableTags: string[] = [],
    availableFileTypes: string[] = []
  ): Promise<SearchDecision> {
    try {
      if (!this.config) {
        throw new Error('DeepSeek konfigürasyonu yapılmamış');
      }

      const systemPrompt = `Sen bir belge arama sistemi uzmanısın. Kullanıcının sorgusunu analiz edip en uygun arama stratejisini belirlemelisin.

Mevcut iki arama sistemi:
1. Neo4j Graph Database: Belgeler arası ilişkiler, bağlantılar, referanslar, networks için ideal
2. Supabase PostgreSQL: Yapılandırılmış veri, içerik arama, kategoriler, metadata için ideal

Kullanılabilir kategoriler: ${availableCategories.join(', ')}
Kullanılabilir etiketler: ${availableTags.join(', ')}
Kullanılabilir dosya tipleri: ${availableFileTypes.join(', ')}

Görevin:
1. Sorguyu analiz et
2. En uygun arama sistemini belirle (neo4j/supabase/both)
3. Kararının gerekçesini açıkla
4. Güven skorunu ver (0-1)
5. Önerilen filtreleri belirle
6. Sorguyu optimize et

Yanıtını JSON formatında ver:
{
  "searchType": "neo4j|supabase|both",
  "reasoning": "Karar gerekçesi",
  "confidence": 0.95,
  "suggestedFilters": {
    "dateRange": {"from": "2024-01-01", "to": "2024-12-31"},
    "categories": ["kategori1"],
    "tags": ["tag1", "tag2"],
    "fileTypes": ["pdf", "docx"]
  },
  "queryOptimization": {
    "originalQuery": "Orijinal sorgu",
    "optimizedQuery": "Optimize edilmiş sorgu",
    "keywords": ["anahtar1", "anahtar2"]
  }
}`;

      const userPrompt = `Kullanıcı sorgusu: "${userQuery}"

Bu sorguyu analiz edip en uygun arama stratejisini belirle.`;

      const response = await this.makeApiCall(systemPrompt, userPrompt);
      
      try {
        const decision = JSON.parse(response) as SearchDecision;
        
        // Validasyon
        if (!['neo4j', 'supabase', 'both'].includes(decision.searchType)) {
          throw new Error('Geçersiz searchType');
        }

        if (decision.confidence < 0 || decision.confidence > 1) {
          decision.confidence = Math.max(0, Math.min(1, decision.confidence));
        }

        return decision;

      } catch (parseError) {
        console.error('DeepSeek yanıtı parse edilemedi:', parseError);
        
        // Fallback karar
        return this.getFallbackDecision(userQuery);
      }

    } catch (error) {
      console.error('DeepSeek API hatası:', error);
      return this.getFallbackDecision(userQuery);
    }
  }

  // Sorgu optimizasyonu
  async optimizeSearchQuery(
    originalQuery: string,
    searchType: 'neo4j' | 'supabase'
  ): Promise<{
    optimizedQuery: string;
    keywords: string[];
    synonyms: string[];
  }> {
    try {
      if (!this.config) {
        throw new Error('DeepSeek konfigürasyonu yapılmamış');
      }

      const systemPrompt = `Sen bir arama sorgusu optimizasyon uzmanısın. 

${searchType === 'neo4j' ? 
  'Neo4j Graph Database için Cypher sorguları optimize ediyorsun. İlişki tabanlı aramalar, bağlantılar ve networks önemli.' :
  'Supabase PostgreSQL için full-text search optimize ediyorsun. İçerik arama, kategoriler ve metadata önemli.'
}

Görevin:
1. Sorguyu ${searchType} için optimize et
2. Anahtar kelimeleri çıkar
3. Eş anlamlı kelimeler öner
4. Türkçe dil özelliklerini dikkate al

JSON yanıt ver:
{
  "optimizedQuery": "Optimize edilmiş sorgu",
  "keywords": ["anahtar1", "anahtar2"],
  "synonyms": ["eşanlamlı1", "eşanlamlı2"]
}`;

      const userPrompt = `Optimize edilecek sorgu: "${originalQuery}"
Hedef sistem: ${searchType}`;

      const response = await this.makeApiCall(systemPrompt, userPrompt);
      
      try {
        return JSON.parse(response);
      } catch (error) {
        // Fallback
        const keywords = originalQuery.split(' ').filter(word => word.length > 2);
        return {
          optimizedQuery: originalQuery,
          keywords,
          synonyms: []
        };
      }

    } catch (error) {
      console.error('Sorgu optimizasyon hatası:', error);
      const keywords = originalQuery.split(' ').filter(word => word.length > 2);
      return {
        optimizedQuery: originalQuery,
        keywords,
        synonyms: []
      };
    }
  }

  // Arama sonuçlarını analiz etme
  async analyzeSearchResults(
    query: string,
    neo4jResults: any[],
    supabaseResults: any[],
    searchDecision: SearchDecision
  ): Promise<{
    relevanceScores: { neo4j: number; supabase: number };
    recommendations: string[];
    suggestedActions: string[];
  }> {
    try {
      if (!this.config) {
        throw new Error('DeepSeek konfigürasyonu yapılmamış');
      }

      const systemPrompt = `Sen bir arama sonucu analiz uzmanısın. Arama sonuçlarını değerlendirip kullanıcıya öneriler sunuyorsun.

Neo4j sonuç sayısı: ${neo4jResults.length}
Supabase sonuç sayısı: ${supabaseResults.length}
Orijinal arama kararı: ${searchDecision.searchType}
Karar güven skoru: ${searchDecision.confidence}

Görevin:
1. Her sistemin sonuçlarının alakalılığını skorla (0-1)
2. Kullanıcıya öneriler sun
3. Önerilen aksiyonları belirle

JSON yanıt:
{
  "relevanceScores": {"neo4j": 0.8, "supabase": 0.9},
  "recommendations": ["Öneri 1", "Öneri 2"],
  "suggestedActions": ["Aksiyon 1", "Aksiyon 2"]
}`;

      const userPrompt = `Analiz edilecek sorgu: "${query}"
Neo4j sonuç örnekleri: ${JSON.stringify(neo4jResults.slice(0, 3))}
Supabase sonuç örnekleri: ${JSON.stringify(supabaseResults.slice(0, 3))}`;

      const response = await this.makeApiCall(systemPrompt, userPrompt);
      
      try {
        return JSON.parse(response);
      } catch (error) {
        return {
          relevanceScores: { neo4j: 0.5, supabase: 0.5 },
          recommendations: ['Daha spesifik anahtar kelimeler kullanmayı deneyin'],
          suggestedActions: ['Filtreleri ayarlayın', 'Date Rangenı daraltın']
        };
      }

    } catch (error) {
      console.error('Sonuç analiz hatası:', error);
      return {
        relevanceScores: { neo4j: 0.5, supabase: 0.5 },
        recommendations: ['Daha spesifik anahtar kelimeler kullanmayı deneyin'],
        suggestedActions: ['Filtreleri ayarlayın', 'Date Rangenı daraltın']
      };
    }
  }

  // API çağrısı yapma
  private async makeApiCall(systemPrompt: string, userPrompt: string): Promise<string> {
    if (!this.config) {
      throw new Error('DeepSeek konfigürasyonu yapılmamış');
    }

    // Don't try network calls when the client is offline
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new Error('DeepSeek API call aborted: offline');
    }

    const url = `${this.config.baseUrl}/chat/completions`;
    // simple retry/backoff to avoid flooding when network is flaky
    const maxAttempts = 2;
    let attempt = 0;
    const baseDelay = 250;

    while (true) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`
          },
          body: JSON.stringify({
            model: this.config.model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            temperature: 0.3,
            max_tokens: 2000
          })
        });

        if (!response.ok) {
          throw new Error(`DeepSeek API hatası: ${response.status} ${response.statusText}`);
        }

        const data: DeepSeekResponse = await response.json();
        if (!data.choices || data.choices.length === 0) {
          throw new Error("DeepSeek API'den yanıt alınamadı");
        }

        return data.choices[0].message.content;
      } catch (err) {
        attempt += 1;
        if (attempt > maxAttempts) {
          throw err;
        }
        // wait small backoff
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, baseDelay * attempt));
      }
    }
  }

  // Fallback karar mekanizması
  private getFallbackDecision(query: string): SearchDecision {
    const queryLower = query.toLowerCase();
    
    // Basit heuristik kurallar
    const graphKeywords = ['ilişki', 'bağlantı', 'referans', 'ağ', 'network', 'relation', 'connection'];
    const databaseKeywords = ['liste', 'tablo', 'rapor', 'kategori', 'filtre', 'list', 'table', 'report'];
    
    const hasGraphKeywords = graphKeywords.some(keyword => queryLower.includes(keyword));
    const hasDatabaseKeywords = databaseKeywords.some(keyword => queryLower.includes(keyword));
    
    let searchType: 'neo4j' | 'supabase' | 'both';
    let confidence: number;
    let reasoning: string;
    
    if (hasGraphKeywords && !hasDatabaseKeywords) {
      searchType = 'neo4j';
      confidence = 0.7;
      reasoning = 'Sorgu ilişki tabanlı arama içeriyor, Graph database uygun';
    } else if (hasDatabaseKeywords && !hasGraphKeywords) {
      searchType = 'supabase';
      confidence = 0.7;
      reasoning = 'Sorgu yapılandırılmış veri arama içeriyor, PostgreSQL uygun';
    } else {
      searchType = 'both';
      confidence = 0.5;
      reasoning = 'Belirsiz sorgu, her iki sistemde de arama yapılacak';
    }
    
    return {
      searchType,
      reasoning,
      confidence,
      queryOptimization: {
        originalQuery: query,
        optimizedQuery: query,
        keywords: query.split(' ').filter(word => word.length > 2)
      }
    };
  }

  // Bağlantı testi
  async testConnection(): Promise<boolean> {
    try {
      if (!this.config) {
        return false;
      }
      // avoid repeating expensive network tests too frequently
      const ok = await this.makeApiCall('Sen bir test asistanısın.', 'Merhaba, çalışıyor musun?')
        .then((r) => !!r)
        .catch((err) => {
          console.warn('DeepSeek testConnection failed:', err);
          return false;
        });

      return ok;

    } catch (error) {
      console.error('DeepSeek bağlantı testi hata (üst seviye):', error);
      return false;
    }
  }
}

// Singleton instance
export const deepSeekService = new DeepSeekService();

// Export types
export type { SearchDecision, DeepSeekConfig };
