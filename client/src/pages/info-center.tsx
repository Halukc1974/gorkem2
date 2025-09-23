import React, { useEffect, useMemo, useState } from 'react';
import { useInfoCenterPage } from '../hooks/useInfoCenterPage';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

// PrimeReact styles (imported here to keep changes localized)
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
import { Button as PButton } from 'primereact/button';
import type { SortableFields } from '../hooks/useInfoCenterPage';
import { useUserSettings } from '../hooks/useUserSettingsFirebase';

// Local styles for filter layout (from user)
const filterStyles = `
.ui-filter-column .ui-column-customfilter .custom-filter {
    width: 100%;
    box-sizing: border-box;
}
`;

function WebUrlBody(rowData: any) {
  const url = rowData?.web_url || rowData?.weburl;
  return url ? (
    <a href={url} target="_blank" rel="noreferrer" className="text-blue-600 underline">
      Link
    </a>
  ) : (
    ''
  );
}

function ContentPreviewBody(rowData: any, { onPreview }: any) {
  // render a small magnifier/icon button
  return (
    <button
      type="button"
      className="p-button p-button-text"
      onClick={() => onPreview(rowData)}
      title="İçeriği önizle"
      style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}
    >
      <i className="pi pi-search" style={{ fontSize: '1.1rem', color: '#0b5cff' }} aria-hidden />
    </button>
  );
}

function DateBody(rowData: any) {
  const d = rowData?.letter_date;
  if (!d) return '';
  const dt = typeof d === 'string' ? new Date(d) : d;
  return <span>{dt.toLocaleDateString()}</span>;
}

function SeverityBody(rowData: any) {
  const v = rowData?.severity_rate;
  const raw = Number(v);
  const num = Number.isFinite(raw) ? raw : 0;
  // expected scale 0-10 -> convert to percent
  const pct = Math.max(0, Math.min(100, (num / 10) * 100));
  return (
    <div className="flex items-center gap-2" style={{ alignItems: 'center' }}>
      <div style={{ flex: 1 }}>
        <ProgressBar value={pct} showValue={false} style={{ height: '0.5rem', background: '#f0f0f0' }} />
      </div>
      <div style={{ minWidth: 48, textAlign: 'right', fontSize: 12 }}>{num}/10</div>
    </div>
  );
}

interface PageQuery {
  pageIndex: number;
  pageSize: number;
  search?: string;
  sortField?: SortableFields;
  sortOrder?: 'asc' | 'desc';
}

export default function InfoCenterPage(): JSX.Element {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState<string>('');

  const handlePreview = (row: any) => {
    // prefer content field, fall back to short_desc
    const c = row?.content ?? row?.short_desc ?? '';
    setPreviewContent(String(c));
    setPreviewOpen(true);
  };

  const [globalFilter, setGlobalFilter] = useState<string>('');
  const [filters, setFilters] = useState<any>(null);
  const [globalFilterOnly, setGlobalFilterOnly] = useState<boolean>(false);
  const [savedFilters, setSavedFilters] = useState<any>(null);
  
  // debounce the global filter to avoid firing a request on every keystroke
  const [debouncedFilter, setDebouncedFilter] = useState<string>('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedFilter(globalFilter), 300);
    return () => clearTimeout(t);
  }, [globalFilter]);

  // Server-side state
  const [query, setQuery] = useState<PageQuery>({
    pageIndex: 0,
    pageSize: 25,
    sortField: 'letter_date',
    sortOrder: 'desc'
  });
  
  const { data: pageResult, isLoading, error } = useInfoCenterPage({ 
    ...query,
    search: debouncedFilter 
  });
  const data = pageResult?.rows || [];
  const totalRecords = pageResult?.total ?? 0;

  // User settings (Firestore) - used to persist visible columns
  const { config, updateConfig } = useUserSettings();

  // default visibility map
  const DEFAULT_COLUMN_VISIBILITY: Record<string, boolean> = {
    inc_out: true,
    letter_no: true,
    letter_date: true,
    short_desc: true,
    ref_letters: true,
    severity_rate: true,
    keywords: true,
    preview: true,
    web_url: true
  };

  const visibleColumns = (config as any)?.infoCenter?.columns || DEFAULT_COLUMN_VISIBILITY;

  // modal state for editing columns
  const [columnsModalOpen, setColumnsModalOpen] = useState(false);
  const [editingColumns, setEditingColumns] = useState<Record<string, boolean>>(visibleColumns);

  useEffect(() => {
    // keep editing copy in sync when config changes
    setEditingColumns((config as any)?.infoCenter?.columns || DEFAULT_COLUMN_VISIBILITY);
  }, [config]);

  const openColumnsModal = () => setColumnsModalOpen(true);
  const closeColumnsModal = () => setColumnsModalOpen(false);

  const saveColumns = async () => {
    try {
      // persist under infoCenter.columns in user config
      await updateConfig({ infoCenter: { columns: editingColumns } } as any);
      setColumnsModalOpen(false);
    } catch (err) {
      console.error('Failed to save column settings', err);
      // keep modal open so user can retry
    }
  };

  useEffect(() => {
    if (error) console.error('Info Center error', error);
  }, [error]);

  // Initialize filters when component mounts
  useEffect(() => {
    setFilters({
      global: { value: null, matchMode: 'contains' },
      letter_no: { value: null, matchMode: 'contains' },
      short_desc: { value: null, matchMode: 'contains' },
      ref_letters: { value: null, matchMode: 'contains' },
      severity_rate: { value: null, matchMode: 'equals' },
      letter_date: { value: null, matchMode: 'dateRange' },
      keywords: { value: null, matchMode: 'contains' }
    });
  }, []);

  const severityOptions = useMemo(() => {
    const set = new Set<string>();
    (data || []).forEach((r: any) => {
      if (r?.severity_rate) set.add(String(r.severity_rate));
    });
    return Array.from(set).map((s) => ({ label: s, value: s }));
  }, [data]);

  // header moved into CardHeader to avoid overlapping the Card title

  const footer = (
    <div className="flex align-items-center justify-content-center">
      <span>
        Total documents: {totalRecords}
      </span>
    </div>
  );

  return (
    <div className="container mx-auto p-6">
      <style>{filterStyles + `
        /* PrimeReact-specific filter elements full width */
        .p-column-filter .p-inputtext,
        .p-column-filter .p-dropdown,
        .p-column-filter .p-calendar,
        .p-column-filter .p-inputnumber {
          width: 100% !important;
          box-sizing: border-box;
        }
        .p-datatable .p-datatable-thead > tr > th {
          vertical-align: middle;
        }
        /* row separators: faint light line */
        .p-datatable .p-datatable-tbody > tr > td {
          border-bottom: 1px solid rgba(0,0,0,0.06);
        }
        /* ensure header search sits above table and doesn't overlap */
        .card-header .p-input-icon-left {
          z-index: 5;
        }
      `}</style>
      <Card>
        <CardHeader>
            <div className="flex justify-between items-center w-full">
                <CardTitle>INFO CENTER</CardTitle>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ marginRight: 8 }}>
                    <InputText
                      placeholder="Anahtar kelime ara..."
                      value={globalFilter}
                      onChange={(e) => {
                        const v = (e.target as HTMLInputElement).value;
                        setGlobalFilter(v);
                        if (globalFilterOnly) {
                          setFilters({ global: { value: v, matchMode: 'contains' } });
                        } else {
                          setFilters((f: any) => ({ ...f, global: { ...(f?.global || {}), value: v } }));
                        }
                      }}
                      className="w-48 border-2 border-black rounded px-2 py-1"
                    />
                  </span>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      if (!globalFilterOnly) {
                        setSavedFilters(filters);
                        setFilters({ global: { value: globalFilter || null, matchMode: 'contains' } });
                        setGlobalFilterOnly(true);
                      } else {
                        setFilters(savedFilters || filters);
                        setGlobalFilterOnly(false);
                      }
                    }}
                  >
                    
                  </button>
                  {/* Gear / columns settings button */}
                  <PButton icon="pi pi-cog" className="p-button-text" onClick={openColumnsModal} aria-label="Sütun ayarları" />
                </div>
            </div>
          </CardHeader>
          <CardContent>
          {isLoading ? (
            <div className="p-6">Veriler Yükleniyor...</div>
          ) : error ? (
            <div className="p-6 text-red-600">Veri Çekilemedi: {String(error)}</div>
          ) : (
            <div>
              <DataTable
                value={data}
                lazy
                paginator
                first={query.pageIndex * query.pageSize}
                rows={query.pageSize}
                totalRecords={totalRecords}
                rowsPerPageOptions={[10, 25, 50, 100]}
                onPage={(e) => {
                  setQuery(prev => ({
                    ...prev,
                    pageIndex: Math.floor(e.first / e.rows),
                    pageSize: e.rows
                  }));
                }}
                onSort={(e) => {
                  const field = e.sortField as SortableFields;
                  const order = e.sortOrder === 1 ? 'asc' : 'desc';
                  setQuery(prev => ({
                    ...prev,
                    sortField: field,
                    sortOrder: order
                  }));
                }}
                sortField={query.sortField}
                sortOrder={query.sortOrder === 'asc' ? 1 : -1}
                loading={isLoading}
                responsiveLayout="scroll"
                footer={footer}
                filters={filters}
                filterDisplay="row"
                globalFilterFields={["letter_no", "short_desc", "keywords", "ref_letters"]}
                emptyMessage="No records found"
                className="p-datatable-gridlines"
              >
                {visibleColumns.inc_out && (
                  <Column
                    header="Tip"
                    body={(rowData: any) => {
                      const v = (rowData?.inc_out ?? rowData?.['inc-out'] ?? rowData?.inc_out)?.toString().toLowerCase();
                      const isIncoming = v === 'incoming' || v === 'gelen' || v === 'in';
                      const label = isIncoming ? 'Gelen' : (v ? 'Giden' : '—');
                      const color = isIncoming ? '#10b981' : (v ? '#ef4444' : '#9ca3af');
                      return (
                        <span style={{ display: 'inline-block', padding: '4px 8px', borderRadius: 12, background: color, color: 'white', fontSize: 12 }}>
                          {label}
                        </span>
                      );
                    }}
                    style={{ width: '6rem', textAlign: 'center' }}
                  />
                )}
                {visibleColumns.letter_no && (
                  <Column
                    field="letter_no"
                    header="letter_no"
                    sortable
                  />
                )}
                {visibleColumns.letter_date && (
                  <Column
                    field="letter_date"
                    header="letter_date"
                    sortable
                    body={DateBody}
                  />
                )}
                {visibleColumns.short_desc && (
                  <Column
                    field="short_desc"
                    header="short_desc"
                    sortable
                  />
                )}
                {visibleColumns.ref_letters && (
                  <Column
                    field="ref_letters"
                    header="ref_letters"
                    sortable
                  />
                )}
                {visibleColumns.severity_rate && (
                  <Column
                    field="severity_rate"
                    header="severity_rate"
                    sortable
                    body={SeverityBody}
                  />
                )}
                {visibleColumns.keywords && (
                  <Column
                    field="keywords"
                    header="keywords"
                    sortable
                  />
                )}
                {visibleColumns.preview && (
                  <Column
                    header="Önizle"
                    body={(rowData: any) => ContentPreviewBody(rowData, { onPreview: handlePreview })}
                    style={{ width: '3.5rem', textAlign: 'center' }}
                  />
                )}
                {visibleColumns.web_url && (
                  <Column
                    field="web_url"
                    header="web_url"
                    body={WebUrlBody}
                  />
                )}
              </DataTable>
              {/* Preview dialog */}
              <Dialog header="Belge İçeriği" visible={previewOpen} style={{ width: '60vw' }} onHide={() => setPreviewOpen(false)}>
                <div style={{ maxHeight: '60vh', overflow: 'auto', whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
                  {previewContent || <i>İçerik bulunamadı</i>}
                </div>
              </Dialog>
              {/* Columns settings dialog */}
              <Dialog header="Sütun Ayarları" visible={columnsModalOpen} style={{ width: '28vw' }} onHide={closeColumnsModal} footer={(
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <PButton label="İptal" className="p-button-text" onClick={closeColumnsModal} />
                  <PButton label="Kaydet" icon="pi pi-check" onClick={saveColumns} />
                </div>
              )}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {Object.keys(DEFAULT_COLUMN_VISIBILITY).map((key) => (
                    <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input type="checkbox" checked={!!editingColumns[key]} onChange={(e) => setEditingColumns(prev => ({ ...prev, [key]: e.target.checked }))} />
                      <span style={{ textTransform: 'capitalize' }}>{key.replace('_', ' ')}</span>
                    </label>
                  ))}
                </div>
              </Dialog>
            </div>
          )}
          </CardContent>
      </Card>
    </div>
  );
}
