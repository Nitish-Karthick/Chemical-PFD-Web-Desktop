import Konva from 'konva';
import jsPDF from 'jspdf';
import { ExportOptions, CanvasItem, Connection } from '@/components/Canvas/types';

/* -------------------------------------------
   SIMPLIFIED CONTENT BOUNDS - FIXED
-------------------------------------------- */
function getContentBounds(items: CanvasItem[], connections: Connection[]) {
  if (!items.length) {
    // Default bounds if no items
    return { x: 0, y: 0, width: 800, height: 600 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  // Include items
  items.forEach(item => {
    minX = Math.min(minX, item.x);
    minY = Math.min(minY, item.y);
    maxX = Math.max(maxX, item.x + item.width);
    maxY = Math.max(maxY, item.y + item.height);
  });

  // Add margin
  const margin = 50;
  return {
    x: Math.max(0, minX - margin),
    y: Math.max(0, minY - margin),
    width: (maxX - minX) + margin * 2,
    height: (maxY - minY) + margin * 2,
  };
}

/* -------------------------------------------
   CREATE CROPPED STAGE - SIMPLIFIED
-------------------------------------------- */
function createCroppedStage(
  originalStage: Konva.Stage,
  items: CanvasItem[],
  padding: number = 50
): Konva.Stage {
  const bounds = getContentBounds(items, []);
  
  // Create temporary container
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  container.style.width = `${bounds.width}px`;
  container.style.height = `${bounds.height}px`;
  document.body.appendChild(container);

  // Create new stage with cropped bounds
  const croppedStage = new Konva.Stage({
    container,
    width: bounds.width,
    height: bounds.height,
    listening: false,
  });

  // Clone the main layer from original stage
  const originalLayer = originalStage.findOne('Layer');
  if (originalLayer) {
    // Clone the layer
    const clonedLayer = originalLayer.clone({
      listening: false,
    });
    
    // Translate the layer to fit within cropped bounds
    clonedLayer.position({
      x: -bounds.x,
      y: -bounds.y
    });
    
    // Remove any selection/transform elements
    clonedLayer.find('.transform-controls').forEach(node => node.destroy());
    clonedLayer.find('.selection-rectangle').forEach(node => node.destroy());
    
    croppedStage.add(clonedLayer);
  }

  return croppedStage;
}

/* -------------------------------------------
   IMAGE EXPORT - SIMPLIFIED (No SVG parsing)
-------------------------------------------- */
export async function exportToImage(
  stage: Konva.Stage,
  options: ExportOptions,
  items: CanvasItem[],
  connections: Connection[] = []
): Promise<Blob> {
  if (!items.length) {
    throw new Error('No items to export');
  }

  // Create cropped stage
  const croppedStage = createCroppedStage(stage, items, options.padding || 20);
  
  try {
    // Wait for all images to load in the stage
    await waitForStageImages(croppedStage);
    
    // Force redraw
    croppedStage.draw();
    
    // Export to data URL
    const dataUrl = croppedStage.toDataURL({
      pixelRatio: options.scale || 2,
      mimeType: options.format === 'jpg' ? 'image/jpeg' : 'image/png',
      quality: options.format === 'jpg' 
        ? options.quality === 'high' ? 0.95 
          : options.quality === 'medium' ? 0.8 
          : 0.6 
        : 1,
      fill: options.backgroundColor === 'transparent' 
        ? 'rgba(0,0,0,0)' 
        : options.backgroundColor || '#ffffff',
    });

    // Cleanup
    croppedStage.destroy();
    const container = croppedStage.container();
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }

    // Convert to blob
    const response = await fetch(dataUrl);
    return await response.blob();
  } catch (error) {
    // Cleanup on error
    croppedStage.destroy();
    const container = croppedStage.container();
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    throw error;
  }
}

/* -------------------------------------------
   WAIT FOR STAGE IMAGES
-------------------------------------------- */
function waitForStageImages(stage: Konva.Stage): Promise<void> {
  return new Promise((resolve) => {
    const images = stage.find('Image');
    
    if (images.length === 0) {
      resolve();
      return;
    }

    let loadedCount = 0;
    const totalImages = images.length;
    
    images.forEach((imageNode: any) => {
      const img = imageNode.image();
      
      if (!img) {
        loadedCount++;
        checkComplete();
        return;
      }

      if (img.complete && img.naturalWidth > 0) {
        loadedCount++;
        checkComplete();
        return;
      }

      img.onload = () => {
        loadedCount++;
        checkComplete();
      };
      
      img.onerror = () => {
        loadedCount++; // Count as loaded even if error
        checkComplete();
      };
    });

    function checkComplete() {
      if (loadedCount === totalImages) {
        resolve();
      }
    }
  });
}

/* -------------------------------------------
   PDF EXPORT - SIMPLIFIED
-------------------------------------------- */
export async function exportToPDF(
  stage: Konva.Stage,
  options: ExportOptions,
  items: CanvasItem[],
  connections: Connection[] = []
): Promise<Blob> {
  // First, create an image blob
  const imageOptions: ExportOptions = {
    ...options,
    format: 'png',
    scale: (options.scale || 1) * 2, // Higher resolution for PDF
  };
  
  const imageBlob = await exportToImage(stage, imageOptions, items, connections);

  return new Promise((resolve, reject) => {
    const imageUrl = URL.createObjectURL(imageBlob);
    const img = new Image();

    img.onload = () => {
      try {
        // Calculate PDF dimensions
        const pdfWidth = 210; // A4 width in mm
        const pdfHeight = 297; // A4 height in mm
        
        // Scale image to fit PDF while maintaining aspect ratio
        const imgAspectRatio = img.width / img.height;
        const pdfAspectRatio = pdfWidth / pdfHeight;
        
        let imgWidth, imgHeight;
        
        if (imgAspectRatio > pdfAspectRatio) {
          // Image is wider than PDF
          imgWidth = pdfWidth - 20; // 10mm margins on each side
          imgHeight = imgWidth / imgAspectRatio;
        } else {
          // Image is taller than PDF
          imgHeight = pdfHeight - 20;
          imgWidth = imgHeight * imgAspectRatio;
        }
        
        // Center the image
        const xOffset = (pdfWidth - imgWidth) / 2;
        const yOffset = (pdfHeight - imgHeight) / 2;
        
        // Create PDF (always portrait for A4)
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4',
        });

        // Add background if needed
        if (options.backgroundColor && options.backgroundColor !== 'transparent') {
          pdf.setFillColor(options.backgroundColor);
          pdf.rect(0, 0, pdfWidth, pdfHeight, 'F');
        }

        // Add image
        pdf.addImage(img, 'PNG', xOffset, yOffset, imgWidth, imgHeight);
        
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
      reject(new Error('Failed to load image for PDF'));
    };
    
    img.src = imageUrl;
  });
}

/* -------------------------------------------
   MAIN EXPORT FUNCTION - SIMPLIFIED
-------------------------------------------- */
export async function exportDiagram(
  stage: Konva.Stage | null,
  items: CanvasItem[],
  options: ExportOptions & { connections?: Connection[] }
): Promise<Blob> {
  if (!stage) {
    throw new Error('Stage not available');
  }

  if (!items.length) {
    throw new Error('No items to export');
  }

  // For PNG/JPG export
  if (options.format === 'png' || options.format === 'jpg') {
    return await exportToImage(stage, options, items, options.connections || []);
  }
  
  // For PDF export
  if (options.format === 'pdf') {
    return await exportToPDF(stage, options, items, options.connections || []);
  }
  
  throw new Error(`Unsupported format: ${options.format}`);
}

/* -------------------------------------------
   DOWNLOAD HELPER
-------------------------------------------- */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  
  // Cleanup
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}