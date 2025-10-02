import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useAddRecord } from "@/hooks/useSheets";
import { addRecordFormSchema, type AddRecordForm } from "@shared/schema";

interface AddRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  sheetName: string;
  headers: string[];
  onSuccess: () => void;
}

export default function AddRecordModal({ isOpen, onClose, sheetName, headers, onSuccess }: AddRecordModalProps) {
  const { toast } = useToast();
  const addRecordMutation = useAddRecord();

  const form = useForm<AddRecordForm>({
    resolver: zodResolver(addRecordFormSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      description: "",
      amount: 0,
      type: undefined,
      category: "",
    },
  });

  const onSubmit = (data: AddRecordForm) => {
    addRecordMutation.mutate({ sheetName, record: data }, {
      onSuccess: () => {
        toast({
          title: "Kayıt Eklendi",
          description: "Yeni kayıt başarıyla eklendi.",
        });
        form.reset();
        onSuccess();
      },
      onError: () => {
        toast({
          title: "Ekleme Hatası",
          description: "Kayıt eklenirken bir hata oluştu.",
          variant: "destructive",
        });
      },
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md" data-testid="modal-add-record">
        <DialogHeader>
          <DialogTitle>Yeni Kayıt Ekle</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date</FormLabel>
                  <FormControl>
                    <Input 
                      type="date" 
                      {...field} 
                      data-testid="input-record-date"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Açıklama</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="İşlem açıklaması" 
                      {...field} 
                      data-testid="input-record-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tutar</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="0" 
                      {...field} 
                      onChange={(e) => field.onChange(Number(e.target.value))}
                      data-testid="input-record-amount"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tür</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-record-type">
                        <SelectValue placeholder="Seçiniz" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Gelir">Gelir</SelectItem>
                      <SelectItem value="Gider">Gider</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kategori</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Kategori" 
                      {...field} 
                      data-testid="input-record-category"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="flex space-x-3 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                className="flex-1"
                onClick={onClose}
                data-testid="button-cancel-record"
              >
                İptal
              </Button>
              <Button 
                type="submit" 
                className="flex-1"
                disabled={addRecordMutation.isPending}
                data-testid="button-save-record"
              >
                {addRecordMutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
