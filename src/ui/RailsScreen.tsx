import { capacityOf, activePlan, useStore } from '../store/store';
import { Chip, Gauge, go } from './common';

export function RailsScreen() {
  const { data } = useStore();
  const cap = capacityOf(data);
  const plan = activePlan(data);
  const zones = [...data.zones].sort((a, b) => a.order - b.order);
  const over = zones.filter((z) => cap.zones[z.id]?.status === 'over');
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
                    <button class="row-btn" onClick={() => go(`/sort/${c.id}`)}>
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
