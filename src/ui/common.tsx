import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';

export function useHashRoute(): string {
  const read = () => location.hash.replace(/^#/, '') || '/rails';
  const [r, setR] = useState(read());
  useEffect(() => {
    const h = () => setR(read());
    addEventListener('hashchange', h);
    return () => removeEventListener('hashchange', h);
  }, []);
  return r;
}
export const go = (path: string) => { location.hash = path; };

export function Gauge({ used, capacity, label, per }: { used: number; capacity: number; label: string; per: number }) {
  const over = used > capacity;
  const pct = Math.min(100, capacity ? (used / capacity) * 100 : 0);
  const free = capacity - used;
  return (
    <div class={`gauge ${over ? 'over' : ''}`}>
      <div class="gauge-head">
        <strong>{label}</strong>
        <span>{used} of {capacity} in</span>
      </div>
      <div class="bar" role="img" aria-label={`${label}: ${used} of ${capacity} inches used`}>
        <div class="fill" style={{ width: `${pct}%` }} />
      </div>
      <div class="gauge-foot">
        {over ? <span class="warn">Over by {used - capacity} in</span> : <span>{free} in free</span>}
        {per !== 1 && <span class="muted"> · {per} in per item</span>}
      </div>
    </div>
  );
}

export function Chip({ children, tone }: { children: ComponentChildren; tone?: 'warn' | 'ok' | 'muted' }) {
  return <span class={`chip ${tone ?? ''}`}>{children}</span>;
}

export function Field({ label, children }: { label: string; children: ComponentChildren }) {
  return (
    <label class="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function NumberInput({ value, onChange, min = 0, label }: { value: number | undefined; onChange: (n: number | undefined) => void; min?: number; label: string }) {
  return (
    <input
      type="number" inputMode="numeric" min={min} aria-label={label} class="num"
      value={value ?? ''}
      onChange={(e) => {
        const raw = (e.target as HTMLInputElement).value;
        if (raw === '') return onChange(undefined);
        const n = Math.max(min, Math.floor(Number(raw)));
        if (!Number.isNaN(n)) onChange(n);
      }}
    />
  );
}

/** Two-step button: avoids native confirm(), which embedded browsers and installed web apps can block. */
export function ConfirmButton({ label, confirmLabel = 'Confirm', onConfirm, class: cls = 'danger', ariaLabel, disabledReason }: {
  label: ComponentChildren; confirmLabel?: string; onConfirm: () => void; class?: string; ariaLabel?: string; disabledReason?: string;
}) {
  const [asking, setAsking] = useState(false);
  if (disabledReason && asking) {
    return <span class="reasons" role="alert"><span class="warn small">{disabledReason}</span><button class="ghost" onClick={() => setAsking(false)}>OK</button></span>;
  }
  if (!asking) return <button type="button" class={cls} aria-label={ariaLabel} onClick={() => setAsking(true)}>{label}</button>;
  return (
    <span class="reasons" role="group">
      <button type="button" class="danger" onClick={() => { setAsking(false); onConfirm(); }}>{confirmLabel}</button>
      <button type="button" class="ghost" onClick={() => setAsking(false)}>Cancel</button>
    </span>
  );
}
