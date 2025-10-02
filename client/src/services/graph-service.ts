import { supabaseService } from './supabase';

export interface GraphNode {
  id: string;
  label: string;
  type: 'document';
  data: {
    docId: string;
    letterNo: string;
    date: string;
    webUrl?: string;
    references?: string[];
    keywords?: string[] | string;
  };
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'reference';
}

interface DocumentDetails {
  id: number;
  letter_no?: string;
  letter_date?: string;
  ref_letters?: string;
  weburl?: string;
  keywords?: string[] | string;
}

class GraphService {
  // ID tiplerini dönüştürme yardımcı fonksiyonu
  private normalizeDocumentId(docId: string | number): string {
    // Eğer sayısal bir string ise (örn: "123")
    if (/^\d+$/.test(docId.toString())) {
      return docId.toString();
    }
    
    // Eğer internal_no formatında ise (örn: "IC-AD-366")
    return docId.toString();
  }
  
  private async getDocumentById(docId: string): Promise<DocumentDetails | null> {
    try {
      console.log(`📄 Belge arama başladı - DocID: ${docId}`);
      
      const client = supabaseService.getClient();
      if (!client) {
        throw new Error('Veritabanı bağlantısı başlatılmadı');
      }

      // Önce tüm belgeleri kontrol edelim (debug için)
      const { data: allDocs, error: listError } = await client
        .from('documents')
        .select('id, internal_no, letter_no')
        .limit(5);

      if (listError) {
        console.error('❌ Belge listesi alınamadı:', listError);
      } else {
        console.log('📋 İlk 5 belge:', allDocs);
      }

      // Önce internal_no ile deneyelim
      const normalizedId = this.normalizeDocumentId(docId);
      console.log(`🔍 Internal No araması - Normalized ID: ${normalizedId}`);
      
      const { data: dataByInternalNo, error: errorByInternalNo } = await client
        .from('documents')
        .select()
        .eq('internal_no', normalizedId)
        .limit(1);

      if (errorByInternalNo) {
        console.error('❌ Internal no sorgu hatası:', errorByInternalNo);
      }

      if (dataByInternalNo?.[0]) {
        console.log('✅ Belge internal_no ile bulundu:', dataByInternalNo[0]);
        return dataByInternalNo[0];
      }

      // Letter no ile deneyelim
      console.log(`🔍 Letter No araması - Normalized ID: ${normalizedId}`);
      
      const { data: dataByLetterNo, error: errorByLetterNo } = await client
        .from('documents')
        .select()
        .eq('letter_no', normalizedId)
        .limit(1);

      if (errorByLetterNo) {
        console.error('❌ Letter no sorgu hatası:', errorByLetterNo);
      }

      if (dataByLetterNo?.[0]) {
        console.log('✅ Belge letter_no ile bulundu:', dataByLetterNo[0]);
        return dataByLetterNo[0];
      }

      console.log('⚠️ Letter no ile bulunamadı, ID ile deneniyor...');

      // Sayısal ID ile deneyelim
      if (/^\d+$/.test(docId)) {
        console.log(`🔢 Sayısal ID sorgusu: ${docId}`);
        
        const { data, error } = await client
          .from('documents')
          .select()
          .eq('id', parseInt(docId))
          .limit(1);

        if (error) {
          console.error('❌ ID sorgu hatası:', error);
          throw new Error(`Belge getirilemedi: ${error.message}`);
        }

        if (data?.[0]) {
          console.log('✅ Belge ID ile bulundu:', data[0]);
          return data[0];
        }
      }

      // Her iki durumda da bulunamadı
      console.warn(`⚠️ Belge bulunamadı - DocID: ${docId}`);
      return null;

    } catch (error) {
      console.error('Belge getirme hatası:', error);
      throw error;
    }
  }

  private parseRefLetters(refLetters?: string): string[] {
    if (!refLetters) return [];
    
    // Referans belge numaralarını ayır ve temizle
    const refs = refLetters.split(',').flatMap(ref => {
      const cleanRef = ref.trim();
      if (!cleanRef) return [];

      // Özel durumlar için regex tanımları
      const icadPattern = /IC-[A-Z]+-\d+/g;
      const rePattern = /RE\s*\d+\/\d+(?:-\d+)?/g;

      // IC-AD formatındaki tüm referansları bul
      const icadRefs = cleanRef.match(icadPattern) || [];
      
      // RE formatındaki tüm referansları bul
      const reRefs = cleanRef.match(rePattern) || [];

      // Bulunan tüm referansları birleştir
      const allRefs = [...icadRefs, ...reRefs];

      // Eğer herhangi bir referans bulunduysa onları döndür
      if (allRefs.length > 0) {
        return allRefs;
      }

      // Hiçbir özel format bulunamadıysa orijinal referansı döndür
      return [cleanRef];
    });

    // ID'leri normalize et ve tekrar edenleri kaldır
    const normalizedRefs = refs.map(ref => this.normalizeDocumentId(ref));
    return [...new Set(normalizedRefs)]; // Tekrar edenleri kaldır
  }

  async buildDocumentGraph(rootDocId: string, maxDepth: number = 3): Promise<{nodes: GraphNode[], edges: GraphEdge[]}> {
    const nodes: Map<string, GraphNode> = new Map();
    const edges: GraphEdge[] = [];
    const processed = new Set<string>();
    const pendingNodes = new Set<string>(); // Henüz işlenmemiş düğümleri takip et

    const addNode = (doc: DocumentDetails) => {
      const nodeId = doc.letter_no || `${doc.id}`;
      if (!nodes.has(nodeId)) {
        nodes.set(nodeId, {
          id: nodeId,
          label: doc.letter_no || `Belge #${doc.id}`,
          type: 'document',
          data: {
            docId: String(doc.id),
            letterNo: doc.letter_no || `Belge #${doc.id}`,
            date: doc.letter_date || 'Date yok',
            webUrl: doc.weburl,
            keywords: doc.keywords || [] // keywords alanını ekledik
          }
        });
      }
      return nodeId;
    };

    const processDocument = async (docId: string, depth: number): Promise<void> => {
      if (depth > maxDepth || processed.has(docId)) return;
      
      try {
        // Belgeyi getir
        const doc = await this.getDocumentById(docId);
        if (!doc) {
          console.warn(`${docId} ID'li belge bulunamadı veya erişilemedi`);
          return;
        }

        // Düğümü ekle
        const sourceNodeId = addNode(doc);

        // Referansları işle
        processed.add(docId);
        const refs = this.parseRefLetters(doc.ref_letters);
        
        // Önce tüm referans belgeleri getir
        const refDocs = await Promise.all(
          refs.map(async refId => {
            try {
              return await this.getDocumentById(refId);
            } catch (error) {
              console.warn(`⚠️ Referans belgesi getirilemiyor: ${refId}`, error);
              return null;
            }
          })
        );

        // Var olan belgeleri işle ve kenarları oluştur
        for (const targetDoc of refDocs) {
          if (targetDoc) {
            // Hedef düğümü ekle
            const targetNodeId = addNode(targetDoc);
            
            // Kenarı oluştur
            const edgeId = `${sourceNodeId}-${targetNodeId}`;
            if (!edges.some(e => e.id === edgeId)) {
              edges.push({
                id: edgeId,
                source: sourceNodeId,
                target: targetNodeId,
                type: 'reference'
              });
            }

            // Referans belgeyi daha sonra işlenecekler listesine ekle
            if (!processed.has(String(targetDoc.id))) {
              pendingNodes.add(String(targetDoc.id));
            }
          }
        }

        // İşlenmemiş düğümleri işle
        const pending = Array.from(pendingNodes);
        for (const pendingId of pending) {
          if (!processed.has(pendingId)) {
            pendingNodes.delete(pendingId);
            await processDocument(pendingId, depth + 1);
          }
        }
      } catch (error) {
        console.error(`Belge işleme hatası (${docId}):`, error);
      }
    };

    try {
      await processDocument(rootDocId, 0);

      const graphNodes = Array.from(nodes.values());
      if (graphNodes.length === 0) {
        throw new Error('Graf oluşturulamadı: Hiç belge bulunamadı');
      }

      return {
        nodes: graphNodes,
        edges
      };
    } catch (error) {
      console.error('Graf oluşturma hatası:', error);
      throw new Error(`Graf oluşturulurken hata oluştu: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`);
    }
  }

  async getDocumentDetails(docId: string): Promise<DocumentDetails | null> {
    return this.getDocumentById(docId);
  }
}

export const graphService = new GraphService();
