import { useEffect, useState } from 'preact/hooks';
import { guessIllustration } from '../data/defaults';
import { tintFor } from '../engine/colour';
import { photoUrls } from '../store/store';
import type { Category, Data, Item } from '../types';

const BASE = import.meta.env.BASE_URL;
const artUrl = (id: string) => `${BASE}illustrations/${id}.svg`;

// Linked images that failed to load (offline, removed, blocked) fall back quietly for the rest of the session.
const failed = new Set<string>();

export const webImagesOn = (d: Data) => d.settings.showWebImages !== false;
export const illustrationOf = (c: Category | undefined) => c?.illustration ?? (c ? guessIllustration(c.name) : 'generic');
export const hasPicture = (i: Item, showWeb: boolean) => !!i.photoId || (!!i.imageUrl && showWeb);

/** The tinted drawing: a white garment multiplied over the item's colour, cut out by its own transparency. */
export function Art({ illustration, colour }: { illustration: string; colour: string }) {
  const url = `url(${artUrl(illustration)})`;
  return (
    <div class="art" style={{ background: colour, WebkitMaskImage: url, maskImage: url } as never} aria-hidden="true">
      <img src={artUrl(illustration)} alt="" loading="lazy" />
    </div>
  );
}

interface Props {
  item: Item;
  category: Category | undefined;
  showWeb: boolean;
  /** use the 800 px photo instead of the 240 px thumbnail */
  large?: boolean;
  /** override for the preview of a not-yet-saved photo */
  previewUrl?: string;
}

/** Photo, then linked image, then illustration: never blank. */
export function ItemImage({ item, category, showWeb, large, previewUrl }: Props) {
  const [photo, setPhoto] = useState<string>();
  const [, bump] = useState(0);

  useEffect(() => {
    let live = true;
    setPhoto(undefined);
    if (item.photoId) photoUrls(item.photoId).then((u) => live && setPhoto(u ? (large ? u.full : u.thumb) : undefined));
    return () => { live = false; };
  }, [item.photoId, large]);

  const src = previewUrl ?? photo;
  let inner;
  if (src) inner = <img class="photo" src={src} alt="" loading="lazy" />;
  else if (item.imageUrl && showWeb && !failed.has(item.imageUrl)) {
    inner = (
      <img
        class="photo" src={item.imageUrl} alt="" loading="lazy" referrerpolicy="no-referrer" crossOrigin={undefined}
        onError={() => { failed.add(item.imageUrl!); bump((n) => n + 1); }}
      />
    );
  } else inner = <Art illustration={illustrationOf(category)} colour={tintFor(item.colourHex, item.colour)} />;
  return <div class="pic">{inner}</div>;
}
