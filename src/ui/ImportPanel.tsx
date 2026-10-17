import { useState } from 'preact/hooks';
import { ConfirmButton } from './common';
import { BackupError, parseBackup, summarise } from '../engine/migrations';
import { applyImport, planImport, type ApplyChoices, type ImportPlan } from '../io/import';
import { actions, restoreFromText, useStore } from '../store/store';
import { toCsv } from '../io/csv';
import { download } from '../store/store';
import type { Backup } from '../types';

const readFile = (f: File) => f.text();

export function CsvImport() {
  const { data } = useStore();
  const [plan, setPlan] = useState<ImportPlan>();
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [catMap, setCatMap] = useState<Record<string, string>>({});
  const [newCap, setNewCap] = useState<string[]>([]);

  const onFile = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    setDone(''); setError(''); setPlan(undefined); setCatMap({}); setNewCap([]);
    if (!f) return;
    const res = planImport(await readFile(f), data);
    if ('error' in res) setError(res.error); else setPlan(res);
  };

  const confirm = async () => {
    if (!plan) return;
    const choices: ApplyChoices = { categoryMap: catMap, useNewCapacity: newCap };
    try {
      const next = applyImport(plan, data, choices);
      await actions.replaceData(next);
      const n = plan.kind === 'rails' ? plan.toAdd.length + newCap.length : plan.kind === 'categories' ? plan.toAdd.length + plan.targetFills.length : plan.toAdd.length;
      setDone(`Imported ${n} ${plan.kind === 'rails' ? 'rail change(s)' : plan.kind === 'categories' ? 'category change(s)' : 'items'}.`);
      setPlan(undefined);
    } catch (e) {
      setError(`Import failed and nothing was changed: ${(e as Error).message}`);
    }
  };

  return (
    <div>
      <label class="file-btn">
        Choose CSV file
        <input type="file" accept=".csv,text/csv" onChange={onFile} />
      </label>
      <button class="ghost" onClick={() => download('items-template.csv', toCsv([
        ['name', 'category', 'seasons', 'fit', 'state', 'brand', 'size', 'material', 'colour', 'notes', 'archived_reason', 'image_url', 'colour_hex'],
        ['Navy wool cardigan', 'Cardigans', 'autumn;winter', 'fits-well', 'pile', 'Example Brand', 'M', 'wool', 'navy', '', '', '', ''],
      ]), 'text/csv')}>Download items template</button>
      <p class="muted small">Import rails first, then categories, then items. Import only adds; it never overwrites or deletes.</p>
      {error && <p class="warn" role="alert">{error}</p>}
      {done && <p class="banner ok" role="status">{done}</p>}
      {plan && (
        <div class="preview card">
          <h3>Preview: {plan.kind} file</h3>
          {plan.ignoredColumns.length > 0 && <p class="small muted">Ignored columns: {plan.ignoredColumns.join(', ')}</p>}
          {plan.kind === 'items' && (
            <>
              <p><b>{plan.toAdd.length}</b> items will be added.</p>
              {plan.duplicates.length > 0 && <p class="warn small">Possible duplicates (same name, brand and size): {plan.duplicates.slice(0, 10).join('; ')}{plan.duplicates.length > 10 ? '…' : ''}</p>}
              {plan.warnings.length > 0 && (
                <details>
                  <summary class="small">{plan.warnings.length} image values ignored (rows still import)</summary>
                  <ul class="small">{plan.warnings.map((w, n) => <li key={n}>Row {w.row}: {w.message}</li>)}</ul>
                </details>
              )}
              {plan.unknownCategories.map((name) => (
                <label class="field" key={name}>
                  <span>"{name}" is not a category yet</span>
                  <select value={catMap[name.toLowerCase()] ?? 'new'} onChange={(e) => setCatMap({ ...catMap, [name.toLowerCase()]: (e.target as HTMLSelectElement).value })}>
                    <option value="new">Create new category (on the {data.zones[0]?.name} rail)</option>
                    {data.categories.map((c) => <option value={c.id} key={c.id}>Map to {c.name}</option>)}
                  </select>
                </label>
              ))}
            </>
          )}
          {plan.kind === 'categories' && (
            <>
              <p><b>{plan.toAdd.length}</b> new categories will be added.</p>
              {plan.targetFills.length > 0 && <p class="small">Targets will be set on existing categories that have none: {plan.targetFills.map((f) => `${f.name} ${f.target}`).join(', ')}.</p>}
              {plan.existing.length > 0 && <p class="small muted">Already exist and will be left alone: {plan.existing.join(', ')}</p>}
              {plan.missingRails.length > 0 && <p class="warn small">Missing rails: {plan.missingRails.join(', ')}. Import the rails file first.</p>}
            </>
          )}
          {plan.kind === 'rails' && (
            <>
              <p><b>{plan.toAdd.length}</b> rails will be added.</p>
              {plan.conflicts.map((c) => (
                <label class="check" key={c.name}>
                  <input type="checkbox" checked={newCap.includes(c.name)} onChange={(e) => setNewCap((cur) => (e.target as HTMLInputElement).checked ? [...cur, c.name] : cur.filter((n) => n !== c.name))} />
                  {c.name}: currently {c.current} in, file says {c.incoming} in. Tick to use the new value.
                </label>
              ))}
            </>
          )}
          {plan.problems.length > 0 && (
            <details open>
              <summary class="warn">{plan.problems.length} rows skipped</summary>
              <ul class="small">{plan.problems.map((p) => <li key={p.row}>Row {p.row}: {p.message}</li>)}</ul>
            </details>
          )}
          <div class="actions">
            <button class="primary" onClick={confirm} disabled={plan.kind === 'items' ? plan.toAdd.length === 0 : false}>Confirm import</button>
            <button class="ghost" onClick={() => setPlan(undefined)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function JsonImport() {
  const [text, setText] = useState('');
  const [backup, setBackup] = useState<Backup>();
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  const onFile = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    setError(''); setDone(''); setBackup(undefined);
    if (!f) return;
    const t = await readFile(f);
    try {
      setBackup(parseBackup(t));
      setText(t);
    } catch (err) {
      setError(err instanceof BackupError ? err.message : 'Could not read that backup.');
    }
  };

  const apply = async (mode: 'merge' | 'replace') => {
    try {
      await restoreFromText(text, mode);
      setDone(mode === 'replace' ? 'Backup restored.' : 'Backup merged.');
      setBackup(undefined);
    } catch (err) {
      setError(err instanceof BackupError ? err.message : 'Restore failed and nothing was changed.');
    }
  };

  const s = backup && summarise(backup);
  return (
    <div>
      <label class="file-btn">
        Choose backup file
        <input type="file" accept=".json,application/json" onChange={onFile} />
      </label>
      {error && <p class="warn" role="alert">{error}</p>}
      {done && <p class="banner ok" role="status">{done}</p>}
      {s && (
        <div class="preview card">
          <p>Backup from {new Date(backup!.exportedAt).toLocaleDateString()} contains {s.items} items, {s.zones} rails, {s.categories} categories and {s.plans} plan(s).</p>
          <div class="actions">
            <button onClick={() => apply('merge')}>Merge (add what is missing)</button>
            <ConfirmButton label="Replace everything" confirmLabel="Yes, replace all data" onConfirm={() => apply('replace')} />
            <button class="ghost" onClick={() => setBackup(undefined)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
