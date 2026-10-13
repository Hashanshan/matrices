/**
 * Client-side image compression utility for Matrices.
 * Optimizes photos before uploading or adding to the offline sync queue,
 * preventing Vercel payload limit issues, network timeouts, and queue sync halts.
 */

export interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  maxSizeBytes?: number;
}

export async function compressImage(
  file: File,
  options: CompressOptions = {}
): Promise<string> {
  const {
    maxWidth = 1200,
    maxHeight = 1200,
    quality = 0.82,
    maxSizeBytes = 1.5 * 1024 * 1024
  } = options;

  if (!file.type.startsWith('image/')) {
    throw new Error('Selected file is not an image.');
  }

  // SVG images
  if (file.type === 'image/svg+xml') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read SVG file'));
      reader.readAsDataURL(file);
    });
  }

  // Small images (< 100KB) don't need further compression
  if (file.size < 100 * 1024) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read image file'));
      reader.readAsDataURL(file);
    });
  }

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;

      // Aspect ratio preservation within bounds
      if (width > maxWidth || height > maxHeight) {
        if (width / height > maxWidth / maxHeight) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, width);
      canvas.height = Math.max(1, height);

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return reject(new Error('Canvas context unavailable'));
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      // WebP preferred, fallback to JPEG
      let result = canvas.toDataURL('image/webp', quality);
      if (!result.startsWith('data:image/webp')) {
        result = canvas.toDataURL('image/jpeg', quality);
      }

      // Safety check: if still over target size, reduce dimensions further
      if (result.length > maxSizeBytes * 1.33) {
        const smallerCanvas = document.createElement('canvas');
        smallerCanvas.width = Math.round(width * 0.75);
        smallerCanvas.height = Math.round(height * 0.75);
        const sCtx = smallerCanvas.getContext('2d');
        if (sCtx) {
          sCtx.imageSmoothingEnabled = true;
          sCtx.drawImage(canvas, 0, 0, smallerCanvas.width, smallerCanvas.height);
          result = smallerCanvas.toDataURL('image/jpeg', 0.7);
        }
      }

      resolve(result);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image for compression'));
    };

    img.src = objectUrl;
  });
}
