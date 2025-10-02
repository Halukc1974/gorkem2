import { useState } from "react";
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { apiRequest } from '../lib/queryClient';
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { useToast } from "../hooks/use-toast";
import { useUpdateRecord } from "../hooks/useSheets";

interface SheetTableProps {
  headers: string[];
  records: any[];
  sheetName: string;
  onDataChange: () => void;
}

export default function SheetTable({ headers, records, sheetName, onDataChange }: SheetTableProps) {
  const [editingCell, setEditingCell] = useState<{row: number, col: number} | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 50;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateRecordMutation = useMutation({
    mutationFn: ({ rowIndex, data }: { rowIndex: number; data: any[] }) =>
      apiRequest("PUT", `/api/sheets/${sheetName}/records/${rowIndex}`, { data }),
    onSuccess: () => {
      onDataChange();
      toast({
        title: "Kayıt Güncellendi",
        description: "Kayıt başarıyla güncellendi.",
      });
    },
    onError: () => {
      toast({
        title: "Güncelleme Hatası",
        description: "Kayıt güncellenirken bir hata oluştu.",
        variant: "destructive",
      });
    },
  });

  const handleCellEdit = (rowIndex: number, colIndex: number, value: string) => {
    const updatedRow = [...records[rowIndex]];
    updatedRow[colIndex] = value;
    updateRecordMutation.mutate({ rowIndex, data: updatedRow });
    setEditingCell(null);
  };

  const handleKeyPress = (e: React.KeyboardEvent, rowIndex: number, colIndex: number) => {
    if (e.key === 'Enter') {
      const input = e.target as HTMLInputElement;
      handleCellEdit(rowIndex, colIndex, input.value);
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
  };

  const startIndex = (currentPage - 1) * recordsPerPage;
  const endIndex = startIndex + recordsPerPage;
  const paginatedRecords = records.slice(startIndex, endIndex);
  const totalPages = Math.ceil(records.length / recordsPerPage);

  return (
    <Card className="shadow-sm overflow-hidden">
      <div className="table-container overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted">
            <tr>
              {headers.map((header, index) => (
                <th 
                  key={index}
                  className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
                  data-testid={`header-${index}`}
                >
                  {header}
                </th>
              ))}
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                İşlemler
              </th>
            </tr>
          </thead>
          <tbody className="bg-card divide-y divide-border">
            {paginatedRecords.length === 0 ? (
              <tr>
                <td colSpan={headers.length + 1} className="px-6 py-12 text-center">
                  <div className="text-muted-foreground">
                    <i className="fas fa-table text-4xl mb-4"></i>
                    <p className="text-lg font-medium mb-2">Kayıt Bulunamadı</p>
                    <p>Bu sheet'te henüz veri bulunmuyor.</p>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedRecords.map((record, rowIndex) => (
                <tr 
                  key={startIndex + rowIndex}
                  className="hover:bg-muted/50 transition-colors"
                  data-testid={`row-${startIndex + rowIndex}`}
                >
                  {record.map((cell: any, colIndex: number) => (
                    <td 
                      key={colIndex}
                      className="px-6 py-4 text-sm text-foreground editable-cell"
                      data-testid={`cell-${startIndex + rowIndex}-${colIndex}`}
                    >
                      {editingCell?.row === startIndex + rowIndex && editingCell?.col === colIndex ? (
                        headers[colIndex]?.toLowerCase().includes('tür') ? (
                          <Select
                            defaultValue={cell?.toString() || ''}
                            onValueChange={(value) => handleCellEdit(startIndex + rowIndex, colIndex, value)}
                          >
                            <SelectTrigger className="h-8 border-none shadow-none">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Gelir">Gelir</SelectItem>
                              <SelectItem value="Gider">Gider</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            type={headers[colIndex]?.toLowerCase().includes('tutar') ? 'number' : 
                                  headers[colIndex]?.toLowerCase().includes('Date') ? 'date' : 'text'}
                            defaultValue={cell?.toString() || ''}
                            className="h-8 border-none shadow-none"
                            onKeyDown={(e) => handleKeyPress(e, startIndex + rowIndex, colIndex)}
                            onBlur={(e: React.FocusEvent<HTMLInputElement>) => handleCellEdit(startIndex + rowIndex, colIndex, e.target.value)}
                            autoFocus
                          />
                        )
                      ) : (
                        <span 
                          onClick={() => setEditingCell({ row: startIndex + rowIndex, col: colIndex })}
                          className="cursor-pointer hover:bg-accent rounded px-2 py-1 block"
                        >
                          {cell?.toString() || '-'}
                        </span>
                      )}
                    </td>
                  ))}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                    <div className="flex space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-primary hover:text-primary/80"
                        data-testid={`button-edit-${startIndex + rowIndex}`}
                        onClick={() => setEditingCell({ row: startIndex + rowIndex, col: 0 })}
                      >
                        <i className="fas fa-edit h-4 w-4"></i>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-6 py-3 bg-muted border-t border-border">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground" data-testid="text-pagination-info">
              <span>{startIndex + 1}-{Math.min(endIndex, records.length)}</span> / <span>{records.length}</span> kayıt gösteriliyor
            </p>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(page => Math.max(1, page - 1))}
                disabled={currentPage === 1}
                data-testid="button-previous-page"
              >
                Önceki
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))}
                disabled={currentPage === totalPages}
                data-testid="button-next-page"
              >
                Sonraki
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
