import { DiagramExportData, CanvasState } from '@/components/Canvas/types';
import { ExportOptions } from '@/components/Canvas/types';

// Current version of the export format
export const CURRENT_EXPORT_VERSION = '1.0.0';
export const EDITOR_VERSION = '1.0.0';

/**
 * Creates export data from current canvas state
 */
export function createExportData(
  canvasState: CanvasState,
  viewport: {
    scale: number;
    position: { x: number; y: number };
    gridSize: number;
    showGrid: boolean;
    snapToGrid: boolean;
  },
  projectId: string,
  projectName?: string
): DiagramExportData {
  return {
    version: CURRENT_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    editorVersion: EDITOR_VERSION,
    
    canvasState: {
      items: [...canvasState.items],
      connections: [...canvasState.connections],
      counts: { ...canvasState.counts },
      sequenceCounter: canvasState.sequenceCounter,
    },
    
    viewport: {
      scale: viewport.scale,
      position: { ...viewport.position },
      gridSize: viewport.gridSize,
      showGrid: viewport.showGrid,
      snapToGrid: viewport.snapToGrid,
    },
    
    project: {
      id: projectId,
      name: projectName || `Diagram ${projectId}`,
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
    },
  };
}

/**
 * Validates export data structure and version
 */
export function validateExportData(data: any): data is DiagramExportData {
  if (!data || typeof data !== 'object') return false;
  
  // Check required top-level properties
  if (!data.version || !data.exportedAt || !data.canvasState) return false;
  
  // Check canvasState structure
  const { canvasState } = data;
  if (!Array.isArray(canvasState.items) || !Array.isArray(canvasState.connections)) {
    return false;
  }
  
  // Version compatibility check
  const [major] = data.version.split('.').map(Number);
  const [currentMajor] = CURRENT_EXPORT_VERSION.split('.').map(Number);
  
  return major <= currentMajor; // Allow loading older versions
}

/**
 * Converts export data to downloadable blob
 */
export function exportToDiagramFile(
  exportData: DiagramExportData,
  fileName?: string
): void {
  // Convert to JSON with pretty formatting
  const jsonString = JSON.stringify(exportData, null, 2);
  
  // Create blob
  const blob = new Blob([jsonString], {
    type: 'application/vnd.pfd-editor+json',
  });
  
  // Create download link
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  
  // Use provided filename or generate default
  if (fileName) {
    // Ensure it has the .pfd extension
    const hasExtension = fileName.toLowerCase().endsWith('.pfd');
    link.download = hasExtension ? fileName : `${fileName}.pfd`;
  } else {
    link.download = `diagram-${exportData.project.id}.pfd`;
  }
  
  // Trigger download
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Clean up
  URL.revokeObjectURL(url);
}

/**
 * Exports canvas as image (PNG, JPG, etc.)
 */
export function exportToImage(
  stage: any, // Konva stage
  options: ExportOptions
): void {
  // Determine MIME type based on format
  let mimeType: string;
  let extension: string;
  
  switch (options.format) {
    case 'png':
      mimeType = 'image/png';
      extension = '.png';
      break;
    case 'jpg':
      mimeType = 'image/jpeg';
      extension = '.jpg';
      break;
    case 'pdf':
      // PDF export would require different handling
      mimeType = 'application/pdf';
      extension = '.pdf';
      break;
    default:
      mimeType = 'image/png';
      extension = '.png';
  }
  
  if (options.format === 'pdf') {
    // PDF export requires special handling (you'd need a PDF library)
    console.warn('PDF export not implemented yet');
    return;
  }
  
  // Get data URL from Konva stage
  const dataUrl = stage.toDataURL({
    mimeType,
    quality: options.quality === 'high' ? 1 : options.quality === 'medium' ? 0.75 : 0.5,
    pixelRatio: options.scale,
  });
  
  // Create download link
  const link = document.createElement('a');
  link.href = dataUrl;
  
  // Use provided filename or generate default
  if (options.filename) {
    // Ensure it has the correct extension
    const hasExtension = options.filename.toLowerCase().endsWith(extension);
    link.download = hasExtension ? options.filename : `${options.filename}${extension}`;
  } else {
    link.download = `diagram${extension}`;
  }
  
  // Trigger download
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Reads and validates diagram file
 */
export async function importFromDiagramFile(file: File): Promise<DiagramExportData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const data = JSON.parse(content);
        
        if (validateExportData(data)) {
          resolve(data);
        } else {
          reject(new Error('Invalid diagram file format'));
        }
      } catch (error) {
        reject(new Error('Failed to parse diagram file'));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsText(file);
  });
}

/**
 * Migrates older export versions to current format
 */
export function migrateExportData(data: DiagramExportData): DiagramExportData {
  const version = data.version || '0.1.0';
  
  // Version 0.1.0 -> 1.0.0 migration
  if (version === '0.1.0') {
    return {
      ...data,
      version: CURRENT_EXPORT_VERSION,
      editorVersion: EDITOR_VERSION,
      viewport: data.viewport || {
        scale: 1,
        position: { x: 0, y: 0 },
        gridSize: 20,
        showGrid: true,
        snapToGrid: true,
      },
    };
  }
  
  return data;
}

/**
 * Creates a thumbnail from canvas state
 */
export async function createExportThumbnail(
  stage: any, // Konva stage
  options: { width: number; height: number }
): Promise<string> {
  return new Promise((resolve) => {
    // Create a temporary stage for thumbnail
    const tempStage = stage.clone();
    tempStage.scale({ x: 1, y: 1 });
    tempStage.position({ x: 0, y: 0 });
    
    // Convert to data URL
    const dataUrl = tempStage.toDataURL({
      width: options.width,
      height: options.height,
      pixelRatio: 1,
    });
    
    resolve(dataUrl);
  });
}