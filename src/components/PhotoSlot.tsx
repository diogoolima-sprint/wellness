import { useRef, useState } from 'react';
import { getLocal, setLocal } from '../lib/localPrefs';

/** Resizes the chosen image so it fits comfortably in local storage. */
async function toDataUrl(file: File, maxSide = 900): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.82);
}

/**
 * Native replacement for the prototype's <image-slot>: tap to pick a photo from the
 * gallery/camera. Stored on the device only.
 */
export function PhotoSlot({ placeholder }: { placeholder: string }) {
  const [photo, setPhoto] = useState<string | undefined>(() => getLocal('welcomePhoto'));
  const input = useRef<HTMLInputElement>(null);
  const pick = async (f: File | undefined) => {
    if (!f) return;
    const url = await toDataUrl(f);
    setLocal('welcomePhoto', url);
    setPhoto(url);
  };
  return (
    <button
      type="button"
      onClick={() => input.current?.click()}
      style={{
        width: '100%', height: '100%', borderRadius: 20, cursor: 'pointer', padding: 0,
        border: photo ? 'none' : '1px dashed var(--border)',
        background: photo
          ? `center/cover no-repeat url("${photo}")`
          : 'repeating-linear-gradient(45deg,var(--surface),var(--surface) 8px,var(--surface2) 8px,var(--surface2) 16px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {!photo && <span style={{ font: '500 13px var(--fb)', color: 'var(--text2)' }}>{placeholder}</span>}
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
    </button>
  );
}
