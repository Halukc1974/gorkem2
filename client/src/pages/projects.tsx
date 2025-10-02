import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Progress } from '../components/ui/progress';
import { Separator } from '../components/ui/separator';
import { 
  Building, 
  MapPin, 
  Calendar, 
  DollarSign, 
  Users, 
  CheckCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
  FileText,
  BarChart3,
  TrendingUp,
  Plus
} from 'lucide-react';
// Google Sheets integration removed: projects will no longer auto-fetch from Google Sheets

// Project data structure - according to all columns in Google Sheets
interface ProjectData {
  proje_adi: string;                    // A: "Project Name"
  proje_kodu: string;                   // B: "Project Code"
  proje_turu: string;                   // C: "Project Type"
  lokasyon: string;                     // D: "Location"
  isveren: string;                      // E: "Employer"
  yuklenici: string;                    // F: "Contractor"
  musavir: string;                      // G: "Consultant"
  sozlesme_bedeli: string;              // H: "Contract Amount"
  avans_miktari: string;                // I: "Advance Amount"
  alinan_hakedisler: string;            // J: "Total Received Payments"
  yapilan_harcamalar: string;           // K: "Total Made Expenditures"
  cari_durum: string;                   // L: "Current Status"
  gecici_teminat: string;               // M: "Temporary Guarantee"
  kesin_teminat: string;                // N: "Final Guarantee"
  finansman_kaynagi: string;            // O: "Funding Source"
  arsa_alani: string;                   // P: "Land Area"
  toplam_insaat_alani: string;          // Q: "Total Construction Area"
  sozlesmeye_gore_baslangic: string;    // R: "Contract Start Date"
  sozlesmeye_gore_bitis: string;        // S: "Contract End Date"
  isin_suresi: string;                  // T: "Work Duration (Days)"
  sure_uzatimi: string;                 // U: "Time Extension"
  devam_durumu: string;                 // V: "Continuation Status"
  fiili_bitis_Datei: string;           // W: "Actual Completion Date"
  gecici_kabul_durumu: string;          // X: "Provisional Acceptance Status"
  kesin_kabul_durumu: string;           // Y: "Final Acceptance Status"
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeProject, setActiveProject] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Placeholder for legacy refresh button - actual data lives elsewhere
  const loadProjectData = () => {
    console.log('loadProjectData called - no-op in migrated client');
  };

  // NOTE: Google Sheets fetching has been removed as per migration to Info Center (Supabase).
  // Projects can be seeded manually or migrated to another data source.

  // Project status color based on status
  const getStatusColor = (status: string): string => {
    if (!status) return 'bg-gray-100 text-gray-800';
    const statusLower = status.toLowerCase();
    if (statusLower.includes('tamamland') || statusLower.includes('bitti')) return 'bg-green-100 text-green-800';
    if (statusLower.includes('devam') || statusLower.includes('aktif')) return 'bg-blue-100 text-blue-800';
    if (statusLower.includes('start') || statusLower.includes('yeni') || statusLower.includes('new')) return 'bg-yellow-100 text-yellow-800';
    if (statusLower.includes('durdur') || statusLower.includes('bekle') || statusLower.includes('stop') || statusLower.includes('wait')) return 'bg-red-100 text-red-800';
    return 'bg-gray-100 text-gray-800';
  };

  // Progress calculation (Received Payments / Contract Amount)
  const calculateProgress = (project: ProjectData): number => {
    try {
      // Extract numeric value from contract amount
      const sozlesmeBedeliStr = project.sozlesme_bedeli?.replace(/[^0-9.-]/g, '') || '0';
      const sozlesmeBedeli = parseFloat(sozlesmeBedeliStr);
      
      // Extract numeric value from received payments
      const alinanHakedislerStr = project.alinan_hakedisler?.replace(/[^0-9.-]/g, '') || '0';
      const alinanHakedisler = parseFloat(alinanHakedislerStr);
      
      // If contract amount doesn't exist or is zero, progress cannot be calculated
      if (!sozlesmeBedeli || sozlesmeBedeli <= 0) {
        return 0;
      }
      
      // Calculate progress percentage (maximum 100%)
      const progressPercent = Math.min((alinanHakedisler / sozlesmeBedeli) * 100, 100);
      
      // Limit negative values to zero
      return Math.max(progressPercent, 0);
      
    } catch (error) {
      console.warn('Progress calculation error:', error);
      return 0;
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="flex items-center justify-center p-12">
            <div className="flex items-center gap-3">
              <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
              <span className="text-lg text-gray-600">Loading projects...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (projects?.length === 0 || !projects) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="text-center p-12">
            <Building className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">
              No Projects Found Yet
            </h3>
            <p className="text-gray-500 mb-4">
              Create a "Projects" table in Google Sheets and add your project information.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* Control Buttons */}
      <div className="flex justify-end mb-6">
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-sm text-gray-500">
              Last Update: {lastUpdated.toLocaleTimeString('en-US')}
            </span>
          )}
          <Button onClick={loadProjectData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Project Tabs */}
      <Card>
        <CardContent className="pt-6">
          <Tabs value={activeProject || projects?.[0]?.proje_kodu} onValueChange={setActiveProject}>
            <TabsList className="grid w-full overflow-x-auto mb-6" 
                      style={{ gridTemplateColumns: `repeat(${Math.min(projects?.length || 0, 4)}, 1fr)` }}>
              {projects?.slice(0, 4).map((project) => (
                <TabsTrigger key={project.proje_kodu} value={project.proje_kodu} 
                  className="text-xs font-medium data-[state=active]:bg-orange-100 data-[state=active]:text-orange-800 hover:bg-orange-50">
                  {project.proje_kodu}
                </TabsTrigger>
              ))}
              {(projects?.length || 0) > 4 && (
                <TabsTrigger value="more" 
  className="text-xs data-[state=active]:bg-orange-100 data-[state=active]:text-orange-800 hover:bg-orange-50">
  +{(projects?.length || 0) - 4} More
</TabsTrigger>
              )}
            </TabsList>

            {projects?.map((project) => (
              <TabsContent key={project.proje_kodu} value={project.proje_kodu} className="space-y-6">
                
                {/* Project Summary Card */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Main Information */}
                  <Card className="lg:col-span-2">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-2xl mb-2">{project.proje_adi}</CardTitle>
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="text-blue-600">
                              {project.proje_kodu}
                            </Badge>
                            <Badge className={getStatusColor(project.devam_durumu)}>
                              {project.devam_durumu || 'Status Unknown'}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-gray-600 mb-1">Financial Progress</div>
                          <div className="text-2xl font-bold text-blue-600">
                            {Math.round(calculateProgress(project))}%
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="space-y-6">
                      {/* Basic Information Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h4 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            Basic Information
                          </h4>
                          <div className="space-y-3 text-sm">
                            <div>
                              <span className="text-gray-600">Project Type:</span>
                              <p className="font-medium">{project.proje_turu}</p>
                            </div>
                            <div>
                              <span className="text-gray-600">Employer:</span>
                              <p className="font-medium">{project.isveren}</p>
                            </div>
                            <div>
                              <span className="text-gray-600">Contractor:</span>
                              <p className="font-medium">{project.yuklenici}</p>
                            </div>
                            {project.musavir && (
                              <div>
                                <span className="text-gray-600">Consultant:</span>
                                <p className="font-medium">{project.musavir}</p>
                              </div>
                            )}
                          </div>
                        </div>

                        <div>
                          <h4 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            Location & Area
                          </h4>
                          <div className="space-y-3 text-sm">
                            <div>
                              <span className="text-gray-600">Location:</span>
                              <p className="font-medium">{project.lokasyon}</p>
                            </div>
                            {project.arsa_alani && (
                              <div>
                                <span className="text-gray-600">Land Area:</span>
                                <p className="font-medium">{project.arsa_alani}</p>
                              </div>
                            )}
                            {project.toplam_insaat_alani && (
                              <div>
                                <span className="text-gray-600">Construction Area:</span>
                                <p className="font-medium">{project.toplam_insaat_alani}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <Separator />

                      {/* Timeline */}
                      <div>
                        <h4 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          Timeline
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          {project.sozlesmeye_gore_baslangic && (
                            <div>
                              <span className="text-gray-600">Contract Start:</span>
                              <p className="font-medium">{project.sozlesmeye_gore_baslangic}</p>
                            </div>
                          )}
                          {project.sozlesmeye_gore_bitis && (
                            <div>
                              <span className="text-gray-600">Contract End:</span>
                              <p className="font-medium">{project.sozlesmeye_gore_bitis}</p>
                            </div>
                          )}
                          {project.fiili_bitis_Datei && (
                            <div>
                              <span className="text-gray-600">Actual Completion:</span>
                              <p className="font-medium">{project.fiili_bitis_Datei}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-gray-600">Financial Progress Status</span>
                          <span className="font-medium">{Math.round(calculateProgress(project))}%</span>
                        </div>
                        <Progress value={calculateProgress(project)} className="h-3" />
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                          <span>Start (0%)</span>
                          <span>Payment/Contract Ratio</span>
                          <span>Completed (100%)</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Status Card */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <CheckCircle className="h-5 w-5" />
                        Project Status
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <span className="text-sm font-medium">Provisional Acceptance:</span>
                          <Badge variant={project.gecici_kabul_durumu?.toLowerCase().includes('tamam') ? 'default' : 'secondary'}>
                            {project.gecici_kabul_durumu || 'Not Specified'}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <span className="text-sm font-medium">Final Acceptance:</span>
                          <Badge variant={project.kesin_kabul_durumu?.toLowerCase().includes('tamam') ? 'default' : 'secondary'}>
                            {project.kesin_kabul_durumu || 'Not Specified'}
                          </Badge>
                        </div>

                        {project.gecici_teminat && (
                          <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                            <span className="text-sm font-medium">Temporary Guarantee:</span>
                            <span className="text-sm font-bold text-blue-600">{project.gecici_teminat}</span>
                          </div>
                        )}

                        {project.kesin_teminat && (
                          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                            <span className="text-sm font-medium">Final Guarantee:</span>
                            <span className="text-sm font-bold text-green-600">{project.kesin_teminat}</span>
                          </div>
                        )}

                        {project.sozlesme_bedeli && (
                          <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                            <span className="text-sm font-medium">Contract Amount:</span>
                            <span className="text-sm font-bold text-purple-600">{project.sozlesme_bedeli}</span>
                          </div>
                        )}

                        {project.avans_miktari && (
                          <div className="flex items-center justify-between p-3 bg-indigo-50 rounded-lg">
                            <span className="text-sm font-medium">Advance Amount:</span>
                            <span className="text-sm font-bold text-indigo-600">{project.avans_miktari}</span>
                          </div>
                        )}

                        {project.alinan_hakedisler && (
                          <div className="flex items-center justify-between p-3 bg-teal-50 rounded-lg">
                            <span className="text-sm font-medium">Received Payments:</span>
                            <span className="text-sm font-bold text-teal-600">{project.alinan_hakedisler}</span>
                          </div>
                        )}

                        {project.yapilan_harcamalar && (
                          <div className="flex items-center justify-between p-3 bg-rose-50 rounded-lg">
                            <span className="text-sm font-medium">Made Expenditures:</span>
                            <span className="text-sm font-bold text-rose-600">{project.yapilan_harcamalar}</span>
                          </div>
                        )}

                        {project.cari_durum && (
                          <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
                            <span className="text-sm font-medium">Current Status:</span>
                            <span className={`text-sm font-bold ${
                              parseFloat(project.cari_durum) > 0 
                                ? 'text-emerald-600' 
                                : parseFloat(project.cari_durum) < 0 
                                ? 'text-red-600' 
                                : 'text-gray-600'
                            }`}>
                              {project.cari_durum}
                            </span>
                          </div>
                        )}

                        {project.sure_uzatimi && (
                          <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                            <span className="text-sm font-medium">Time Extension:</span>
                            <span className="text-sm font-bold text-orange-600">{project.sure_uzatimi}</span>
                          </div>
                        )}
                      </div>

                      {project.finansman_kaynagi && (
                        <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
                          <h5 className="text-sm font-medium text-yellow-800 mb-2">Funding Source:</h5>
                          <p className="text-sm text-yellow-700">{project.finansman_kaynagi}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
