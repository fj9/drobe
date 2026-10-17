import { useRef, useState } from 'preact/hooks';
import { buildZip, harvestImages, linkedItems, STATUS_TEXT, type HarvestResult } from '../io/harvest';
import { actions, download, today, useStore } from '../store/store';

type Phase = { kind: 'idle' } | { kind: 'running'; done: number; total: number } | { kind: 'done'; results: HarvestResult[]; cancelled: boolean };

export function ImageDownload() {
  const { data } = useStore();
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const ctl = useRef<AbortController | undefined>(undefined);
  const [skip, setSkip] = useState(true);
  const allLinked = linkedItems(data.items);
  const doneBefore = allLinked.filter((i) => i.imageHarvested).length;
  const linked = linkedItems(data.items, skip);
  const sites = new Set(linked.map((i) => { try { return new URL(i.imageUrl!).hostname; } catch { return ''; } }).filter(Boolean));

  const run = async () => {
    const ac = new AbortController();
    ctl.current = ac;
    setPhase({ kind: 'running', done: 0, total: linked.length });
    const { results, files } = await harvestImages(data.items, {
      signal: ac.signal, skipHarvested: skip,
      onProgress: (done, total) => setPhase({ kind: 'running', done, total }),
    });
    const blob = buildZip(results, files);
    download(`wardrobe-images-${today()}.zip`, blob);
    await actions.markImagesHarvested(results.filter((r) => r.status === 'saved').map((r) => r.itemId));
    setPhase({ kind: 'done', results, cancelled: ac.signal.aborted });
  };

  if (allLinked.length === 0) {
    return <p class="muted small">No items have a linked image address yet, so there is nothing to download. Add them in the item screen or with an items CSV.</p>;
  }

  const saved = phase.kind === 'done' ? phase.results.filter((r) => r.status === 'saved').length : 0;
  const bad = phase.kind === 'done' ? phase.results.filter((r) => r.status !== 'saved') : [];

  return (
    <div>
      <h3>Download linked images</h3>
      <p class="muted small">
        Tries to download the picture behind each linked address ({linked.length} items, {sites.size} {sites.size === 1 ? 'website' : 'websites'}) and saves them in a zip with a list of what worked.
        This contacts those websites. Many sites don't let other pages download their images, so expect some to fail; those are listed in the zip.
      </p>
      {doneBefore > 0 && phase.kind !== 'running' && (
        <label class="check">
          <input type="checkbox" checked={skip} onChange={(e) => setSkip((e.target as HTMLInputElement).checked)} />
          Skip the {doneBefore} already downloaded
        </label>
      )}
      {linked.length === 0 && phase.kind !== 'running' && <p class="small muted">Every linked image has already been downloaded. Untick the box above to download them again.</p>}
      {phase.kind !== 'running' ? (
        <div class="actions"><button disabled={linked.length === 0} onClick={run}>{phase.kind === 'done' ? 'Run again' : 'Download images as zip'}</button></div>
      ) : (
        <div role="status">
          <p>Downloading {phase.done} of {phase.total}…</p>
          <div class="bar"><div class="fill" style={{ width: `${(phase.done / Math.max(1, phase.total)) * 100}%` }} /></div>
          <div class="actions"><button class="ghost" onClick={() => ctl.current?.abort()}>Stop and save what we have</button></div>
        </div>
      )}
      {phase.kind === 'done' && (
        <div class="banner" role="status">
          <p>{phase.cancelled ? 'Stopped. ' : ''}Saved {saved} of {phase.results.length} images. The zip has been downloaded{bad.length ? ', with a list of the ones that failed' : ''}.</p>
          {bad.length > 0 && (
            <details>
              <summary class="small">{bad.length} could not be downloaded</summary>
              <ul class="small">
                {bad.slice(0, 50).map((r) => <li key={r.itemId}>{r.name}: {STATUS_TEXT[r.status]}</li>)}
                {bad.length > 50 && <li>…and {bad.length - 50} more, listed in the zip.</li>}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
