import Konva from 'konva';
import jsPDF from 'jspdf';
import { ExportOptions, CanvasItem } from '@/components/Canvas/types';

/* -------------------------------------------
   CONTENT BOUNDS
-------------------------------------------- */
function getContentBounds(items: CanvasItem[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  items.forEach(item => {
    minX = Math.min(minX, item.x);
    minY = Math.min(minY, item.y);
    maxX = Math.max(maxX, item.x + item.width);
    maxY = Math.max(maxY, item.y + item.height);
  });

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/* -------------------------------------------
   IMAGE EXPORT (PNG / JPG)
-------------------------------------------- */
export async function exportToImage(
  stage: Konva.Stage,
  options: ExportOptions,
  items: CanvasItem[]
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      if (!items.length) {
        throw new Error('Nothing to export');
      }

      const padding = options.padding ?? 40;
      const bounds = getContentBounds(items);

      const bgColor =
        options.backgroundColor === 'transparent'
          ? '#ffffff'
          : options.backgroundColor;

      // Save stage state
      const originalScale = stage.scale();
      const originalPos = stage.position();

      // Background layer (TEMP)
      const bgLayer = new Konva.Layer({ listening: false });
      const bgRect = new Konva.Rect({
        x: bounds.x - padding,
        y: bounds.y - padding,
        width: bounds.width + padding * 2,
        height: bounds.height + padding * 2,
        fill: bgColor,
      });

      bgLayer.add(bgRect);
      stage.add(bgLayer);
      bgLayer.moveToBottom();
      bgLayer.draw();

      // Reset transforms
      stage.scale({ x: 1, y: 1 });
      stage.position({ x: 0, y: 0 });

      // Export ONLY content area
      const dataUrl = stage.toDataURL({
        x: bounds.x - padding,
        y: bounds.y - padding,
        width: bounds.width + padding * 2,
        height: bounds.height + padding * 2,
        pixelRatio: options.scale,
        mimeType:
          options.format === 'jpg'
            ? 'image/jpeg'
            : 'image/png',
        quality:
          options.format === 'jpg'
            ? options.quality === 'high'
              ? 1
              : options.quality === 'medium'
              ? 0.8
              : 0.6
            : undefined,
      });

      // Cleanup
      bgLayer.destroy();
      stage.scale(originalScale);
      stage.position(originalPos);

      fetch(dataUrl)
        .then(res => res.blob())
        .then(resolve)
        .catch(reject);
    } catch (err) {
      reject(err);
    }
  });
}

/* -------------------------------------------
   SVG EXPORT (SAFE)
-------------------------------------------- */
 

/* -------------------------------------------
   PDF EXPORT
-------------------------------------------- */
export async function exportToPDF(
  stage: Konva.Stage,
  options: ExportOptions,
  items: CanvasItem[]
): Promise<Blob> {
  const imageBlob = await exportToImage(
    stage,
    { ...options, format: 'png' },
    items
  );

  return new Promise((resolve, reject) => {
    const imageUrl = URL.createObjectURL(imageBlob);
    const img = new Image();

    img.onload = () => {
      const pdf = new jsPDF({
        orientation: img.width > img.height ? 'l' : 'p',
        unit: 'px',
        format: [img.width, img.height],
      });

      pdf.addImage(img, 'PNG', 0, 0, img.width, img.height);
      const pdfBlob = pdf.output('blob');
      URL.revokeObjectURL(imageUrl);
      resolve(pdfBlob);
    };

    img.onerror = reject;
    img.src = imageUrl;
  });
}

/* -------------------------------------------
   DOWNLOAD HELPERS
-------------------------------------------- */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadSVG(svgString: string, filename: string) {
  const blob = new Blob([svgString], { type: 'image/svg+xml' });
  downloadBlob(blob, filename);
}
