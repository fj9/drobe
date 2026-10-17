import { useState } from 'preact/hooks';
import { inPlanSeasons } from '../engine/capacity';
import { actions, activePlan, capacityOf, useStore } from '../store/store';
import { LABELS, REASONS, type ArchivedReason, type Item } from '../types';
import { Chip, Gauge, go } from './common';

export function SortScreen({ categoryId }: { categoryId?: string }) {
  const { data } = useStore();
  const cap = capacityOf(data);
  const plan = activePlan(data);

  if (!categoryId) {
    return (
      <section>
        <h1>Sort</h1>
        <p class="muted">Pick a category and decide what goes back.</p>
        <ul class="rows card">
          {data.categories.map((c) => {
            const cr = cap.categories[c.id];
            return (
              <li key={c.id}>
                <button class="row-btn" onClick={() => go(`/sort/${c.id}`)}>
                  <span>{c.name}</span>
                  <span class="row-meta">
                    {cr.onRail}{cr.target !== undefined ? ` / ${cr.target}` : ''}
                    {cr.inPile > 0 && <Chip>{cr.inPile} in pile</Chip>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    );
  }

  const cat = data.categories.find((c) => c.id === categoryId);
  if (!cat) return <section><h1>Sort</h1><p>Category not found. <a href="#/sort">Back</a></p></section>;
  const cr = cap.categories[cat.id];
  const zone = data.zones.find((z) => z.id === cat.defaultZone);
  const zr = zone ? cap.zones[zone.id] : undefined;
  const pile = data.items.filter((i) => i.category === cat.id && i.state === 'pile' && inPlanSeasons(i, plan.seasons));
  const onRail = data.items.filter((i) => i.category === cat.id && i.state === 'on-rail');
  const targetReached = cr.target !== undefined && cr.onRail >= cr.target;

  return (
    <section>
      <p><a href="#/sort">‹ All categories</a></p>
      <h1>{cat.name}</h1>
      <div class="stats">
        <div><b>{cr.target ?? '–'}</b><span>Target</span></div>
        <div><b>{cr.onRail}</b><span>On rail</span></div>
        <div><b>{pile.length}</b><span>In pile</span></div>
      </div>
      {cr.surplus > 0 && <p class="banner warn" role="status">{cr.surplus} over the target for {cat.name.toLowerCase()}.</p>}
      {cr.needed > 0 && <p class="banner">Still need {cr.needed}.</p>}
      {zone && zr && <div class="card"><Gauge used={zr.usedInches} capacity={zone.capacity} label={`${zone.name} rail`} per={plan.inchesPerItem} /></div>}

      <h2>Pile</h2>
      {pile.length === 0 && <p class="muted">Nothing in the pile for this category.</p>}
      <ul class="cards">
        {pile.map((it) => <PileItem key={it.id} item={it} warnPutBack={targetReached} />)}
      </ul>

      {onRail.length > 0 && (
        <>
          <h2>On the rail</h2>
          <ul class="cards">
            {onRail.map((it) => (
              <li class="card item" key={it.id}>
                <ItemSummary item={it} />
                <div class="actions">
                  <button onClick={() => actions.setState(it.id, 'stored')}>Not now</button>
                  <LetGo id={it.id} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function ItemSummary({ item }: { item: Item }) {
  return (
    <div class="item-main">
      <a href={`#/edit/${item.id}`} class="item-name">{item.name}</a>
      <div class="meta">
        {item.brand && <span>{item.brand}</span>}
        {item.size && <span>size {item.size}</span>}
        <Chip tone={item.fit === 'doesnt-fit' ? 'warn' : item.fit === 'fits-replace' ? 'muted' : undefined}>{LABELS[item.fit]}</Chip>
      </div>
    </div>
  );
}

function PileItem({ item, warnPutBack }: { item: Item; warnPutBack: boolean }) {
  const suggestLetGo = item.fit === 'doesnt-fit';
  return (
    <li class="card item">
      <ItemSummary item={item} />
      {suggestLetGo && <p class="small warn">Doesn't fit. Letting go is suggested.</p>}
      {warnPutBack && <p class="small muted">Target already reached for this category.</p>}
      <div class="actions">
        <button class="primary" onClick={() => actions.setState(item.id, 'on-rail')}>Put back</button>
        <button onClick={() => actions.setState(item.id, 'stored')}>Not now</button>
        <LetGo id={item.id} suggested={suggestLetGo} />
      </div>
    </li>
  );
}

function LetGo({ id, suggested }: { id: string; suggested?: boolean }) {
  const [asking, setAsking] = useState(false);
  if (!asking) return <button class={suggested ? 'danger' : ''} onClick={() => setAsking(true)}>Let go</button>;
  const done = (r?: ArchivedReason) => actions.setState(id, 'archived', r);
  return (
    <span class="reasons" role="group" aria-label="Reason for letting go">
      {REASONS.map((r) => <button key={r} onClick={() => done(r)}>{LABELS[r]}</button>)}
      <button onClick={() => done()}>No reason</button>
      <button class="ghost" onClick={() => setAsking(false)}>Cancel</button>
    </span>
  );
}
