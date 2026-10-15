/** Limite di sicurezza per una foto in base64 (un documento Firestore arriva a 1 MB; le regole tagliano a 900 000). */
const MAX_CHARS = 800_000;
/** Per i biglietti, che si cifrano: il testo cifrato pesa circa 4/3 della foto. */
export const MAX_CHARS_SEALED = 600_000;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("formato")); };
    img.src = url;
  });
}

/**
 * Riduce una foto del telefono a un JPEG leggero (di solito 150–400 KB).
 * I browser applicano già l'orientamento EXIF quando disegnano l'immagine.
 * Se il risultato è ancora troppo pesante si riprova più piccolo.
 */
export async function compressImage(file: File, maxChars = MAX_CHARS): Promise<{ data: string; w: number; h: number }> {
  const img = await loadImage(file);
  for (const [side, q] of [[1600, 0.72], [1200, 0.6], [900, 0.5]] as const) {
    const k = Math.min(1, side / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    ctx.fillStyle = "#fff"; // PNG trasparenti: sfondo bianco invece che nero
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const data = canvas.toDataURL("image/jpeg", q);
    if (data.length < maxChars) return { data, w, h };
  }
  throw new Error("troppo grande");
}
