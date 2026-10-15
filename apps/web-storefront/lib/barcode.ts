// Reading a barcode in the browser, with the BarcodeDetector the browser itself provides (Chrome and Edge; Safari and Firefox do not have it yet, and the page then says so
// and offers typing the number instead). Nothing is uploaded: the camera picture or the photo is read on the buyer's own device.
interface DetectedBarcode { rawValue: string }
interface Detector { detect(source: ImageBitmapSource): Promise<DetectedBarcode[]> }
type DetectorConstructor = new (options?: { formats?: string[] }) => Detector;

// The formats printed on car parts and their boxes.
const FORMATS = ["code_128", "code_39", "ean_13", "ean_8", "upc_a", "upc_e", "itf", "codabar", "qr_code", "data_matrix"];

function constructor(): DetectorConstructor | null {
  if (typeof window === "undefined") return null;
  const ctor = (window as unknown as { BarcodeDetector?: DetectorConstructor }).BarcodeDetector;
  return ctor ?? null;
}

export const barcodeSupported = (): boolean => constructor() !== null;

/** The first barcode in [source] (a video frame or an image), or null when there is none or this browser cannot read barcodes. */
export async function readBarcode(source: ImageBitmapSource): Promise<string | null> {
  const Ctor = constructor();
  if (!Ctor) return null;
  const found = await new Ctor({ formats: FORMATS }).detect(source);
  const value = found[0]?.rawValue?.trim();
  return value ? value : null;
}

/** Reads a photo the buyer picked. */
export async function readBarcodeFromFile(file: Blob): Promise<string | null> {
  const bitmap = await createImageBitmap(file);
  try {
    return await readBarcode(bitmap);
  } finally {
    bitmap.close();
  }
}
