import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Progress } from '../components/ui/progress';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Label } from '../components/ui/label';
import { useToast } from '../hooks/use-toast';
import { Brain, Search, FileText, AlertTriangle, Lightbulb, File, MessageSquare, TrendingUp, BarChart3, Clock, Users, Filter } from 'lucide-react';

// PrimeReact components for advanced features
import 'primereact/resources/themes/saga-blue/theme.css';
import 'primereact/resources/primereact.min.css';
import 'primeicons/primeicons.css';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { InputText } from 'primereact/inputtext';
import { Dropdown } from 'primereact/dropdown';
import { Calendar } from 'primereact/calendar';
import { ProgressBar } from 'primereact/progressbar';
import { Dialog } from 'primereact/dialog';
import { Accordion, AccordionTab } from 'primereact/accordion';

// Services
import { decisionSupportService, CorrespondenceMetadata, AIAnalysis, SearchFilters, SearchResult } from '../services/decision-support';

const DecisionSupportPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [correspondenceData, setCorrespondenceData] = useState<CorrespondenceMetadata[]>([]);
  const [filteredData, setFilteredData] = useState<CorrespondenceMetadata[]>([]);
  const [selectedCorrespondence, setSelectedCorrespondence] = useState<CorrespondenceMetadata | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  const [stats, setStats] = useState<any>(null);
  const [selectedApi, setSelectedApi] = useState<'deepseek' | 'openai'>('deepseek'); // Default to DeepSeek
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [totalResults, setTotalResults] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const { toast } = useToast();

  // Load initial data
  useEffect(() => {
    loadCorrespondenceData();
    loadStats();
  }, []);

  const loadCorrespondenceData = async (query: string = '', filters: SearchFilters = {}) => {
    try {
      setIsLoading(true);
      const result: SearchResult = await decisionSupportService.searchCorrespondence(query, filters);
      setCorrespondenceData(result.data);
      setFilteredData(result.data);
      setTotalResults(result.total);
      setHasMore(result.hasMore);
    } catch (error) {
      console.error('Error loading correspondence data:', error);
      toast({
        title: "Data Loading Error",
        description: "An error occurred while loading correspondence data.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async () => {
    try {
      setIsSearching(true);
      const result: SearchResult = await decisionSupportService.searchCorrespondence(searchQuery, searchFilters);
      setCorrespondenceData(result.data);
      setFilteredData(result.data);
      setTotalResults(result.total);
      setHasMore(result.hasMore);

      toast({
        title: "Search Completed",
        description: `${result.total} results found.`,
      });
    } catch (error) {
      console.error('Search error:', error);
      toast({
        title: "Search Error",
        description: "An error occurred during search.",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const loadStats = async () => {
    try {
      const statsData = await decisionSupportService.getCorrespondenceStats();
      setStats(statsData);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const analyzeCorrespondence = async (correspondence: CorrespondenceMetadata) => {
    setIsAnalyzing(true);
    setAiAnalysis(null);

    try {
      const analysis = await decisionSupportService.analyzeCorrespondence(correspondence.content, selectedApi);
      setAiAnalysis(analysis);

      // Save analysis to database
      await decisionSupportService.saveAIAnalysis(correspondence.id, analysis);

      toast({
        title: "AI Analysis Completed",
        description: `Analysis successfully performed with ${selectedApi.toUpperCase()} API.`,
      });
    } catch (error) {
      console.error('AI analysis error:', error);
      toast({
        title: "Analysis Error",
        description: `An error occurred during AI analysis: ${(error as Error).message}`,
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handlePreview = async (correspondence: CorrespondenceMetadata) => {
    try {
      setPreviewContent(correspondence.content);
      setPreviewOpen(true);
    } catch (error) {
      console.error('Error opening preview:', error);
      toast({
        title: "Preview Error",
        description: "Could not load document content.",
        variant: "destructive",
      });
    }
  };

  return (
    <Tabs value="analysis" className="w-full">
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">🧠 Decision Support System</h1>
            <p className="text-muted-foreground mt-2">
              AI-powered correspondence analysis and decision suggestions
            </p>
          </div>
          <TabsList>
            <TabsTrigger value="analysis">Analysis</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
          </TabsList>
        </div>

      {/* Search Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Correspondence Search and AI Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* API Selection */}
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium">AI API Selection:</label>
              <div className="flex gap-2">
                <Button
                  variant={selectedApi === 'deepseek' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedApi('deepseek')}
                  className="flex items-center gap-2"
                >
                  <Brain className="h-4 w-4" />
                  DeepSeek
                </Button>
                <Button
                  variant={selectedApi === 'openai' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedApi('openai')}
                  className="flex items-center gap-2"
                >
                  <MessageSquare className="h-4 w-4" />
                  OpenAI
                </Button>
              </div>
              <div className="text-xs text-muted-foreground">
                Selected: <span className="font-medium">{selectedApi.toUpperCase()}</span>
              </div>
            </div>

            {/* Search Input */}
            <div className="flex gap-4">
              <Input
                placeholder="Search by subject, party, number or keyword..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="h-4 w-4 mr-2" />
                Filters
              </Button>
              <Button
                onClick={handleSearch}
                disabled={isSearching}
              >
                {isSearching ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                ) : (
                  <Search className="h-4 w-4 mr-2" />
                )}
                Search
              </Button>
            </div>

            {/* Filters Panel */}
            {showFilters && (
              <div className="p-4 bg-gray-50 rounded-lg space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Date Range */}
                  <div className="space-y-2">
                    <Label>Letter Date Range</Label>
                    <div className="flex gap-2">
                      <Input
                        type="date"
                        value={searchFilters.dateFrom || ''}
                        onChange={(e) => setSearchFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                        placeholder="Start"
                      />
                      <Input
                        type="date"
                        value={searchFilters.dateTo || ''}
                        onChange={(e) => setSearchFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                        placeholder="End"
                      />
                    </div>
                  </div>

                  {/* Content Type */}
                  <div className="space-y-2">
                    <Label>Correspondence Type</Label>
                    <select
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                      value={searchFilters.type_of_corr || ''}
                      onChange={(e) => setSearchFilters(prev => ({ ...prev, type_of_corr: e.target.value || undefined }))}
                    >
                      <option value="">All</option>
                      <option value="Bilgilendirme">Information</option>
                      <option value="İhtar">Warning</option>
                      <option value="Cevap">Reply</option>
                      <option value="Talep">Request</option>
                      <option value="Başvuru">Application</option>
                      <option value="Diğer">Other</option>
                    </select>
                  </div>

                  {/* Risk Level */}
                  <div className="space-y-2">
                    <Label>Risk Level</Label>
                    <select
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                      value={searchFilters.severity_rate || ''}
                      onChange={(e) => setSearchFilters(prev => ({ ...prev, severity_rate: e.target.value || undefined }))}
                    >
                      <option value="">All</option>
                      <option value="Düşük">Low</option>
                      <option value="Orta">Medium</option>
                      <option value="Yüksek">High</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Project Name */}
                  <div className="space-y-2">
                    <Label>Project Name</Label>
                    <Input
                      value={searchFilters.sp_id || ''}
                      onChange={(e) => setSearchFilters(prev => ({ ...prev, sp_id: e.target.value || undefined }))}
                      placeholder="Enter project name"
                    />
                  </div>

                  {/* Parties */}
                  <div className="space-y-2">
                    <Label>Parties</Label>
                    <Input
                      value={searchFilters.sp_id || ''}
                      onChange={(e) => setSearchFilters(prev => ({ ...prev, sp_id: e.target.value || undefined }))}
                      placeholder="Enter party name"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Letter Number */}
                  <div className="space-y-2">
                    <Label>Letter Number</Label>
                    <Input
                      value={searchFilters.letter_no || ''}
                      onChange={(e) => setSearchFilters(prev => ({ ...prev, letter_no: e.target.value || undefined }))}
                      placeholder="Enter letter number"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchFilters({});
                      setSearchQuery('');
                    }}
                  >
                    Clear
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Correspondence List */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Correspondence ({totalResults})</CardTitle>
              {totalResults > filteredData.length && (
                <p className="text-sm text-muted-foreground">
                  {filteredData.length} shown
                  {hasMore && " (more available)"}
                </p>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {isLoading || isSearching ? (
                <div className="p-6 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                  <p className="text-sm text-muted-foreground">
                    {isSearching ? 'Searching...' : 'Loading data...'}
                  </p>
                </div>
              ) : (
                <div className="max-h-96 overflow-y-auto">
                  {filteredData.map((item) => (
                    <div
                      key={item.id}
                      className={`p-4 border-b cursor-pointer hover:bg-accent transition-colors ${
                        selectedCorrespondence?.id === item.id ? 'bg-accent' : ''
                      }`}
                      onClick={() => {
                        setSelectedCorrespondence(item);
                        analyzeCorrespondence(item);
                      }}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-medium text-sm">{item.letter_no}</span>
                        <Badge variant={item.severity_rate?.includes('Yüksek') ? "destructive" : "secondary"}>
                          Criticality: {item.severity_rate || 'Unknown'}/10
                        </Badge>
                      </div>
                      <h4 className="font-medium mb-1">{item.short_desc}</h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        {item.sp_id}
                      </p>
                      <div className="flex justify-between items-center text-xs text-muted-foreground">
                        <span>{new Date(item.letter_date).toLocaleDateString('en-US')}</span>
                        <span>{item.type_of_corr}</span>
                      </div>
                      <div className="flex gap-1 mt-2">
                        {item.keywords && (item.keywords as string).split(',').slice(0, 3).map((keyword, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {keyword.trim()}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                  {filteredData.length === 0 && !isLoading && !isSearching && (
                    <div className="p-6 text-center text-muted-foreground">
                      <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No correspondence found matching search criteria</p>
                      <p className="text-xs mt-1">Try different search terms</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* AI Analysis Panel */}
        <div className="lg:col-span-2">
          {selectedCorrespondence ? (
            <div className="space-y-6">
              {/* Selected Correspondence Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Selected Correspondence: {selectedCorrespondence.letter_no}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePreview(selectedCorrespondence)}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Preview
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="text-sm font-medium">Subject</label>
                      <p className="text-sm text-muted-foreground">{selectedCorrespondence.short_desc}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Date</label>
                      <p className="text-sm text-muted-foreground">{new Date(selectedCorrespondence.letter_date).toLocaleDateString('en-US')}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Parties</label>
                      <p className="text-sm text-muted-foreground">{selectedCorrespondence.sp_id}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Project</label>
                      <p className="text-sm text-muted-foreground">{selectedCorrespondence.sp_id}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline">{selectedCorrespondence.type_of_corr}</Badge>
                    <Badge variant={selectedCorrespondence.reply_letter ? "default" : "secondary"}>
                      {selectedCorrespondence.reply_letter ? "Decision Made" : "Pending"}
                    </Badge>
                    <Badge variant={
                      selectedCorrespondence.severity_rate === 'Yüksek' ? 'destructive' :
                      selectedCorrespondence.severity_rate === 'Orta' ? 'default' : 'secondary'
                    }>
                      {selectedCorrespondence.severity_rate === 'Yüksek' ? 'High' : selectedCorrespondence.severity_rate === 'Orta' ? 'Medium' : selectedCorrespondence.severity_rate === 'Düşük' ? 'Low' : selectedCorrespondence.severity_rate} Risk
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* AI Analysis Results */}
              {isAnalyzing ? (
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-center">
                      <div className="text-center">
                        <Brain className="h-8 w-8 animate-pulse mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">AI is analyzing...</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : aiAnalysis ? (
                <Tabs defaultValue="summary" className="w-full">
                    <TabsList className="grid w-full grid-cols-6">
                      <TabsTrigger value="summary">Summary</TabsTrigger>
                      <TabsTrigger value="similar">Similar</TabsTrigger>
                      <TabsTrigger value="actions">Actions</TabsTrigger>
                      <TabsTrigger value="templates">Templates</TabsTrigger>
                      <TabsTrigger value="completion">Completion</TabsTrigger>
                      <TabsTrigger value="risk">Risk</TabsTrigger>
                  </TabsList>

                  <TabsContent value="summary" className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <FileText className="h-5 w-5" />
                          Correspondence Summary
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm">{aiAnalysis.summary}</p>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="similar" className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Search className="h-5 w-5" />
                          Similar Correspondence
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {aiAnalysis.similar_docs && aiAnalysis.similar_docs.length > 0 ? (
                            aiAnalysis.similar_docs.map((docId: string) => {
                              const similarDoc = correspondenceData.find(doc => doc.id === docId);
                              return similarDoc ? (
                                <div key={docId} className="p-3 border rounded hover:bg-accent cursor-pointer transition-colors"
                                     onClick={() => {
                                       setSelectedCorrespondence(similarDoc);
                                       analyzeCorrespondence(similarDoc);
                                     }}>
                                  <div className="flex justify-between">
                                    <span className="font-medium">{similarDoc.letter_no}</span>
                                    <span className="text-sm text-muted-foreground">{new Date(similarDoc.letter_date).toLocaleDateString('en-US')}</span>
                                  </div>
                                  <p className="text-sm mt-1">{similarDoc.short_desc}</p>
                                  <div className="flex gap-1 mt-2">
                                    {similarDoc.keywords && (similarDoc.keywords as string).split(',').slice(0, 2).map((keyword, idx) => (
                                      <Badge key={idx} variant="outline" className="text-xs">
                                        {keyword.trim()}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              ) : null;
                            }).filter(Boolean)
                          ) : (
                            <p className="text-sm text-muted-foreground">No similar correspondence found</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="actions" className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Lightbulb className="h-5 w-5" />
                          Suggested Actions
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {aiAnalysis.action_suggestions.map((action: string, index: number) => (
                            <li key={index} className="flex items-start gap-2">
                              <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
                              <span className="text-sm">{action}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="templates" className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <File className="h-5 w-5" />
                          Suitable Templates
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 gap-2">
                          {aiAnalysis.template_suggestions.map((template: string, index: number) => (
                            <Button key={index} variant="outline" className="justify-start">
                              <File className="h-4 w-4 mr-2" />
                              {template}
                            </Button>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="completion" className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <MessageSquare className="h-5 w-5" />
                          Text Completion Suggestion
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Textarea
                          value={aiAnalysis.text_completion}
                          readOnly
                          className="min-h-24"
                        />
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="risk" className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5" />
                          Risk and Sentiment Analysis
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <div className="flex justify-between mb-2">
                            <span className="text-sm font-medium">Risk Level</span>
                            <Badge variant={aiAnalysis.risk_analysis.level === 'Yüksek' ? 'destructive' : 'secondary'}>
                              {aiAnalysis.risk_analysis.level === 'Yüksek' ? 'High' : aiAnalysis.risk_analysis.level === 'Orta' ? 'Medium' : aiAnalysis.risk_analysis.level === 'Düşük' ? 'Low' : aiAnalysis.risk_analysis.level}
                            </Badge>
                          </div>
                          <ul className="text-sm space-y-1">
                            {aiAnalysis.risk_analysis.factors.map((factor: string, index: number) => (
                              <li key={index}>• {factor}</li>
                            ))}
                          </ul>
                        </div>

                        <div>
                          <div className="flex justify-between mb-2">
                            <span className="text-sm font-medium">Sentiment Analysis</span>
                            <span className="text-sm text-muted-foreground">
                              {aiAnalysis.sentiment_analysis.overall} ({aiAnalysis.sentiment_analysis.score}%)
                            </span>
                          </div>
                          <Progress value={aiAnalysis.sentiment_analysis.score} className="h-2" />
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              ) : null}
            </div>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <Brain className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">Select Correspondence</h3>
                <p className="text-muted-foreground">
                  Select the correspondence to analyze from the list on the left
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Reports Tab Content */}
      <TabsContent value="reports" className="space-y-6 mt-6">
        {stats ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Summary Cards */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <FileText className="h-8 w-8 text-blue-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">Total Correspondence</p>
                    <p className="text-2xl font-bold">{stats.total}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Clock className="h-8 w-8 text-orange-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">Pending Decisions</p>
                    <p className="text-2xl font-bold">{stats.pendingDecisions}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <AlertTriangle className="h-8 w-8 text-red-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">Overdue Decisions</p>
                    <p className="text-2xl font-bold">{stats.overdueDecisions}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <TrendingUp className="h-8 w-8 text-green-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">This Month</p>
                    <p className="text-2xl font-bold">
                      {stats.byMonth.find((m: any) => m.month === new Date().toISOString().substring(0, 7))?.count || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardContent className="p-6 text-center">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Loading statistics...</p>
            </CardContent>
          </Card>
        )}

        {stats && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Monthly Trend */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Monthly Correspondence Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {stats.byMonth.slice(-6).map((month: any) => (
                    <div key={month.month} className="flex items-center justify-between">
                      <span className="text-sm">{month.month}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-secondary rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full"
                            style={{ width: `${(month.count / Math.max(...stats.byMonth.map((m: any) => m.count))) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium w-8 text-right">{month.count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Content Types */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Correspondence Type Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {stats.byType.map((type: any) => (
                    <div key={type.type} className="flex items-center justify-between">
                      <span className="text-sm">{type.type}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-secondary rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full"
                            style={{ width: `${(type.count / Math.max(...stats.byType.map((t: any) => t.count))) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium w-8 text-right">{type.count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Projects */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Project-based Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {stats.byProject.slice(0, 5).map((project: any) => (
                    <div key={project.project} className="flex items-center justify-between">
                      <span className="text-sm truncate flex-1 mr-2">{project.project}</span>
                      <span className="text-sm font-medium">{project.count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Risk Analysis */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Risk Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>High Risk</span>
                      <span>{correspondenceData.filter(c => c.severity_rate === 'Yüksek').length}</span>
                    </div>
                    <Progress
                      value={(correspondenceData.filter(c => c.severity_rate === 'Yüksek').length / correspondenceData.length) * 100}
                      className="h-2"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Medium Risk</span>
                      <span>{correspondenceData.filter(c => c.severity_rate === 'Orta').length}</span>
                    </div>
                    <Progress
                      value={(correspondenceData.filter(c => c.severity_rate === 'Orta').length / correspondenceData.length) * 100}
                      className="h-2"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Low Risk</span>
                      <span>{correspondenceData.filter(c => c.severity_rate === 'Düşük').length}</span>
                    </div>
                    <Progress
                      value={(correspondenceData.filter(c => c.severity_rate === 'Düşük').length / correspondenceData.length) * 100}
                      className="h-2"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </TabsContent>

      {/* Preview Dialog */}
      <Dialog
  header="Document Content"
        visible={previewOpen}
        style={{ width: '60vw' }}
        onHide={() => setPreviewOpen(false)}
      >
        <div style={{ maxHeight: '60vh', overflow: 'auto', whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
          {previewContent || <i>Content not found</i>}
        </div>
      </Dialog>
      </div>
    </Tabs>
  );
};

export default DecisionSupportPage;