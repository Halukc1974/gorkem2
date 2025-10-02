import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Checkbox } from '../components/ui/checkbox';
import { Alert, AlertDescription } from '../components/ui/alert';
import { useToast } from '../hooks/use-toast';
import { Brain, Search, FileText, Plus, X, Loader2, Reply, AlertTriangle, FileDown, Printer, Download } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Textarea } from '../components/ui/textarea';

import { useUserSettingsLegacy } from "../hooks/useUserSettings";
import { useDocumentSearch } from "../hooks/useDocumentSearch";

// Services
import { decisionSupportService, CorrespondenceMetadata, SearchFilters } from '../services/decision-support';
import { supabaseService } from '../services/supabase';

const DecisionSupportTemplate: React.FC = () => {
  // Search and data states
  const [correspondenceData, setCorrespondenceData] = useState<CorrespondenceMetadata[]>([]);
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({
    query: '',
    type_of_corr: '',
    inc_out: 'all',
    severity_rate: 'all'
  });
  const [isLoading, setIsLoading] = useState(false);

  // Tab and configuration states
  const [activeTab, setActiveTab] = useState('correspondence');
  const [isConfigured, setIsConfigured] = useState(false);
  const [useVectorSearch, setUseVectorSearch] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedCorrespondence, setSelectedCorrespondence] = useState<CorrespondenceMetadata | null>(null);

  // Correspondence basket (sepet) states
  const [correspondenceBasket, setCorrespondenceBasket] = useState<CorrespondenceMetadata[]>([]);
  const [selectedForResponse, setSelectedForResponse] = useState<CorrespondenceMetadata | null>(null);
  const [referenceDocuments, setReferenceDocuments] = useState<CorrespondenceMetadata[]>([]);

  // AI Analysis states
  const [basketSummaries, setBasketSummaries] = useState<Array<{
    id: string;
    title: string;
    summary: string;
    keyPoints: string[];
    riskLevel: string;
  }>>([]);
  const [referenceSummaries, setReferenceSummaries] = useState<Array<{
    id: string;
    title: string;
    summary: string;
    keyPoints: string[];
    riskLevel: string;
  }>>([]);
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());
  const [isGeneratingSummaries, setIsGeneratingSummaries] = useState(false);

  // Selected documents analysis state
  const [selectedDocumentsAnalysis, setSelectedDocumentsAnalysis] = useState<{
    selectedDocuments: string[];
    basketItems: CorrespondenceMetadata[];
    referenceItems: CorrespondenceMetadata[];
    analysis: any;
    generatedAt: string;
  } | null>(null);

  // Response letter generation states
  const [isResponseLetterModalOpen, setIsResponseLetterModalOpen] = useState(false);
  const [isResponseLetterResultModalOpen, setIsResponseLetterResultModalOpen] = useState(false);
  const [responseLetterInstruction, setResponseLetterInstruction] = useState('');
  const [isGeneratingResponseLetter, setIsGeneratingResponseLetter] = useState(false);
  const [generatedResponseLetter, setGeneratedResponseLetter] = useState<{
    content: string;
    generatedAt: string;
    instruction: string;
  } | null>(null);

  // OpenAI connection status
  const [openaiConnectionStatus, setOpenaiConnectionStatus] = useState<{
    isConnected: boolean;
    isChecking: boolean;
    lastChecked: string | null;
    error: string | null;
  }>({
    isConnected: false,
    isChecking: false,
    lastChecked: null,
    error: null
  });

  const { settings, isLoading: settingsLoading } = useUserSettingsLegacy();
  const { configureServices } = useDocumentSearch();
  const { toast } = useToast();

  // Configure Supabase using global config
  useEffect(() => {
    if (settings?.supabase?.url && settings?.supabase?.anonKey) {
      try {
        configureServices({ supabase: settings.supabase });
  setIsConfigured(true);
  console.log('✅ Decision support: Supabase configuration loaded (global config)');
      } catch (error) {
  console.error('❌ Decision support: Supabase configuration failed:', error);
        setIsConfigured(false);
      }
    } else {
  console.warn('⚠️ Decision support: No valid Supabase configuration found');
      setIsConfigured(false);
    }
  }, [settings, configureServices]);

  // AI analiz sekmesine geçtiğinde OpenAI bağlantısını otomatik kontrol et
  useEffect(() => {
    if (activeTab === 'analysis' && settings?.openai?.apiKey && !openaiConnectionStatus.isConnected && !openaiConnectionStatus.isChecking) {
      console.log('🔄 AI analysis tab activated, checking OpenAI connection...');
      checkOpenAIConnection();
    }
  }, [activeTab, settings?.openai?.apiKey]);

  // OpenAI bağlantısını kontrol eden fonksiyon
  const checkOpenAIConnection = async () => {
    if (!settings?.openai?.apiKey) {
      setOpenaiConnectionStatus({
        isConnected: false,
        isChecking: false,
        lastChecked: new Date().toISOString(),
        error: "OpenAI API key not found. Please enter your API key in Settings."
      });
      return;
    }

    setOpenaiConnectionStatus(prev => ({ ...prev, isChecking: true, error: null }));

    try {
  console.log('🔄 Testing OpenAI connection...');
      const testResponse = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${settings.openai.apiKey}`
        }
      });

      if (!testResponse.ok) {
        const errorMsg = `OpenAI API connection error: ${testResponse.status} ${testResponse.statusText}`;
        setOpenaiConnectionStatus({
          isConnected: false,
          isChecking: false,
          lastChecked: new Date().toISOString(),
          error: errorMsg
        });
        console.error('❌ OpenAI connection test failed:', errorMsg);
      } else {
        setOpenaiConnectionStatus({
          isConnected: true,
          isChecking: false,
          lastChecked: new Date().toISOString(),
          error: null
        });
        console.log('✅ OpenAI connection successful!');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setOpenaiConnectionStatus({
        isConnected: false,
        isChecking: false,
        lastChecked: new Date().toISOString(),
        error: `Connection error: ${errorMsg}`
      });
      console.error('❌ OpenAI connection test error:', error);
    }
  };

  // Generate summaries when AI analysis tab is selected
  useEffect(() => {
    if (activeTab === 'analysis' && isConfigured) {
      generateAllSummaries();
    }
  }, [activeTab, correspondenceBasket, referenceDocuments, isConfigured]);

  // Generate AI summaries for basket and reference documents
  const generateAllSummaries = async () => {
    if (!isConfigured || (correspondenceBasket.length === 0 && referenceDocuments.length === 0)) {
      return;
    }

    setIsGeneratingSummaries(true);
    try {
      // Generate summaries for basket documents
      if (correspondenceBasket.length > 0) {
        const basketResults = await decisionSupportService.generateBasketSummaries(correspondenceBasket);
        setBasketSummaries(basketResults);
      }

      // Generate summaries for reference documents
      if (referenceDocuments.length > 0) {
        const referenceResults = await decisionSupportService.generateBasketSummaries(referenceDocuments);
        setReferenceSummaries(referenceResults);
      }

      toast({
        title: "AI Summaries Ready",
        description: `${correspondenceBasket.length + referenceDocuments.length} documents have AI summaries.`,
      });
    } catch (error) {
      console.error('Summary generation error:', error);
      toast({
        title: "Summary Generation Error",
        description: "An error occurred while creating AI summaries.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingSummaries(false);
    }
  };

  // Generate summaries when AI analysis tab is selected
  useEffect(() => {
    if (activeTab === 'analysis' && isConfigured) {
      generateAllSummaries();
    }
  }, [activeTab, correspondenceBasket, referenceDocuments, isConfigured]);

  // Handle single document analysis
  const handleAnalyze = async (correspondence: CorrespondenceMetadata) => {
    if (!isConfigured) {
      toast({
        title: "Configuration Required",
        description: "Required configuration for AI analysis is missing.",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    try {
      const analysis = await decisionSupportService.analyzeCorrespondence(correspondence.content);
      
      // Update the correspondence with analysis results
      const updatedCorrespondence = { ...correspondence, aiAnalysis: analysis };
      
      // Update in correspondenceData if it exists there
      setCorrespondenceData(prev => prev.map(item => 
        item.id === correspondence.id ? updatedCorrespondence : item
      ));

      // Update in basket if it exists there
      setCorrespondenceBasket(prev => prev.map(item => 
        item.id === correspondence.id ? updatedCorrespondence : item
      ));

      // Update in reference documents if it exists there
      setReferenceDocuments(prev => prev.map(item => 
        item.id === correspondence.id ? updatedCorrespondence : item
      ));

      toast({
        title: "AI Analysis Completed",
        description: `AI analysis ready for "${correspondence.short_desc}".`,
      });
    } catch (error) {
      console.error('Single document analysis error:', error);
      toast({
        title: "Analysis Error",
        description: "An error occurred during AI analysis.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Load correspondence data from database
  const loadCorrespondenceData = async () => {
    if (!isConfigured) {
      toast({
        title: "Configuration Required",
        description: "Database connection is not configured.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);
      let result;
      
      if (useVectorSearch && searchFilters.query.trim()) {
        // Use vector search
        result = await decisionSupportService.searchCorrespondenceVector(
          searchFilters.query, 
          searchFilters
        );
      } else {
        // Normal text search
        result = await decisionSupportService.searchCorrespondence(searchFilters.query || '', searchFilters);
      }
      
      setCorrespondenceData(result.data);
    } catch (error) {
      console.error('Error loading correspondence data:', error);
      toast({
        title: "Data Loading Error",
        description: "An error occurred while loading correspondence data. Check the database connection.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Add to correspondence basket
  const addToBasket = (correspondence: CorrespondenceMetadata) => {
    if (!correspondenceBasket.find(item => item.id === correspondence.id)) {
      setCorrespondenceBasket(prev => [...prev, correspondence]);
      toast({
        title: "Added to Basket",
        description: `"${correspondence.short_desc}" added to your basket.`,
      });
    } else {
      toast({
        title: "Already in Basket",
        description: "This correspondence is already in your basket.",
        variant: "destructive",
      });
    }
  };

  // Remove from correspondence basket
  const removeFromBasket = (correspondenceId: string) => {
    setCorrespondenceBasket(prev => prev.filter(item => item.id !== correspondenceId));
    toast({
      title: "Removed from Basket",
      description: "The correspondence has been removed from your basket.",
    });
  };

  // Set as response target
  const setAsResponseTarget = (correspondence: CorrespondenceMetadata) => {
    setSelectedForResponse(correspondence);
    toast({
      title: "Response Target Selected",
      description: `A response will be written for "${correspondence.short_desc}".`,
    });
  };

  // Add as reference document
  const addAsReference = (correspondence: CorrespondenceMetadata) => {
    if (!referenceDocuments.find(item => item.id === correspondence.id)) {
      setReferenceDocuments(prev => [...prev, correspondence]);
      toast({
        title: "Reference Added",
        description: `"${correspondence.short_desc}" added as a reference document.`,
      });
    }
  };

  // Remove reference document
  const removeReference = (correspondenceId: string) => {
    setReferenceDocuments(prev => prev.filter(item => item.id !== correspondenceId));
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'High': return 'destructive';
      case 'Medium': return 'secondary';
      case 'Low': return 'default';
      default: return 'default';
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'Positive': return 'default';
      case 'Neutral': return 'secondary';
      case 'Negative': return 'destructive';
      default: return 'default';
    }
  };

  // Handle document selection
  const toggleDocumentSelection = (documentId: string) => {
    setSelectedDocuments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(documentId)) {
        newSet.delete(documentId);
      } else {
        newSet.add(documentId);
      }
      return newSet;
    });
  };

  const selectAllDocuments = () => {
    const allIds = [...basketSummaries, ...referenceSummaries].map(doc => doc.id);
    setSelectedDocuments(new Set(allIds));
  };

  const clearSelection = () => {
    setSelectedDocuments(new Set());
  };

  // Process selected documents
  const processSelectedDocuments = async () => {
    if (selectedDocuments.size === 0) {
      toast({
        title: "No Document Selected",
        description: "Please select at least one document to proceed.",
        variant: "destructive",
      });
      return;
    }

    const selectedBasketItems = correspondenceBasket.filter(item => selectedDocuments.has(item.id));
    const selectedReferenceItems = referenceDocuments.filter(item => selectedDocuments.has(item.id));

    if (selectedBasketItems.length === 0 && selectedReferenceItems.length === 0) {
      toast({
        title: "Invalid Selection",
        description: "Selected documents could not be found.",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    setOpenaiConnectionStatus({ isConnected: false, isChecking: true, lastChecked: null, error: null });

    try {
      // Kullanıcı ayarlarından OpenAI API key'ini al
      const openaiApiKey = settings?.openai?.apiKey;

      if (!openaiApiKey || !openaiApiKey.trim()) {
        setOpenaiConnectionStatus({
          isConnected: false,
          isChecking: false,
          lastChecked: new Date().toISOString(),
          error: "OpenAI API key not found. Please enter your API key in Settings."
        });
        toast({
          title: "API Key Required",
          description: "OpenAI API key is required for document analysis.",
          variant: "destructive",
        });
        setIsAnalyzing(false);
        return;
      }

      // OpenAI bağlantısını test et
  console.log('🔄 Testing OpenAI connection...');
      const testResponse = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`
        }
      });

      if (!testResponse.ok) {
        const errorMsg = `OpenAI API connection error: ${testResponse.status} ${testResponse.statusText}`;
        setOpenaiConnectionStatus({
          isConnected: false,
          isChecking: false,
          lastChecked: new Date().toISOString(),
          error: errorMsg
        });
        console.error('❌ OpenAI connection test failed:', errorMsg);
        toast({
          title: "OpenAI Connection Error",
          description: "Please check your API key.",
          variant: "destructive",
        });
        setIsAnalyzing(false);
        return;
      }

      setOpenaiConnectionStatus({
        isConnected: true,
        isChecking: false,
        lastChecked: new Date().toISOString(),
        error: null
      });
  console.log('✅ OpenAI connection successful!');

      // Tüm seçili belgelerin içeriğini birleştir
      const allSelectedDocuments = [...selectedBasketItems, ...selectedReferenceItems];
      const combinedContent = allSelectedDocuments.map(item =>
        `DOCUMENT: ${item.short_desc}\nTYPE: ${item.incout === 'incoming' ? 'Incoming' : 'Outgoing'}\nDATE: ${new Date(item.letter_date).toLocaleDateString('en-US')}\nCONTENT:\n${item.content}`
      ).join('\n\n---\n\n');

      // Detaylı analiz için kapsamlı prompt oluştur
      const analysisPrompt = `
Please comprehensively analyze the selected documents below. The analysis should be between 200-300 words and include the following elements:

DOCUMENTS:
${combinedContent}

ANALYSIS INSTRUCTIONS:
1. General Summary: Summarize the overall subject and purpose of the documents (50-70 words).
2. Relationships and Links: Identify relationships, references, and connections between documents. Clean up inconsistent references and highlight true relations.
3. Risk Analysis: Assess potential risks, severity, and urgency (50-70 words).
4. Sentiment and Tone Analysis: Analyze the general sentiment and tone of the communications.
5. Suggested Actions: List concrete recommended actions (50-70 words).
6. Timeline: Note important dates, deadlines, and timing if present.

OUTPUT FORMAT:
- Write in English
- Use professional and objective language
- Be evidence-based
- Provide actionable recommendations
- Indicate risk levels (Low/Medium/High)

Please respond in JSON format:
{
  "summary": "Summary text",
  "relationships": "Analysis of relationships between documents",
  "risk_analysis": {
    "level": "Low|Medium|High",
    "factors": ["risk factor 1", "risk factor 2"],
    "description": "Risk analysis description"
  },
  "sentiment_analysis": {
    "overall": "Positive|Neutral|Negative",
    "score": 0,
    "description": "Sentiment analysis description"
  },
  "action_suggestions": ["action 1", "action 2", "action 3"],
  "timeline": "Timeline and important dates"
}
      `;

      console.log('🔄 Starting detailed analysis with OpenAI...');
      const analysisResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiApiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are an experienced public administration expert. Analyze correspondence documents, identify relationships, and provide decision support recommendations. Respond in English and produce detailed, comprehensive analyses.'
            },
            {
              role: 'user',
              content: analysisPrompt
            }
          ],
          temperature: 0.3,
          max_tokens: 4000
        })
      });

      if (!analysisResponse.ok) {
        throw new Error(`OpenAI API error: ${analysisResponse.status} ${analysisResponse.statusText}`);
      }

      const analysisData = await analysisResponse.json();
      const aiResponse = analysisData.choices[0]?.message?.content;

      if (!aiResponse) {
        throw new Error('OpenAI API returned an empty response');
      }

      console.log('✅ OpenAI analizi tamamlandı, JSON parse ediliyor...');

      // JSON parse et ve validate et
      let parsedAnalysis;
      try {
        parsedAnalysis = JSON.parse(aiResponse);
      } catch (parseError) {
        console.error('JSON parse hatası:', parseError);
        console.log('AI response:', aiResponse);
        throw new Error('AI response is not valid JSON');
      }

      // Analiz sonuçlarını state'te sakla
      const analysisResult = {
        selectedDocuments: Array.from(selectedDocuments),
        basketItems: selectedBasketItems,
        referenceItems: selectedReferenceItems,
        analysis: parsedAnalysis,
        generatedAt: new Date().toISOString()
      };

      setSelectedDocumentsAnalysis(analysisResult);

      // localStorage'a da kaydet (şimdilik)
      localStorage.setItem('selectedDocumentsAnalysis', JSON.stringify(analysisResult));

      console.log('✅ Document analysis completed successfully!');
      console.log('📊 Analysis summary:', parsedAnalysis.summary?.substring(0, 100) + '...');

      toast({
        title: "Analysis Completed",
        description: `Comprehensive OpenAI analysis is ready for ${selectedDocuments.size} selected documents.`,
      });

    } catch (error) {
      console.error('❌ Selected documents analysis error:', error);
      setOpenaiConnectionStatus({
        isConnected: false,
        isChecking: false,
        lastChecked: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      toast({
        title: "Analysis Error",
        description: "An error occurred while analyzing the selected documents. Check your API key.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Generate decision support report based on basket items
  const generateDecisionReport = async () => {
    if (!isConfigured) {
      toast({
        title: "Configuration Required",
        description: "Required configuration for generating decision report is missing.",
        variant: "destructive",
      });
      return;
    }

    if (correspondenceBasket.length === 0) {
      toast({
        title: "Basket Empty",
        description: "Add correspondence to your basket to generate a decision report.",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    try {
      // Combine all correspondence content for analysis
      const combinedContent = correspondenceBasket.map(item => item.content).join('\n\n');
      const analysis = await decisionSupportService.analyzeCorrespondence(combinedContent);

      // Create comprehensive report
      const report = {
        targetCorrespondence: selectedForResponse,
        referenceDocuments: referenceDocuments,
        basketItems: correspondenceBasket,
        analysis: analysis,
        generatedAt: new Date().toISOString(),
        recommendations: generateBasketRecommendations()
      };

      // Store report in localStorage for now (could be saved to database later)
      localStorage.setItem('decisionSupportReport', JSON.stringify(report));

      toast({
        title: "Decision Report Ready",
        description: "A decision report has been generated based on selected correspondence.",
      });

      setActiveTab('reports');
    } catch (error) {
      console.error('Report generation error:', error);
      toast({
        title: "Report Generation Error",
        description: "An error occurred while generating the decision report. Check API keys.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Generate recommendations based on basket contents
  const generateBasketRecommendations = () => {
    const recommendations = [];
    const highSeverityItems = correspondenceBasket.filter(item => item.severity_rate === '5');
    const urgentItems = correspondenceBasket.filter(item => item.severity_rate >= '4');

    if (highSeverityItems.length > 0) {
      recommendations.push(`Prepare an urgent action plan for ${highSeverityItems.length} high-severity correspondence`);
    }

    if (urgentItems.length > 0) {
      recommendations.push(`Obtain executive approval for ${urgentItems.length} critical correspondences`);
    }

    if (selectedForResponse) {
      recommendations.push(`Send the drafted response for ${selectedForResponse.short_desc} to relevant parties`);
    }

    return recommendations;
  };

  // Generate response letter based on analysis and user instruction
  const generateResponseLetter = async () => {
    if (!selectedDocumentsAnalysis || !responseLetterInstruction.trim()) {
      toast({
        title: "Missing Information",
        description: "Analysis and instruction are required.",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingResponseLetter(true);
    try {
      // Kullanıcı ayarlarından OpenAI API key'ini al
      const openaiApiKey = settings?.openai?.apiKey;

      if (!openaiApiKey || !openaiApiKey.trim()) {
        toast({
          title: "API Key Required",
          description: "OpenAI API key is required to generate the response letter.",
          variant: "destructive",
        });
        setIsGeneratingResponseLetter(false);
        return;
      }

      // Tüm ilgili belgelerin içeriğini birleştir
      const allDocuments = [...selectedDocumentsAnalysis.basketItems, ...selectedDocumentsAnalysis.referenceItems];
      const allContent = allDocuments.map(item =>
        `Document: ${item.short_desc}\nContent: ${item.content}`
      ).join('\n\n---\n\n');

      // OpenAI API ile cevap yazısı oluştur
  const responsePrompt = `
Based on the following analysis and documents, draft an official response letter according to the user's instruction:

USER INSTRUCTION: ${responseLetterInstruction}

ANALYSIS RESULT: ${JSON.stringify(selectedDocumentsAnalysis.analysis, null, 2)}

RELEVANT DOCUMENTS:
${allContent}

INSTRUCTIONS:
1. Use official and professional tone
2. Follow the user's instruction
3. Include document references
4. Use appropriate header and closing
5. Write in English
6. Be detailed and comprehensive

Please return only the response letter content, do not add extra commentary.
  `;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiApiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are an experienced public administration expert. Draft official response letters based on analysis and documents. Write in English, formal and professional.'
            },
            {
              role: 'user',
              content: responsePrompt
            }
          ],
          temperature: 0.4,
          max_tokens: 3000
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const aiResponse = data.choices[0]?.message?.content;

      if (!aiResponse) {
        throw new Error('OpenAI API returned an empty response');
      }

      const responseLetter = {
        content: aiResponse.trim(),
        generatedAt: new Date().toISOString(),
        instruction: responseLetterInstruction
      };

      setGeneratedResponseLetter(responseLetter);
      setIsResponseLetterModalOpen(false); // İlk modal'ı kapat
      setIsResponseLetterResultModalOpen(true); // Sonuç modal'ını aç

      toast({
        title: "Response Letter Ready",
        description: "The AI-generated response letter is ready.",
      });

    } catch (error) {
      console.error('Response letter generation error:', error);
      toast({
        title: "Response Letter Error",
        description: "An error occurred while generating the response letter. Check your API key.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingResponseLetter(false);
    }
  };  // Export response letter as PDF
  const exportAsPDF = () => {
    if (!generatedResponseLetter) return;

    // Basit PDF export (şimdilik print kullanarak)
    const printContent = `
      <html>
        <head>
          <title>Response Letter</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            .header { text-align: center; margin-bottom: 30px; }
            .content { line-height: 1.6; }
            .footer { margin-top: 50px; text-align: right; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>RESPONSE LETTER</h2>
            <p>Generated At: ${new Date(generatedResponseLetter.generatedAt).toLocaleDateString('en-US')}</p>
          </div>
          <div class="content">
            ${generatedResponseLetter.content.replace(/\n/g, '<br>')}
          </div>
          <div class="footer">
            <p>Sincerely,</p>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  // Export response letter as Word (basit text dosyası olarak)
  const exportAsWord = () => {
    if (!generatedResponseLetter) return;

  const content = `RESPONSE LETTER

Generated At: ${new Date(generatedResponseLetter.generatedAt).toLocaleDateString('en-US')}

${generatedResponseLetter.content}

Sincerely,
Authorized
  `;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cevap-yazisi-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">🧠 Decision Support System</h1>
          <p className="text-muted-foreground">AI-assisted correspondence analysis and decision support</p>
        </div>
      </div>

      {!isConfigured && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Decision support requires a configured Supabase connection.
            Please enter Supabase URL and Anon Key in Settings.
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="correspondence">Correspondence</TabsTrigger>
          <TabsTrigger value="analysis">AI Analysis</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        {/* Correspondence Tab */}
        <TabsContent value="correspondence" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Search and Results Section */}
            <div className="lg:col-span-3 space-y-6">
              {/* Search Filters */}
              <Card>
                <CardHeader>
                  <CardTitle>Correspondence Search</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <Label htmlFor="searchQuery">Search Query</Label>
                      <Input
                        id="searchQuery"
                        placeholder="Subject, content or keyword..."
                        value={searchFilters.query}
                        onChange={(e) => setSearchFilters(prev => ({ ...prev, query: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="type_of_corr">Type of Correspondence</Label>
                      <Select value={searchFilters.type_of_corr} onValueChange={(value) => setSearchFilters(prev => ({ ...prev, type_of_corr: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="All" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="HardCopy">HardCopy</SelectItem>
                          <SelectItem value="Email">Email</SelectItem>
                          <SelectItem value="Digital">Digital</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="inc_out">Incoming/Outgoing</Label>
                      <Select value={searchFilters.inc_out} onValueChange={(value) => setSearchFilters(prev => ({ ...prev, inc_out: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Tümü" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="incoming">Incoming</SelectItem>
                          <SelectItem value="outgoing">Outgoing</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="severity_rate">Severity</Label>
                      <Select value={searchFilters.severity_rate} onValueChange={(value) => setSearchFilters(prev => ({ ...prev, severity_rate: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Tümü" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="1">Low (1)</SelectItem>
                          <SelectItem value="2">Medium (2)</SelectItem>
                          <SelectItem value="3">High (3)</SelectItem>
                          <SelectItem value="4">Critical (4)</SelectItem>
                          <SelectItem value="5">Urgent (5)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4 items-center">
                    <Button onClick={loadCorrespondenceData} disabled={isLoading || !isConfigured}>
                      {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                      Search
                    </Button>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="vectorSearch"
                        checked={useVectorSearch}
                        onCheckedChange={(checked) => setUseVectorSearch(checked as boolean)}
                      />
                      <Label htmlFor="vectorSearch" className="text-sm">Vector Search</Label>
                    </div>
                    <Button variant="outline" onClick={() => {
                      setSearchFilters({ query: '', type_of_corr: '', inc_out: 'all', severity_rate: 'all' });
                      setUseVectorSearch(false);
                    }}>
                      Clear
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Search Results */}
              <Card>
                <CardHeader>
                  <CardTitle>Search Results ({correspondenceData.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                    ) : correspondenceData.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No search results found.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {correspondenceData.map((item) => (
                        <Card key={item.id} className="p-4">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1">
                              <h4 className="font-semibold">{item.short_desc}</h4>
                              <p className="text-sm text-muted-foreground">
                                Letter No: {item.letter_no} | Date: {new Date(item.letter_date).toLocaleDateString('en-US')} | {item.incout === 'incoming' ? 'Incoming' : 'Outgoing'}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <Badge variant={item.severity_rate === '5' ? 'destructive' : item.severity_rate === '4' ? 'secondary' : 'default'}>
                                Severity: {item.severity_rate}
                              </Badge>
                              <Badge variant="outline">
                                {item.type_of_corr}
                              </Badge>
                            </div>
                          </div>
                          <p className="text-sm mb-3 line-clamp-2">{item.content}</p>
                              {item.keywords && (
                            <p className="text-xs text-muted-foreground mb-3">Keywords: {item.keywords}</p>
                          )}
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAnalyze(item)}
                              disabled={isAnalyzing || !isConfigured}
                            >
                              {isAnalyzing ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Brain className="mr-2 h-3 w-3" />}
                              AI Analyze
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => addToBasket(item)}
                              disabled={correspondenceBasket.some(b => b.id === item.id)}
                            >
                              <Plus className="mr-2 h-3 w-3" />
                              Add to Basket
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => addAsReference(item)}
                              disabled={referenceDocuments.some(r => r.id === item.id)}
                            >
                              <FileText className="mr-2 h-3 w-3" />
                              Add as Reference
                            </Button>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Basket and References Sidebar */}
            <div className="space-y-6">
              {/* Correspondence Basket */}
              <Card>
                  <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    Correspondence Basket
                    <Badge variant="secondary">{correspondenceBasket.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {correspondenceBasket.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Your basket is empty. Add correspondence from search results.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {correspondenceBasket.map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-2 border rounded">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{item.short_desc}</p>
                            <p className="text-xs text-muted-foreground">{item.letter_no}</p>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setAsResponseTarget(item)}
                              title="Set as response target"
                            >
                              <Reply className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeFromBasket(item.id)}
                              title="Remove from basket"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {selectedForResponse && (
                    <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950 rounded">
                      <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                        Response Target: {selectedForResponse.short_desc}
                      </p>
                    </div>
                  )}
                  <Button
                    className="w-full mt-4"
                    onClick={generateDecisionReport}
                    disabled={correspondenceBasket.length === 0 || isAnalyzing || !isConfigured}
                  >
                    {isAnalyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                    Generate Decision Report
                  </Button>
                </CardContent>
              </Card>

              {/* Reference Documents */}
              <Card>
                  <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    Reference Documents
                    <Badge variant="secondary">{referenceDocuments.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {referenceDocuments.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No reference documents. Add references from search results.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {referenceDocuments.map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-2 border rounded">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{item.short_desc}</p>
                            <p className="text-xs text-muted-foreground">{item.letter_no}</p>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeReference(item.id)}
                            title="Remove from references"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* AI Analysis Tab */}
        <TabsContent value="analysis" className="space-y-4">
          {/* OpenAI Connection Status */}
          <Card>
              <CardHeader>
              <CardTitle className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${
                  openaiConnectionStatus.isConnected ? 'bg-green-500' :
                  openaiConnectionStatus.isChecking ? 'bg-yellow-500 animate-pulse' :
                  openaiConnectionStatus.error ? 'bg-red-500' : 'bg-gray-400'
                }`} />
                OpenAI API Connection Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
              <span className="text-sm">
              {openaiConnectionStatus.isChecking ? 'Checking connection...' :
              openaiConnectionStatus.isConnected ? '✅ Connection successful' :
              openaiConnectionStatus.error ? '❌ Connection error' : '⏳ Connection not checked'}
            </span>
                  {openaiConnectionStatus.lastChecked && (
                      <span className="text-xs text-muted-foreground">
                      Last checked: {new Date(openaiConnectionStatus.lastChecked).toLocaleTimeString('en-US')}
                    </span>
                  )}
                </div>
                {openaiConnectionStatus.error && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      {openaiConnectionStatus.error}
                    </AlertDescription>
                  </Alert>
                )}
                {openaiConnectionStatus.isConnected && (
                    <div className="text-xs text-green-600 dark:text-green-400">
                    ✓ Real OpenAI API (gpt-4o-mini) is used - no mock data
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          {/* Control Panel */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  AI Analiz Paneli
                </div>
                  <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={selectAllDocuments}
                    disabled={basketSummaries.length === 0 && referenceSummaries.length === 0}
                  >
                    Select All
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={clearSelection}
                    disabled={selectedDocuments.size === 0}
                  >
                    Clear Selection
                  </Button>
                  <Button
                    size="sm"
                    onClick={processSelectedDocuments}
                    disabled={selectedDocuments.size === 0 || isAnalyzing}
                  >
                    {isAnalyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Process Selected Documents ({selectedDocuments.size})
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
                  <div className="text-sm text-muted-foreground">
                You have {correspondenceBasket.length} correspondence in your basket and {referenceDocuments.length} reference documents.
                {isGeneratingSummaries && " AI summaries are being prepared..."}
              </div>
            </CardContent>
          </Card>

          {/* Basket Documents Analysis */}
          {basketSummaries.length > 0 && (
            <Card>
              <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                  🛒 Basket Documents ({basketSummaries.length})
                  {selectedForResponse && (
                    <Badge variant="secondary" className="ml-2">
                      Response: {selectedForResponse.short_desc}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {basketSummaries.map((summary) => (
                    <div key={summary.id} className="grid grid-cols-12 gap-4 p-4 border rounded-lg hover:bg-muted/50">
                      {/* Checkbox Column */}
                      <div className="col-span-1 flex items-center">
                        <Checkbox
                          checked={selectedDocuments.has(summary.id)}
                          onCheckedChange={() => toggleDocumentSelection(summary.id)}
                        />
                      </div>

                      {/* Document Title Column */}
                      <div className="col-span-4">
                        <h4 className="font-semibold text-sm mb-1">{summary.title}</h4>
                        <Badge
                          variant={summary.riskLevel === 'High' ? 'destructive' :
                                 summary.riskLevel === 'Medium' ? 'secondary' : 'default'}
                          className="text-xs"
                        >
                          Risk: {summary.riskLevel}
                        </Badge>
                      </div>

                      {/* AI Summary Column */}
                      <div className="col-span-6">
                        <p className="text-sm text-muted-foreground mb-2">{summary.summary}</p>
                        <div className="text-xs">
                          <strong>Key Points:</strong>
                          <ul className="list-disc list-inside mt-1 space-y-1">
                            {summary.keyPoints.map((point, idx) => (
                              <li key={idx}>{point}</li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* Action Column */}
                      <div className="col-span-1 flex items-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            const doc = correspondenceBasket.find(d => d.id === summary.id);
                            if (doc) setSelectedCorrespondence(doc);
                          }}
                          title="Detailed analysis"
                        >
                          <Brain className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Reference Documents Analysis */}
          {referenceSummaries.length > 0 && (
            <Card>
              <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                  📄 Reference Documents ({referenceSummaries.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {referenceSummaries.map((summary) => (
                    <div key={summary.id} className="grid grid-cols-12 gap-4 p-4 border rounded-lg hover:bg-muted/50">
                      {/* Checkbox Column */}
                      <div className="col-span-1 flex items-center">
                        <Checkbox
                          checked={selectedDocuments.has(summary.id)}
                          onCheckedChange={() => toggleDocumentSelection(summary.id)}
                        />
                      </div>

                      {/* Document Title Column */}
                      <div className="col-span-4">
                        <h4 className="font-semibold text-sm mb-1">{summary.title}</h4>
                        <Badge
                          variant={summary.riskLevel === 'Yüksek' ? 'destructive' :
                                 summary.riskLevel === 'Orta' ? 'secondary' : 'default'}
                          className="text-xs"
                        >
                          Risk: {summary.riskLevel}
                        </Badge>
                      </div>

                      {/* AI Summary Column */}
                      <div className="col-span-6">
                        <p className="text-sm text-muted-foreground mb-2">{summary.summary}</p>
                        <div className="text-xs">
                          <strong>Key Points:</strong>
                          <ul className="list-disc list-inside mt-1 space-y-1">
                            {summary.keyPoints.map((point, idx) => (
                              <li key={idx}>{point}</li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* Action Column */}
                      <div className="col-span-1 flex items-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            const doc = referenceDocuments.find(d => d.id === summary.id);
                            if (doc) setSelectedCorrespondence(doc);
                          }}
                          title="Detaylı analiz"
                        >
                          <Brain className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* No Documents Message */}
          {basketSummaries.length === 0 && referenceSummaries.length === 0 && (
            <Card>
                <CardContent className="text-center py-12">
                <Brain className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Documents for AI Analysis</h3>
                <p className="text-muted-foreground mb-4">
                  To perform AI analysis, first add correspondence to your basket or references.
                </p>
                <Button onClick={() => setActiveTab('correspondence')}>
                  Go to Correspondence
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Selected Documents Analysis Report */}
          {selectedDocumentsAnalysis && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Brain className="h-5 w-5" />
                    Seçili Belgeler Kapsamlı Analizi
                  </div>
                  <div className="flex gap-2">
                    <Dialog open={isResponseLetterModalOpen} onOpenChange={(open) => {
                      setIsResponseLetterModalOpen(open);
                      if (!open) {
                        setResponseLetterInstruction('');
                      }
                    }}>
                        <DialogTrigger asChild>
                        <Button onClick={() => setIsResponseLetterModalOpen(true)}>
                          <FileText className="mr-2 h-4 w-4" />
                          Generate Response Letter
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Generate Response Letter</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="responseInstruction">How should the response letter be written?</Label>
                            <Textarea
                              id="responseInstruction"
                              placeholder="e.g.: I request an extension with reasons..."
                              value={responseLetterInstruction}
                              onChange={(e) => setResponseLetterInstruction(e.target.value)}
                              rows={4}
                            />
                          </div>
                          <div className="flex gap-2 justify-end">
                            <Button
                              variant="outline"
                              onClick={() => setIsResponseLetterModalOpen(false)}
                            >
                              Cancel
                            </Button>
                            <Button
                              onClick={generateResponseLetter}
                              disabled={isGeneratingResponseLetter || !responseLetterInstruction.trim()}
                            >
                              {isGeneratingResponseLetter ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <FileText className="mr-2 h-4 w-4" />
                              )}
                              Generate
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>

                    {/* Response Letter Result Modal */}
                    <Dialog open={isResponseLetterResultModalOpen} onOpenChange={setIsResponseLetterResultModalOpen}>
                      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5" />
                            Generated Response Letter
                          </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-6">
                          {generatedResponseLetter && (
                            <>
                              <div className="p-4 border rounded-lg bg-muted/50">
                                <h4 className="font-semibold mb-2">Your Instruction:</h4>
                                <p className="text-sm text-muted-foreground italic">
                                  "{generatedResponseLetter.instruction}"
                                </p>
                              </div>

                              <div className="p-4 border rounded-lg">
                                <h4 className="font-semibold mb-4">Response Letter Content:</h4>
                                <div className="whitespace-pre-wrap text-sm leading-relaxed bg-white p-4 rounded border min-h-[300px]">
                                  {generatedResponseLetter.content}
                                </div>
                              </div>

                              <div className="flex gap-2 justify-between items-center pt-4 border-t">
                                <div className="text-xs text-muted-foreground">
                                  Generated At: {new Date(generatedResponseLetter.generatedAt).toLocaleString('en-US')}
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={exportAsPDF}
                                  >
                                    <Printer className="mr-2 h-4 w-4" />
                                    Print PDF
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={exportAsWord}
                                  >
                                    <Download className="mr-2 h-4 w-4" />
                                    Download Word
                                  </Button>
                                  <Button
                                    onClick={() => setIsResponseLetterResultModalOpen(false)}
                                  >
                                    Close
                                  </Button>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Analysis Summary */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold mb-2">Analiz Özeti</h4>
                    <p className="text-sm text-muted-foreground">
                      {selectedDocumentsAnalysis.analysis.summary}
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Risk Analizi</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Risk Seviyesi:</span>
                        <Badge variant={selectedDocumentsAnalysis.analysis.risk_analysis.level === 'Yüksek' ? 'destructive' :
                                       selectedDocumentsAnalysis.analysis.risk_analysis.level === 'Orta' ? 'secondary' : 'default'}>
                          {selectedDocumentsAnalysis.analysis.risk_analysis.level}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Risk Faktörleri: {selectedDocumentsAnalysis.analysis.risk_analysis.factors.join(', ')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Action Suggestions */}
                <div>
                  <h4 className="font-semibold mb-2">Önerilen Aksiyonlar</h4>
                  <ul className="text-sm space-y-1">
                    {selectedDocumentsAnalysis.analysis.action_suggestions.map((action, idx) => (
                      <li key={idx}>• {action}</li>
                    ))}
                  </ul>
                </div>

                {/* Sentiment Analysis */}
                <div>
                  <h4 className="font-semibold mb-2">Duygu Analizi</h4>
                  <div className="flex items-center gap-2">
                    <Badge variant={selectedDocumentsAnalysis.analysis.sentiment_analysis.overall === 'Pozitif' ? 'default' :
                                   selectedDocumentsAnalysis.analysis.sentiment_analysis.overall === 'Negatif' ? 'destructive' : 'secondary'}>
                      {selectedDocumentsAnalysis.analysis.sentiment_analysis.overall}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      Skor: {selectedDocumentsAnalysis.analysis.sentiment_analysis.score}/100
                    </span>
                  </div>
                </div>

                {/* Analyzed Documents */}
                <div>
                  <h4 className="font-semibold mb-2">Analiz Edilen Belgeler ({selectedDocumentsAnalysis.basketItems.length + selectedDocumentsAnalysis.referenceItems.length})</h4>
                  <div className="space-y-2">
                    {[...selectedDocumentsAnalysis.basketItems, ...selectedDocumentsAnalysis.referenceItems].map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-2 border rounded">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{doc.short_desc}</p>
                          <p className="text-xs text-muted-foreground">{doc.letter_no}</p>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {doc.incout === 'incoming' ? 'Gelen' : 'Giden'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="text-xs text-muted-foreground text-center pt-4 border-t">
                  Analiz Datei: {new Date(selectedDocumentsAnalysis.generatedAt).toLocaleString('tr-TR')}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Generated Response Letter */}
          {generatedResponseLetter && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Oluşturulan Cevap Yazısı
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={exportAsPDF}
                    >
                      <Printer className="mr-2 h-4 w-4" />
                      PDF Yazdır
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={exportAsWord}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Word İndir
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 border rounded-lg bg-muted/50">
                    <h4 className="font-semibold mb-2">Talimatınız:</h4>
                    <p className="text-sm text-muted-foreground italic">
                      "{generatedResponseLetter.instruction}"
                    </p>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <h4 className="font-semibold mb-4">Cevap Yazısı İçeriği:</h4>
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                      {generatedResponseLetter.content}
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground text-center pt-4 border-t">
                    Oluşturulma Datei: {new Date(generatedResponseLetter.generatedAt).toLocaleString('tr-TR')}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Hazır Şablonlar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle className="text-base">İzin Başvuru Şablonu</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      Belediye ve ilgili kurumlara proje izin başvuruları için
                    </p>
                    <Button size="sm" className="w-full">
                      Kullan
                    </Button>
                  </CardContent>
                </Card>

                <Card className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle className="text-base">Cevap Yazısı Şablonu</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      Gelen yazışmalara verilen cevaplar için
                    </p>
                    <Button size="sm" className="w-full">
                      Kullan
                    </Button>
                  </CardContent>
                </Card>

                <Card className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle className="text-base">İhtar Yazısı Şablonu</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      Süreç hatırlatmaları ve ihtar yazıları için
                    </p>
                    <Button size="sm" className="w-full">
                      Kullan
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Toplam Yazışma</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{correspondenceData.length}</div>
                <p className="text-xs text-muted-foreground">Aktif yazışma</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Karar Bekleyen</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {correspondenceData.filter(item => item.severity_rate >= '3').length}
                </div>
                <p className="text-xs text-muted-foreground">Eylem gerekli</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Yüksek Risk</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {correspondenceData.filter(item => item.severity_rate === '5').length}
                </div>
                <p className="text-xs text-muted-foreground">Dikkat gerekli</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Tamamlanan</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {correspondenceData.filter(item => item.reply_letter && item.reply_letter.trim() !== '').length}
                </div>
                <p className="text-xs text-muted-foreground">Bu ay</p>
              </CardContent>
            </Card>
          </div>

          {/* Decision Report Display */}
          {(() => {
            const report = localStorage.getItem('decisionSupportReport');
            if (report) {
              try {
                const reportData = JSON.parse(report);
                return (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Oluşturulan Karar Raporu
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h4 className="font-semibold mb-2">Seçili Yazışmalar ({reportData.basketItems.length})</h4>
                          <ul className="text-sm space-y-1">
                            {reportData.basketItems.map((item: any, idx: number) => (
                              <li key={idx}>• {item.short_desc}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <h4 className="font-semibold mb-2">Referans Belgeler ({reportData.referenceDocuments.length})</h4>
                          <ul className="text-sm space-y-1">
                            {reportData.referenceDocuments.map((item: any, idx: number) => (
                              <li key={idx}>• {item.short_desc}</li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {reportData.targetCorrespondence && (
                        <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded">
                          <p className="text-sm font-medium">
                            Cevap Yazılacak: {reportData.targetCorrespondence.short_desc}
                          </p>
                        </div>
                      )}

                      <div>
                        <h4 className="font-semibold mb-2">AI Önerileri</h4>
                        <ul className="text-sm space-y-1">
                          {reportData.recommendations.map((rec: string, idx: number) => (
                            <li key={idx}>• {rec}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">
                          Raporu İndir
                        </Button>
                        <Button variant="outline" size="sm">
                          Raporu Yazdır
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              } catch (error) {
                return null;
              }
            }
            return null;
          })()}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DecisionSupportTemplate;
