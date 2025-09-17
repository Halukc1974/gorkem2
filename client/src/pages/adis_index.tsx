import React, { useEffect, useRef } from 'react';

export default function AdisIndexPage(): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadScript = (src: string) => new Promise<void>((resolve, reject) => {
      // Don't add the same script twice
      const existing = Array.from(document.getElementsByTagName('script')).find(s => s.src === src);
      if (existing) {
        existing.addEventListener('load', () => resolve());
        if ((existing as any).loaded) resolve();
        return;
      }
      const s = document.createElement('script');
      s.src = src;
      s.async = false;
      s.onload = () => {
        (s as any).loaded = true;
        resolve();
      };
      s.onerror = () => reject(new Error('Failed to load ' + src));
      document.head.appendChild(s);
    });

    const ensureCss = (href: string) => {
      if (!Array.from(document.getElementsByTagName('link')).some(l => l.href === href)) {
        const l = document.createElement('link');
        l.rel = 'stylesheet';
        l.href = href;
        document.head.appendChild(l);
      }
    };

    (async () => {
      try {
        // load jQuery then select2
        await loadScript('https://code.jquery.com/jquery-3.6.0.min.js');
        ensureCss('https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/css/select2.min.css');
        await loadScript('https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/js/select2.min.js');

        if (!mounted) return;

        // Now run the page's inline script logic (initialize select2, bind events)
        // Encapsulate to avoid leaking variables to global scope
        (function initForm() {
          try {
            // eslint-disable-next-line no-undef
            const $ = (window as any).jQuery;
            if (!$) return;

            const selectEl = $('#yazismaSelect');
            try { selectEl.select2({ placeholder: 'Select Referenced Letters', allowClear: true }); } catch (e) { /* ignore */ }

            // Keep selected PDF in memory after upload or manual selection
            let cachedPdfFile: File | null = null;
            const pdfInput = document.getElementById('pdfInput') as HTMLInputElement | null;
            if (pdfInput) {
              pdfInput.addEventListener('change', (e: Event) => {
                const target = e.target as HTMLInputElement;
                cachedPdfFile = (target.files && target.files[0]) ? target.files[0] : null;
              });
            }

            let originalLetterNo: string | null = null;
            let canSaveGate = false;

            function setCanSaveGate(v: boolean) {
              canSaveGate = v;
              validateRequired();
            }

            function validateRequired(showAll = false) {
              const fields = [
                { id: 'direction' },
                { id: 'letterClass' },
                { id: 'letterType' },
                { id: 'letterNo', trim: true },
                { id: 'letterDate' },
                { id: 'responseStatus' },
                { id: 'subject', trim: true },
                { id: 'letterContent', trim: true },
              ];

              let allValid = true;
              fields.forEach(f => {
                const el = document.getElementById(f.id) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
                if (!el) return;
                const valRaw: any = (el as any).value;
                const val = f.trim ? String(valRaw || '').trim() : valRaw;
                const errEl = document.getElementById(`err-${f.id}`);
                const empty = !val;

                if (empty) {
                  allValid = false;
                  el.classList.add('invalid');
                  if (errEl) (errEl as HTMLElement).style.display = 'block';
                } else {
                  el.classList.remove('invalid');
                  if (errEl) (errEl as HTMLElement).style.display = 'none';
                }
              });

              const submitBtn = document.getElementById('submitBtn') as HTMLButtonElement | null;
              if (submitBtn) submitBtn.disabled = !(canSaveGate && allValid);
              return allValid;
            }

            // Live validation bindings
            ['direction','letterClass','letterType','letterNo','letterDate','responseStatus','subject','letterContent']
              .forEach(id => {
                const el = document.getElementById(id);
                if (!el) return;
                const evt = (el.tagName === 'SELECT' || (el as any).type === 'date') ? 'change' : 'input';
                el.addEventListener(evt, () => validateRequired());
              });

            function setReferencedLetters(refLetters: any) {
              const arr = Array.isArray(refLetters) ? refLetters : [];
              const selections = arr.map(item => {
                if (item && typeof item === 'object') {
                  const id = item.LookupId ?? item.id ?? item.value ?? '';
                  const text = item.LookupValue ?? item.yazisma_no ?? item.text ?? item.label ?? String(id);
                  return { id: String(id), text: String(text) };
                }
                return { id: String(item), text: String(item) };
              });

              selections.forEach(s => {
                if (!s.id) return;
                if (selectEl.find(`option[value="${s.id}"]`).length === 0) {
                  const opt = new Option(s.text || s.id, s.id, false, false);
                  selectEl.append(opt);
                }
              });
              const ids = selections.map(s => s.id).filter(Boolean);
              try { selectEl.val(ids).trigger('change'); } catch (e) {}
            }

            function populateFormFromData(data: any) {
              (document.getElementById('letterClass') as HTMLSelectElement).value = data.letter_class || '';
              document.getElementById('letterClass')?.dispatchEvent(new Event('change'));
              (document.getElementById('direction') as HTMLSelectElement).value = data.direction || '';
              (document.getElementById('letterType') as HTMLSelectElement).value = data.letter_type || '';
              (document.getElementById('letterNo') as HTMLInputElement).value = data.letter_no || '';
              (document.getElementById('letterDate') as HTMLInputElement).value = data.date || '';
              (document.getElementById('subject') as HTMLTextAreaElement).value = data.subject || '';
              (document.getElementById('letterContent') as HTMLTextAreaElement).value = data.letterContent || '';
              (document.getElementById('manufacturer') as HTMLInputElement).value = data.Manufac || '';
              (document.getElementById('responseStatus') as HTMLSelectElement).value = data.response_status || '';
              setReferencedLetters(data.ref_letters);
              try { $('#groupCheckboxes').val(data.groups || []).trigger('change'); } catch(e){}
              try { $('#counterpartyCheckboxes').val(data.counterparty || []).trigger('change'); } catch(e){}
              try { $('#keysubjectCheckboxes').val(data.key_subject || []).trigger('change'); } catch(e){}
              setTimeout(() => {
                try { $('#submittalType').val(data.subm_type || []).trigger('change'); } catch(e){}
                (document.getElementById('submittalStatus') as HTMLSelectElement).value = data.onay_durumu || '';
                (document.getElementById('DecisionDate') as HTMLInputElement).value = data.onay_tarih || '';
              }, 0);
              validateRequired();
            }

            function toggleSubmittalSection() {
              const letterClass = (document.getElementById('letterClass') as HTMLSelectElement).value;
              document.getElementById('submittalSection')!.style.display = letterClass === 'SUBMITTALS' ? 'block' : 'none';
            }
            document.getElementById('letterClass')?.addEventListener('change', toggleSubmittalSection);
            toggleSubmittalSection();

            // Mode handling
            function updateModeUI() {
              const mode = (document.querySelector('input[name="formMode"]:checked') as HTMLInputElement).value;
              const showEdit = mode === 'edit';
              document.getElementById('uploadSection')!.style.display = showEdit ? 'none' : 'block';
              document.getElementById('editSection')!.style.display = showEdit ? 'block' : 'none';
              const ln = document.getElementById('letterNo') as HTMLInputElement;
              const note = document.getElementById('edit-letterno-note');
              if (showEdit) { ln.readOnly = true; if (note) note.style.display = 'block'; } else { ln.readOnly = false; if (note) note.style.display = 'none'; originalLetterNo = null; }
              setCanSaveGate(false);
              (document.getElementById('submitBtn') as HTMLButtonElement).disabled = true;
              if (!showEdit) document.getElementById('loadStatus')!.textContent = '';
              else document.getElementById('uploadStatus')!.textContent = '';
            }
            document.querySelectorAll('input[name="formMode"]').forEach(r => r.addEventListener('change', updateModeUI));
            updateModeUI();

            // Load existing letter
            document.getElementById('loadLetterBtn')?.addEventListener('click', async () => {
              const letterNo = (document.getElementById('editLetterNo') as HTMLInputElement).value.trim();
              if (!letterNo) { alert('Please enter a Letter No to load.'); return; }
              document.getElementById('loadStatus')!.textContent = 'Loading letter...';
              try {
                const response = await fetch('https://oz5ctrkt.rpcld.com/webhook/get_letter', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ letter_no: letterNo })
                });
                if (!response.ok) throw new Error('Failed to load letter');
                const data = await response.json();
                populateFormFromData(data);
                originalLetterNo = data.letter_no || letterNo;
                document.getElementById('loadStatus')!.textContent = 'Letter loaded.';
                setCanSaveGate(true);
              } catch (err) {
                console.error(err);
                document.getElementById('loadStatus')!.textContent = 'Letter could not be loaded.';
              }
            });

            // Upload
            document.getElementById('uploadBtn')?.addEventListener('click', async () => {
              const fi = document.getElementById('pdfInput') as HTMLInputElement | null;
              const file = fi && fi.files && fi.files[0];
              if (!file) { alert('Lütfen bir PDF seçiniz!'); return; }
              cachedPdfFile = file;
              const formData = new FormData();
              formData.append('file', file);
              document.getElementById('uploadStatus')!.textContent = 'Yükleniyor...';
              try {
                const response = await fetch('https://oz5ctrkt.rpcld.com/webhook/upload_pdf', { method: 'POST', body: formData });
                const data = await response.json();
                populateFormFromData(data);
                document.getElementById('uploadStatus')!.textContent = 'Letter information loaded!';
                setCanSaveGate(true);
              } catch (err) {
                console.error(err);
                document.getElementById('uploadStatus')!.textContent = 'Loading Failed!';
              }
            });

            // Fetch list
            document.getElementById('fetchBtn')?.addEventListener('click', async () => {
              const statusEl = document.getElementById('status');
              if (!statusEl) return;
              statusEl.textContent = 'Getting list...';
              const selected = selectEl.find('option:selected').map((i: any, opt: any) => ({ id: String(opt.value), text: opt.text })).get();
              selectEl.empty();
              try {
                const response = await fetch('https://oz5ctrkt.rpcld.com/webhook/yazisma-list');
                const data = await response.json();
                data.list.forEach((item: any) => {
                  const option = new Option(item.yazisma_no, String(item.id), false, false);
                  selectEl.append(option);
                });
                selected.forEach((s: any) => {
                  if (s.id && selectEl.find(`option[value="${s.id}"]`).length === 0) selectEl.append(new Option(s.text || s.id, s.id, false, false));
                });
                selectEl.val(selected.map((s: any) => s.id)).trigger('change');
                statusEl.textContent = `${data.list.length} number of letters found.`;
              } catch (err) { console.error(err); statusEl.textContent = 'Error during getting list!'; }
            });

            // Submit
            document.getElementById('submitBtn')?.addEventListener('click', async () => {
              if (!validateRequired(true)) { alert('Please fill all required fields.'); return; }
              const pdfInputEl = document.getElementById('pdfInput') as HTMLInputElement | null;
              const formData = new FormData();
              const mode = (document.querySelector('input[name="formMode"]:checked') as HTMLInputElement).value;
              formData.append('mode', mode);
              formData.append('direction', (document.getElementById('direction') as HTMLSelectElement).value);
              formData.append('letter_type', (document.getElementById('letterType') as HTMLSelectElement).value);
              const currentLetterNo = (document.getElementById('letterNo') as HTMLInputElement).value;
              const letterNoToSend = (mode === 'edit') ? (originalLetterNo || currentLetterNo) : currentLetterNo;
              formData.append('letter_no', letterNoToSend);
              formData.append('letter_class', (document.getElementById('letterClass') as HTMLSelectElement).value);
              formData.append('date', (document.getElementById('letterDate') as HTMLInputElement).value);
              formData.append('response_status', (document.getElementById('responseStatus') as HTMLSelectElement).value);
              formData.append('subject', (document.getElementById('subject') as HTMLTextAreaElement).value);
              formData.append('letterContent', (document.getElementById('letterContent') as HTMLTextAreaElement).value);
              formData.append('onay_durumu', (document.getElementById('submittalStatus') as HTMLSelectElement).value);
              formData.append('onay_tarih', (document.getElementById('DecisionDate') as HTMLInputElement).value);
              formData.append('Manufac', (document.getElementById('manufacturer') as HTMLInputElement).value);
              const appendArray = (fd: FormData, name: string, val: any) => {
                const arr = Array.isArray(val) ? val : (val ? [val] : []);
                arr.forEach((v: any) => fd.append(`${name}[]`, v));
              };
              try { appendArray(formData, 'groups', ($('#groupCheckboxes').val())); } catch(e){}
              try { appendArray(formData, 'counterparty', ($('#counterpartyCheckboxes').val())); } catch(e){}
              try { appendArray(formData, 'key_subject', ($('#keysubjectCheckboxes').val())); } catch(e){}
              try { appendArray(formData, 'subm_type', ($('#submittalType').val())); } catch(e){}
              const refs = ($('#yazismaSelect').val() || []);
              if (!refs || refs.length === 0) { formData.append('references[]', ''); } else { refs.forEach((v: any) => formData.append('references[]', v)); }
              const fileToSend = (pdfInputEl && pdfInputEl.files && pdfInputEl.files[0]) ? pdfInputEl.files[0] : cachedPdfFile;
              if (fileToSend) formData.append('file', fileToSend, fileToSend.name);
              try {
                const response = await fetch('https://oz5ctrkt.rpcld.com/webhook/submit_letter', { method: 'POST', body: formData });
                if (response.ok) {
                  alert('Document saved!');
                  if (pdfInputEl) pdfInputEl.value = '';
                  cachedPdfFile = null;
                  (document.querySelector('input[name="formMode"][value="new"]') as HTMLInputElement).checked = true;
                  updateModeUI();
                  (document.getElementById('submitBtn') as HTMLButtonElement).disabled = true;
                  document.querySelectorAll('input, select, textarea').forEach(element => {
                    if ((element as HTMLInputElement).type !== 'radio' && (element as HTMLInputElement).type !== 'checkbox') {
                      (element as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value = '';
                    }
                  });
                  try { $('#groupCheckboxes, #counterpartyCheckboxes, #keysubjectCheckboxes, #submittalType, #yazismaSelect').val(null).trigger('change'); } catch(e){}
                } else {
                  alert('Error occurred while saving!');
                }
              } catch (err) { console.error(err); alert('Connection error!'); }
            });

          } catch (err) {
            // ignore init errors
            console.error('initForm error', err);
          }
        })();
      } catch (err) {
        console.error('Failed to load external libs for adis_index', err);
      }
    })();

    return () => { mounted = false; };
  }, []);

  // Render the page HTML (copy of provided body fragment)
  const inner = `
  <div class="container">
    <h2>INFO CENTER LETTER REGISTRATION FORM</h2>

    <!-- MODE SWITCH -->
    <div class="form-section">
      <h3>Mode</h3>
      <div class="mode-options">
        <label>
          <input type="radio" name="formMode" value="new" checked> Register new letter
        </label>
        <label>
          <input type="radio" name="formMode" value="edit"> Edit existing letter
        </label>
      </div>

      <div id="editSection" style="display: none; margin-top: 10px;">
        <label>Letter No to edit:</label>
        <input type="text" id="editLetterNo" style="max-width: 95%; width: 100%;" placeholder="Enter existing Letter No">
        <button class="btn" id="loadLetterBtn">Load Letter</button>
        <div id="loadStatus"></div>
      </div>
    </div>

    <!-- 1) DOSYA YÜKLEME ALANI -->
    <div class="form-section" id="uploadSection">
      <h3>PDF Letter Upload</h3>
      <input type="file" style="max-width: 95%; width: 100%;" id="pdfInput" accept="application/pdf">
      <button class="btn" id="uploadBtn">Upload Doc & Wait for the Processing</button>
      <div id="uploadStatus"></div>
    </div>

    <!-- 2) META VERİ FORMU -->
    <div class="form-section">
      <h3>Informations about the Letter</h3>

      <div style="display: flex; gap: 1px;">
        <div style="flex: 1;">
          <label class="required-star">Incoming/Outgoing:</label>
          <select id="direction" style="width: 200px; font-size: medium;">
            <option value="incoming">Incoming</option>
            <option value="outgoing">Outgoing</option>
          </select>
          <div class="field-error" id="err-direction">This field is required.</div>
        </div>
        <div style="flex: 1;">
          <label class="required-star">Letter Class:</label>
          <select id="letterClass" style="width: 200px; font-size: medium;">
            <option value="CORRESPONDENCE">CORRESPONDENCE</option>
            <option value="SUBMITTALS">SUBMITTALS</option>
          </select>
          <div class="field-error" id="err-letterClass">This field is required.</div>
        </div>
        <div style="flex: 1;">
          <label class="required-star">Letter Type:</label>
          <select id="letterType" style="width: 200px; font-size: medium;">
            <option value="Normal">Normal</option>
            <option value="Test Result">Test Result/Request</option>
            <option value="RE to Consultant">RE to Consultant</option>
            <option value="CAN">CAN</option>
          </select>
          <div class="field-error" id="err-letterType">This field is required.</div>
        </div>
      </div>

      <div style="display: flex; gap: 1px;">
        <div style="flex: 1;">
          <label class="required-star">Letter No:</label>
          <input type="text" id="letterNo" style="width: 184px; font-size: medium;" placeholder="Enter Letter No">
          <div class="field-error" id="err-letterNo">This field is required.</div>
          <div id="edit-letterno-note" style="display:none; color:#555; font-size:12px;">Letter No is locked in Edit mode.</div>
        </div>
        <div style="flex: 1;">
          <label class="required-star">Letter Date:</label>
          <input type="date" id="letterDate" style="width: 184px; font-size: medium;" placeholder="Select Letter Date">
          <div class="field-error" id="err-letterDate">This field is required.</div>
        </div>
        <div style="flex: 1;">
          <label class="required-star">Response Status:</label>
          <select id="responseStatus" style="width: 200px; font-size: medium;">
            <option value="Cevap Bekliyor">Pending Reply</option>
            <option value="Cevap Gerekmiyor">No need for Reply</option>
          </select>
          <div class="field-error" id="err-responseStatus">This field is required.</div>
        </div>
      </div>

      <label class="required-star">Subject:</label>
      <textarea id="subject" style="width: 95%; max-width: 95%; font-size: small;" placeholder="Enter Subject"></textarea>
      <div class="field-error" id="err-subject">This field is required.</div>

      <label class="required-star">Content of the Letter:</label>
      <textarea id="letterContent" style="width: 95%; height: 200px; max-width: 95%; font-size: small;" placeholder="Enter Content of the Letter"></textarea>
      <div class="field-error" id="err-letterContent">This field is required.</div>

      <div style="display: flex; max-width: 100%; gap: 5px;">
        <div style="flex: 1;">
          <label>Group:</label>
          <select id="groupCheckboxes" multiple style="max-width: 100%; height: 130px;">
            <option value="İdari">Management</option>
            <option value="Finansal">Financial</option>
            <option value="İnşaat">Construction</option>
            <option value="Mimari">Architectural</option>
            <option value="Mekanik">Mechanical</option>
            <option value="Elektrik">Electrical</option>
            <option value="Hukuk">Legal</option>
          </select>
        </div>
        <div style="flex: 1;">
          <label>Counter Party:</label>
          <select id="counterpartyCheckboxes" multiple style="max-width: 100%; height: 130px;">
            <option value="İdare">Client/RE Office</option>
            <option value="Müşavir">Legal Consultant</option>
            <option value="Taşeron">Subcontractor</option>
            <option value="Şirket içi">In-House</option>
            <option value="Şirket dışı">Outside</option>
            <option value="Danışman">Other Consultant</option>
            <option value="Diğer">Other</option>
          </select>
        </div>
        <div style="flex: 1;">
          <label>Key Subject:</label>
          <select id="keysubjectCheckboxes" multiple style="max-width: 100%; height: 130px;">
            <option value="LG Related">L/G or L/C Related</option>
            <option value="Time Ext. Related">Time Ext. Related</option>
            <option value="VO Related">VO Related</option>
            <option value="Payment Related">Payment Related</option>
          </select>
        </div>
      </div>
    </div>

    <!-- SUBMITTAL CLASS LETTERS SECTION -->
    <div class="form-section" id="submittalSection" style="display: none;">
      <h3>Submittal Details</h3>
      <div style="display: flex; gap: 1px;">
        <div style="flex: 1;">
          <label>Submittal Type:</label>
          <select id="submittalType" multiple style="width: 200px; height: 150px; font-size: small;">
            <option value="Material">Material</option>
            <option value="Equipment">Equipment</option>
            <option value="Drawing">Drawing</option>
            <option value="Report & MS">Report & MS</option>
            <option value="Variation Order">Variation Order</option>
            <option value="Check Request">Check Request</option>
            <option value="Work Schedule">Work Schedule</option>
          </select>
        </div>
        <div style="flex: 2; align-self: first baseline;">
          <label>Submittal Status:</label>
          <select id="submittalStatus" style="width: 240px; font-size: medium;">
            <option value="Draft">Draft</option>
            <option value="Submitted">Submitted</option>
            <option value="Approved">Approved</option>
            <option value="Approved with Commends">Approved with Commends</option>
            <option value="Rejected">Rejected</option>
            <option value="Revise and resubmit">Revise and resubmit</option>
          </select>
          <label>Approve/Reject Date:</label>
          <input type="date" id="DecisionDate" style="width: 222px; font-size: medium;">
        </div>
      </div>
      <div id="manufacturerFields" style="display: none; margin-top: 10px;">
        <label>Manufacturer:</label>
        <input type="text" id="manufacturer" style="width: 95%; font-size: medium;" placeholder="Enter Manufacturer Company Name">
      </div>
    </div>

    <!-- 3) REFERANS YAZI SEÇİMİ -->
    <div class="form-section">
      <h3>Referenced Letters</h3>
      <button class="btn" id="fetchBtn">Get List</button>
      <div id="status"></div>
      <select id="yazismaSelect" multiple style="width: 100%; margin-top: 10px;"></select>
    </div>

    <!-- 4) FORM GÖNDERME -->
    <div class="form-section">
      <button class="btn" id="submitBtn" disabled>Save</button>
    </div>
  </div>
  `;

  // Minimal page styles (kept local to component)
  const styles = `
    .container { max-width: 900px; margin: 20px auto; font-family: Arial, sans-serif; }
    .form-section { margin-bottom: 20px; padding: 15px; border: 1px solid #ccc; border-radius: 10px; }
    label { display: block; margin-top: 10px; font-weight: bold; }
    .required-star::after { content: " *"; color: #d00; margin-left: 2px; }
    .field-error { display: none; color: #d00; font-size: 12px; margin-top: 4px; }
    .invalid { border-color: #d00 !important; }
    input[type="text"], input[type="date"], input[type="file"], input[type="number"], input[type="email"], select, textarea { width: 100%; padding: 8px; margin-top: 5px; border: 1px solid #ccc; border-radius: 6px; }
    .btn { margin-top: 10px; padding: 8px 12px; border-radius: 8px; border: none; background-color: #007bff; color: white; cursor: pointer; }
    .btn:disabled { background-color: #aaa; cursor: not-allowed; }
    .mode-options { display: flex; gap: 16px; align-items: center; }
  `;

  return (
    <div ref={containerRef}>
      <style>{styles}</style>
      <div dangerouslySetInnerHTML={{ __html: inner }} />
    </div>
  );
}
