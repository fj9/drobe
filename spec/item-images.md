# Wardrobe Manager: Item Images Spec

Oct 17, 2026 · @Frankie

## Overview

This spec adds pictures to Wardrobe Manager, so the wardrobe can be browsed by sight rather than by name. It extends the [core spec](https://claude.ai/code/artifact/b695461b-6a84-42e9-af97-2a578a9fa0c9), is planned for phase 2, and changes nothing in phase 1.

- Use product images that already exist online wherever possible.
- Ask the user for a photo only when an item has no picture at all.
- Never show a blank: every item falls back to a drawing tinted to its colour.
- Keep the app a static page that stores the user's data on their own device.

## How a picture is chosen

Every item shows the first of these sources that exists, so it is never blank.

| Order | Source | Where it comes from | Works offline |
| --- | --- | --- | --- |
| 1 | The user's own photo | Taken or chosen in the app and kept on the device | Yes |
| 2 | A linked product image | A web address found by the add-items skill and stored on the item | No |
| 3 | A tinted illustration | A drawing of the item's category, coloured to match the colour the user gave | Yes |

Web images are preferred because they save photographing the whole wardrobe. The user is only prompted for a photo when an item has neither a photo nor a working web image. The prompt is a quiet "Add photo" on the item and a No photo filter, never a blocker. If a linked image fails to load (offline, removed, blocked), the tile falls back to the illustration without an error.

## Finding product images

The web search happens in the add-items skill, not the app. The app is a static page with no server, so it cannot search the web, and browsers stop a page from copying most other sites' images. The skill finds an address and the app only displays it.

**Skill rules** (the skill is updated once this spec is agreed)

- Take the image from the product page of the exact item, ideally the right colour variant, and prefer the retailer's own page. Record the direct address of the image file, as an https address.
- If there is no clear match, leave it blank. Never guess, and never use a search thumbnail or a third-party site's copy.
- Never use an address that carries personal or tracking details, such as many images in order-confirmation emails. Those are skipped.
- For Vinted purchases, the listing photo is the actual item. It may disappear if the listing is removed, which the fallback covers.
- The skill writes the address to the `image_url` column and proposes a `colour_hex` (see Changes to the core spec).

**App rules**

- Only https addresses are accepted. Anything else is ignored with a note in the import preview.
- Images are requested lazily, only when a tile is on screen, with no referrer sent.
- A Settings switch, **Show product images from the web**, turns this off. Off means the app never requests them and shows illustrations instead. It is on by default, with a one-line note the first time explaining that showing a linked image tells that website the device has requested it.
- Phase 2 stores the address, not the picture.

**Things to know**

- Links break over time. That is the main reason photos and, later, saved copies exist.
- The images belong to the retailers. The app only shows them privately on the user's own device and never republishes them. This is a design note, not legal advice.
- A later "save a copy" step could store the picture locally, but it only works where the site allows it, and many do not. It is phase 3 and best-effort.

## Photos taken or chosen by the user

The user's own photos are resized on the phone and kept in the browser's local storage, about 100 KB each.

- Add item and the item screen offer **Take photo** and **Choose photo**, using a standard file picker that lets phones open the camera or the photo library.
- The image is resized on the device before saving: longest edge 800 px, WebP (JPEG where WebP is not available) at about 80 percent quality, plus a 240 px thumbnail for the grid. The aim is under 100 KB per photo, so about 15 MB for 150 items. The original is not kept.
- Re-encoding drops location and other metadata from the photo.
- Photos are stored in IndexedDB in a separate `images` store and referenced by `photoId`. Removing a photo, or deleting an item, removes the stored image.
- Export has an **Include photos** option with the resulting file size shown. Photos go in the backup as base64 under `images`.
- Backups matter more once photos exist, so the storage persistence request and backup reminders stay on.

## Illustrations

A small built-in set of garment drawings means even an item with nothing else shows a recognisable picture in its own colour.

- Thirteen illustrations, one per starter category plus jeans and a generic fallback, listed in Making the illustrations below. Each is stored as `illustrations/<id>.webp`: 512 px square with transparency, about 15 to 30 KB, so about 300 KB in total, precached with the app.
- Each category has an `illustration` id. The starter categories ship mapped. A renamed or custom category keeps its current illustration or uses `generic`, and the user can pick another in Settings.
- Every item uses its category's illustration. There is no per-item choice in this version.

## Colouring

Each illustration is one transparent image of a white garment with light grey shading and a dark outline, and the app tints it by multiplying it over the item's colour. White becomes the colour while the outline and shading stay dark, and the image's own transparency cuts the shape out so the background stays clear.

```
.art { background: var(--item-colour); isolation: isolate;
       -webkit-mask: url(trousers.webp) center / contain no-repeat;
               mask: url(trousers.webp) center / contain no-repeat; }
.art > img { width: 100%; height: 100%; object-fit: contain;
             mix-blend-mode: multiply; }
```

**Palette.** The colour field is free text, so the app maps it to a small named palette: black #1F1F1F, charcoal #4A4A4A, grey #9A9A9A, white #F5F5F2, cream #EFE6D2, beige #D8C3A5, camel #C19A6B, tan #B58B5A, brown #6B4A32, burgundy #6D1F33, red #C0392B, pink #E8A0B4, orange #D9702B, mustard #D4A017, yellow #F0D24B, olive #6B6B2F, green #4C8C4A, forest #2F5D3A, teal #2A7F82, light blue #9CC3E0, blue #2F6DB5, navy #1F2A4A, purple #6A4C93, lilac #BBA6D6.

**Matching**

1. If the item has a `colourHex`, use it.
2. Otherwise lower-case the colour text and look for a palette name in it, longest name first, so "dark navy" gives navy and "light blue" gives light blue rather than blue.
3. If nothing matches, or the text says striped, floral, patterned or multi, show the illustration in neutral grey. The user can pick an exact colour with a colour picker on the item, which saves `colourHex`.

**Known limits.** Very dark colours lose their internal detail but keep their shape. Patterns are not drawn in this version. The tiles sit on a light neutral background with a faint outline so white and cream items do not disappear.

## Browsing by image

The wardrobe becomes a picture grid on Items, Sort and Rails.

- **Items** gets a **Grid / List** switch. Grid is the default: square tiles, three across on a phone, with the name underneath and small markers for the replace flag and for pile, stored and archived states. Archived items stay behind their toggle and stored ones appear dimmed. All existing filters apply, plus a **No photo** filter.
- Tapping a tile opens the item with its image large.
- **Sort** shows pile items as picture cards, so deciding is by sight.
- Tapping a category on **Rails** shows its on-rail items as a grid.
- The grid uses the 240 px thumbnails and loads tiles lazily, so it stays smooth at 150 items and beyond.

## Making the illustrations

Generate each of the 13 illustrations with the shared style prompt below followed by its item line. Use the same image tool in one sitting, and once the first one looks right, give it as a reference so the set matches in style, line weight and size.

**Shared style prompt**

```
Flat front-view product illustration of a single garment, centred and filling about 80 percent of a square canvas. Clean, modern, minimal style with a uniform dark charcoal outline of consistent weight, and a fully closed outline with no gaps. The garment body is flat white (#FFFFFF) with only very subtle light grey shading for folds and seams. Symmetrical. No hanger, no mannequin, no model, no person, no ground shadow, no text, no logos, no pattern, and no colour other than white, grey and charcoal. Plain pure white background. The garment is:
```

**Item lines**

| ID | Used for | Item line |
| --- | --- | --- |
| `shirt` | Shirts | a long-sleeved button-up collared shirt with buttons down the front and a slightly curved hem |
| `top` | Tops | a short-sleeved crew-neck t-shirt in a relaxed fit |
| `light-jumper` | Light jumpers | a lightweight fine-knit crew-neck jumper with long sleeves and ribbed cuffs and hem |
| `bulky-jumper` | Bulky jumpers | a chunky cable-knit jumper with a thick roll neck, long sleeves, ribbed cuffs and hem, and visibly thick knit texture |
| `cardigan` | Cardigans | a long-sleeved cardigan with a button placket down the centre, ribbed cuffs and hem, buttoned up |
| `trousers` | Trousers | a pair of straight-leg tailored trousers with a waistband, belt loops, a front crease and side pockets |
| `jeans` | Jeans | a pair of straight-leg five-pocket jeans with a waistband, belt loops, a zip fly, front pockets and visible seam stitching |
| `skirt` | Skirts | a knee-length A-line skirt with a waistband and a subtle seam detail |
| `short-dress` | Short dresses | a knee-length fit-and-flare dress with a round neckline, short sleeves, a fitted bodice and a flared skirt |
| `long-dress` | Long dresses | a floor-skimming maxi dress with a V-neckline, short sleeves, a fitted waist and a flowing skirt |
| `suit-jacket` | Suits and jackets | a tailored single-breasted blazer with notch lapels, two buttons, flap pockets and long sleeves |
| `coat` | Coats | a knee-length single-breasted wool overcoat with wide lapels, long sleeves, front buttons and two angled pockets |
| `generic` | Any other category | a simple plain tunic-shaped top with short sleeves and no details |

**Check each one before keeping it**

- The outline is completely closed. This matters, because the background is removed by filling in from the corners, and a gap would leave the garment's inside see-through.
- The body is white or very light grey, with no colour or pattern.
- The set matches in scale, line weight and style, and each is symmetrical.
- It tints well: try each in navy, mustard and white on a test page.

**Processing.** Make the background transparent by flood-filling from the corners, resize to 512 px square, save as `illustrations/<id>.webp`, and keep the originals. If a generator will not give a clean white background, ask for a flat green one and remove that instead.

**Check first.** Before generating the whole set, build one tinted tile from the first illustration and try it in Safari on iOS, Chrome on Android and a desktop browser. If the masking and blending look wrong anywhere, switch to drawing the tint on a canvas instead.

## Changes to the core spec when this is built

The core spec stays as it is until this is built. These are the changes it will need, all additive.

| Area | Change |
| --- | --- |
| Item record | Adds optional `photoId` (a photo stored on the device), `imageUrl` (a linked https image) and `colourHex` (#RRGGBB tint, otherwise worked out from the colour text). |
| Category record | Adds `illustration`, the id of the drawing used for its items, `generic` if none is set. |
| Settings | Adds a flag for whether linked product images are shown. |
| Backup file | Adds `images`, holding photos as base64, filled only when Include photos is ticked on export. Linked addresses belong to the items. |
| Items CSV | Adds optional `image_url` (a direct https image address, otherwise ignored with a preview note) and `colour_hex` (#RRGGBB, otherwise ignored with a preview note). |
| Screens | Items gets a grid and list switch and a No photo filter. Add item gets a photo control. Sort shows pile items as picture cards. Rails shows a category's on-rail items as a grid. Settings gets the web images switch. |
| Privacy requirement | "No network calls after install" gains one exception: loading product images the user has linked, which can be switched off. |
| Add-items skill | Looks up `image_url` from the exact product's page and proposes `colour_hex`, following the skill rules above. |
| Prioritisation | Phase 2: the illustrations and grid, linked product images, and photo upload. Phase 3: save a copy of linked images where allowed, and a simple crop. |

## Phasing and acceptance

The illustrations and grid come first because they make browsing by image work with no photos at all.

| Phase | Feature | Why here | Effort |
| --- | --- | --- | --- |
| 2 | Tinted category illustrations and a picture grid on Items, Sort and Rails | Browsing by sight needs only the drawings, no photos. | M |
| 2 | Linked product images from the add-items skill, with fallback | Real pictures without photographing the whole wardrobe. | S |
| 2 | Photo upload with on-device resize, thumbnails and photos in the backup | Covers items with no web image. | M |
| 3 | Save a copy of linked images where the site allows it; simple crop | Protects against broken links; best-effort because many sites block copying. | M |

**Done when**

- [ ] An item with no photo and no linked image shows its category illustration tinted to its colour, and a colour that is not in the palette shows a neutral grey one.
- [ ] A photo taken or chosen in the app is resized on the device, appears in the grid, and is restored by export then import when photos are included.
- [ ] A linked image that fails to load falls back to the illustration without an error, and with the web images setting off the app makes no image requests.
- [ ] Items can be browsed as a picture grid and filtered to items with no photo.
- [ ] A CSV with `image_url` and `colour_hex` imports them, and ignores invalid values with a note in the preview.
- [ ] The tint renders correctly in Safari on iOS, Chrome on Android and a desktop browser.

## Risks and things to check

The tint technique is the biggest unknown, and linked images are the most fragile part.

- **Tint rendering.** The mask and multiply approach is untested on the target browsers. Prototype one tile before generating the full set.
- **Link rot.** Linked images will disappear over time. The illustration fallback hides the break, and a saved copy in phase 3 reduces the loss.
- **Saving copies.** Many retailers do not allow a page to copy their images, so phase 3 will only work for some sites. Try the retailers actually used before committing to it.
- **Wrong image.** A lookup can match the wrong colour variant or a similar product. The user can remove or replace any linked image on the item.
- **Privacy.** Showing linked images tells the retailer's site the device requested it. Mitigated by the Settings switch, lazy loading and no referrer, but it is a real change from phase 1.
- **Image rights.** The images belong to the retailers. The app only displays them privately and never republishes them, which is a design choice rather than legal advice.
- **Dark colours.** Very dark items lose their internal detail. Accept for now and revisit once seen on a real device.
