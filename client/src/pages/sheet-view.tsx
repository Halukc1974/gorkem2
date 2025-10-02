import { useParams } from "wouter";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { SheetTable } from "../components/sheet-table";
import { useSheets, useSheetData } from "../hooks/useSheets";
import { RefreshCw, Save, Download } from "lucide-react";
import { useToast } from "../hooks/use-toast";

export default function SheetView() {
  const { id } = useParams();
  const { toast } = useToast();
  
  // Get sheets to find the sheet name by id
  const { data: sheets } = useSheets();
  const sheet = sheets?.find((s: any) => s.id === id);
  
  // Get sheet data using sheet name
  const { data: sheetData, isLoading, error, refetch } = useSheetData(sheet?.name || '');

  const handleRefetch = async () => {
    try {
      await refetch();
    } catch (e) {
      console.warn('Refetch failed', e);
    }
  };

  const handleSaveToGoogleSheets = async () => {
    toast({
      title: 'Deprecated',
      description: "Google Sheets save client has been disabled on the client side. Please use admin settings.",
      variant: 'destructive'
    });
  };

  const handleExcelDownload = () => {
    if (!sheetData || !transformedData) return;

    // Download in CSV format
    const headers = sheetData.headers || [];
    const records = transformedData.records || [];
    
    let csvContent = "\uFEFF"; // UTF-8 BOM
    csvContent += headers.join(",") + "\n";
    
    records.forEach((record: any) => {
      const row = headers.map((header: any) => {
        const value = record[header] || "";
        // Escape special characters for CSV
        return `"${String(value).replace(/"/g, '""')}"`;
      });
      csvContent += row.join(",") + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${sheet?.name || 'sheet'}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Success",
      description: "Excel file downloaded",
    });
  };

  // Transform data to match expected format
  const transformedData = sheetData ? {
    sheet: sheet,
    records: sheetData.records,
    headers: sheetData.headers
  } : null;

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="h-6 bg-muted rounded w-48 mb-2"></div>
              <div className="h-4 bg-muted rounded w-24"></div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="h-10 bg-muted rounded w-48"></div>
              <div className="h-10 bg-muted rounded w-32"></div>
            </div>
          </div>
          <Card>
            <div className="p-6">
              <div className="h-96 bg-muted rounded"></div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card>
          <div className="p-6 text-center">
            <div className="text-destructive mb-4">
              <i className="fas fa-exclamation-triangle text-4xl"></i>
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">An Error Occurred</h3>
            <p className="text-muted-foreground">{(error as any)?.message ?? String(error)}</p>
          </div>
        </Card>
      </div>
    );
  }

  if (!transformedData) {
    return (
      <div className="p-6">
        <Card>
          <div className="p-6 text-center">
            <div className="text-muted-foreground mb-4">
              <i className="fas fa-table text-4xl"></i>
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Sheet Not Found</h3>
            <p className="text-muted-foreground">This sheet may not exist or may have been deleted.</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Control Buttons */}
      <div className="flex items-center justify-end gap-3">
        <Button
          variant="outline"
          onClick={handleRefetch}
          disabled={isLoading}
          className="text-foreground hover:bg-primary/5"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
        
        <Button
          variant="outline"
          onClick={handleSaveToGoogleSheets}
          disabled={isLoading || !sheetData}
          className="text-foreground hover:bg-primary/5"
        >
          <Save className="h-4 w-4 mr-2" />
          Save to Google Sheets
        </Button>

        <Button
          variant="outline"
          onClick={handleExcelDownload}
          disabled={isLoading || !sheetData || sheetData.headers.length === 0}
          className="text-foreground hover:bg-primary/5"
        >
          <Download className="h-4 w-4 mr-2" />
          Download Excel
        </Button>
      </div>

      {/* Data Table */}
        {(!sheetData || (sheetData.headers || []).length === 0) ? (
        <Card>
          <div className="p-6 text-center">
            <div className="text-muted-foreground mb-4">
              <i className="fas fa-table text-4xl"></i>
            </div>
            <h4 className="text-lg font-medium text-foreground mb-2">Sheet Empty</h4>
            <p className="text-muted-foreground mb-4">This sheet does not yet contain headers or data.</p>
          </div>
        </Card>
      ) : (
        <SheetTable
          headers={sheetData.headers}
          records={transformedData.records}
          sheetName={sheet?.name || ''}
          sheetTabId={sheet?.sheetTabId || 0}
          onDataChange={() => refetch()}
        />
      )}
    </div>
  );
}