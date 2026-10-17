import { actions, capacityOf, activePlan, useStore } from '../store/store';
import { Chip, Gauge, NumberInput, go } from './common';
import { ItemTile } from './ItemTile';

export function RailsScreen() {
  const { data } = useStore();
  const cap = capacityOf(data);
  const plan = activePlan(data);
  const zones = [...data.zones].sort((a, b) => a.order - b.order);
  const over = zones.filter((z) => cap.zones[z.id]?.status === 'over');
  const skipped = new Set(data.settings.noTargetNeeded ?? []);
  const noTarget = data.categories.filter((c) => plan.allocations[c.id] === undefined && !skipped.has(c.id));
  const pile = data.items.filter((i) => i.state === 'pile').length;

  return (
    <section>
      <h1>Rails</h1>
      <p class="muted">{plan.name} · {cap.totalUsed} of {cap.totalCapacity} in used</p>
      {over.length > 0 && (
        <p class="banner warn" role="status">
          {over.map((z) => `${z.name} is over by ${cap.zones[z.id].overInches} in`).join('. ')}.
        </p>
      )}
      {noTarget.length > 0 && (
        <div class="banner" role="group" aria-label="Categories without a target">
          <p><b>{noTarget.length} {noTarget.length === 1 ? 'category has' : 'categories have'} no target.</b> Set how many you want, or say none is needed.</p>
          {noTarget.slice(0, 5).map((c) => (
            <div class="setting-row" key={c.id}>
              <span>{c.name}</span>
              <span class="reasons">
                <NumberInput label={`${c.name} target`} value={undefined} onChange={(n) => n !== undefined && actions.setTarget(c.id, n)} />
                <button class="ghost" onClick={() => actions.skipTarget(c.id)}>Not needed</button>
              </span>
            </div>
          ))}
          {noTarget.length > 5 && <p class="small muted">{noTarget.length - 5} more. Set them in <a href="#/settings">Settings</a>.</p>}
        </div>
      )}
      <p class="small"><a href="#/lists">Shopping and replace lists</a></p>
      {pile > 0 && (
        <p class="banner">
          {pile} {pile === 1 ? 'item' : 'items'} in the pile. <a href="#/sort">Start sorting</a>
        </p>
      )}
      {zones.map((z) => {
        const zr = cap.zones[z.id];
        const cats = data.categories.filter((c) => c.defaultZone === z.id);
        return (
          <article class="card" key={z.id}>
            <Gauge used={zr.usedInches} capacity={z.capacity} label={`${z.name} rail`} per={plan.inchesPerItem} />
            {zr.targetsOver && (
              <p class="warn small">Targets here add up to {zr.targetInches} in, more than the {z.capacity} in capacity.</p>
            )}
            <ul class="rows">
              {cats.map((c) => {
                const cr = cap.categories[c.id];
                return (
                  <li key={c.id}>
                    <button class="row-btn" onClick={() => go(`/rails/${c.id}`)}>
                      <span>{c.name}</span>
                      <span class="row-meta">
                        {cr.onRail}{cr.target !== undefined ? ` / ${cr.target}` : ''}
                        {cr.needed > 0 && <Chip tone="muted">need {cr.needed}</Chip>}
                        {cr.surplus > 0 && <Chip tone="warn">+{cr.surplus} over</Chip>}
                        {cr.inPile > 0 && <Chip>{cr.inPile} in pile</Chip>}
                      </span>
                    </button>
                  </li>
                );
              })}
              {cats.length === 0 && <li class="muted small">No categories on this rail.</li>}
            </ul>
          </article>
        );
      })}
    </section>
  );
}

/** A category's on-rail items as a picture grid. */
export function CategoryGrid({ categoryId }: { categoryId: string }) {
  const { data } = useStore();
  const cat = data.categories.find((c) => c.id === categoryId);
  if (!cat) return <section><h1>Rails</h1><p>Category not found. <a href="#/rails">Back</a></p></section>;
  const cr = capacityOf(data).categories[cat.id];
  const items = data.items.filter((i) => i.category === cat.id && i.state === 'on-rail').sort((a, b) => a.name.localeCompare(b.name));
  return (
    <section>
      <p><a href="#/rails">‹ Rails</a></p>
      <h1>{cat.name}</h1>
      <p class="muted">{cr.onRail}{cr.target !== undefined ? ` of ${cr.target}` : ''} on the rail{cr.inPile > 0 ? ` · ${cr.inPile} in pile` : ''}</p>
      <p><a href={`#/sort/${cat.id}`}>Sort this category</a></p>
      {items.length === 0 ? <p class="muted">Nothing on the rail yet.</p> : (
        <ul class="grid">{items.map((i) => <li key={i.id}><ItemTile item={i} /></li>)}</ul>
      )}
    </section>
  );
}
