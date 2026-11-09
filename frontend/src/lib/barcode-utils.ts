export type ProcessingPass = 
  | 'original'
  | 'grayscale'
  | 'contrast'
  | 'threshold'
  | 'upscale'
  | 'upscale-gray'
  | 'roi-center';

export const PASSES: ProcessingPass[] = [
  'original',
  'grayscale',
  'roi-center',
  'upscale',
  'contrast',
  'threshold',
  'upscale-gray'
];

export const SUPPORTED_BARCODE_FORMATS = [
  'ean_13',
  'ean_8',
  'upc_a',
  'upc_e',
  'code_128',
  'code_39',
  'itf',
  'qr_code'
] as const;

export const ZXING_WASM_FORMATS = [
  'EAN13',
  'EAN8',
  'UPCA',
  'UPCE',
  'Code128',
  'Code39',
  'ITF',
  'QRCode'
] as const;

/**
 * 880Hz Synthesized Sine-Wave Beep using native Web Audio API
 * Zero external audio files required. Instant low-latency execution.
 */
export function playBeepSound(): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, ctx.currentTime); // 880Hz pitch (A5 note)

    // Smooth attack and exponential decay to prevent audio pops
    gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.1);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.1);

    // Close audio context after playback
    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 200);
  } catch (e) {
    // Audio autoplay restrictions might occasionally trigger; safely ignore
  }
}

/**
 * Create a white-padded canvas from an image element or source canvas.
 * Adding white margin around barcodes is proven to dramatically improve 1D barcode detection.
 */
export function createPaddedCanvas(
  source: HTMLImageElement | HTMLCanvasElement,
  paddingPercent: number = 0.1
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return document.createElement('canvas');

  const width = source.width;
  const height = source.height;
  const padX = Math.max(40, Math.round(width * paddingPercent));
  const padY = Math.max(40, Math.round(height * paddingPercent));

  canvas.width = width + padX * 2;
  canvas.height = height + padY * 2;

  // Fill solid white background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw source image centered
  ctx.drawImage(source, padX, padY, width, height);
  return canvas;
}

/**
 * Region of Interest (ROI) cropping to center 80% width, 60% height
 */
export function applyRoiCenter(sourceCanvas: HTMLCanvasElement): HTMLCanvasElement {
  const width = sourceCanvas.width;
  const height = sourceCanvas.height;
  const w = Math.round(width * 0.8);
  const h = Math.round(height * 0.6);
  const x = Math.round((width - w) / 2);
  const y = Math.round((height - h) / 2);

  const resultCanvas = document.createElement('canvas');
  resultCanvas.width = w;
  resultCanvas.height = h;
  const ctx = resultCanvas.getContext('2d', { willReadFrequently: true });
  if (ctx) {
    ctx.drawImage(sourceCanvas, x, y, w, h, 0, 0, w, h);
  }
  return resultCanvas;
}

/**
 * Grayscale conversion via standard luminance weights (0.299*R + 0.587*G + 0.114*B)
 */
export function applyGrayscale(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const luminance = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const gray = Math.min(255, Math.max(0, Math.round(luminance)));
    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
  }
  ctx.putImageData(imgData, 0, 0);
}

/**
 * Contrast adjustment with 1.5x factor and intercept offset
 */
export function applyContrast(ctx: CanvasRenderingContext2D, w: number, h: number, contrast: number = 1.5): void {
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  const intercept = 128 * (1 - contrast);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.min(255, Math.max(0, Math.round(data[i] * contrast + intercept)));
    data[i + 1] = Math.min(255, Math.max(0, Math.round(data[i + 1] * contrast + intercept)));
    data[i + 2] = Math.min(255, Math.max(0, Math.round(data[i + 2] * contrast + intercept)));
  }
  ctx.putImageData(imgData, 0, 0);
}

/**
 * Binary thresholding (black & white at threshold = 128)
 */
export function applyThreshold(ctx: CanvasRenderingContext2D, w: number, h: number, threshold: number = 128): void {
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const luminance = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const val = luminance > threshold ? 255 : 0;
    data[i] = val;
    data[i + 1] = val;
    data[i + 2] = val;
  }
  ctx.putImageData(imgData, 0, 0);
}

/**
 * Apply a specific preprocessing pass to a canvas
 */
export function applyProcessing(
  sourceCanvas: HTMLCanvasElement,
  pass: ProcessingPass
): HTMLCanvasElement {
  const width = sourceCanvas.width;
  const height = sourceCanvas.height;
  if (width === 0 || height === 0) return sourceCanvas;

  if (pass === 'original') {
    const resultCanvas = document.createElement('canvas');
    resultCanvas.width = width;
    resultCanvas.height = height;
    const ctx = resultCanvas.getContext('2d', { willReadFrequently: true });
    ctx?.drawImage(sourceCanvas, 0, 0);
    return resultCanvas;
  }

  if (pass === 'roi-center') {
    return applyRoiCenter(sourceCanvas);
  }

  if (pass === 'upscale' || pass === 'upscale-gray') {
    const resultCanvas = document.createElement('canvas');
    resultCanvas.width = width * 2;
    resultCanvas.height = height * 2;
    const ctx = resultCanvas.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(sourceCanvas, 0, 0, resultCanvas.width, resultCanvas.height);
      if (pass === 'upscale-gray') {
        applyGrayscale(ctx, resultCanvas.width, resultCanvas.height);
      }
    }
    return resultCanvas;
  }

  const resultCanvas = document.createElement('canvas');
  resultCanvas.width = width;
  resultCanvas.height = height;
  const ctx = resultCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return sourceCanvas;

  ctx.drawImage(sourceCanvas, 0, 0);

  if (pass === 'grayscale') {
    applyGrayscale(ctx, width, height);
  } else if (pass === 'contrast') {
    applyContrast(ctx, width, height, 1.5);
  } else if (pass === 'threshold') {
    applyThreshold(ctx, width, height, 128);
  }

  return resultCanvas;
}

/**
 * Fallback using native BarcodeDetector if available
 */
export async function fallbackNativeDecode(
  canvas: HTMLCanvasElement
): Promise<{ value: string; format: string } | null> {
  if (typeof window === 'undefined' || !('BarcodeDetector' in window)) return null;

  try {
    // @ts-ignore
    const detector = new window.BarcodeDetector({
      formats: Array.from(SUPPORTED_BARCODE_FORMATS)
    });

    const barcodes = await detector.detect(canvas);
    if (barcodes && barcodes.length > 0) {
      return {
        value: barcodes[0].rawValue,
        format: barcodes[0].format
      };
    }
  } catch (err) {
    // Native detector fallback failed
  }
  return null;
}
