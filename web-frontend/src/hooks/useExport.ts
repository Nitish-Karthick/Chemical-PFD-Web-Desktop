import { useState, useCallback } from 'react';
import Konva from 'konva';
import { ExportOptions, ExportFormat } from '@/components/Canvas/types';
import {
  exportToImage, 
  exportToPDF,
  downloadBlob,
  downloadSVG,
} from '@/utils/exports';
import { CanvasItem } from '@/components/Canvas/types';

export function useExport() {
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const generateFilename = (format: ExportFormat): string => {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    return `diagram-${timestamp}.${format}`;
  };
const exportDiagram = useCallback(
  async (
    stage: Konva.Stage | null,
    options: ExportOptions,
    items: CanvasItem[]
  ): Promise<void> => {      
    if (!stage) {
        setExportError('Stage not found');
        return;
    }

      setIsExporting(true);
      setExportError(null);

      try {
        const filename = generateFilename(options.format);

        switch (options.format) {

          case 'pdf': {
            const pdfBlob = await exportToPDF(stage, options, items);
            downloadBlob(pdfBlob, filename);
            break;
          }

          case 'png':
          case 'jpg': {
            const imageBlob = await exportToImage(stage, options, items);
            downloadBlob(imageBlob, filename);
            break;
          }

          default:
            throw new Error(`Unsupported format: ${options.format}`);
        }
      } catch (error) {
        console.error('Export failed:', error);
        setExportError(
          error instanceof Error ? error.message : 'Export failed. Please try again.'
        );
      } finally {
        setIsExporting(false);
      }
    },
    []
  );

  return {
    exportDiagram,
    isExporting,
    exportError,
    clearError: () => setExportError(null),
  };
}