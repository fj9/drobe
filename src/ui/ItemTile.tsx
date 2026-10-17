import { useStore } from '../store/store';
import { LABELS, type Item } from '../types';
import { ItemImage, webImagesOn } from './art';

interface Props {
  item: Item;
  /** in selection mode a tap toggles instead of opening the item */
  selecting?: boolean;
  picked?: boolean;
  onToggle?: () => void;
}

export function ItemTile({ item, selecting, picked, onToggle }: Props) {
  const { data } = useStore();
  const cat = data.categories.find((c) => c.id === item.category);
  const showWeb = webImagesOn(data);
  const cls = `tile ${item.state === 'stored' || item.state === 'archived' ? 'dim' : ''} ${picked ? 'picked' : ''}`;
  const inner = (
    <>
      <ItemImage item={item} category={cat} showWeb={showWeb} />
      <span class="badges">
        {item.state !== 'on-rail' && <span class="chip">{LABELS[item.state]}</span>}
        {item.fit === 'fits-replace' && <span class="chip replace">Replace</span>}
        {item.fit === 'doesnt-fit' && <span class="chip">Doesn't fit</span>}
      </span>
      {selecting && <span class={`tick ${picked ? 'on' : ''}`} aria-hidden="true">{picked ? '✓' : ''}</span>}
      <span class="name">{item.name}</span>
    </>
  );
  if (selecting) {
    return <button type="button" class={cls} aria-pressed={picked} aria-label={`Select ${item.name}`} onClick={onToggle}>{inner}</button>;
  }
  return <a class={cls} href={`#/edit/${item.id}`} aria-label={item.name}>{inner}</a>;
}
