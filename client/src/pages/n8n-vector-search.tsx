import React, { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';

const GETS_URL = 'https://oz5ctrkt.rpcld.com/webhook/gets-letters';
const CHAIN_BW_URL = 'https://oz5ctrkt.rpcld.com/webhook/chain_bw';
const CHAIN_FW_URL = 'https://oz5ctrkt.rpcld.com/webhook/chain_fw';
const VECTOR_SEARCH_URL = 'https://oz5ctrkt.rpcld.com/webhook/vector_search';

function PrettyJson({ data }: { data: any }) {
  return (
    <pre className="bg-surface border p-4 rounded text-sm overflow-auto max-h-96">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

function isCorrespondenceShape(obj: any) {
  if (!obj || typeof obj !== 'object') return false;
  // expected keys that hold arrays
  const keys = ['inc_out', 'letter_no', 'letter_date', 'subject', 'content'];
  return keys.every(k => Array.isArray(obj[k]));
}

function LetterCard({ data, idx }: { data: any; idx: number }) {
  const incOut = data.inc_out?.[idx] || '';
  const letterNo = data.letter_no?.[idx] || '';
  const date = data.letter_date?.[idx] || '';
  const subject = data.subject?.[idx] || '';
  const spId = data.sp_id?.[idx] || '';
  const content = data.content?.[idx] || '';
  const refLetters = data.ref_letters?.[idx] || '';
  const severity = data.severity_rate?.[idx] || '';
  const keywords = data.keywords?.[idx] || '';
  const weburl = data.weburl?.[idx] || '';

  return (
    <article className="bg-white shadow-sm border rounded p-6 mb-6">
      <header className="flex items-start justify-between mb-4">
        <div>
          <div className="text-sm text-muted-foreground">{incOut?.toUpperCase()}</div>
          <h3 className="text-lg font-semibold">{subject}</h3>
          <div className="text-sm text-muted-foreground mt-1">No: <span className="font-medium">{letterNo}</span> • Date: {date}</div>
        </div>
        <div className="text-right text-sm">
          {spId && <div className="mb-1">SP ID: <span className="font-medium">{spId}</span></div>}
          {severity && <div className="text-xs text-muted-foreground">Önem: {severity}</div>}
        </div>
      </header>

      <section className="prose max-w-none mb-4 whitespace-pre-wrap text-sm text-foreground">{content}</section>

      <footer className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
        <div>
          {refLetters ? <div>Referanslar: {refLetters}</div> : null}
          {keywords ? <div className="mt-1">Anahtar Kelimeler: <span className="text-muted-foreground">{keywords}</span></div> : null}
        </div>
        <div className="text-right">
          {weburl ? (
            <a href={weburl} target="_blank" rel="noreferrer" className="text-primary underline">Kaynağı Aç</a>
          ) : null}
        </div>
      </footer>
    </article>
  );
}

export default function N8NVectorSearch() {
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<'gets' | 'chain_bw' | 'chain_fw' | 'vector'>('gets');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [rawResult, setRawResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isEmbedded, setIsEmbedded] = useState(false);

  // Check if page is embedded
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const embed = urlParams.get('embed') === 'true';
    const hideSidebar = urlParams.get('hideSidebar') === 'true';
    setIsEmbedded(embed && hideSidebar);
  }, []);

  const [letterNo, setLetterNo] = useState('');
  const [searchText, setSearchText] = useState('');
  const [threshold, setThreshold] = useState('0.3');

  const doGetAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(GETS_URL, { method: 'GET' });
      const json = await res.json();
      setRawResult(json);
      setResult(json);
    } catch (err: any) {
      setError(String(err?.message || err));
    } finally {
      setLoading(false);
    }
  };

  const displayed = useMemo(() => {
    if (!rawResult) return null;
    if (!isCorrespondenceShape(rawResult)) return rawResult;
    const kw = searchText.trim().toLowerCase();
    if (!kw) return rawResult;
    // build filtered arrays by including only indices where any field contains the keyword
    const len = rawResult.letter_no.length || 0;
    const keepIdx: number[] = [];
    for (let i = 0; i < len; i++) {
      const subject = (rawResult.subject?.[i] || '').toString().toLowerCase();
      const content = (rawResult.content?.[i] || '').toString().toLowerCase();
      const keywords = (rawResult.keywords?.[i] || '').toString().toLowerCase();
      if (subject.includes(kw) || content.includes(kw) || keywords.includes(kw)) {
        keepIdx.push(i);
      }
    }
    // produce new object with arrays filtered
    const filtered: any = {};
    for (const k of Object.keys(rawResult)) {
      if (Array.isArray(rawResult[k])) {
        filtered[k] = keepIdx.map(i => rawResult[k][i]);
      } else {
        filtered[k] = rawResult[k];
      }
    }
    return filtered;
  }, [rawResult, searchText]);

  const doPost = async (url: string, body: any) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      setResult(json);
    } catch (err: any) {
      setError(String(err?.message || err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      {!isEmbedded && (
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-semibold">n8n-vector-search</h2>
            <p className="text-sm text-muted-foreground">Webhook-based test UI — sends GET/POST requests and displays JSON output.</p>
          </div>
          <div>
            {/* <Button variant="ghost" onClick={() => setLocation('/settings')}>Back to Settings</Button> */}
          </div>
        </div>
      )}

      <div className="mb-4">
        <nav className="flex gap-2">
          <button onClick={() => setTab('gets')} className={`px-3 py-2 rounded ${tab==='gets'?'bg-primary text-primary-foreground':'bg-muted/40'}`}>All Correspondence</button>
          <button onClick={() => setTab('chain_bw')} className={`px-3 py-2 rounded ${tab==='chain_bw'?'bg-primary text-primary-foreground':'bg-muted/40'}`}>Backward References</button>
          <button onClick={() => setTab('chain_fw')} className={`px-3 py-2 rounded ${tab==='chain_fw'?'bg-primary text-primary-foreground':'bg-muted/40'}`}>Forward References</button>
          <button onClick={() => setTab('vector')} className={`px-3 py-2 rounded ${tab==='vector'?'bg-primary text-primary-foreground':'bg-muted/40'}`}>Vector Search</button>
        </nav>
      </div>

      <div className="bg-card border border-border rounded p-4">
        {tab === 'gets' && (
          <div className="space-y-4">
            <p className="text-sm">Fetches all correspondence from Supabase (GET). Click the button below.</p>
            <div className="flex gap-2 items-center">
              <Button onClick={doGetAll} disabled={loading}>{loading ? 'Loading...' : 'Fetch All Correspondence'}</Button>
              <Input
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                placeholder="Enter keyword to search.."
                className="w-80"
              />
              <Button variant="outline" onClick={() => { setSearchText(''); }} disabled={loading}>Clear</Button>
            </div>
            <p className="text-xs text-muted-foreground">The keyword you type will automatically filter results after they arrive. (Searched in subject/content/keywords)</p>
          </div>
        )}

        {tab === 'chain_bw' && (
          <div className="space-y-4">
            <p className="text-sm">Fetches backward references. `letter_no` should be sent as JSON.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>letter_no (single or array)</Label>
                <Input value={letterNo} onChange={e => setLetterNo(e.target.value)} placeholder='Example: IC-HQ-868 or ["IC-HQ-868"]' />
                <p className="text-xs text-muted-foreground mt-1">You don't need to write JSON; a simple number will be sent as a string. To send an array, use ["IC-HQ-868","IC-HQ-1037"].</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => {
                setError(null);
                let payload: any;
                const raw = letterNo.trim();
                if (!raw) { setError('Please provide letter_no.'); return; }
                // Try to parse JSON if it looks like JSON
                if ((raw.startsWith('{') && raw.endsWith('}')) || (raw.startsWith('[') && raw.endsWith(']')) || (raw.startsWith('"') && raw.endsWith('"'))) {
                  try {
                    payload = JSON.parse(raw);
                  } catch (err) {
                    setError('Unable to parse JSON. Please provide valid JSON or a simple string.');
                    return;
                  }
                } else {
                  // treat as plain string
                  payload = raw;
                }
                doPost(CHAIN_BW_URL, { letter_no: payload });
              }} disabled={loading}>Getir (POST)</Button>
            </div>
          </div>
        )}

        {tab === 'chain_fw' && (
          <div className="space-y-4">
            <p className="text-sm">Fetches forward references. `letter_no` should be sent as JSON.</p>
            <div>
              <Label>letter_no (single or array)</Label>
              <Input value={letterNo} onChange={e => setLetterNo(e.target.value)} placeholder='"IC-HQ-868" or ["IC-HQ-868"]' />
            </div>
            <div className="flex gap-2">
              <Button onClick={() => {
                setError(null);
                let payload: any;
                const raw = letterNo.trim();
                if (!raw) { setError('Please provide letter_no.'); return; }
                if ((raw.startsWith('{') && raw.endsWith('}')) || (raw.startsWith('[') && raw.endsWith(']')) || (raw.startsWith('"') && raw.endsWith('"'))) {
                  try {
                    payload = JSON.parse(raw);
                  } catch (err) {
                    setError('Unable to parse JSON. Please provide valid JSON or a simple string.');
                    return;
                  }
                } else {
                  payload = raw;
                }
                doPost(CHAIN_FW_URL, { letter_no: payload });
              }} disabled={loading}>Getir (POST)</Button>
            </div>
          </div>
        )}

        {tab === 'vector' && (
          <div className="space-y-4">
            <p className="text-sm">Fetches matching results with vector search. JSON to send: {`{ search_text: string, threshold: number }`}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>search_text</Label>
                <Input value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="Search text" />
              </div>
              <div>
                <Label>threshold</Label>
                <Input value={threshold} onChange={e => setThreshold(e.target.value)} placeholder="0.3" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => {
                const t = Number(threshold);
                if (!searchText) { setError('Search text cannot be empty.'); return; }
                if (Number.isNaN(t)) { setError('Threshold must be numeric.'); return; }
                doPost(VECTOR_SEARCH_URL, { search_text: searchText, threshold: t });
              }} disabled={loading}>{loading ? 'Aranıyor...' : 'Ara (POST)'}</Button>
            </div>
            // Vector search extension point: add custom logic or debug output here if needed.
          </div>
        )}

        <div className="mt-6">
          {error && <div className="text-destructive mb-2">{error}</div>}
          {displayed ? (
            isCorrespondenceShape(displayed) ? (
              <div>
                {Array.from({ length: displayed.letter_no.length }).map((_, i) => (
                  <LetterCard key={i} data={displayed} idx={i} />
                ))}
              </div>
            ) : (
              <PrettyJson data={displayed} />
            )
          ) : (
            <div className="text-sm text-muted-foreground">Henüz sonuç yok. İstek yapın.</div>
          )}
        </div>
      </div>
    </div>
  );
}
