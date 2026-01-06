// Editor.tsx (integrated version)
import React, { useEffect, useState, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Stage, Layer, Line, Shape } from "react-konva";
import Konva from "konva";
import {
  Button,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Tooltip,
  Switch,
} from "@heroui/react";
import {
  TbLayoutSidebarRightExpand,
  TbLayoutSidebarRightCollapse,
  TbLayoutSidebarLeftCollapse,
  TbLayoutSidebarLeftExpand,
  TbFileImport,
} from "react-icons/tb";
import { MdZoomIn, MdZoomOut, MdCenterFocusWeak } from "react-icons/md";
import { FiDownload } from "react-icons/fi";
import { Popover, PopoverTrigger, PopoverContent } from "@heroui/react";
import { TbGridDots, TbGridPattern } from "react-icons/tb";

import { ThemeSwitch } from "@/components/theme-switch";
import { CanvasItemImage } from "@/components/Canvas/CanvasItemImage";
import { ConnectionLine } from "@/components/Canvas/ConnectionLine";
import {
  ComponentLibrarySidebar,
  CanvasPropertiesSidebar,
} from "@/components/Canvas/ComponentLibrarySidebar";
import { calculateManualPathsWithBridges } from "@/utils/routing";
import { useComponents } from "@/context/ComponentContext";
import ExportModal from "@/components/Canvas/ExportModal";
import { exportDiagram, downloadBlob } from "@/utils/exports";
import { ExportOptions } from "@/components/Canvas/types";
import { useEditorStore } from "@/store/useEditorStore";
import {
  type ComponentItem,
  type CanvasItem,
  type Connection,
} from "@/components/Canvas/types";
import { ExportReportModal } from "@/components/Canvas/ExportReportModal";
import {
  createExportData,
  exportToDiagramFile,
  importFromDiagramFile,
  migrateExportData,
} from "@/utils/diagramExport";
import { SaveConfirmationModal } from "@/components/SaveConfirmationModal";
import { UnsavedChangesModal } from "@/components/UnsavedChangesModal";
import { NewProjectModal } from "@/components/NewProjectModal";
import {
  getProject,
  saveProject,
  createProject,
  type SavedProject,
  convertToBackendFormat,
} from "@/utils/projectStorage";

type Shortcut = {
  key: string;
  label: string;
  display: string;
  handler: () => void;
  requireCtrl?: boolean;
};

export default function Editor() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(true);

  const [gridSize, setGridSize] = useState(20);
  // In your state section, add:
  const [isImporting, setIsImporting] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [projectMetadata, setProjectMetadata] = useState<Pick<SavedProject, 'name' | 'description'> | null>(null);

  // Unsaved changes tracking
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSavedState, setLastSavedState] = useState<string | null>(null);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [unsavedContext, setUnsavedContext] = useState<'navigation' | 'newProject'>('navigation');
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);

  // Get editor store methods
  const editorStore = useEditorStore();

  // Get current state from store
  const currentState = useMemo(() => {
    if (!projectId) return null;

    return editorStore.getEditorState(projectId);
  }, [projectId, editorStore]);

  // Initialize editor when projectId changes and load from localStorage
  useEffect(() => {
    if (!projectId) return;

    // Try to load project from localStorage
    const savedProject = getProject(Number(projectId));

    if (savedProject) {
      // Load project metadata
      setProjectMetadata({
        name: savedProject.name,
        description: savedProject.description,
      });

      // Hydrate editor with saved canvas state
      // Convert BackendCanvasItem to CanvasItem format
      const canvasItems = savedProject.canvas_state.items.map(item => ({
        id: item.id,
        name: item.name || item.object || 'Component',
        icon: item.png || item.svg || '',
        svg: item.svg || '',
        class: item.object || '',
        object: item.object || '',
        args: [],
        addedAt: Date.now(),
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height,
        rotation: item.rotation,
        scaleX: item.scaleX,
        scaleY: item.scaleY,
        sequence: item.sequence,
        label: item.label,
        grips: item.grips,
        legend: item.legend,
        suffix: item.suffix,
        png: item.png,
      } as any));

      editorStore.hydrateEditor(projectId, {
        items: canvasItems,
        connections: savedProject.canvas_state.connections,
        counts: {}, // Will be recalculated
        sequenceCounter: savedProject.canvas_state.sequence_counter,
      });

      // Restore viewport settings if available
      if (savedProject.viewport) {
        setStageScale(savedProject.viewport.scale);
        setStagePos(savedProject.viewport.position);
        setGridSize(savedProject.viewport.gridSize);
        setShowGrid(savedProject.viewport.showGrid);
        setSnapToGrid(savedProject.viewport.snapToGrid);
      }
    } else {
      // New project, just initialize
      editorStore.initEditor(projectId);
      setProjectMetadata({
        name: `Project ${projectId}`,
        description: null,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]); // Only depend on projectId, not editorStore

  // Extract data from current state
  const droppedItems = useMemo(() => {
    if (!projectId) return [];

    return editorStore.getItemsInOrder(projectId);
  }, [projectId, editorStore, currentState?.items]);

  const connections = useMemo(() => {
    return currentState?.connections || [];
  }, [currentState?.connections]);

  const canUndo = projectId ? editorStore.canUndo(projectId) : false;
  const canRedo = projectId ? editorStore.canRedo(projectId) : false;

  const isCtrlOrCmd = (e: KeyboardEvent) => e.ctrlKey || e.metaKey;

  // Export diagram states
  const [showExportModal, setShowExportModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showGrid, setShowGrid] = useState(true);


  const [isExporting, setIsExporting] = useState(false);

  // Add this component inside your Editor component, after all state declarations
  const FileDropZone = () => {
    const [isDragging, setIsDragging] = useState(false);

    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
    };

    const handleDrop = async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (!file || !file.name.endsWith('.export')) return;

      // Create a synthetic event for handleImportDiagram
      const syntheticEvent = {
        target: {
          files: [file]
        }
      } as unknown as React.ChangeEvent<HTMLInputElement>;

      await handleImportDiagram(syntheticEvent);
    };

    if (!isDragging) return null;

    return (
      <div
        className="absolute inset-0 z-50 flex items-center justify-center bg-blue-500/10 backdrop-blur-sm border-4 border-dashed border-blue-400 rounded-lg"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow-2xl">
          <TbFileImport className="w-16 h-16 text-blue-500 mx-auto mb-4" />
          <p className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">
            Drop Diagram File Here
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            .export files only
          </p>
        </div>
      </div>
    );
  };
  const handleImportDiagram = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !projectId) return;

    setIsImporting(true);

    try {
      const importData = await importFromDiagramFile(file);
      const migratedData = migrateExportData(importData);

      // Restore the canvas state
      editorStore.hydrateEditor(projectId, migratedData.canvasState);

      // Restore viewport settings
      setStageScale(migratedData.viewport.scale);
      setStagePos(migratedData.viewport.position);
      setGridSize(migratedData.viewport.gridSize);
      setShowGrid(migratedData.viewport.showGrid);
      setSnapToGrid(migratedData.viewport.snapToGrid);

      alert(`Diagram "${migratedData.project.name}" imported successfully!`);
    } catch (error) {
      console.error('Import failed:', error);
      alert(`Import failed: ${(error as Error).message}`);
    } finally {
      setIsImporting(false);
      event.target.value = ''; // Reset file input
    }
  };
  // In your Editor.tsx handleExport function:
  const handleExport = async (options: ExportOptions) => {
    if (!projectId || !currentState) {
      alert('No project loaded');
      return;
    }

    setIsExporting(true);

    // Save current grid state for image exports
    const originalShowGrid = showGrid;

    try {
      if (options.format === 'export') {
        // Custom diagram file export
        const exportData = createExportData(
          currentState,
          {
            scale: stageScale,
            position: stagePos,
            gridSize: gridSize,
            showGrid: showGrid,
            snapToGrid: snapToGrid,
          },
          projectId,
          `Diagram ${projectId}`
        );

        // Use the filename from options or generate default
        const fileName = options.filename
          ? `${options.filename}.pfd`
          : `diagram-${projectId}.pfd`;

        exportToDiagramFile(exportData, fileName);
        setShowExportModal(false);
        return;
      }

      // Original image export code
      if (!stageRef.current) {
        throw new Error('Stage not available');
      }

      // Temporarily update grid visibility for image exports
      if (options.includeGrid !== undefined) {
        setShowGrid(options.includeGrid);
      }

      // Force a re-render to update the canvas
      await new Promise(resolve => setTimeout(resolve, 50));

      // Use the updated exportDiagram function with connections
      const result = await exportDiagram(
        stageRef.current,
        droppedItems,
        {
          ...options,
          connections: connections,
        }
      );

      // Use the filename from options with correct extension
      let filename: string;
      if (options.filename) {
        // Ensure correct extension based on format
        const extension = options.format === 'pdf' ? '.pdf' :
          options.format === 'jpg' ? '.jpg' : '.png';

        // Check if filename already has extension
        const hasCorrectExtension = options.filename.toLowerCase().endsWith(extension);
        filename = hasCorrectExtension ? options.filename : `${options.filename}${extension}`;
      } else {
        // Default filename
        const timestamp = new Date().toISOString().split('T')[0];
        filename = `diagram-${timestamp}.${options.format}`;
      }

      downloadBlob(result as Blob, filename);
      setShowExportModal(false);
    } catch (error) {
      console.error('Export failed:', error);
      alert(`Export failed: ${(error as Error).message}`);
    } finally {
      // Always restore original grid state for image exports
      if (options.format !== 'export') {
        setShowGrid(originalShowGrid);
      }
      setIsExporting(false);
    }
  };

  // Handle save changes to localStorage
  const handleSaveChanges = () => {
    if (!projectId || !currentState || !projectMetadata) {
      alert('No project loaded');
      return;
    }

    try {
      // Convert current editor state to backend format
      const canvasState = convertToBackendFormat(
        Number(projectId),
        currentState.items,
        currentState.connections,
        currentState.sequenceCounter || 0
      );

      // Create or update project
      const projectToSave: SavedProject = {
        id: Number(projectId),
        name: projectMetadata.name,
        description: projectMetadata.description,
        created_at: new Date().toISOString(), // Will be overridden if existing
        updated_at: new Date().toISOString(),
        canvas_state: canvasState,
        viewport: {
          scale: stageScale,
          position: stagePos,
          gridSize: gridSize,
          showGrid: showGrid,
          snapToGrid: snapToGrid,
        },
      };

      // Check if project already exists
      const existing = getProject(Number(projectId));
      if (existing) {
        projectToSave.created_at = existing.created_at;
      }

      // Save to localStorage
      saveProject(projectToSave);
      // Update last saved state after successful save
      const savedStateStr = JSON.stringify({
        items: currentState.items,
        connections: currentState.connections,
      });
      setLastSavedState(savedStateStr);
      setHasUnsavedChanges(false);
      alert(`Project "${projectMetadata.name}" saved successfully!`);
    } catch (error) {
      console.error('Save failed:', error);
      alert(`Save failed: ${(error as Error).message}`);
    }
  };

  // Initialize lastSavedState only on first load
  useEffect(() => {
    if (!currentState || lastSavedState) return;

    // Initialize on first load only (when lastSavedState is null)
    const currentStateStr = JSON.stringify({
      items: currentState.items,
      connections: currentState.connections,
    });
    setLastSavedState(currentStateStr);
  }, [currentState, lastSavedState]);
  // Track changes to detect unsaved modifications
  useEffect(() => {
    if (!currentState || !lastSavedState) return;

    const currentStateStr = JSON.stringify({
      items: currentState.items,
      connections: currentState.connections,
    });

    const changed = currentStateStr !== lastSavedState;
    if (changed !== hasUnsavedChanges) {
      setHasUnsavedChanges(changed);
    }
  }, [currentState?.items, currentState?.connections, lastSavedState, hasUnsavedChanges]);


  // Warn on browser refresh/close
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Handler for save and proceed with navigation
  const handleSaveAndNavigate = () => {
    handleSaveChanges();
    setHasUnsavedChanges(false);
    navigate('/dashboard');
  };

  // Handler for discard and proceed with navigation
  const handleDiscardAndNavigate = () => {
    setHasUnsavedChanges(false);
    navigate('/dashboard');
  };

  // Handler for new project button
  const handleNewProjectClick = () => {
    if (hasUnsavedChanges) {
      setUnsavedContext('newProject');
      setShowUnsavedModal(true);
    } else {
      setShowNewProjectModal(true);
    }
  };

  // Handler for save and create new project
  const handleSaveAndCreateNew = () => {
    handleSaveChanges();
    setHasUnsavedChanges(false);
    setShowNewProjectModal(true);
  };

  // Handler for discard and create new project
  const handleDiscardAndCreateNew = () => {
    setHasUnsavedChanges(false);
    setShowNewProjectModal(true);
  };

  // Handler for creating new project from modal
  const handleCreateNewProject = (name: string, description: string) => {
    const newProject = createProject(name, description || null);
    navigate(`/editor/${newProject.id}`);
  };


  useEffect(() => {
    if (showExportModal) {
      // Clear all selections when export modal opens
      setSelectedItemIds(new Set());
      setSelectedConnectionIds(new Set());
    }
  }, [showExportModal]);

  // --- State ---
  const { components } = useComponents();
  const handleZoomIn = () => {
    setStageScale((prev) => Math.min(3, prev + 0.1));
  };

  const handleZoomOut = () => {
    setStageScale((prev) => Math.max(0.1, prev - 0.1));
  };

  const handleToggleGrid = () => {
    setShowGrid((prev) => !prev);
  };

  const handleCenterToContent = () => {
    if (droppedItems.length === 0) {
      setStagePos({ x: 0, y: 0 });
      setStageScale(1);

      return;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    droppedItems.forEach((item) => {
      minX = Math.min(minX, item.x);
      minY = Math.min(minY, item.y);
      maxX = Math.max(maxX, item.x + item.width);
      maxY = Math.max(maxY, item.y + item.height);
    });

    const padding = 100;
    const contentWidth = maxX - minX + padding * 2;
    const contentHeight = maxY - minY + padding * 2;

    if (stageRef.current && containerRef.current) {
      const containerWidth = stageSize.width;
      const containerHeight = stageSize.height;

      const scaleX = containerWidth / contentWidth;
      const scaleY = containerHeight / contentHeight;
      const scale = Math.min(scaleX, scaleY, 1);

      const centerX = minX - padding + contentWidth / 2;
      const centerY = minY - padding + contentHeight / 2;

      const targetX = containerWidth / 2 - centerX * scale;
      const targetY = containerHeight / 2 - centerY * scale;

      setStageScale(scale);
      setStagePos({ x: targetX, y: targetY });
    }
  };

  // Selection state
  const [selectedItemIds, setSelectedItemIds] = useState<Set<number>>(
    new Set(),
  );
  const [selectedConnectionIds, setSelectedConnectionIds] = useState<
    Set<number>
  >(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  // Connection drawing state
  const [isDrawingConnection, setIsDrawingConnection] = useState(false);
  const [tempConnection, setTempConnection] = useState<{
    sourceItemId: number;
    sourceGripIndex: number;
    startX: number;
    startY: number;
    waypoints: { x: number; y: number }[];
    currentX: number;
    currentY: number;
  } | null>(null);
  const [hoveredGrip, setHoveredGrip] = useState<{
    itemId: number;
    gripIndex: number;
  } | null>(null);

  // Canvas Viewport State
  const [stageScale, setStageScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });

  // Refs
  const stageRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragItemRef = useRef<ComponentItem | null>(null);

  // --- Helpers ---
  const connectionPaths = useMemo(
    () => calculateManualPathsWithBridges(connections, droppedItems),
    [connections, droppedItems],
  );

  const handleCancelDrawing = () => {
    if (isDrawingConnection) {
      setIsDrawingConnection(false);
      setTempConnection(null);
    }
  };

  const snapToGridPosition = (x: number, y: number) => {
    if (!snapToGrid) return { x, y };
    const effectiveGridSize = gridSize;

    return {
      x: Math.round(x / effectiveGridSize) * effectiveGridSize,
      y: Math.round(y / effectiveGridSize) * effectiveGridSize,
    };
  };

  // --- Shortcuts ---
  const shortcuts: Shortcut[] = useMemo(
    () => [
      {
        key: "z",
        label: "Undo",
        display: "Ctrl + Z",
        requireCtrl: true,
        handler: () => projectId && editorStore.undo(projectId),
      },
      {
        key: "g",
        label: "Toggle Grid",
        display: "Ctrl+G",
        requireCtrl: true,
        handler: handleToggleGrid,
      },
      {
        key: "h",
        label: "Toggle Snap to Grid",
        display: "Ctrl+h",
        requireCtrl: true,
        handler: () => setSnapToGrid((prev) => !prev),
      },
      {
        key: "y",
        label: "Redo",
        display: "Ctrl + Y",
        requireCtrl: true,
        handler: () => projectId && editorStore.redo(projectId),
      },
      {
        key: "c",
        label: "Center to Content",
        display: "Ctrl + C",
        requireCtrl: true,
        handler: handleCenterToContent,
      },
      {
        key: "d",
        label: "Delete Selection",
        display: "d",
        requireCtrl: false,
        handler: () => {
          if (!projectId) return;

          if (selectedConnectionIds.size > 0) {
            editorStore.batchRemoveConnections(
              projectId,
              Array.from(selectedConnectionIds),
            );
            setSelectedConnectionIds(new Set());
          }

          if (selectedItemIds.size > 0) {
            editorStore.batchDeleteItems(
              projectId,
              Array.from(selectedItemIds),
            );
            setSelectedItemIds(new Set());
          }
        },
      },
      {
        key: "escape",
        label: "Cancel Drawing",
        display: "Esc",
        requireCtrl: false,
        handler: handleCancelDrawing,
      },
    ],
    [
      projectId,
      editorStore,
      selectedItemIds,
      selectedConnectionIds,
      snapToGrid,
    ],
  );

  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();

      for (const shortcut of shortcuts) {
        const matchesKey =
          key === shortcut.key ||
          (shortcut.key === "delete" &&
            (key === "delete" || key === "backspace"));

        if (matchesKey && (!shortcut.requireCtrl || isCtrlOrCmd(e))) {
          e.preventDefault();
          shortcut.handler();

          return;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [shortcuts]);

  // --- Handlers ---
  const handleDragStart = (e: React.DragEvent, item: ComponentItem) => {
    dragItemRef.current = item;

    if (item.svg) {
      const img = new Image();

      img.src = item.svg;
      const canvas = document.createElement("canvas");

      canvas.width = 80;
      canvas.height = 80;
      const ctx = canvas.getContext("2d");

      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, 80, 80);
        img.onload = () => {
          ctx.drawImage(img, 0, 0, 80, 80);
          try {
            e.dataTransfer.setDragImage(canvas, 40, 40);
          } catch {
            // ignore in unsupported environments
          }
        };
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const stage = stageRef.current;

    if (dragItemRef.current && stage && projectId) {
      try {
        stage.setPointersPositions(e.nativeEvent);
      } catch {
        // fallback
      }

      const pointer = stage.getRelativePointerPosition?.();

      if (pointer) {
        const droppedItem = dragItemRef.current;
        const img = new Image();

        img.src = droppedItem.svg || droppedItem.icon || "";

        const finalizeAdd = (width: number, height: number) => {
          let x = pointer.x - width / 2;
          let y = pointer.y - height / 2;

          if (snapToGrid) {
            const snapped = snapToGridPosition(x, y);

            x = snapped.x;
            y = snapped.y;
          }

          const newItem = editorStore.addItem(projectId, droppedItem, {
            x,
            y,
            width,
            height,
            rotation: 0,
          });

          if (newItem) {
            setSelectedItemIds(new Set([newItem.id]));
          }
        };

        img.onload = () => {
          const aspectRatio = img.width / img.height;
          const baseSize = 80;
          let width = baseSize;
          let height = baseSize;

          if (aspectRatio > 1) {
            height = baseSize / aspectRatio;
          } else {
            width = baseSize * aspectRatio;
          }

          finalizeAdd(width, height);
        };

        img.onerror = () => {
          finalizeAdd(80, 80);
        };
      }
      dragItemRef.current = null;
    }
  };

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;

    if (!stage) return;

    if (e.evt.ctrlKey) {
      const scaleBy = 1.05;
      const oldScale = stage.scaleX();
      const pointer = stage.getPointerPosition();

      if (!pointer) return;

      const mousePointTo = {
        x: (pointer.x - stage.x()) / oldScale,
        y: (pointer.y - stage.y()) / oldScale,
      };

      const newScale =
        e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;

      setStageScale(newScale);
      setStagePos({
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
      });
    } else {
      setStagePos((prev: { x: number; y: number }) => ({
        x: prev.x - e.evt.deltaX,
        y: prev.y - e.evt.deltaY,
      }));
    }
  };

  const handleDeleteItem = (itemId: number) => {
    if (!projectId) return;

    editorStore.deleteItem(projectId, itemId);
    setSelectedItemIds((prev: Set<number>) => {
      const next = new Set(prev);

      next.delete(itemId);

      return next;
    });
  };

  const handleUpdateItem = (itemId: number, updates: Partial<CanvasItem>) => {
    if (!projectId) return;

    let snappedUpdates: Partial<CanvasItem> = { ...updates };

    if (snapToGrid && (updates.x !== undefined || updates.y !== undefined)) {
      const currentItem = droppedItems.find((i) => i.id === itemId);

      if (currentItem) {
        const x = updates.x ?? currentItem.x;
        const y = updates.y ?? currentItem.y;
        const snapped = snapToGridPosition(x, y);

        if (updates.x !== undefined) snappedUpdates.x = snapped.x;
        if (updates.y !== undefined) snappedUpdates.y = snapped.y;
      }
    }

    // Multi-drag support
    if (
      selectedItemIds.has(itemId) &&
      (snappedUpdates.x !== undefined || snappedUpdates.y !== undefined)
    ) {
      const currentItem = droppedItems.find((i) => i.id === itemId);

      if (currentItem) {
        const deltaX = (snappedUpdates.x ?? currentItem.x) - currentItem.x;
        const deltaY = (snappedUpdates.y ?? currentItem.y) - currentItem.y;

        if (deltaX !== 0 || deltaY !== 0) {
          const batchUpdates = droppedItems
            .filter((item) => selectedItemIds.has(item.id))
            .map((item) => ({
              id: item.id,
              patch: {
                x: snapToGrid
                  ? snapToGridPosition(item.x + deltaX, item.y + deltaY).x
                  : item.x + deltaX,
                y: snapToGrid
                  ? snapToGridPosition(item.x + deltaX, item.y + deltaY).y
                  : item.y + deltaY,
              },
            }));

          editorStore.batchUpdateItems(projectId, batchUpdates);

          return;
        }
      }
    }

    // Single item update
    editorStore.updateItem(projectId, itemId, snappedUpdates);
  };

  const handleSelectItem = (
    itemId: number,
    e?: Konva.KonvaEventObject<MouseEvent>,
  ) => {
    const isCtrl = e?.evt.ctrlKey || e?.evt.metaKey;

    setSelectedItemIds((prev) => {
      const next = new Set(isCtrl ? prev : []);

      if (isCtrl && prev.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }

      return next;
    });

    if (!isCtrl) {
      setSelectedConnectionIds(new Set());
    }
  };

  const handleClearSelection = () => {
    setSelectedItemIds(new Set());
    setSelectedConnectionIds(new Set());
  };

  // Connection Handlers
  const handleGripMouseDown = (
    itemId: number,
    gripIndex: number,
    x: number,
    y: number,
  ) => {
    if (!projectId) return;

    if (
      isDrawingConnection &&
      tempConnection &&
      (tempConnection.sourceItemId !== itemId ||
        tempConnection.sourceGripIndex !== gripIndex)
    ) {
      const newConnection = editorStore.addConnection(projectId, {
        sourceItemId: tempConnection.sourceItemId,
        sourceGripIndex: tempConnection.sourceGripIndex,
        targetItemId: itemId,
        targetGripIndex: gripIndex,
        waypoints: tempConnection.waypoints,
      });

      setIsDrawingConnection(false);
      setTempConnection(null);
      setSelectedConnectionIds(new Set([newConnection.id]));

      return;
    }

    setIsDrawingConnection(true);
    setTempConnection({
      sourceItemId: itemId,
      sourceGripIndex: gripIndex,
      startX: x,
      startY: y,
      waypoints: [],
      currentX: x,
      currentY: y,
    });
  };

  const handleGripMouseEnter = (itemId: number, gripIndex: number) => {
    setHoveredGrip({ itemId, gripIndex });
  };

  const handleGripMouseLeave = () => {
    setHoveredGrip(null);
  };

  const handleStageMouseMove = () => {
    if (isDrawingConnection && tempConnection) {
      const stage = stageRef.current;

      if (stage) {
        const pointer = stage.getRelativePointerPosition();

        if (pointer) {
          setTempConnection((prev: any) =>
            prev
              ? {
                ...prev,
                currentX: pointer.x,
                currentY: pointer.y,
              }
              : null,
          );
        }
      }
    }
  };

  const handleStageMouseUp = () => {
    // Manual connection drawing - no auto-cancel
  };

  // Handle stage resize
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect;

      setStageSize({
        width: rect.width,
        height: rect.height,
      });
    });

    resizeObserver.observe(containerRef.current);

    return () => resizeObserver.disconnect();
  }, []);

  // Undo/Redo handlers
  const handleUndo = () => {
    if (projectId && canUndo) {
      editorStore.undo(projectId);
    }
  };

  const handleRedo = () => {
    if (projectId && canRedo) {
      editorStore.redo(projectId);
    }
  };

  // Grid Layer Component
  const GridLayer = React.memo(
    ({
      width,
      height,
      gridSize,
      showGrid,
    }: {
      width: number;
      height: number;
      gridSize: number;
      showGrid: boolean;
    }) => {
      if (!showGrid) return null;

      return (
        <Layer listening={false}>
          <Shape
            opacity={0.3}
            perfectDrawEnabled={false}
            sceneFunc={(
              context: any,
              shape: Konva.Shape,
            ) => {
              context.beginPath();

              const startX = -5000;
              const endX = width + 5000;
              const startY = -5000;
              const endY = height + 5000;

              // Vertical Lines
              for (let x = startX; x <= endX; x += gridSize) {
                context.moveTo(x, startY);
                context.lineTo(x, endY);
              }

              // Horizontal Lines
              for (let y = startY; y <= endY; y += gridSize) {
                context.moveTo(startX, y);
                context.lineTo(endX, y);
              }

              context.fillStrokeShape(shape);
            }}
            stroke="#9ca3af"
            strokeWidth={1}
          />
        </Layer>
      );
    },
  );

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header Bar */}
      <div className="h-14 shrink-0 border-b flex items-center px-4 justify-between bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 z-10">
        <div className="flex items-center gap-2">
          <Tooltip content="Back to Dashboard">
            <Button
              isIconOnly
              className="text-gray-700 dark:text-gray-300"
              variant="light"
              onPress={() => {
                if (hasUnsavedChanges) {
                  setUnsavedContext('navigation');
                  setShowUnsavedModal(true);
                } else {
                  navigate("/dashboard");
                }
              }}
            >
              ←
            </Button>
          </Tooltip>
          <div className="h-6 w-px bg-gray-300 dark:bg-gray-700 mx-2" />

          <Dropdown>
            <DropdownTrigger>
              <Button
                className="text-gray-700 dark:text-gray-300"
                size="sm"
                variant="light"
              >
                Edit
              </Button>
            </DropdownTrigger>
            <DropdownMenu
              aria-label="Edit Actions"
              disabledKeys={
                [!canUndo && "undo", !canRedo && "redo"].filter(
                  Boolean,
                ) as string[]
              }
            >
              <DropdownItem key="undo" onPress={handleUndo}>
                Undo (Ctrl+Z)
              </DropdownItem>
              <DropdownItem key="redo" onPress={handleRedo}>
                Redo (Ctrl+Y)
              </DropdownItem>
              <DropdownItem
                key="delete"
                onPress={() => {
                  if (
                    selectedItemIds.size > 0 ||
                    selectedConnectionIds.size > 0
                  ) {
                    if (projectId && selectedItemIds.size > 0)
                      editorStore.batchDeleteItems(
                        projectId,
                        Array.from(selectedItemIds),
                      );
                    if (projectId && selectedConnectionIds.size > 0)
                      editorStore.batchRemoveConnections(
                        projectId,
                        Array.from(selectedConnectionIds),
                      );
                    setSelectedItemIds(new Set());
                    setSelectedConnectionIds(new Set());
                  }
                }}
              >
                Delete Selected (d)
              </DropdownItem>
              <DropdownItem key="clear" onPress={handleClearSelection}>
                Clear Selection
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>

          <Dropdown>
            <DropdownTrigger>
              <Button
                className="text-gray-700 dark:text-gray-300"
                size="sm"
                variant="light"
              >
                View
              </Button>
            </DropdownTrigger>
            <DropdownMenu aria-label="View Actions">
              <DropdownItem key="zoom-in" onPress={handleZoomIn}>
                Zoom In (+)
              </DropdownItem>
              <DropdownItem key="zoom-out" onPress={handleZoomOut}>
                Zoom Out (-)
              </DropdownItem>
              <DropdownItem key="fit" onPress={handleCenterToContent}>
                Fit to Screen
              </DropdownItem>
              <DropdownItem key="grid" onPress={handleToggleGrid}>
                {showGrid ? "Hide Grid" : "Show Grid"}
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </div>

        <div className="font-semibold text-gray-800 dark:text-gray-200">
          Diagram Editor{" "}
          <span className="text-xs ml-2 text-gray-600 dark:text-gray-400">
            ID: {projectId}
          </span>
        </div>

        <div className="flex gap-2">
          <ThemeSwitch />
          <Button
            className="border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300"
            size="sm"
            variant="bordered"
            onPress={handleNewProjectClick}
          >
            New Project
          </Button>
          <Button
            className="border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300"
            size="sm"
            startContent={<TbFileImport />}
            variant="bordered"
            onPress={() => {
              // Create a hidden file input
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = '.pfd';
              input.onchange = (e) => handleImportDiagram(e as any);
              input.click();
            }}
            isLoading={isImporting}
          >
            Import
          </Button>
          <Button
            className="border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300"
            size="sm"
            startContent={<FiDownload />}
            variant="bordered"
            onPress={() => setShowExportModal(true)}
          >
            Export
          </Button>
          <Button
            className="border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300"
            size="sm"
            startContent={<FiDownload />}
            variant="bordered"
            onPress={() => setShowReportModal(true)}
          >
            Generate Report
          </Button>

          <Button
            className="bg-blue-600 text-white hover:bg-blue-700"
            size="sm"
            onPress={() => setShowSaveModal(true)}
            isDisabled={!projectId}
          >
            Save Changes
          </Button>
        </div>
      </div>

      {/* Main workspace */}
      <div
        className="flex-1 grid overflow-hidden transition-all duration-300"
        style={{
          gridTemplateColumns: `
            ${leftCollapsed ? "48px" : "256px"}
            minmax(0, 1fr)
            ${rightCollapsed ? "48px" : "288px"}
          `,
        }}
      >
        {/* Left Sidebar - Component Library */}
        <div className="relative overflow-hidden border-r border-gray-200 dark:border-gray-800">
          {/* Collapse Button */}
          <button
            className="absolute top-2 right-2 z-10 w-7 h-7 flex items-center justify-center
            rounded-md bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700
            hover:bg-gray-100 dark:hover:bg-gray-700"
            title={leftCollapsed ? "Expand" : "Collapse"}
            onClick={() => setLeftCollapsed((v) => !v)}
          >
            {!leftCollapsed ? (
              <TbLayoutSidebarLeftCollapse />
            ) : (
              <TbLayoutSidebarLeftExpand />
            )}
          </button>

          {!leftCollapsed && (
            <ComponentLibrarySidebar
              components={components}
              initialSearchQuery={searchQuery}
              onDragStart={handleDragStart}
              onSearch={setSearchQuery}
            />
          )}
        </div>

        {/* Canvas Area - Konva */}
        {/* Canvas Area - Konva */}
        <div
          ref={containerRef}
          className="relative min-w-0 overflow-hidden bg-white"
          onDragOver={(e) => {
            e.preventDefault(); // Allow drop
            // Also handle file drags
            if (e.dataTransfer.types.includes('Files')) {
              e.dataTransfer.dropEffect = 'copy';
            }
          }}
          onDragLeave={(e) => {
            e.preventDefault();
          }}
          onDrop={(e) => {
            e.preventDefault();

            // First check if it's a file drop (for .export files)
            if (e.dataTransfer.files.length > 0) {
              const file = e.dataTransfer.files[0];
              if (file.name.endsWith('.export')) {
                // Create a synthetic event for handleImportDiagram
                const syntheticEvent = {
                  target: {
                    files: [file]
                  }
                } as unknown as React.ChangeEvent<HTMLInputElement>;
                handleImportDiagram(syntheticEvent);
                return;
              }
            }

            // Otherwise, it's a component drag from the sidebar
            handleDrop(e);
          }}
        >
          <FileDropZone />
          <Stage
            ref={stageRef}
            draggable
            className="flex relative"
            height={stageSize.height}
            scaleX={stageScale}
            scaleY={stageScale}
            width={stageSize.width}
            x={stagePos.x}
            y={stagePos.y}
            onDragEnd={(e) => {
              if (e.target === stageRef.current) {
                setStagePos({ x: e.target.x(), y: e.target.y() });
              }
            }}
            onMouseDown={(e) => {
              const clickedOnEmpty = e.target === e.target.getStage();

              if (clickedOnEmpty && isDrawingConnection && tempConnection) {
                const stage = stageRef.current;

                if (stage) {
                  const pointer = stage.getRelativePointerPosition();

                  if (pointer) {
                    setTempConnection((prev: any) =>
                      prev
                        ? {
                          ...prev,
                          waypoints: [
                            ...prev.waypoints,
                            { x: pointer.x, y: pointer.y },
                          ],
                        }
                        : prev,
                    );
                  }
                }

                return;
              }

              if (clickedOnEmpty) {
                handleClearSelection();
              }
            }}
            onMouseMove={() => {
              const stage = stageRef.current;

              if (stage) {
                const pointer = stage.getRelativePointerPosition();

                if (pointer)
                  setCursorPos({
                    x: Math.round(pointer.x),
                    y: Math.round(pointer.y),
                  });
              }
              handleStageMouseMove();
            }}
            onMouseUp={handleStageMouseUp}
            onWheel={handleWheel}
          >
            <GridLayer
              gridSize={gridSize}
              height={stageSize.height}
              showGrid={showGrid}
              width={stageSize.width}
            />
            <Layer>
              {/* Render Connections */}
              {connections.map((connection: Connection) => (
                <ConnectionLine
                  key={connection.id}
                  arrowAngle={connectionPaths[connection.id]?.arrowAngle}
                  connection={connection}
                  isSelected={selectedConnectionIds.has(connection.id)}
                  items={droppedItems}
                  pathData={connectionPaths[connection.id]?.pathData}
                  points={[]}
                  targetPosition={connectionPaths[connection.id]?.endPoint}
                  onSelect={(e: Konva.KonvaEventObject<MouseEvent>) => {
                    const isCtrl = e?.evt.ctrlKey || e?.evt.metaKey;

                    setSelectedConnectionIds((prev: Set<number>) => {
                      const next = new Set(isCtrl ? prev : []);

                      if (isCtrl && prev.has(connection.id)) {
                        next.delete(connection.id);
                      } else {
                        next.add(connection.id);
                      }

                      return next;
                    });
                    if (!isCtrl) setSelectedItemIds(new Set());
                  }}
                />
              ))}

              {/* Render Temporary Connection Line (Drawing) */}
              {tempConnection && (
                <Line
                  dash={[10, 5]}
                  listening={false}
                  points={[
                    tempConnection.startX,
                    tempConnection.startY,
                    ...tempConnection.waypoints.flatMap((p) => [p.x, p.y]),
                    tempConnection.currentX,
                    tempConnection.currentY,
                  ]}
                  stroke="#9ca3af"
                  strokeWidth={2}
                />
              )}

              {/* Render Components */}
              {droppedItems.map((item: CanvasItem) => (
                <CanvasItemImage
                  key={item.id}
                  hoveredGrip={hoveredGrip}
                  isDrawingConnection={isDrawingConnection}
                  isSelected={selectedItemIds.has(item.id)}
                  item={item}
                  onChange={(newAttrs) =>
                    handleUpdateItem(newAttrs.id, newAttrs)
                  }
                  onGripMouseDown={handleGripMouseDown}
                  onGripMouseEnter={handleGripMouseEnter}
                  onGripMouseLeave={handleGripMouseLeave}
                  onSelect={(e) => handleSelectItem(item.id, e)}
                />
              ))}
            </Layer>
          </Stage>

          {/* Floating Info Bubble */}
          <div className="absolute bottom-6 right-[38%] flex flex-col items-end gap-2 pointer-events-none">
            <div className="flex items-center gap-3 px-4 py-2 bg-white/90 dark:bg-[#1f2938] backdrop-blur shadow-lg border border-gray-200 rounded-full text-xs font-mono text-gray-600 pointer-events-auto">
              {/* XY Coordinates */}
              <div className="flex gap-2 dark:text-gray-200">
                <span className="font-bold text-gray-400">X</span> {cursorPos.x}
              </div>
              <div className="w-px h-3 bg-gray-400" />
              <div className="flex gap-2 dark:text-gray-200">
                <span className="font-bold text-gray-400">Y</span> {cursorPos.y}
              </div>

              <div className="w-px h-3 bg-gray-300" />

              <div className="flex items-center gap-3">
                {/* Show Grid Button */}
                <Tooltip
                  content={showGrid ? "Hide Grid" : "Show Grid"}
                  placement="top"
                >
                  <button
                    aria-label="Toggle Grid Visibility"
                    className={`w-8 h-8 flex items-center justify-center rounded-md 
        border border-gray-300 dark:border-gray-700 
        bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 
        transition-all duration-150`}
                    onClick={() => setShowGrid((prev) => !prev)}
                  >
                    {showGrid ? (
                      <TbGridDots className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                    ) : (
                      <TbGridPattern className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                    )}
                  </button>
                </Tooltip>

                {/* Snap to Grid Switch */}
                <Tooltip
                  content={snapToGrid ? "Snap Enabled" : "Snap Disabled"}
                  placement="top"
                >
                  <Switch
                    aria-label="Snap to Grid"
                    color="primary"
                    isSelected={snapToGrid}
                    size="sm"
                    thumbIcon={({ isSelected, className }) =>
                      isSelected ? (
                        <TbGridDots className={className} />
                      ) : (
                        <TbGridPattern className={className} />
                      )
                    }
                    onValueChange={setSnapToGrid}
                  />
                </Tooltip>
              </div>

              <div className="w-px h-3 bg-gray-300" />

              {/* Zoom Controls */}
              <div className="flex items-center gap-2">
                {/* Zoom Out Button */}
                <button
                  className="w-8 h-8 flex items-center justify-center rounded-full
                bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700
                border border-gray-300 dark:border-gray-600
                shadow-sm hover:shadow
                disabled:opacity-40 disabled:cursor-not-allowed
                transition-all duration-200"
                  disabled={stageScale <= 0.1}
                  title="Zoom Out"
                  onClick={handleZoomOut}
                >
                  <MdZoomOut className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                </button>

                {/* Zoom Percentage Display */}
                <div className="flex items-center">
                  <div
                    className="px-3 py-1.5 text-sm font-medium
                bg-gray-50 dark:bg-gray-800 
                rounded-l-md
                text-gray-700 dark:text-gray-300"
                  >
                    {Math.round(stageScale * 100)}%
                  </div>
                </div>

                {/* Center Content Button */}
                <button
                  className="w-8 h-8 flex items-center justify-center rounded-full
                bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700
                border border-gray-300 dark:border-gray-600
                shadow-sm hover:shadow
                disabled:opacity-40 disabled:cursor-not-allowed
                transition-all duration-200"
                  disabled={droppedItems.length === 0}
                  title="Center to Content"
                  onClick={handleCenterToContent}
                >
                  <MdCenterFocusWeak className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                </button>

                {/* Zoom In Button */}
                <button
                  className="w-8 h-8 flex items-center justify-center rounded-full
                bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700
                border border-gray-300 dark:border-gray-600
                shadow-sm hover:shadow
                disabled:opacity-40 disabled:cursor-not-allowed
                transition-all duration-200"
                  disabled={stageScale >= 3}
                  title="Zoom In"
                  onClick={handleZoomIn}
                >
                  <MdZoomIn className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                </button>
              </div>
            </div>
          </div>
          {/* Canvas Shortcuts Help */}
          <div className="absolute bottom-6 right-6 z-20">
            <Popover showArrow offset={8} placement="top-end">
              <PopoverTrigger>
                <Button
                  isIconOnly
                  className="rounded-ful bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  size="sm"
                  variant="bordered"
                >
                  ?
                </Button>
              </PopoverTrigger>

              <PopoverContent className="w-64">
                <div className="p-3 space-y-2">
                  <div className="text-sm font-semibold text-foreground">
                    Keyboard Shortcuts
                  </div>

                  <div className="space-y-1">
                    {shortcuts.map((s) => (
                      <div
                        key={s.label}
                        className="flex justify-between items-center text-xs"
                      >
                        <span className="text-foreground/70">{s.label}</span>
                        <span className="font-mono bg-content2 px-2 py-0.5 rounded">
                          {s.display}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 text-[10px] text-foreground/50">
                    Ctrl (Windows/Linux) or Cmd (Mac)
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Connection Guidance Overlay */}
          {isDrawingConnection && (
            <div className="absolute top-6 left-1/2 -translate-x-1/2 pointer-events-none">
              <div className="px-4 py-2 bg-black/70 backdrop-blur text-white text-sm rounded-full shadow-lg border border-white/10 flex items-center gap-3">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                  Drawing Connection
                </span>
                <div className="w-px h-3 bg-white/20" />
                <span className="text-white/80 text-xs">
                  Click empty space to add corner • Click target point to finish
                  • Press Esc to cancel
                </span>
              </div>
            </div>
          )}

          {/* Selection Guidance Overlay */}
          {!isDrawingConnection &&
            (selectedItemIds.size > 0 || selectedConnectionIds.size > 0) && (
              <div className="absolute top-6 left-1/2 -translate-x-1/2 pointer-events-none">
                <div className="px-4 py-2 bg-black/70 backdrop-blur text-white text-sm rounded-full shadow-lg border border-white/10 flex items-center gap-3">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                    {selectedItemIds.size + selectedConnectionIds.size} Selected
                  </span>
                  <div className="w-px h-3 bg-white/20" />
                  <span className="text-white/80 text-xs">
                    Press 'd' to delete selection • Ctrl+Click to add more
                  </span>
                </div>
              </div>
            )}

          {/* Empty State Overlay */}
          {droppedItems.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center p-6 bg-white/20 backdrop-blur rounded-xl border border-gray-200 shadow-sm">
                <div className="text-black font-medium">Canvas Empty</div>
                <div className="text-sm text-gray-400 mt-1">
                  Drag components from the sidebar <br></br>
                  <span className="font-bold">or</span> drag and drop a .pfd file
                  started.
                </div>
              </div>
            </div>
          )}
        </div>
        {/* Right Sidebar - Canvas Properties/Items List */}
        <div className="relative overflow-hidden border-l border-gray-200 dark:border-gray-800 hidden lg:block">
          {/* Collapse Button */}
          <button
            className="absolute top-2 left-2 z-10 w-7 h-7 flex items-center justify-center
      rounded-md bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700
      hover:bg-gray-100 dark:hover:bg-gray-700"
            title={rightCollapsed ? "Expand" : "Collapse"}
            onClick={() => setRightCollapsed((v: boolean) => !v)}
          >
            {!rightCollapsed ? (
              <TbLayoutSidebarRightCollapse />
            ) : (
              <TbLayoutSidebarRightExpand />
            )}
          </button>

          {!rightCollapsed && (
            <CanvasPropertiesSidebar
              showAllItemsByDefault
              items={droppedItems}
              selectedItemId={
                selectedItemIds.size === 1
                  ? Array.from(selectedItemIds)[0]
                  : null
              }
              onDeleteItem={handleDeleteItem}
              onSelectItem={(id: number) => setSelectedItemIds(new Set([id]))}
              onUpdateItem={handleUpdateItem}
            />
          )}
        </div>
        <ExportModal
          isExporting={isExporting}
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          onExport={handleExport}
        />


        <ExportReportModal
          editorId={projectId ?? ""}
          open={showReportModal}
          onClose={() => setShowReportModal(false)}
        />

        {/* Save Confirmation Modal */}
        <SaveConfirmationModal
          isOpen={showSaveModal}
          onClose={() => setShowSaveModal(false)}
          onConfirm={handleSaveChanges}
          projectName={projectMetadata?.name || 'Untitled Project'}
          itemCount={droppedItems.length}
          connectionCount={connections.length}
        />
        {/* Unsaved Changes Modal */}
        <UnsavedChangesModal
          isOpen={showUnsavedModal}
          onClose={() => {
            setShowUnsavedModal(false);
          }}
          context={unsavedContext}
          onSaveAndProceed={
            unsavedContext === 'navigation'
              ? handleSaveAndNavigate
              : handleSaveAndCreateNew
          }
          onDiscardAndProceed={
            unsavedContext === 'navigation'
              ? handleDiscardAndNavigate
              : handleDiscardAndCreateNew
          }
          projectName={projectMetadata?.name || 'Untitled Project'}
        />

        {/* New Project Modal */}
        <NewProjectModal
          isOpen={showNewProjectModal}
          onClose={() => setShowNewProjectModal(false)}
          onCreate={handleCreateNewProject}
        />
      </div>
    </div>
  );
}
