import Konva from 'konva';
import jsPDF from 'jspdf';
import { ExportOptions, CanvasItem } from '@/components/Canvas/types';

/* -------------------------------------------
   CONTENT BOUNDS
-------------------------------------------- */
function getContentBounds(items: CanvasItem[]) {
  if (!items.length) {
    return { x: 0, y: 0, width: 100, height: 100 };
  }

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
   CREATE CLEAN EXPORT STAGE
-------------------------------------------- */
function createExportStage(
  originalStage: Konva.Stage,
  includeGrid: boolean = false
): { stage: Konva.Stage; container: HTMLDivElement } {
  // Create a temporary container
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  document.body.appendChild(container);

  // Clone the original stage
  const exportStage = originalStage.clone({
    container,
  }) as Konva.Stage;

  // Remove all non-exportable elements
  exportStage.find('*').forEach(node => {
    // Remove selection outlines and grips
    if (
      node.name()?.includes('selection') ||
      node.name()?.includes('grip') ||
      node.name()?.includes('resize') ||
      node.name()?.includes('hover')
    ) {
      node.destroy();
      return;
    }

    // Remove guides and helper lines
    if (
      node.name()?.includes('guide') ||
      node.name()?.includes('helper') ||
      node.name()?.includes('snap')
    ) {
      node.destroy();
      return;
    }

    // Control grid visibility
    if (node.name() === 'grid-layer' || node.name() === 'grid') {
      if (!includeGrid) {
        node.destroy();
      }
    }

    // Remove any nodes marked as non-exportable
    if (node.getAttr('exportable') === false) {
      node.destroy();
    }
  });

  // Reset transforms for clean export
  exportStage.scale({ x: 1, y: 1 });
  exportStage.position({ x: 0, y: 0 });

  return { stage: exportStage, container };
}

/* -------------------------------------------
   ADD WATERMARK
-------------------------------------------- */
function addWatermark(
  stage: Konva.Stage,
  text: string,
  bounds: { width: number; height: number }
) {
  const watermarkLayer = new Konva.Layer();
  
  const watermark = new Konva.Text({
    x: bounds.width - 200,
    y: bounds.height - 40,
    text: text,
    fontSize: 16,
    fontFamily: 'Arial',
    fill: 'rgba(0, 0, 0, 0.2)',
    opacity: 0.3,
    rotation: -30,
    listening: false,
  });

  watermarkLayer.add(watermark);
  stage.add(watermarkLayer);
  watermarkLayer.moveToTop();
}

/* -------------------------------------------
   IMAGE EXPORT (PNG / JPG) - FIXED VERSION
-------------------------------------------- */
export async function exportToImage(
  stage: Konva.Stage,
  options: ExportOptions,
  items: CanvasItem[]
): Promise<Blob> {
  if (!items.length) {
    throw new Error('Nothing to export');
  }

  const padding = options.padding ?? 40;
  const bounds = getContentBounds(items);
  
  // Create clean export stage
  const { stage: exportStage, container } = createExportStage(
    stage,
    options.showGrid || options.includeGrid
  );

  try {
    // Add background layer
    const bgLayer = new Konva.Layer({ listening: false });
    const bgRect = new Konva.Rect({
      x: bounds.x - padding,
      y: bounds.y - padding,
      width: bounds.width + padding * 2,
      height: bounds.height + padding * 2,
      fill: options.backgroundColor === 'transparent' 
        ? '#ffffff' 
        : options.backgroundColor,
      listening: false,
    });

    bgLayer.add(bgRect);
    exportStage.add(bgLayer);
    bgLayer.moveToBottom();

    // Add watermark if enabled
    if (options.includeWatermark && options.watermarkText) {
      addWatermark(exportStage, options.watermarkText, {
        width: bounds.width + padding * 2,
        height: bounds.height + padding * 2,
      });
    }

    exportStage.draw();

    // Export the cropped area
    const dataUrl = exportStage.toDataURL({
      x: bounds.x - padding,
      y: bounds.y - padding,
      width: bounds.width + padding * 2,
      height: bounds.height + padding * 2,
      pixelRatio: options.scale,
      mimeType: options.format === 'jpg' ? 'image/jpeg' : 'image/png',
      quality: options.format === 'jpg' 
        ? options.quality === 'high' ? 1 
          : options.quality === 'medium' ? 0.8 
          : 0.6 
        : undefined,
    });

    // Cleanup
    exportStage.destroy();
    document.body.removeChild(container);

    // Convert to blob
    const response = await fetch(dataUrl);
    return await response.blob();
  } catch (error) {
    // Ensure cleanup even on error
    exportStage.destroy();
    if (container.parentNode) {
      document.body.removeChild(container);
    }
    throw error;
  }
}

/* -------------------------------------------
   SVG EXPORT (SAFE)
-------------------------------------------- */
export async function exportToSVG(
  stage: Konva.Stage,
  options: ExportOptions,
  items: CanvasItem[]
): Promise<string> {
  if (!items.length) {
    throw new Error('Nothing to export');
  }

  const padding = options.padding ?? 40;
  const bounds = getContentBounds(items);
  
  // Create clean export stage
  const { stage: exportStage, container } = createExportStage(
    stage,
    options.showGrid || options.includeGrid
  );

  try {
    // Add background
    const bgLayer = new Konva.Layer({ listening: false });
    const bgRect = new Konva.Rect({
      x: bounds.x - padding,
      y: bounds.y - padding,
      width: bounds.width + padding * 2,
      height: bounds.height + padding * 2,
      fill: options.backgroundColor === 'transparent' 
        ? 'none' 
        : options.backgroundColor,
      listening: false,
    });

    bgLayer.add(bgRect);
    exportStage.add(bgLayer);
    bgLayer.moveToBottom();

    // Add watermark if enabled
    if (options.includeWatermark && options.watermarkText) {
      addWatermark(exportStage, options.watermarkText, {
        width: bounds.width + padding * 2,
        height: bounds.height + padding * 2,
      });
    }

    exportStage.draw();

    // Get SVG string
    const svgString = exportStage.toSVG({
      x: bounds.x - padding,
      y: bounds.y - padding,
      width: bounds.width + padding * 2,
      height: bounds.height + padding * 2,
    });

    // Cleanup
    exportStage.destroy();
    document.body.removeChild(container);

    return svgString;
  } catch (error) {
    exportStage.destroy();
    if (container.parentNode) {
      document.body.removeChild(container);
    }
    throw error;
  }
}

/* -------------------------------------------
   PDF EXPORT
-------------------------------------------- */
export async function exportToPDF(
  stage: Konva.Stage,
  options: ExportOptions,
  items: CanvasItem[]
): Promise<Blob> {
  // For PDF, always use PNG as source
  const imageBlob = await exportToImage(
    stage,
    { 
      ...options, 
      format: 'png',
      scale: options.scale * 2, // Higher scale for PDF
    },
    items
  );

  return new Promise((resolve, reject) => {
    const imageUrl = URL.createObjectURL(imageBlob);
    const img = new Image();

    img.onload = () => {
      try {
        const pdf = new jsPDF({
          orientation: img.width > img.height ? 'l' : 'p',
          unit: 'px',
          format: [img.width, img.height],
        });

        pdf.addImage(img, 'PNG', 0, 0, img.width, img.height);
        const pdfBlob = pdf.output('blob');
        URL.revokeObjectURL(imageUrl);
        resolve(pdfBlob);
      } catch (error) {
        URL.revokeObjectURL(imageUrl);
        reject(error);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(imageUrl);
      reject(new Error('Failed to load image for PDF export'));
    };
    
    img.src = imageUrl;
  });
}

/* -------------------------------------------
   MAIN EXPORT FUNCTION
-------------------------------------------- */
export async function exportDiagram(
  stage: Konva.Stage | null,
  items: CanvasItem[],
  options: ExportOptions
): Promise<Blob | string> {
  if (!stage) {
    throw new Error('Stage not available');
  }

  if (!items.length) {
    throw new Error('No items to export');
  }

  switch (options.format) {
    case 'png':
    case 'jpg':
      return await exportToImage(stage, options, items);
    
    case 'pdf':
      return await exportToPDF(stage, options, items);
    
    case 'svg':
      return await exportToSVG(stage, options, items);
    
    default:
      throw new Error(`Unsupported format: ${options.format}`);
  }
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