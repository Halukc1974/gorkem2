import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Switch } from '../components/ui/switch';
import { 
  Search, Network, Brain, Cpu, CircuitBoard, Sparkles, CheckCircle2, XCircle, Eye, FileText, Calendar 
} from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { DocumentGraph } from '../components/graph-engine/DocumentGraph';
import { supabaseService } from '../services/supabase';
import { buildStarMapGraph } from '../utils/documentGraphStarMap';
import { useDocumentGraph } from '../hooks/use-document-graph';
import { GraphCustomizationProvider } from '../components/graph-engine/context/GraphCustomizationContext';
import { useDocumentSearch } from '../hooks/use-document-search';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../components/ui/alert-dialog';
import { useUserSettings } from '../hooks/useUserSettings';
import { DecisionSupportService } from '../services/decision-support';
import { useToast } from '../hooks/use-toast';

export default function AISearchPage() {
  // User settings hook for API keys
  const { config, hasValidApis } = useUserSettings();
  const { toast } = useToast();
  
  // Document search hooks
  const {
    loading: searchLoading,
    isAnyDatabaseConnected,
    totalResults,
    hasResults,
    search,
    clearResults,
    configureServices,
  } = useDocumentSearch();
  
  // Initialize services on mount
  useEffect(() => {
    if (configureServices) {
      configureServices();
    }
  }, []); // Run only on mount

  // UI state
  const [activeTab, setActiveTab] = useState('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [enableAI, setEnableAI] = useState(() => {
    const stored = localStorage.getItem('doc_search_enable_ai');
    return stored !== null ? stored === 'true' : true;
  });

  // Graph state
  const [rootDoc, setRootDoc] = useState('');
  const { 
    graphData, 
    loading: graphLoading, 
    error, 
    loadGraph, 
    handleNodeClick 
  } = useDocumentGraph();

    // Node click handler - show document details or open web_url
  const handleNodeClickWithModal = useCallback(async (nodeId: string) => {
    try {
      console.log('Node clicked:', nodeId);
      
      // Get document details - can be letter_no, internal_no or id
            // First try letter_no or internal_no
      let { data, error } = await supabaseService.getClient()
        .from('documents')
        .select('id, letter_no, letter_date, ref_letters, short_desc, weburl, content, inc_out')
        .or(`letter_no.eq.${nodeId},internal_no.eq.${nodeId},id.eq.${nodeId}`)
        .maybeSingle();
      
      // If not found, try internal_no
      if (!data && !error) {
        const result = await supabaseService.getClient()
          .from('documents')
          .select('*')
          .eq('internal_no', nodeId)
          .maybeSingle();
        data = result.data;
        error = result.error;
      }
      
      // If still not found, try id
      if (!data && !error) {
        const result = await supabaseService.getClient()
          .from('documents')
          .select('*')
          .eq('id', nodeId)
          .maybeSingle();
        data = result.data;
        error = result.error;
      }

      if (error) {
        console.error('Document query error:', error);
        return;
      }

      if (data) {
        console.log('Document found:', data);
        
        // If weburl exists, open directly
        if (data.weburl) {
          console.log('Opening web URL:', data.weburl);
          window.open(data.weburl, '_blank', 'noopener,noreferrer');
          return;
        }
        
        console.log('No web URL, opening modal');
        // If no weburl, open modal
        setSelectedDocument(data);
        setShowDocumentModal(true);
      } else {
        console.warn('Document details not found:', nodeId);
      }
    } catch (error) {
      console.error('Error getting document details:', error);
    }
  }, []);
  const [preloadedStarMap, setPreloadedStarMap] = useState<{ nodes: any[]; edges: any[] } | null>(null);
  const [starQuery, setStarQuery] = useState('');
  const [starLoading, setStarLoading] = useState(false);
  const [starError, setStarError] = useState<string | null>(null);
  const [showAllDocsConfirm, setShowAllDocsConfirm] = useState(false);

  // Timeline state
  const [timelineQuery, setTimelineQuery] = useState('');
  const [timelineDocuments, setTimelineDocuments] = useState<any[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineError, setTimelineError] = useState<string | null>(null);
  // Derived arrays for timeline rendering (non-invasive)
  const [incomingDates, setIncomingDates] = useState<string[]>([]);
  const [outgoingDates, setOutgoingDates] = useState<string[]>([]);
  const [incomingDocs, setIncomingDocs] = useState<any[]>([]);
  const [outgoingDocs, setOutgoingDocs] = useState<any[]>([]);

  // Timeline tooltip state
  const [timelineTooltip, setTimelineTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    title?: string;
    body?: string;
    nodeId?: string;
    doc?: any;
  }>({ visible: false, x: 0, y: 0, title: undefined, body: undefined, nodeId: undefined, doc: undefined });
  const timelineTooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Timeline zoom state
  const [timelineZoom, setTimelineZoom] = useState(1);
  const timelineContainerRef = useRef<HTMLDivElement>(null);

  // Helper: format date as DD/MM/YYYY
  const formatDDMMYYYY = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      // en-GB gives DD/MM/YYYY format
      return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch (e) {
      return String(dateStr);
    }
  };

  // Document analysis state
  const [documentBasket, setDocumentBasket] = useState<Array<{
    id: string;
    letter_no: string;
    letter_date?: string;
    ref_letters?: string;
    short_desc?: string;
    weburl?: string;
    inc_out?: string;
  }>>([]);
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());

  // Load basket from localStorage on mount (for documents added from info-center)
  useEffect(() => {
    const savedBasket = localStorage.getItem('documentBasket');
    if (savedBasket) {
      try {
        const basket = JSON.parse(savedBasket);
        if (Array.isArray(basket) && basket.length > 0) {
          setDocumentBasket(basket);
        }
      } catch (e) {
        console.error('Error loading basket from localStorage:', e);
      }
    }

    // Listen for basket updates from other pages/components
    const handleBasketUpdate = (event: any) => {
      console.log('📥 Basket updated from another page');
      if (event.detail?.basket) {
        setDocumentBasket(event.detail.basket);
      }
    };

    // Listen for storage events (from other tabs)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'documentBasket' && e.newValue) {
        try {
          const basket = JSON.parse(e.newValue);
          if (Array.isArray(basket)) {
            console.log('📥 Basket updated from another tab');
            setDocumentBasket(basket);
          }
        } catch (err) {
          console.error('Error parsing basket from storage event:', err);
        }
      }
    };

    window.addEventListener('basketUpdated', handleBasketUpdate);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('basketUpdated', handleBasketUpdate);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Save basket to localStorage whenever it changes
  useEffect(() => {
    if (documentBasket.length > 0) {
      localStorage.setItem('documentBasket', JSON.stringify(documentBasket));
    }
  }, [documentBasket]);

  // Document detail modal state
  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  const [showDocumentModal, setShowDocumentModal] = useState(false);

  // Document preview modal state
  const [previewContent, setPreviewContent] = useState<{ 
    letter_no: string; 
    letter_date?: string;
    ref_letters?: string;
    short_desc?: string;
    content: string 
  } | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Analysis modal and results state
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [analysisOptions, setAnalysisOptions] = useState({
    useChatGPT: true,
    useDeepSeek: false,
    chatgptModel: 'gpt-4o-mini' as 'gpt-4o-mini' | 'gpt-4o' | 'gpt-4-turbo' | 'gpt-3.5-turbo'
  });
  const [tokenUsage, setTokenUsage] = useState<{
    chatgpt?: { prompt: number; completion: number; total: number };
    deepseek?: { prompt: number; completion: number; total: number };
  }>({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<Array<{
    id: string;
    letter_no: string;
    letter_date?: string;
    short_desc?: string;
    chatgptAnalysis?: {
      summary: string;
      request: string;
      deadline?: string;
      importance: string;
      relevance: string;
      relevanceNote?: string;
      actions: string[];
    };
    deepseekAnalysis?: {
      summary: string;
      request: string;
      deadline?: string;
      importance: string;
      relevance: string;
      relevanceNote?: string;
      actions: string[];
    };
  }>>([]);
  const [selectedForDraft, setSelectedForDraft] = useState<Set<string>>(new Set());

  // Add document to basket function
  const addToDocumentBasket = useCallback(async (documentId: string) => {
    try {
      console.log('Adding to basket, nodeId:', documentId);
      
      // Get document details from Supabase - nodeId can be letter_no, internal_no or id
      // First try letter_no
      let { data, error } = await supabaseService.getClient()
        .from('documents')
        .select('id, letter_no, letter_date, ref_letters, short_desc, weburl, inc_out')
        .eq('letter_no', documentId)
        .maybeSingle();
      
      // If not found, try internal_no
      if (!data && !error) {
        const result = await supabaseService.getClient()
          .from('documents')
          .select('id, letter_no, letter_date, ref_letters, short_desc, weburl, inc_out')
          .eq('internal_no', documentId)
          .maybeSingle();
        data = result.data;
        error = result.error;
      }
      
      // If still not found, try id
      if (!data && !error) {
        const result = await supabaseService.getClient()
          .from('documents')
          .select('id, letter_no, letter_date, ref_letters, short_desc, weburl, inc_out')
          .eq('id', documentId)
          .maybeSingle();
        data = result.data;
        error = result.error;
      }

      if (error) {
        console.error('Document not found:', error);
        alert(`Document not found: ${documentId}`);
        return;
      }

      if (data) {
        // If already in basket, don't add
        if (documentBasket.some(doc => doc.id === String(data.id))) {
          console.log('Document already in basket:', data.id);
          alert('This document is already in the basket!');
          return;
        }

        console.log('Adding document to basket:', data);
        const newBasketItem = {
          id: String(data.id),
          letter_no: data.letter_no || '',
          letter_date: data.letter_date,
          ref_letters: data.ref_letters,
          short_desc: data.short_desc,
          weburl: data.weburl,
          inc_out: data.inc_out
        };
        
        setDocumentBasket(prev => {
          const newBasket = [...prev, newBasketItem];
          // Update localStorage
          localStorage.setItem('documentBasket', JSON.stringify(newBasket));
          // Dispatch event to notify other components
          window.dispatchEvent(new CustomEvent('basketUpdated', { 
            detail: { basket: newBasket } 
          }));
          return newBasket;
        });
        
        alert(`"${data.letter_no}" document sent to analysis page`);
      }
    } catch (error) {
      console.error('Error adding document to basket:', error);
      alert('An error occurred while adding the document to basket!');
    }
  }, [documentBasket]);

  // Remove document from basket function
  const removeFromDocumentBasket = (documentId: string) => {
    setDocumentBasket(prev => {
      const newBasket = prev.filter(doc => doc.id !== documentId);
      // Update localStorage
      localStorage.setItem('documentBasket', JSON.stringify(newBasket));
      // Dispatch event to notify other components
      window.dispatchEvent(new CustomEvent('basketUpdated', { 
        detail: { basket: newBasket } 
      }));
      return newBasket;
    });
    
    setSelectedDocuments(prev => {
      const newSet = new Set(prev);
      newSet.delete(documentId);
      return newSet;
    });
  };

  // Document preview function
  const handlePreviewDocument = async (documentId: string, letterNo: string) => {
    try {
      const { data, error } = await supabaseService.getClient()
        .from('documents')
        .select('id, letter_no, letter_date, ref_letters, short_desc, content, weburl, inc_out')
        .eq('id', documentId)
        .single();

      if (error || !data) {
        alert('Document content could not be loaded!');
        return;
      }

      setPreviewContent({ 
        letter_no: data.letter_no || letterNo,
        letter_date: data.letter_date,
        ref_letters: data.ref_letters,
        short_desc: data.short_desc,
        content: data.content || data.short_desc || 'Content not found'
      });
      setShowPreviewModal(true);
    } catch (error) {
      console.error('Document preview error:', error);
      alert('An error occurred while previewing the document!');
    }
  };

  // Open document in new tab
  const handleOpenDocument = (weburl: string | undefined) => {
    if (weburl && weburl.trim()) {
      window.open(weburl, '_blank', 'noopener,noreferrer');
    } else {
      alert('URL not found for this document!');
    }
  };

  // Comprehensive document analysis function
  const handleComprehensiveAnalysis = async () => {
    if (selectedDocuments.size === 0) {
      toast({
        title: 'No Documents Selected',
        description: 'Please select at least one document to analyze.',
        variant: 'destructive'
      });
      return;
    }

    if (!analysisOptions.useChatGPT && !analysisOptions.useDeepSeek) {
      toast({
        title: 'No AI Selected',
        description: 'Please select at least one AI service (ChatGPT or DeepSeek).',
        variant: 'destructive'
      });
      return;
    }

    setIsAnalyzing(true);
    setShowAnalysisModal(false);
    setTokenUsage({}); // Reset token usage before new analysis

    try {
      const selectedDocs = documentBasket.filter(doc => selectedDocuments.has(doc.id));
      
      // Fetch full content for selected documents
      const docsWithContent = await Promise.all(
        selectedDocs.map(async (doc) => {
          const { data, error } = await supabaseService.getClient()
            .from('documents')
            .select('id, letter_no, letter_date, short_desc, content, inc_out, ref_letters')
            .eq('id', doc.id)
            .single();
          
          if (error || !data) {
            console.error(`Error fetching document ${doc.id}:`, error);
            return null;
          }
          
          return data;
        })
      );
      
      const validDocs = docsWithContent.filter(d => d !== null);
      
      if (validDocs.length === 0) {
        toast({
          title: 'Error',
          description: 'Could not load document content for analysis.',
          variant: 'destructive'
        });
        setIsAnalyzing(false);
        return;
      }

      toast({
        title: 'Analysis Started',
        description: `Analyzing ${validDocs.length} documents...`,
      });

      // Analyze each document separately
      const analysisPromises = validDocs.map(async (doc) => {
        const result: any = {
          id: doc.id,
          letter_no: doc.letter_no,
          letter_date: doc.letter_date,
          short_desc: doc.short_desc
        };

        // ChatGPT Analysis
        if (analysisOptions.useChatGPT && config?.apis?.openai) {
          try {
            const chatgptResult = await analyzeWithAI(doc, 'chatgpt');
            result.chatgptAnalysis = chatgptResult;
          } catch (error) {
            console.error('ChatGPT analysis error:', error);
            result.chatgptAnalysis = {
              summary: 'Analysis failed',
              request: 'N/A',
              importance: 'Unknown',
              relevance: 'Unknown',
              actions: ['Analysis could not be completed']
            };
          }
        }

        // DeepSeek Analysis
        if (analysisOptions.useDeepSeek && config?.apis?.deepseek) {
          try {
            const deepseekResult = await analyzeWithAI(doc, 'deepseek');
            result.deepseekAnalysis = deepseekResult;
          } catch (error) {
            console.error('DeepSeek analysis error:', error);
            result.deepseekAnalysis = {
              summary: 'Analysis failed',
              request: 'N/A',
              importance: 'Unknown',
              relevance: 'Unknown',
              actions: ['Analysis could not be completed']
            };
          }
        }

        return result;
      });

      const results = await Promise.all(analysisPromises);
      setAnalysisResults(results);

      toast({
        title: 'Analysis Complete',
        description: `Successfully analyzed ${results.length} documents.`,
      });

    } catch (error) {
      console.error('Comprehensive analysis error:', error);
      toast({
        title: 'Analysis Failed',
        description: error instanceof Error ? error.message : 'An error occurred during analysis.',
        variant: 'destructive'
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // AI analysis function for a single document
  const analyzeWithAI = async (doc: any, aiType: 'chatgpt' | 'deepseek') => {
    const apiKey = aiType === 'chatgpt' ? config?.apis?.openai : config?.apis?.deepseek;
    const apiUrl = aiType === 'chatgpt' 
      ? 'https://api.openai.com/v1/chat/completions'
      : 'https://api.deepseek.com/v1/chat/completions';
    const model = aiType === 'chatgpt' ? analysisOptions.chatgptModel : 'deepseek-chat';

    const allDocsContext = documentBasket.map(d => 
      `Letter No: ${d.letter_no}\nDate: ${d.letter_date}\nSubject: ${d.short_desc}`
    ).join('\n\n');

    const analysisPrompt = `
You are analyzing official correspondence documents. Here is the context of all selected documents for relationship analysis:

SELECTED DOCUMENTS CONTEXT:
${allDocsContext}

DOCUMENT TO ANALYZE:
Letter No: ${doc.letter_no}
Date: ${doc.letter_date}
Subject: ${doc.short_desc}
Content: ${doc.content || doc.short_desc}

ANALYSIS REQUIREMENTS (respond in ENGLISH):
1. **Summary**: Provide a concise summary (2-3 sentences in English)
2. **Request**: What is being requested or communicated? (in English)
3. **Deadline**: If there's a deadline mentioned, extract it. Format: "DD.MM.YYYY" or "None"
4. **Importance**: Rate as "Low", "Medium", or "High"
5. **Relevance**: Analyze how this document relates to OTHER documents in the selected group. Rate as:
   - "High" - Directly related, references other documents
   - "Medium" - Somewhat related, similar topic
   - "Low" - Not related, different topic
   - "Irrelevant" - Completely unrelated to the group
6. **Relevance Note**: If relevance is "Low" or "Irrelevant", explain in English why this document doesn't belong with the others
7. **Actions**: List 3-4 specific action items (in English)

RETURN JSON FORMAT (all values in ENGLISH):
{
  "summary": "English summary",
  "request": "What is requested",
  "deadline": "DD.MM.YYYY or None",
  "importance": "Low|Medium|High",
  "relevance": "High|Medium|Low|Irrelevant",
  "relevanceNote": "Explanation if low relevance (optional)",
  "actions": ["Action 1", "Action 2", "Action 3"]
}
`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert in analyzing official correspondence. Always respond in JSON format with English language content.'
          },
          {
            role: 'user',
            content: analysisPrompt
          }
        ],
        temperature: 0.3,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      throw new Error(`${aiType} API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0]?.message?.content;

    // Track token usage
    if (data.usage) {
      setTokenUsage(prev => ({
        ...prev,
        [aiType]: {
          prompt: (prev[aiType]?.prompt || 0) + (data.usage.prompt_tokens || 0),
          completion: (prev[aiType]?.completion || 0) + (data.usage.completion_tokens || 0),
          total: (prev[aiType]?.total || 0) + (data.usage.total_tokens || 0)
        }
      }));
    }

    if (!aiResponse) {
      throw new Error(`${aiType} returned empty response`);
    }

    // Try to parse JSON
    try {
      const parsed = JSON.parse(aiResponse);
      return parsed;
    } catch (parseError) {
      // If JSON parsing fails, try to extract JSON from markdown code blocks
      const jsonMatch = aiResponse.match(/```json\n([\s\S]*?)\n```/) || aiResponse.match(/```\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }
      throw new Error('Failed to parse AI response as JSON');
    }
  };

  // Generate draft document from selected analysis results
  const handleGenerateDraft = async () => {
    if (selectedForDraft.size === 0) {
      toast({
        title: 'No Documents Selected',
        description: 'Please select at least one analyzed document to generate a draft.',
        variant: 'destructive'
      });
      return;
    }

    try {
      const selectedAnalyses = analysisResults.filter(r => selectedForDraft.has(r.id));
      
      // Combine all summaries and actions
      const combinedContext = selectedAnalyses.map(doc => {
        const analysis = doc.chatgptAnalysis || doc.deepseekAnalysis;
        return `
Document: ${doc.letter_no} (${doc.letter_date})
Summary: ${analysis?.summary}
Request: ${analysis?.request}
Actions: ${analysis?.actions.join(', ')}
        `;
      }).join('\n\n');

      const draftPrompt = `
Based on the following analyzed documents, generate a professional response letter in English:

${combinedContext}

Generate a formal business letter that:
1. Acknowledges receipt of the referenced documents
2. Addresses the main requests
3. Proposes solutions or next steps
4. Maintains a professional tone
5. Is structured with proper formatting (date, subject, body, closing)

Return the complete draft letter in plain text format.
`;

      const apiKey = config?.apis?.openai || config?.apis?.deepseek;
      const apiUrl = config?.apis?.openai 
        ? 'https://api.openai.com/v1/chat/completions'
        : 'https://api.deepseek.com/v1/chat/completions';
      const model = config?.apis?.openai ? 'gpt-4o-mini' : 'deepseek-chat';

      toast({
        title: 'Generating Draft',
        description: 'Please wait...',
      });

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: 'You are a professional business correspondence writer.'
            },
            {
              role: 'user',
              content: draftPrompt
            }
          ],
          temperature: 0.7,
          max_tokens: 2000
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const draftText = data.choices[0]?.message?.content;

      // Show draft in a modal or download
      const blob = new Blob([draftText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `draft-response-${new Date().toISOString().split('T')[0]}.txt`;
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: 'Draft Generated',
        description: 'Draft document has been downloaded.',
      });

    } catch (error) {
      console.error('Draft generation error:', error);
      toast({
        title: 'Draft Generation Failed',
        description: error instanceof Error ? error.message : 'An error occurred.',
        variant: 'destructive'
      });
    }
  };
 
  // Handler to load all documents - called from "All Documents Network" tab functionality
  const handleBringAllDocuments = async () => {
    setStarLoading(true);
    setStarError(null);
    setShowAllDocsConfirm(false);
    
    try {
      toast({
        title: 'Loading All Documents',
        description: 'This may take up to 2 minutes. Please wait...',
      });
      
      // Load all document relations from Supabase
      const records = await supabaseService.getAllDocumentRelations();
      const fullGraph = buildStarMapGraph(records);
      
      // Set the preloaded star map with all documents
      setPreloadedStarMap({ nodes: fullGraph.nodes, edges: fullGraph.edges });
      
      toast({
        title: 'Success',
        description: `Loaded ${fullGraph.nodes.length} documents and ${fullGraph.edges.length} connections.`,
      });
      
      setStarLoading(false);
    } catch (err: any) {
      console.error('Error loading all documents:', err);
      setStarError(String(err?.message ?? err));
      toast({
        title: 'Error',
        description: 'Failed to load all documents. Please try again.',
        variant: 'destructive',
      });
      setStarLoading(false);
    }
  };

  const handleFindIsland = async (query: string) => {
    if (!query || !query.trim()) return;
    setStarLoading(true);
    setStarError(null);
    try {
      // Ensure we have full star map data (use cached preloadedStarMap if present)
      let fullGraph = preloadedStarMap;
      if (!fullGraph) {
        const records = await supabaseService.getAllDocumentRelations();
        const built = buildStarMapGraph(records);
        fullGraph = { nodes: built.nodes, edges: built.edges };
      }

      // Helper: extract canonical id from node/edge shapes the util may produce
      const getNodeId = (n: any) => {
        if (!n) return '';
        if (typeof n === 'string') return n;
        if (n.id) return String(n.id);
        if (n.data?.id) return String(n.data.id);
        if (n.data?.letter_no) return String(n.data.letter_no);
        return '';
      };

      const normalize = (s: any) => String(s ?? '').trim().toUpperCase();

      // Map normalized id -> original id (to handle case/whitespace differences)
      const normToOriginal = new Map<string, string>();
      fullGraph.nodes.forEach((n: any) => {
        const orig = getNodeId(n);
        if (!orig) return;
        normToOriginal.set(normalize(orig), orig);
      });

      const qNorm = normalize(query);
      const startId = normToOriginal.get(qNorm) || null;
      if (!startId) {
        setStarError('Searched letter_no not found in map.');
        setStarLoading(false);
        return;
      }

      // build adjacency and BFS to get connected component (undirected)
      const adj = new Map<string, Set<string>>();
      // initialize adjacency for all known original ids
      fullGraph.nodes.forEach((n: any) => {
        const id = getNodeId(n);
        if (!adj.has(id)) adj.set(id, new Set());
      });
      // add edges (handle shapes where edge may be {source,target} or {data:{source,target}})
      fullGraph.edges.forEach((e: any) => {
        const s = e.source ?? e.data?.source ?? e.data?.from ?? '';
        const t = e.target ?? e.data?.target ?? e.data?.to ?? '';
        const sId = String(s);
        const tId = String(t);
        if (!adj.has(sId)) adj.set(sId, new Set());
        if (!adj.has(tId)) adj.set(tId, new Set());
        adj.get(sId)!.add(tId);
        adj.get(tId)!.add(sId);
      });

      const queue: string[] = [startId];
      const seen = new Set<string>([startId]);
      while (queue.length) {
        const cur = queue.shift()!;
        const neighbors = adj.get(cur);
        if (!neighbors) continue;
        for (const nb of neighbors) {
          if (!seen.has(nb)) {
            seen.add(nb);
            queue.push(nb);
          }
        }
      }

      // filter nodes/edges to the island
    const islandNodes = fullGraph.nodes.filter((n: any) => seen.has(getNodeId(n)));
    const islandNodeIds = new Set(islandNodes.map((n: any) => getNodeId(n)));
      const getEdgeEndpoints = (e: any) => {
        const s = e.source ?? e.data?.source ?? e.data?.from ?? undefined;
        const t = e.target ?? e.data?.target ?? e.data?.to ?? undefined;
        return { s: s !== undefined ? String(s) : undefined, t: t !== undefined ? String(t) : undefined };
      };

      const islandEdges = fullGraph.edges.filter((e: any) => {
        const { s, t } = getEdgeEndpoints(e);
        if (!s || !t) return false;
        return islandNodeIds.has(s) && islandNodeIds.has(t);
      });

      setPreloadedStarMap({ nodes: islandNodes, edges: islandEdges });
      // ensure UI shows star-map tab (optional)
      setActiveTab('star-map-top');
    } catch (err: any) {
      console.error('Island finding error', err);
      setStarError(String(err?.message ?? err));
    } finally {
      setStarLoading(false);
    }
  };

  // Handle timeline search - finds island and displays as timeline
  const handleFindTimeline = async (query: string) => {
    if (!query || !query.trim()) return;
    setTimelineLoading(true);
    setTimelineError(null);
    setTimelineDocuments([]);
    
    try {
      // Use same island finding logic as handleFindIsland
      let fullGraph = preloadedStarMap;
      if (!fullGraph) {
        const records = await supabaseService.getAllDocumentRelations();
        const built = buildStarMapGraph(records);
        fullGraph = { nodes: built.nodes, edges: built.edges };
      }

      const getNodeId = (n: any) => {
        if (!n) return '';
        if (typeof n === 'string') return n;
        if (n.id) return String(n.id);
        if (n.data?.id) return String(n.data.id);
        if (n.data?.letter_no) return String(n.data.letter_no);
        return '';
      };

      const normalize = (s: any) => String(s ?? '').trim().toUpperCase();

      const normToOriginal = new Map<string, string>();
      fullGraph.nodes.forEach((n: any) => {
        const orig = getNodeId(n);
        if (!orig) return;
        normToOriginal.set(normalize(orig), orig);
      });

      const qNorm = normalize(query);
      const startId = normToOriginal.get(qNorm) || null;
      if (!startId) {
        setTimelineError('Searched letter_no not found in map.');
        setTimelineLoading(false);
        return;
      }

      // Build adjacency and BFS to get connected component
      const adj = new Map<string, Set<string>>();
      fullGraph.nodes.forEach((n: any) => {
        const id = getNodeId(n);
        if (!adj.has(id)) adj.set(id, new Set());
      });
      
      fullGraph.edges.forEach((e: any) => {
        const s = e.source ?? e.data?.source ?? e.data?.from ?? '';
        const t = e.target ?? e.data?.target ?? e.data?.to ?? '';
        const sId = String(s);
        const tId = String(t);
        if (!adj.has(sId)) adj.set(sId, new Set());
        if (!adj.has(tId)) adj.set(tId, new Set());
        adj.get(sId)!.add(tId);
        adj.get(tId)!.add(sId);
      });

      const queue: string[] = [startId];
      const seen = new Set<string>([startId]);
      while (queue.length) {
        const cur = queue.shift()!;
        const neighbors = adj.get(cur);
        if (!neighbors) continue;
        for (const nb of neighbors) {
          if (!seen.has(nb)) {
            seen.add(nb);
            queue.push(nb);
          }
        }
      }

      // Get all letter_no values from the island
      const islandLetterNos = Array.from(seen);
      
      // Fetch full document details from Supabase
      const { data: documents, error } = await supabaseService.getClient()
        .from('documents')
        .select('id, letter_no, letter_date, ref_letters, short_desc, weburl, inc_out, content')
        .in('letter_no', islandLetterNos);

      if (error) {
        console.error('Error fetching timeline documents:', error);
        setTimelineError('Error loading documents from database.');
        setTimelineLoading(false);
        return;
      }

      if (!documents || documents.length === 0) {
        setTimelineError('No documents found for this island.');
        setTimelineLoading(false);
        return;
      }

      // Sort documents by date
      const sortedDocuments = documents
        .filter(doc => doc.letter_date) // Only include documents with dates
        .sort((a, b) => new Date(a.letter_date).getTime() - new Date(b.letter_date).getTime());

      setTimelineDocuments(sortedDocuments);
      // Non-invasive: derive incoming/outgoing arrays from returned documents
      try {
        const canonicalType = (d: any) => {
          if (!d) return undefined;
          const candidates = [d.inc_out, d.incout, d.incoming, d.type_of_corr];
          for (const c of candidates) {
            if (!c && typeof c !== 'number') continue;
            const s = String(c ?? '').trim().toLowerCase();
            if (s === 'inc' || s === 'incoming' || s === 'in') return 'inc';
            if (s === 'out' || s === 'outgoing' || s === 'ex') return 'out';
          }
          return undefined;
        };

        const incDocs = sortedDocuments.filter(d => canonicalType(d) === 'inc');
        const outDocs = sortedDocuments.filter(d => canonicalType(d) === 'out');

        setIncomingDocs(incDocs);
        setOutgoingDocs(outDocs);
        setIncomingDates(incDocs.map(d => d.letter_date).filter(Boolean));
        setOutgoingDates(outDocs.map(d => d.letter_date).filter(Boolean));
      } catch (e) {
        // keep this non-invasive
        console.debug('Timeline: deriving incoming/outgoing arrays failed', e);
      }
      // Debug: log counts and sample data without changing behavior
      try {
        console.debug('Timeline: setTimelineDocuments -> total=', sortedDocuments.length);
        console.debug('Timeline: distinct inc_out values=', Array.from(new Set(sortedDocuments.map((d:any) => d.inc_out))));
        if (sortedDocuments.length) console.debug('Timeline: sample document[0]=', sortedDocuments[0]);
      } catch (e) {
        // keep non-invasive
      }
      setTimelineLoading(false);

    } catch (err: any) {
      console.error('Timeline search error:', err);
      setTimelineError(String(err?.message ?? err));
      setTimelineLoading(false);
    }
  };
 
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <span className="inline-flex items-center justify-center p-2 bg-blue-100 rounded-lg">
              <Brain className="h-8 w-8 text-blue-600 stroke-2" strokeLinejoin="round" />
            </span>
           Document Search & Analysis
          </h1>
          <p className="text-gray-600 mt-1">
            AI-powered search and document relationship visualization
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
       <TabsList className="grid w-full md:w-auto grid-cols-5 gap-2">
  <TabsTrigger
    value="documents-search"
    className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors
              data-[state=active]:bg-[#e0f2ff] data-[state=active]:border data-[state=active]:border-[#90caf9] data-[state=active]:text-blue-900"
  >
    <Search className="h-4 w-4" />
    Document Search
  </TabsTrigger>

  <TabsTrigger
    value="vector-search"
    className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors
              data-[state=active]:bg-[#e0f2ff] data-[state=active]:border data-[state=active]:border-[#90caf9] data-[state=active]:text-blue-900"
  >
    <Brain className="h-4 w-4" />
    Vector Search
  </TabsTrigger>

  <TabsTrigger
    value="graph"
    className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors
              data-[state=active]:bg-[#e0f2ff] data-[state=active]:border data-[state=active]:border-[#90caf9] data-[state=active]:text-blue-900"
  >
    <Network className="h-4 w-4" />
    Document Reference Graph
  </TabsTrigger>

  <TabsTrigger
    value="timeline"
    className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors
              data-[state=active]:bg-[#e0f2ff] data-[state=active]:border data-[state=active]:border-[#90caf9] data-[state=active]:text-blue-900"
  >
    <Calendar className="h-4 w-4" />
    Timeline View
  </TabsTrigger>

  <TabsTrigger
    value="analysis"
    className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors
              data-[state=active]:bg-[#e0f2ff] data-[state=active]:border data-[state=active]:border-[#90caf9] data-[state=active]:text-blue-900"
  >
    <Cpu className="h-4 w-4" />
    Document Analysis
  </TabsTrigger>
</TabsList>

        
        <TabsContent value="documents-search">
          <Card>
            <CardContent className="p-0">
              <iframe
                src="/document-search?embed=true&hideSidebar=true"
                className="w-full border-0"
                style={{ height: 'calc(100vh - 250px)', minHeight: '600px' }}
                title="Document Search"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vector-search">
          <Card>
            <CardContent className="p-0">
              <iframe
                src="/n8n-vector-search?embed=true&hideSidebar=true"
                className="w-full border-0"
                style={{ height: 'calc(100vh - 250px)', minHeight: '600px' }}
                title="N8N Vector Search"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="graph">
          <Card>
           {/*  <CardHeader>
              <CardTitle>Document Relationship Graph</CardTitle>
              <CardDescription>
                Visualizes reference relationships between documents
              </CardDescription>
            </CardHeader> */}
            <CardContent>
              <div className="space-y-4">
                {/* Search box: enter letter_no -> bring only the island where that document is located */}
                <div className="flex gap-2 items-center">
                  <Input
                    placeholder="Enter letter_no for island (e.g., IC-HQ-975)"
                    value={starQuery}
                    onChange={(e) => setStarQuery(e.target.value)}
                    className="w-full max-w-md"
                  />
                  <Button onClick={() => handleFindIsland(starQuery)} disabled={starLoading}>
                    {starLoading ? 'Finding...' : 'Show Island'}
                  </Button>
                  <Button 
                    variant="default" 
                    onClick={() => setShowAllDocsConfirm(true)} 
                    disabled={starLoading}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {starLoading ? 'Loading...' : 'Bring All Documents'}
                  </Button>
                  <Button variant="ghost" onClick={() => { setPreloadedStarMap(null); setStarQuery(''); }}>
                    Reset
                  </Button>
                </div>
                {starError && <div className="text-sm text-red-600">{starError}</div>}

                <GraphCustomizationProvider>
                  <DocumentGraph 
                    data={graphData || { nodes: [], edges: [] }}
                    onNodeClick={handleNodeClickWithModal}
                    initialActiveTab="previous"
                    openStarMap={!!preloadedStarMap && preloadedStarMap.nodes.length > 0}
                    preloadedStarMap={preloadedStarMap}
                    onAddToBasket={addToDocumentBasket}
                  />
                </GraphCustomizationProvider>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="star-map-top">
          <Card>            
            <CardContent>
              <div className="space-y-4">
                {/* Search box: enter letter_no -> bring only the island where that document is located */}
                <div className="flex gap-2 items-center">
                  <Input
                    placeholder="Enter letter_no for island (e.g., IC-HQ-975)"
                    value={starQuery}
                    onChange={(e) => setStarQuery(e.target.value)}
                    className="w-full max-w-md"
                  />
                  <Button onClick={() => handleFindIsland(starQuery)} disabled={starLoading}>
                    {starLoading ? 'Finding...' : 'Show Island'}
                  </Button>
                  <Button variant="ghost" onClick={() => { setPreloadedStarMap(null); setStarQuery(''); }}>
                    Reset
                  </Button>
                </div>
                {starError && <div className="text-sm text-red-600">{starError}</div>}
                 <GraphCustomizationProvider>
                   <DocumentGraph 
                     data={graphData || { nodes: [], edges: [] }}
                     onNodeClick={handleNodeClickWithModal}
                     initialActiveTab="star-map"
                     openStarMap={activeTab === 'star-map-top'}
                     preloadedStarMap={preloadedStarMap}
                     onAddToBasket={addToDocumentBasket}
                   />
                 </GraphCustomizationProvider>
               </div>
             </CardContent>
           </Card>
         </TabsContent>
        
        <TabsContent value="timeline">
          <Card>
            <CardContent>
              <div className="space-y-4">
                {/* Search box */}
                <div className="flex gap-2 items-center">
                  <Input
                    placeholder="Enter letter_no for timeline (e.g., IC-HQ-975)"
                    value={timelineQuery}
                    onChange={(e) => setTimelineQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleFindTimeline(timelineQuery);
                      }
                    }}
                    className="w-full max-w-md"
                  />
                  <Button onClick={() => handleFindTimeline(timelineQuery)} disabled={timelineLoading}>
                    {timelineLoading ? 'Loading...' : 'Show Timeline'}
                  </Button>
                  <Button variant="ghost" onClick={() => { 
                    setTimelineDocuments([]); 
                    setTimelineQuery(''); 
                    setTimelineError(null);
                  }}>
                    Reset
                  </Button>
                </div>
                {timelineError && <div className="text-sm text-red-600">{timelineError}</div>}

                {/* Timeline Visualization */}
                {timelineDocuments.length > 0 && (
                  <div className="mt-6 p-4 bg-gray-50 rounded-lg border">
                    <div className="mb-4 flex justify-between items-center">
                      <div className="text-sm text-gray-600">
                        Found {timelineDocuments.length} documents in timeline (Incoming: {incomingDocs.length}, Outgoing: {outgoingDocs.length})
                      </div>
                      {/* Zoom Controls */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-600">Zoom:</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setTimelineZoom(prev => Math.max(0.5, prev - 0.25))}
                          disabled={timelineZoom <= 0.5}
                        >
                          -
                        </Button>
                        <span className="text-xs font-medium w-12 text-center">{Math.round(timelineZoom * 100)}%</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setTimelineZoom(prev => Math.min(3, prev + 0.25))}
                          disabled={timelineZoom >= 3}
                        >
                          +
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setTimelineZoom(1)}
                        >
                          Reset
                        </Button>
                      </div>
                    </div>
                    
                    {/* Timeline Container - Horizontal scroll for all documents */}
                    <div 
                      ref={timelineContainerRef}
                      className="overflow-x-auto overflow-y-visible pb-4 border rounded-lg bg-white" 
                      style={{ 
                        overflowY: 'visible',
                        cursor: 'grab'
                      }}
                      onMouseDown={(e) => {
                        const container = timelineContainerRef.current;
                        if (!container) return;
                        
                        // Check if content is wider than container (needs scrolling)
                        const needsScroll = container.scrollWidth > container.clientWidth;
                        if (!needsScroll) return;
                        
                        const startX = e.pageX - container.offsetLeft;
                        const scrollLeft = container.scrollLeft;
                        
                        const handleMouseMove = (e: MouseEvent) => {
                          const x = e.pageX - container.offsetLeft;
                          const walk = (x - startX) * 2;
                          container.scrollLeft = scrollLeft - walk;
                        };
                        
                        const handleMouseUp = () => {
                          document.removeEventListener('mousemove', handleMouseMove);
                          document.removeEventListener('mouseup', handleMouseUp);
                          container.style.cursor = 'grab';
                        };
                        
                        container.style.cursor = 'grabbing';
                        document.addEventListener('mousemove', handleMouseMove);
                        document.addEventListener('mouseup', handleMouseUp);
                      }}
                    >
                      {(() => {
                        // BASIT VE NET TIMELINE KURGUSU
                        const NODE_SIZE = 6; // Timeline üzerindeki node boyutu
                        const INDICATOR_SIZE = 16; // Indikatör çemberi boyutu
                        const CONNECTOR_LENGTH = 60; // Node merkezinden indikatör merkezine mesafe
                        const LABEL_DISTANCE = 35; // Indikatörden tarih etiketine mesafe (incoming için arttırıldı)
                        
                        // Timeline node'ların merkezinden geçecek
                        const TIMELINE_CENTER_Y = 180; // Yukarı taşındı (150'den 180'e)
                        
                        // Yeşil (Incoming) pozisyonları - yukarıda
                        const GREEN_INDICATOR_CENTER_Y = TIMELINE_CENTER_Y - CONNECTOR_LENGTH;
                        const GREEN_INDICATOR_TOP_Y = GREEN_INDICATOR_CENTER_Y - (INDICATOR_SIZE / 2);
                        
                        // Kırmızı (Outgoing) pozisyonları - aşağıda
                        const RED_INDICATOR_CENTER_Y = TIMELINE_CENTER_Y + CONNECTOR_LENGTH;
                        const RED_INDICATOR_TOP_Y = RED_INDICATOR_CENTER_Y - (INDICATOR_SIZE / 2);
                        
                        const TOTAL_HEIGHT = 400; // Arttırıldı (350'den 400'e)
                        
                        // Calculate min width based on closer node spacing and zoom
                        const MIN_NODE_SPACING = 105; // Arttırıldı (80'den 105'e)
                        const BASE_MIN_WIDTH = Math.max(timelineDocuments.length * MIN_NODE_SPACING, 1200);
                        const MIN_WIDTH = BASE_MIN_WIDTH * timelineZoom;
                        
                        return (
                          <div className="relative" style={{ 
                            minWidth: `${MIN_WIDTH}px`, 
                            minHeight: `${TOTAL_HEIGHT}px`, 
                            paddingTop: '40px', // Arttırıldı (20'den 40'a)
                            paddingBottom: '20px',
                            transition: 'min-width 0.2s ease-out'
                          }}>
                            
                            {/* Header - Incoming */}
                            <div className="absolute left-0 right-0" style={{ top: '15px' }}> {/* Yukarı taşındı (10px'den 15px'e) */}
                              <div className="text-xs font-semibold text-green-700 uppercase text-center">
                                ↓ Incoming (Administration)
                              </div>
                            </div>
                            
                            {/* Timeline Line - Node'ların tam ortasından geçer */}
                            <div 
                              className="absolute left-0 right-0"
                              style={{ 
                                top: `${TIMELINE_CENTER_Y}px`,
                                height: '3px',
                                transform: 'translateY(-50%)'
                              }}
                            >
                              <div className="absolute left-0 right-0 h-full bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 rounded-full shadow-lg" />
                              
                              {/* Timeline Node'ları - her doküman için */}
                              {timelineDocuments.map((doc, index) => {
                                const firstDate = new Date(timelineDocuments[0].letter_date).getTime();
                                const lastDate = new Date(timelineDocuments[timelineDocuments.length - 1].letter_date).getTime();
                                const docDate = new Date(doc.letter_date).getTime();
                                const totalRange = lastDate - firstDate || 1;
                                const position = ((docDate - firstDate) / totalRange) * 94 + 3; // 94% range, 3% padding
                                
                                return (
                                  <div
                                    key={`node-${doc.id}`}
                                    className="absolute top-1/2"
                                    style={{ left: `${position}%`, transform: 'translate(-50%, -50%)' }}
                                  >
                                    <div 
                                      className="w-1.5 h-1.5 bg-white border-2 border-blue-600 rounded-full shadow-sm"
                                    />
                                  </div>
                                );
                              })}
                              
                              {/* Start/End markers */}
                              <div className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg z-10">
                                <div className="absolute left-1/2 -translate-x-1/2 text-[9px] font-semibold text-gray-700 whitespace-nowrap" style={{ top: '18px' }}>
                                  {formatDDMMYYYY(timelineDocuments[0].letter_date)}
                                </div>
                              </div>
                              <div className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg z-10">
                                <div className="absolute left-1/2 -translate-x-1/2 text-[9px] font-semibold text-gray-700 whitespace-nowrap" style={{ top: '18px' }}>
                                  {formatDDMMYYYY(timelineDocuments[timelineDocuments.length - 1].letter_date)}
                                </div>
                              </div>
                            </div>
                            
                            {/* Incoming (Yeşil) İndikatörler ve Bağlantılar */}
                            {incomingDocs.map((doc, index) => {
                              const firstDate = new Date(timelineDocuments[0].letter_date).getTime();
                              const lastDate = new Date(timelineDocuments[timelineDocuments.length - 1].letter_date).getTime();
                              const docDate = new Date(doc.letter_date).getTime();
                              const totalRange = lastDate - firstDate || 1;
                              const position = ((docDate - firstDate) / totalRange) * 94 + 3; // 94% range, 3% padding
                              
                              return (
                                <div key={`green-${doc.id}`}>
                                  {/* Bağlayıcı Çizgi - Node merkezinden indikatör merkezine */}
                                  <div 
                                    className="absolute w-0.5 bg-green-400"
                                    style={{ 
                                      left: `${position}%`,
                                      top: `${GREEN_INDICATOR_CENTER_Y}px`,
                                      height: `${CONNECTOR_LENGTH}px`,
                                      transform: 'translateX(-50%)'
                                    }}
                                  />
                                  
                                  {/* İndikatör Çemberi */}
                                  <div 
                                    className="absolute bg-green-500 border-2 border-green-700 rounded-full cursor-pointer hover:shadow-xl transition-all hover:scale-125 hover:z-50"
                                    style={{ 
                                      left: `${position}%`,
                                      top: `${GREEN_INDICATOR_TOP_Y}px`,
                                      width: `${INDICATOR_SIZE}px`,
                                      height: `${INDICATOR_SIZE}px`,
                                      transform: 'translateX(-50%)'
                                    }}
                                    onClick={() => handleNodeClickWithModal(doc.letter_no)}
                                    onMouseEnter={(e) => {
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      const pageX = rect.left + window.scrollX + rect.width / 2;
                                      const pageY = rect.top + window.scrollY - 10;
                                      
                                      const parts: string[] = [];
                                      if (doc.letter_date) parts.push(`Date: ${formatDDMMYYYY(doc.letter_date)}`);
                                      if (doc.ref_letters) parts.push(`References: ${doc.ref_letters}`);
                                      if (doc.short_desc) parts.push(`Description: ${doc.short_desc}`);
                                      if (doc.content) parts.push(`Content: ${String(doc.content).slice(0, 200)}${String(doc.content).length > 200 ? '...' : ''}`);
                                      
                                      setTimelineTooltip({
                                        visible: true,
                                        x: pageX,
                                        y: pageY,
                                        title: doc.letter_no,
                                        body: parts.join('\n\n'),
                                        nodeId: doc.letter_no,
                                        doc: doc
                                      });
                                    }}
                                    onMouseLeave={() => {
                                      if (timelineTooltipTimeoutRef.current) {
                                        clearTimeout(timelineTooltipTimeoutRef.current);
                                      }
                                      timelineTooltipTimeoutRef.current = setTimeout(() => {
                                        setTimelineTooltip(prev => ({ ...prev, visible: false }));
                                      }, 500);
                                    }}
                                  />
                                  
                                  {/* Tarih Etiketi - İndikatörden daha yukarıda */}
                                  <div 
                                    className="absolute text-[9px] font-bold text-green-900 whitespace-nowrap"
                                    style={{ 
                                      left: `${position}%`,
                                      top: `${GREEN_INDICATOR_TOP_Y - LABEL_DISTANCE - 5}px`, // Extra 5px yukarı
                                      transform: 'translateX(-50%) rotate(-90deg)',
                                      transformOrigin: 'center center'
                                    }}
                                  >
                                    {formatDDMMYYYY(doc.letter_date)}
                                  </div>
                                </div>
                              );
                            })}
                            
                            {/* Outgoing (Kırmızı) İndikatörler ve Bağlantılar */}
                            {outgoingDocs.map((doc, index) => {
                              const firstDate = new Date(timelineDocuments[0].letter_date).getTime();
                              const lastDate = new Date(timelineDocuments[timelineDocuments.length - 1].letter_date).getTime();
                              const docDate = new Date(doc.letter_date).getTime();
                              const totalRange = lastDate - firstDate || 1;
                              const position = ((docDate - firstDate) / totalRange) * 94 + 3; // 94% range, 3% padding
                              
                              return (
                                <div key={`red-${doc.id}`}>
                                  {/* Bağlayıcı Çizgi - Node merkezinden indikatör merkezine */}
                                  <div 
                                    className="absolute w-0.5 bg-red-400"
                                    style={{ 
                                      left: `${position}%`,
                                      top: `${TIMELINE_CENTER_Y}px`,
                                      height: `${CONNECTOR_LENGTH}px`,
                                      transform: 'translateX(-50%)'
                                    }}
                                  />
                                  
                                  {/* İndikatör Çemberi */}
                                  <div 
                                    className="absolute bg-red-500 border-2 border-red-700 rounded-full cursor-pointer hover:shadow-xl transition-all hover:scale-125 hover:z-50"
                                    style={{ 
                                      left: `${position}%`,
                                      top: `${RED_INDICATOR_TOP_Y}px`,
                                      width: `${INDICATOR_SIZE}px`,
                                      height: `${INDICATOR_SIZE}px`,
                                      transform: 'translateX(-50%)'
                                    }}
                                    onClick={() => handleNodeClickWithModal(doc.letter_no)}
                                    onMouseEnter={(e) => {
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      const pageX = rect.left + window.scrollX + rect.width / 2;
                                      const pageY = rect.top + window.scrollY + rect.height + 10;
                                      
                                      const parts: string[] = [];
                                      if (doc.letter_date) parts.push(`Date: ${formatDDMMYYYY(doc.letter_date)}`);
                                      if (doc.ref_letters) parts.push(`References: ${doc.ref_letters}`);
                                      if (doc.short_desc) parts.push(`Description: ${doc.short_desc}`);
                                      if (doc.content) parts.push(`Content: ${String(doc.content).slice(0, 200)}${String(doc.content).length > 200 ? '...' : ''}`);
                                      
                                      setTimelineTooltip({
                                        visible: true,
                                        x: pageX,
                                        y: pageY,
                                        title: doc.letter_no,
                                        body: parts.join('\n\n'),
                                        nodeId: doc.letter_no,
                                        doc: doc
                                      });
                                    }}
                                    onMouseLeave={() => {
                                      if (timelineTooltipTimeoutRef.current) {
                                        clearTimeout(timelineTooltipTimeoutRef.current);
                                      }
                                      timelineTooltipTimeoutRef.current = setTimeout(() => {
                                        setTimelineTooltip(prev => ({ ...prev, visible: false }));
                                      }, 500);
                                    }}
                                  />
                                  
                                  {/* Tarih Etiketi - İndikatörden uzakta */}
                                  <div 
                                    className="absolute text-[9px] font-bold text-red-900 whitespace-nowrap"
                                    style={{ 
                                      left: `${position}%`,
                                      top: `${RED_INDICATOR_TOP_Y + INDICATOR_SIZE + LABEL_DISTANCE}px`,
                                      transform: 'translateX(-50%) rotate(-90deg)',
                                      transformOrigin: 'center center'
                                    }}
                                  >
                                    {formatDDMMYYYY(doc.letter_date)}
                                  </div>
                                </div>
                              );
                            })}
                            
                            {/* Duration Indicators - Show gaps > 10 days between consecutive documents */}
                            {timelineDocuments.map((doc, index) => {
                              if (index === 0) return null; // Skip first document
                              
                              const prevDoc = timelineDocuments[index - 1];
                              const currentDate = new Date(doc.letter_date).getTime();
                              const prevDate = new Date(prevDoc.letter_date).getTime();
                              const daysDiff = Math.round((currentDate - prevDate) / (1000 * 60 * 60 * 24));
                              
                              // Only show if gap is more than 10 days
                              if (daysDiff <= 10) return null;
                              
                              // Calculate position between the two documents
                              const firstDate = new Date(timelineDocuments[0].letter_date).getTime();
                              const lastDate = new Date(timelineDocuments[timelineDocuments.length - 1].letter_date).getTime();
                              const totalRange = lastDate - firstDate || 1;
                              
                              const prevPosition = ((prevDate - firstDate) / totalRange) * 94 + 3;
                              const currentPosition = ((currentDate - firstDate) / totalRange) * 94 + 3;
                              const midPosition = (prevPosition + currentPosition) / 2;
                              
                              return (
                                <div key={`duration-${doc.id}`}>
                                  {/* Duration Badge */}
                                  <div 
                                    className="absolute bg-orange-500 text-white rounded-full px-2 py-1 text-[10px] font-bold shadow-md cursor-help"
                                    style={{ 
                                      left: `${midPosition}%`,
                                      top: `${TIMELINE_CENTER_Y + 12}px`,
                                      transform: 'translateX(-50%)',
                                      zIndex: 20
                                    }}
                                    title={`${daysDiff} days gap between ${prevDoc.letter_no} and ${doc.letter_no}`}
                                  >
                                    {daysDiff}d
                                  </div>
                                  
                                  {/* Warning Line - highlight the gap on timeline */}
                                  <div 
                                    className="absolute h-1 bg-orange-300 opacity-50"
                                    style={{ 
                                      left: `${prevPosition}%`,
                                      width: `${currentPosition - prevPosition}%`,
                                      top: `${TIMELINE_CENTER_Y - 2}px`,
                                      zIndex: 5
                                    }}
                                  />
                                </div>
                              );
                            })}
                            
                            {/* Header - Outgoing */}
                            <div className="absolute left-0 right-0" style={{ top: `${TOTAL_HEIGHT - 40}px` }}>
                              <div className="text-xs font-semibold text-red-700 uppercase text-center">
                                ↑ Outgoing (Gorkem)
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                    
                    {/* Legend */}
                    <div className="mt-4 flex items-center justify-center gap-6 text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                        <span>Incoming Letters</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                        <span>Outgoing Letters</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-blue-500 rounded-full border-2 border-white"></div>
                        <span>Timeline Marker</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-orange-500 rounded-full"></div>
                        <span>Gap &gt; 10 days</span>
                      </div>
                    </div>

                    {/* Document List Table - Moved below timeline */}
                    <div className="mt-6">
                      <div className="text-sm font-medium text-gray-700 mb-2">Timeline documents (full list)</div>
                      <div className="overflow-x-auto bg-white rounded border" style={{ maxHeight: 400 }}>
                        <table className="w-full text-xs">
                          <thead className="sticky top-0 bg-gray-50">
                            <tr className="text-left text-gray-600">
                              <th className="px-2 py-1 border-b">#</th>
                              <th className="px-2 py-1 border-b">Document No</th>
                              <th className="px-2 py-1 border-b">Date</th>
                              <th className="px-2 py-1 border-b">Type</th>
                              <th className="px-2 py-1 border-b">Refs</th>
                              <th className="px-2 py-1 border-b">Short Desc</th>
                              <th className="px-2 py-1 border-b text-center">Preview</th>
                              <th className="px-2 py-1 border-b">URL</th>
                            </tr>
                          </thead>
                          <tbody>
                            {timelineDocuments.map((d, i) => (
                              <tr key={d.id || `${d.letter_no}-${i}`} className="border-t hover:bg-gray-50">
                                <td className="px-2 py-1 align-top">{i + 1}</td>
                                <td className="px-2 py-1 align-top font-medium">{d.letter_no || '-'}</td>
                                <td className="px-2 py-1 align-top">{d.letter_date ? formatDDMMYYYY(d.letter_date) : '-'}</td>
                                <td className="px-2 py-1 align-top">
                                  {(() => {
                                    const incOut = String(d.inc_out || '').toLowerCase().trim();
                                    if (incOut === 'inc' || incOut === 'incoming' || incOut === 'in' || incOut === 'gelen') {
                                      return (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                          Inc
                                        </span>
                                      );
                                    } else if (incOut === 'out' || incOut === 'outgoing' || incOut === 'ex' || incOut === 'giden') {
                                      return (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                                          Out
                                        </span>
                                      );
                                    } else {
                                      return '-';
                                    }
                                  })()}
                                </td>
                                <td className="px-2 py-1 align-top truncate" style={{ maxWidth: 200 }} title={d.ref_letters || ''}>{d.ref_letters || '-'}</td>
                                <td className="px-2 py-1 align-top truncate" style={{ maxWidth: 240 }} title={d.short_desc || ''}>{d.short_desc || '-'}</td>
                                <td className="px-2 py-1 align-top text-center">
                                  <button
                                    type="button"
                                    onClick={() => handlePreviewDocument(d.id, d.letter_no)}
                                    title="Preview Content"
                                    style={{ 
                                      border: 'none', 
                                      background: 'transparent', 
                                      cursor: 'pointer',
                                      padding: '4px'
                                    }}
                                  >
                                    <Eye className="w-4 h-4" style={{ color: '#0b5cff' }} />
                                  </button>
                                </td>
                                <td className="px-2 py-1 align-top">
                                  {d.weburl ? (
                                    <a href={d.weburl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Open</a>
                                  ) : ('-')}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* Empty state */}
                {timelineDocuments.length === 0 && !timelineLoading && !timelineError && (
                  <div className="text-center py-12 text-gray-500">
                    <Calendar className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                    <p>Enter a letter number to view its timeline</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analysis">
          <Card>
            <CardHeader>
              <CardTitle>Document Analysis</CardTitle>
              <CardDescription>
                Analyze selected documents
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* API Connection Status */}
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border">
                  {hasValidApis ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                      <span className="text-sm text-gray-700">
                        API connection active 
                        {config?.apis.openai && <span className="text-xs text-gray-500 ml-1">(OpenAI)</span>}
                        {config?.apis.deepseek && <span className="text-xs text-gray-500 ml-1">(DeepSeek)</span>}
                      </span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-5 h-5 text-red-600" />
                      <span className="text-sm text-gray-700">
                        No API connection - Please add API key from settings
                      </span>
                    </>
                  )}
                </div>

                {/* Analyze button */}
                <div className="flex justify-between items-center">
                  <div className="text-sm text-gray-600">
                    {selectedDocuments.size} documents selected
                  </div>
                  <Button 
                    onClick={() => setShowAnalysisModal(true)}
                    disabled={selectedDocuments.size === 0 || !hasValidApis || isAnalyzing}
                  >
                    <Brain className="w-4 h-4 mr-2" />
                    {isAnalyzing ? 'Analyzing...' : `Analyze (${selectedDocuments.size})`}
                  </Button>
                </div>

                {/* Document table */}
                {documentBasket.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No documents added yet. Hover over nodes in graphs and click 'Send To Analysis Page' button to add documents.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-300">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="border border-gray-300 px-4 py-2 text-left">
                            <input
                              type="checkbox"
                              checked={selectedDocuments.size === documentBasket.length && documentBasket.length > 0}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedDocuments(new Set(documentBasket.map(doc => doc.id)));
                                } else {
                                  setSelectedDocuments(new Set());
                                }
                              }}
                              className="rounded"
                            />
                          </th>
                          <th className="border border-gray-300 px-4 py-2 text-center">Type</th>
                          <th className="border border-gray-300 px-4 py-2 text-left">Document No</th>
                          <th className="border border-gray-300 px-4 py-2 text-left">Date</th>
                          <th className="border border-gray-300 px-4 py-2 text-left">References</th>
                          <th className="border border-gray-300 px-4 py-2 text-left">Description</th>
                          <th className="border border-gray-300 px-4 py-2 text-center">Preview</th>
                          <th className="border border-gray-300 px-4 py-2 text-center">Document</th>
                          <th className="border border-gray-300 px-4 py-2 text-left">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {documentBasket.map((doc) => (
                          <tr key={doc.id} className="hover:bg-gray-50">
                            <td className="border border-gray-300 px-4 py-2">
                              <input
                                type="checkbox"
                                checked={selectedDocuments.has(doc.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedDocuments(prev => new Set([...prev, doc.id]));
                                  } else {
                                    setSelectedDocuments(prev => {
                                      const newSet = new Set(prev);
                                      newSet.delete(doc.id);
                                      return newSet;
                                    });
                                  }
                                }}
                                className="rounded"
                              />
                            </td>
                            <td className="border border-gray-300 px-4 py-2 text-center">
                              {(() => {
                                const incOut = String(doc.inc_out || '').toLowerCase().trim();
                                if (incOut === 'incoming' || incOut === 'gelen' || incOut === 'inc' || incOut === 'in') {
                                  return (
                                    <Badge className="bg-green-500 text-white hover:bg-green-600">
                                      Incoming
                                    </Badge>
                                  );
                                } else if (incOut === 'outgoing' || incOut === 'giden' || incOut === 'out' || incOut === 'ex') {
                                  return (
                                    <Badge className="bg-red-500 text-white hover:bg-red-600">
                                      Outgoing
                                    </Badge>
                                  );
                                } else {
                                  return (
                                    <Badge variant="secondary">
                                      -
                                    </Badge>
                                  );
                                }
                              })()}
                            </td>
                            <td className="border border-gray-300 px-4 py-2">{doc.letter_no}</td>
                            <td className="border border-gray-300 px-4 py-2">{doc.letter_date || '-'}</td>
                            <td className="border border-gray-300 px-4 py-2">{doc.ref_letters || '-'}</td>
                            <td className="border border-gray-300 px-4 py-2">{doc.short_desc || '-'}</td>
                            <td className="border border-gray-300 px-4 py-2 text-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handlePreviewDocument(doc.id, doc.letter_no)}
                                className="text-blue-600 hover:text-blue-800"
                                title="Preview document content"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            </td>
                            <td className="border border-gray-300 px-4 py-2 text-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenDocument(doc.weburl)}
                                disabled={!doc.weburl}
                                className="text-green-600 hover:text-green-800 disabled:text-gray-400"
                                title={doc.weburl ? "Open Document" : "URL not found"}
                              >
                                <FileText className="w-4 h-4" />
                              </Button>
                            </td>
                            <td className="border border-gray-300 px-4 py-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeFromDocumentBasket(doc.id)}
                                className="text-red-600 hover:text-red-800"
                              >
                                ✕
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Analysis Results Section */}
                {analysisResults.length > 0 && (
                  <div className="mt-8 space-y-4">
                    {/* Token Usage Display */}
                    {(tokenUsage.chatgpt || tokenUsage.deepseek) && (
                      <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
                        <div className="flex items-center gap-2 mb-3">
                          <CircuitBoard className="w-5 h-5 text-blue-600" />
                          <h4 className="font-semibold text-gray-900">Token Usage Summary</h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {tokenUsage.chatgpt && (
                            <div className="bg-white rounded-lg p-3 border border-blue-200">
                              <div className="flex items-center gap-2 mb-2">
                                <Brain className="w-4 h-4 text-blue-600" />
                                <span className="font-medium text-sm text-blue-900">ChatGPT ({analysisOptions.chatgptModel})</span>
                              </div>
                              <div className="space-y-1 text-xs text-gray-700">
                                <div className="flex justify-between">
                                  <span>Input tokens:</span>
                                  <span className="font-mono font-medium">{tokenUsage.chatgpt.prompt.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Output tokens:</span>
                                  <span className="font-mono font-medium">{tokenUsage.chatgpt.completion.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between pt-1 border-t border-blue-200">
                                  <span className="font-medium">Total:</span>
                                  <span className="font-mono font-bold text-blue-700">{tokenUsage.chatgpt.total.toLocaleString()}</span>
                                </div>
                                <div className="pt-1 text-[10px] text-gray-500">
                                  {analysisOptions.chatgptModel === 'gpt-4o-mini' && '≈ 1x cost'}
                                  {analysisOptions.chatgptModel === 'gpt-4o' && '≈ 15x cost vs mini'}
                                  {analysisOptions.chatgptModel === 'gpt-4-turbo' && '≈ 30x cost vs mini'}
                                  {analysisOptions.chatgptModel === 'gpt-3.5-turbo' && '≈ 0.3x cost vs mini'}
                                </div>
                              </div>
                            </div>
                          )}
                          {tokenUsage.deepseek && (
                            <div className="bg-white rounded-lg p-3 border border-purple-200">
                              <div className="flex items-center gap-2 mb-2">
                                <Sparkles className="w-4 h-4 text-purple-600" />
                                <span className="font-medium text-sm text-purple-900">DeepSeek</span>
                              </div>
                              <div className="space-y-1 text-xs text-gray-700">
                                <div className="flex justify-between">
                                  <span>Input tokens:</span>
                                  <span className="font-mono font-medium">{tokenUsage.deepseek.prompt.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Output tokens:</span>
                                  <span className="font-mono font-medium">{tokenUsage.deepseek.completion.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between pt-1 border-t border-purple-200">
                                  <span className="font-medium">Total:</span>
                                  <span className="font-mono font-bold text-purple-700">{tokenUsage.deepseek.total.toLocaleString()}</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-semibold">Analysis Results</h3>
                      <Button 
                        onClick={handleGenerateDraft}
                        disabled={selectedForDraft.size === 0}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        Generate Draft Response ({selectedForDraft.size})
                      </Button>
                    </div>

                    {/* Analysis Cards */}
                    <div className="space-y-4">
                      {analysisResults.map((result) => (
                        <Card key={result.id} className="border-2">
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-3">
                                <input
                                  type="checkbox"
                                  checked={selectedForDraft.has(result.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedForDraft(prev => new Set([...prev, result.id]));
                                    } else {
                                      setSelectedForDraft(prev => {
                                        const newSet = new Set(prev);
                                        newSet.delete(result.id);
                                        return newSet;
                                      });
                                    }
                                  }}
                                  className="mt-1 rounded"
                                />
                                <div>
                                  <CardTitle className="text-base">{result.letter_no}</CardTitle>
                                  <CardDescription className="text-sm">
                                    {result.letter_date} • {result.short_desc}
                                  </CardDescription>
                                </div>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-6">
                            {/* ChatGPT Analysis */}
                            {result.chatgptAnalysis && (
                              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                                <div className="flex items-center gap-2 mb-3">
                                  <Brain className="w-5 h-5 text-blue-600" />
                                  <h4 className="font-semibold text-blue-900">ChatGPT Analysis</h4>
                                </div>
                                
                                <div className="space-y-3 text-sm">
                                  <div>
                                    <span className="font-medium text-gray-700">Summary:</span>
                                    <p className="mt-1 text-gray-800">{result.chatgptAnalysis.summary}</p>
                                  </div>
                                  
                                  <div>
                                    <span className="font-medium text-gray-700">Request:</span>
                                    <p className="mt-1 text-gray-800">{result.chatgptAnalysis.request}</p>
                                  </div>
                                  
                                  <div className="flex gap-4">
                                    <div>
                                      <span className="font-medium text-gray-700">Deadline:</span>
                                      <span className="ml-2 text-gray-800">{result.chatgptAnalysis.deadline || 'None'}</span>
                                    </div>
                                    <div>
                                      <span className="font-medium text-gray-700">Importance:</span>
                                      <Badge className={`ml-2 ${
                                        result.chatgptAnalysis.importance === 'High' ? 'bg-red-500' :
                                        result.chatgptAnalysis.importance === 'Medium' ? 'bg-yellow-500' : 'bg-green-500'
                                      }`}>
                                        {result.chatgptAnalysis.importance}
                                      </Badge>
                                    </div>
                                    <div>
                                      <span className="font-medium text-gray-700">Relevance:</span>
                                      <Badge className={`ml-2 ${
                                        result.chatgptAnalysis.relevance === 'High' ? 'bg-green-500' :
                                        result.chatgptAnalysis.relevance === 'Medium' ? 'bg-yellow-500' :
                                        result.chatgptAnalysis.relevance === 'Low' ? 'bg-orange-500' : 'bg-red-500'
                                      }`}>
                                        {result.chatgptAnalysis.relevance}
                                      </Badge>
                                    </div>
                                  </div>
                                  
                                  {result.chatgptAnalysis.relevanceNote && (
                                    <div className="p-2 bg-orange-50 border border-orange-200 rounded">
                                      <span className="font-medium text-orange-700">⚠️ Relevance Note:</span>
                                      <p className="mt-1 text-orange-800 text-xs">{result.chatgptAnalysis.relevanceNote}</p>
                                    </div>
                                  )}
                                  
                                  <div>
                                    <span className="font-medium text-gray-700">Recommended Actions:</span>
                                    <ul className="mt-2 space-y-1 list-disc list-inside text-gray-800">
                                      {result.chatgptAnalysis.actions.map((action, idx) => (
                                        <li key={idx}>{action}</li>
                                      ))}
                                    </ul>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* DeepSeek Analysis */}
                            {result.deepseekAnalysis && (
                              <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                                <div className="flex items-center gap-2 mb-3">
                                  <Sparkles className="w-5 h-5 text-purple-600" />
                                  <h4 className="font-semibold text-purple-900">DeepSeek Analysis</h4>
                                </div>
                                
                                <div className="space-y-3 text-sm">
                                  <div>
                                    <span className="font-medium text-gray-700">Summary:</span>
                                    <p className="mt-1 text-gray-800">{result.deepseekAnalysis.summary}</p>
                                  </div>
                                  
                                  <div>
                                    <span className="font-medium text-gray-700">Request:</span>
                                    <p className="mt-1 text-gray-800">{result.deepseekAnalysis.request}</p>
                                  </div>
                                  
                                  <div className="flex gap-4">
                                    <div>
                                      <span className="font-medium text-gray-700">Deadline:</span>
                                      <span className="ml-2 text-gray-800">{result.deepseekAnalysis.deadline || 'None'}</span>
                                    </div>
                                    <div>
                                      <span className="font-medium text-gray-700">Importance:</span>
                                      <Badge className={`ml-2 ${
                                        result.deepseekAnalysis.importance === 'High' ? 'bg-red-500' :
                                        result.deepseekAnalysis.importance === 'Medium' ? 'bg-yellow-500' : 'bg-green-500'
                                      }`}>
                                        {result.deepseekAnalysis.importance}
                                      </Badge>
                                    </div>
                                    <div>
                                      <span className="font-medium text-gray-700">Relevance:</span>
                                      <Badge className={`ml-2 ${
                                        result.deepseekAnalysis.relevance === 'High' ? 'bg-green-500' :
                                        result.deepseekAnalysis.relevance === 'Medium' ? 'bg-yellow-500' :
                                        result.deepseekAnalysis.relevance === 'Low' ? 'bg-orange-500' : 'bg-red-500'
                                      }`}>
                                        {result.deepseekAnalysis.relevance}
                                      </Badge>
                                    </div>
                                  </div>
                                  
                                  {result.deepseekAnalysis.relevanceNote && (
                                    <div className="p-2 bg-orange-50 border border-orange-200 rounded">
                                      <span className="font-medium text-orange-700">⚠️ Relevance Note:</span>
                                      <p className="mt-1 text-orange-800 text-xs">{result.deepseekAnalysis.relevanceNote}</p>
                                    </div>
                                  )}
                                  
                                  <div>
                                    <span className="font-medium text-gray-700">Recommended Actions:</span>
                                    <ul className="mt-2 space-y-1 list-disc list-inside text-gray-800">
                                      {result.deepseekAnalysis.actions.map((action, idx) => (
                                        <li key={idx}>{action}</li>
                                      ))}
                                    </ul>
                                  </div>
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Analysis Options Modal */}
      <Dialog open={showAnalysisModal} onOpenChange={setShowAnalysisModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Analysis Options</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-3">
              {/* ChatGPT Section */}
              <div className="border rounded-lg p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Brain className="w-5 h-5 text-blue-600" />
                    <div>
                      <div className="font-medium">ChatGPT (OpenAI)</div>
                      <div className="text-xs text-gray-500">Select model for analysis</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={analysisOptions.useChatGPT}
                    onChange={(e) => setAnalysisOptions(prev => ({ ...prev, useChatGPT: e.target.checked }))}
                    disabled={!config?.apis?.openai}
                    className="w-5 h-5 rounded"
                  />
                </div>
                
                {/* ChatGPT Model Selection */}
                {analysisOptions.useChatGPT && (
                  <div className="space-y-2 ml-8 pt-2 border-t">
                    <div className="text-xs font-medium text-gray-700">Select Model:</div>
                    <div className="space-y-1.5">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="chatgptModel"
                          value="gpt-4o-mini"
                          checked={analysisOptions.chatgptModel === 'gpt-4o-mini'}
                          onChange={(e) => setAnalysisOptions(prev => ({ ...prev, chatgptModel: e.target.value as any }))}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">GPT-4o Mini <span className="text-xs text-gray-500">(Fast, ~1x cost)</span></span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="chatgptModel"
                          value="gpt-4o"
                          checked={analysisOptions.chatgptModel === 'gpt-4o'}
                          onChange={(e) => setAnalysisOptions(prev => ({ ...prev, chatgptModel: e.target.value as any }))}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">GPT-4o <span className="text-xs text-gray-500">(Better, ~15x cost)</span></span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="chatgptModel"
                          value="gpt-4-turbo"
                          checked={analysisOptions.chatgptModel === 'gpt-4-turbo'}
                          onChange={(e) => setAnalysisOptions(prev => ({ ...prev, chatgptModel: e.target.value as any }))}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">GPT-4 Turbo <span className="text-xs text-gray-500">(Advanced, ~30x cost)</span></span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="chatgptModel"
                          value="gpt-3.5-turbo"
                          checked={analysisOptions.chatgptModel === 'gpt-3.5-turbo'}
                          onChange={(e) => setAnalysisOptions(prev => ({ ...prev, chatgptModel: e.target.value as any }))}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">GPT-3.5 Turbo <span className="text-xs text-gray-500">(Cheapest, ~0.3x cost)</span></span>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* DeepSeek Section */}
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-purple-600" />
                  <div>
                    <div className="font-medium">DeepSeek</div>
                    <div className="text-xs text-gray-500">DeepSeek-Chat model</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={analysisOptions.useDeepSeek}
                  onChange={(e) => setAnalysisOptions(prev => ({ ...prev, useDeepSeek: e.target.checked }))}
                  disabled={!config?.apis?.deepseek}
                  className="w-5 h-5 rounded"
                />
              </div>
            </div>

            <div className="text-xs text-gray-500 p-3 bg-gray-50 rounded">
              <p><strong>Note:</strong> Select one or both AI services for analysis. Each document will be analyzed separately, and relationships between documents will be evaluated.</p>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowAnalysisModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleComprehensiveAnalysis} disabled={!analysisOptions.useChatGPT && !analysisOptions.useDeepSeek}>
                <Brain className="w-4 h-4 mr-2" />
                Start Analysis
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Document Detail Modal */}
      <Dialog open={showDocumentModal} onOpenChange={setShowDocumentModal}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Document Details</DialogTitle>
          </DialogHeader>
          {selectedDocument && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold">Document No:</label>
                  <p>{selectedDocument.letter_no || '-'}</p>
                </div>
                <div>
                  <label className="font-semibold">Date:</label>
                  <p>{selectedDocument.letter_date || '-'}</p>
                </div>
                <div>
                  <label className="font-semibold">References:</label>
                  <p>{selectedDocument.ref_letters || '-'}</p>
                </div>
                <div>
                  <label className="font-semibold">Severity Level:</label>
                  <p>{selectedDocument.severity_rate || '-'}</p>
                </div>
                <div>
                  <label className="font-semibold">Correspondence Type:</label>
                  <p>{selectedDocument.type_of_corr || '-'}</p>
                </div>
                <div>
                  <label className="font-semibold">Incoming/Outgoing:</label>
                  <p>{selectedDocument.incout || '-'}</p>
                </div>
              </div>
              
              <div>
                <label className="font-semibold">Short Description:</label>
                <p className="mt-1">{selectedDocument.short_desc || '-'}</p>
              </div>
              
              <div>
                <label className="font-semibold">Content:</label>
                <div className="mt-1 p-3 bg-gray-50 rounded max-h-40 overflow-y-auto">
                  {selectedDocument.content || 'Content not found'}
                </div>
              </div>
              
              <div>
                <label className="font-semibold">Keywords:</label>
                <p className="mt-1">{selectedDocument.keywords || '-'}</p>
              </div>
              
              {selectedDocument.weburl && (
                <div>
                  <label className="font-semibold">Web URL:</label>
                  <a 
                    href={selectedDocument.weburl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline ml-2"
                  >
                    {selectedDocument.weburl}
                  </a>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Document Preview Modal */}
      <Dialog open={showPreviewModal} onOpenChange={setShowPreviewModal}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Document Content</DialogTitle>
          </DialogHeader>
          {previewContent && (
            <div className="flex-1 overflow-hidden flex flex-col">
              {/* Header with document info */}
              <div className="flex-shrink-0 pb-4 mb-4 border-b-2 border-gray-200">
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'flex-start'
                }}>
                  <div style={{ flex: 1 }}>
                    <div className="space-y-2">
                      <div>
                        <strong className="text-gray-900 text-base">Letter No:</strong>{' '}
                        <span className="text-gray-700">{previewContent.letter_no || '-'}</span>
                      </div>
                      <div>
                        <strong className="text-gray-900 text-sm">Letter Date:</strong>{' '}
                        <span className="text-gray-700 text-sm">
                          {previewContent.letter_date ? new Date(previewContent.letter_date).toLocaleDateString('en-GB') : '-'}
                        </span>
                      </div>
                      <div>
                        <strong className="text-gray-900 text-sm">Reference Letters:</strong>{' '}
                        <span className="text-gray-700 text-sm">{previewContent.ref_letters || '-'}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      // Add to document basket
                      if (previewContent.letter_no) {
                        addToDocumentBasket(previewContent.letter_no);
                        setShowPreviewModal(false);
                      }
                    }}
                    style={{
                      background: '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: 6,
                      padding: '8px 16px',
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: 'pointer',
                      marginLeft: 16,
                      flexShrink: 0,
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#059669'}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#10b981'}
                  >
                    + Send To Analysis Page
                  </button>
                </div>
              </div>
              
              {/* Content - scrollable */}
              <div className="flex-1 overflow-y-auto bg-gray-50 rounded-lg p-4">
                <div className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">
                  {previewContent.content}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog for Bring All Documents */}
      <AlertDialog open={showAllDocsConfirm} onOpenChange={setShowAllDocsConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Load All Documents?</AlertDialogTitle>
            <AlertDialogDescription>
              This operation will load all documents from the database and may take up to 2 minutes to complete.
              <br /><br />
              The network graph may become very large and could affect performance.
              <br /><br />
              Do you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No</AlertDialogCancel>
            <AlertDialogAction onClick={handleBringAllDocuments}>Yes, Load All Documents</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Timeline Tooltip - Same style as Document Graph */}
      {timelineTooltip.visible && (
        <div
          role="tooltip"
          onMouseEnter={() => {
            // Cancel hide timeout when mouse enters tooltip
            if (timelineTooltipTimeoutRef.current) {
              clearTimeout(timelineTooltipTimeoutRef.current);
              timelineTooltipTimeoutRef.current = null;
            }
          }}
          onMouseLeave={() => {
            // Hide immediately when leaving tooltip
            setTimelineTooltip(prev => ({ ...prev, visible: false }));
          }}
          style={{
            position: 'fixed',
            top: timelineTooltip.y,
            left: timelineTooltip.x,
            zIndex: 2000,
            background: 'white',
            padding: '12px',
            borderRadius: 8,
            boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
            maxWidth: 420,
            fontSize: 13,
            color: '#0f172a',
            whiteSpace: 'pre-wrap',
            pointerEvents: 'auto',
            transform: 'translateX(-50%)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ fontWeight: 700, flex: 1 }}>{timelineTooltip.title}</div>
            {timelineTooltip.nodeId && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  addToDocumentBasket(timelineTooltip.nodeId!);
                  setTimelineTooltip(prev => ({ ...prev, visible: false }));
                }}
                style={{
                  background: timelineTooltip.doc?.inc_out === 'inc' ? '#10b981' : '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  padding: '4px 12px',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  marginLeft: 8,
                  flexShrink: 0,
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = timelineTooltip.doc?.inc_out === 'inc' ? '#059669' : '#dc2626'}
                onMouseLeave={(e) => e.currentTarget.style.background = timelineTooltip.doc?.inc_out === 'inc' ? '#10b981' : '#ef4444'}
              >
                + Send To Analysis Page
              </button>
            )}
          </div>
          <div style={{ lineHeight: 1.4 }}>{timelineTooltip.body}</div>
        </div>
      )}

      {/* Confirmation Dialog for Bring All Documents */}
      <AlertDialog open={showAllDocsConfirm} onOpenChange={setShowAllDocsConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Load All Documents?</AlertDialogTitle>
            <AlertDialogDescription>
              This operation will load all documents from the database and may take up to 2 minutes to complete.
              <br /><br />
              The network graph may become very large and could affect performance.
              <br /><br />
              Do you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No</AlertDialogCancel>
            <AlertDialogAction onClick={handleBringAllDocuments}>Yes, Load All Documents</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}