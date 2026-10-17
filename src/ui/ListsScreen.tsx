import { useState } from 'preact/hooks';
import { capacityOf, useStore } from '../store/store';
import { LABELS } from '../types';
import { Chip } from './common';

export function ListsScreen() {
  const { data } = useStore();
  const cap = capacityOf(data);
  const [copied, setCopied] = useState('');
  const zones = [...data.zones].sort((a, b) => a.order - b.order);
  const catName = (id: string) => data.categories.find((c) => c.id === id)?.name ?? '?';

  const needed = data.categories
    .map((c) => ({ c, r: cap.categories[c.id] }))
    .filter((x) => x.r.needed > 0);
  const replace = data.items.filter((i) => i.fit === 'fits-replace' && i.state !== 'archived');
  const replaceByCat = data.categories
    .map((c) => ({ c, items: replace.filter((i) => i.category === c.id) }))
    .filter((x) => x.items.length > 0);

  const shoppingText = () => [
    'Needed:',
    ...needed.map(({ c, r }) => `- ${c.name}: ${r.needed}`),
    '',
    'Replace when I can:',
    ...replace.map((i) => `- ${i.name}${i.size ? ` (size ${i.size})` : ''} [${catName(i.category)}]`),
  ].join('\n');

  const copy = async () => {
    try { await navigator.clipboard.writeText(shoppingText()); setCopied('Copied'); } catch { setCopied('Could not copy on this browser'); }
  };

  return (
    <section>
      <p><a href="#/rails">‹ Rails</a></p>
      <h1>Shopping and replace</h1>
      <div class="actions"><button onClick={copy}>Copy both lists as text</button>{copied && <span role="status" class="small muted">{copied}</span>}</div>

      <h2>Still needed</h2>
      <p class="muted small">Target minus what is on the rail. Only categories with a target appear.</p>
      {needed.length === 0 && <p class="muted">Nothing needed. Every target is met.</p>}
      {zones.map((z) => {
        const rows = needed.filter((x) => x.c.defaultZone === z.id);
        if (rows.length === 0) return null;
        return (
          <div class="card" key={z.id}>
            <h3>{z.name} rail</h3>
            <ul class="rows">
              {rows.map(({ c, r }) => (
                <li key={c.id}><a class="row-btn" href={`#/sort/${c.id}`}><span>{c.name}</span><span class="row-meta"><b>{r.needed}</b><Chip tone="muted">{r.onRail} of {r.target}</Chip></span></a></li>
              ))}
            </ul>
          </div>
        );
      })}

      <h2>Replace when I can</h2>
      <p class="muted small">Items that fit but aren't ideal. They stay where they are until a replacement arrives; then archive the old one.</p>
      {replaceByCat.length === 0 && <p class="muted">No items flagged. Mark an item "Fits, replace when I can" to see it here.</p>}
      {replaceByCat.map(({ c, items }) => (
        <div class="card" key={c.id}>
          <h3>{c.name}</h3>
          <ul class="rows">
            {items.map((i) => (
              <li key={i.id}>
                <a class="row-btn" href={`#/edit/${i.id}`}>
                  <span>{i.name}{i.notes && <span class="muted small"><br />{i.notes}</span>}</span>
                  <span class="row-meta">{i.size && <Chip>size {i.size}</Chip>}<Chip tone="muted">{LABELS[i.state]}</Chip></span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
