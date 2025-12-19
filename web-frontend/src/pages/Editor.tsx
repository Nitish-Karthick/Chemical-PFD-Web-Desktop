import { useEffect, useState, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Stage, Layer, Line } from "react-konva";
import Konva from "konva";
import { Button, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Tooltip } from "@heroui/react";
import { ThemeSwitch } from "@/components/theme-switch";
import { CanvasItemImage } from "@/components/Canvas/CanvasItemImage";
import { ConnectionLine } from "@/components/Canvas/ConnectionLine";
import { ComponentLibrarySidebar, CanvasPropertiesSidebar } from "@/components/Canvas/ComponentLibrarySidebar";
import { calculateManualPathsWithBridges } from "@/utils/routing";
import { useHistory } from "@/hooks/useHistory";
import { TbLayoutSidebarRightExpand, TbLayoutSidebarRightCollapse, TbLayoutSidebarLeftCollapse, TbLayoutSidebarLeftExpand } from "react-icons/tb";
import { MdZoomIn, MdZoomOut, MdCenterFocusWeak } from "react-icons/md";
import ExportModal from '@/components/Canvas/ExportModal';
import { useExport } from '@/hooks/useExport';
import { ExportOptions } from '@/components/Canvas/types';
import { FiDownload } from 'react-icons/fi';
import { useComponents } from "@/context/ComponentContext";
import { useEditorStore, type ComponentItem, type CanvasItem, type Connection, type CanvasState } from "@/store/useEditorStore";

 
export default function Editor() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);


  // Export diagram states
  const editorStore = useEditorStore();
  useEffect(() => {
    if (projectId) {
      // Load saved state from localStorage or API (optional)
      const savedState = localStorage.getItem(`editor-${projectId}`);
      if (savedState) {
        try {
          const parsedState = JSON.parse(savedState);
          editorStore.hydrateEditor(projectId, parsedState);
        } catch (e) {
          console.error("Failed to load saved state:", e);
          editorStore.initEditor(projectId);
        }
      } else {
        editorStore.initEditor(projectId);
      }
    }
    
    // Cleanup on unmount
    return () => {
      if (projectId) {
        // Optionally save state before removing
        // const state = editorStore.getEditorState(projectId);
        // localStorage.setItem(`editor-${projectId}`, JSON.stringify(state));
        // editorStore.removeEditor(projectId);
      }
    };
  }, [projectId]);

  const currentState = projectId ? editorStore.getEditorState(projectId) : null;
  const droppedItems = currentState?.items || [];
  const connections = currentState?.connections || [];
  
  const [showExportModal, setShowExportModal] = useState(false);
  const { exportDiagram, isExporting, exportError } = useExport();
  const handleExport = async (options: ExportOptions) => {
    await exportDiagram(stageRef.current, options, droppedItems);
    setShowExportModal(false);

    if (!exportError) {
      alert('Export successful!');
    }
  };


  // --- State ---
  const { components } = useComponents();
  const handleZoomIn = () => {
    setStageScale(prev => Math.min(3, prev + 0.1)); // Max 300%, increment 10%
  };

  const handleZoomOut = () => {
    setStageScale(prev => Math.max(0.1, prev - 0.1)); // Min 10%, decrement 10%
  };
  const handleCenterToContent = () => {
    if (droppedItems.length === 0) {
      // If no items, reset view
      setStagePos({ x: 0, y: 0 });
      setStageScale(1);
      return;
    }

    // Calculate bounding box of all items
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    droppedItems.forEach(item => {
      minX = Math.min(minX, item.x);
      minY = Math.min(minY, item.y);
      maxX = Math.max(maxX, item.x + item.width);
      maxY = Math.max(maxY, item.y + item.height);
    });

    // Add some padding
    const padding = 100;
    const contentWidth = maxX - minX + padding * 2;
    const contentHeight = maxY - minY + padding * 2;

    if (stageRef.current && containerRef.current) {
      const containerWidth = stageSize.width;
      const containerHeight = stageSize.height;

      // Calculate scale to fit content
      const scaleX = containerWidth / contentWidth;
      const scaleY = containerHeight / contentHeight;
      const scale = Math.min(scaleX, scaleY, 1); // Don't zoom in beyond 100%

      // Calculate center position
      const centerX = minX - padding + contentWidth / 2;
      const centerY = minY - padding + contentHeight / 2;

      const targetX = (containerWidth / 2) - (centerX * scale);
      const targetY = (containerHeight / 2) - (centerY * scale);

      // Animate to position
      setStageScale(scale);
      setStagePos({ x: targetX, y: targetY });
    }
  };
  // History management
  const {
    state: canvasState,
    set: setCanvasState,
    undo,
    redo,
    canUndo,
    canRedo
  } = useHistory<CanvasState>({
    items: [],
    connections: [],
    counts: {},
    sequenceCounter: 0
  });

  // Sync store with history
  useEffect(() => {
    if (currentState && projectId) {
      setCanvasState(currentState);
    }
  }, [currentState, projectId]);

  // Use items and connections from history state

  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Connection State
  // const [connections, setConnections] = useState<Connection[]>([]); // Replaced by history state
  const [selectedConnectionId, setSelectedConnectionId] = useState<number | null>(null);
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
  const [hoveredGrip, setHoveredGrip] = useState<{ itemId: number; gripIndex: number } | null>(null);
  // Canvas Viewport State
  const [stageScale, setStageScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });

  // Refs
  const stageRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragItemRef = useRef<ComponentItem | null>(null);

  // --- Initialization ---
  /* 
  // No longer needed - components loaded from Context
  useEffect(() => {
    setComponents(componentsConfig);
  }, []);
  */


  // --- Helpers ---


  // Precompute final polylines with small "bridge" bumps where
  // manually drawn lines cross.
   const connectionPaths = useMemo(
    () => calculateManualPathsWithBridges(connections, droppedItems),
    [connections, droppedItems]
  );

  // --- Event Listeners ---

  // Handle keyboard events (Delete key)
    useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        handleCenterToContent();
      }

      if (e.key === 'Delete' || e.key === 'Backspace' || e.key.toLowerCase() === 'd') {
        if (selectedConnectionId !== null && projectId) {
          editorStore.removeConnection(projectId, selectedConnectionId);
          setSelectedConnectionId(null);
        } else if (selectedItemId !== null && projectId) {
          editorStore.deleteItem(projectId, selectedItemId);
          setSelectedItemId(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedConnectionId, selectedItemId, undo, redo, projectId, editorStore]);

  // --- Handlers ---
  const handleDragStart = (e: React.DragEvent, item: ComponentItem) => {
    dragItemRef.current = item;

    // Set drag image (ghost)
    if (item.svg) {
      const img = new Image();
      img.src = item.svg;
      const canvas = document.createElement('canvas');
      canvas.width = 80;
      canvas.height = 80;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 80, 80);
        img.onload = () => {
          ctx.drawImage(img, 0, 0, 80, 80);
          e.dataTransfer.setDragImage(canvas, 40, 40);
        };
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const stage = stageRef.current;

    if (dragItemRef.current && stage && projectId) {
      stage.setPointersPositions(e.nativeEvent);
      const pointer = stage.getRelativePointerPosition();

      if (pointer) {
        const droppedItem = dragItemRef.current;

        const img = new Image();
        img.src = droppedItem.svg || droppedItem.icon || '';

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

          const newItem = editorStore.addItem(projectId, droppedItem, {
            x: pointer.x - width / 2,
            y: pointer.y - height / 2,
            width,
            height,
            rotation: 0
          });

          setSelectedItemId(newItem.id);
        };

        img.onerror = () => {
          const newItem = editorStore.addItem(projectId, droppedItem, {
            x: pointer.x - 40,
            y: pointer.y - 40,
            width: 80,
            height: 80,
            rotation: 0
          });

          setSelectedItemId(newItem.id);
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
      // Zoom logic
      const scaleBy = 1.05;
      const oldScale = stage.scaleX();
      const pointer = stage.getPointerPosition();

      if (!pointer) return;

      const mousePointTo = {
        x: (pointer.x - stage.x()) / oldScale,
        y: (pointer.y - stage.y()) / oldScale,
      };

      const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;

      setStageScale(newScale);
      setStagePos({
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
      });
    } else {
      // Pan logic
      setStagePos(prev => ({
        x: prev.x - e.evt.deltaX,
        y: prev.y - e.evt.deltaY
      }));
    }
  };

  const handleDeleteItem = (itemId: number) => {
    if (projectId) {
      editorStore.deleteItem(projectId, itemId);
      if (selectedItemId === itemId) {
        setSelectedItemId(null);
      }
    }
  };

  const handleUpdateItem = (itemId: number, updates: Partial<CanvasItem>) => {
    if (projectId) {
      // Transform Canvas types to store types if needed
      const storeUpdates: Partial<CanvasItem> = {};
      Object.entries(updates).forEach(([key, value]) => {
        (storeUpdates as any)[key] = value;
      });
      editorStore.updateItem(projectId, itemId, storeUpdates);
    }
  };

  const handleSelectItem = (itemId: number) => {
    setSelectedItemId(itemId);
  };

  const handleClearSelection = () => {
    setSelectedItemId(null);
  };

  // --- Connection Handlers ---

    const handleGripMouseDown = (itemId: number, gripIndex: number, x: number, y: number) => {
    if (!projectId) return;

    if (
      isDrawingConnection &&
      tempConnection &&
      (tempConnection.sourceItemId !== itemId || tempConnection.sourceGripIndex !== gripIndex)
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
      setSelectedConnectionId(newConnection.id);
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
          setTempConnection(prev => prev ? {
            ...prev,
            currentX: pointer.x,
            currentY: pointer.y,
          } : null);
        }
      }
    }
  };

  const handleStageMouseUp = () => {
    // In manual mode we don't auto-cancel on mouse up; user either clicks
    // empty canvas to add waypoints or a grip to finish the connection.
  };
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver(entries => {
      const rect = entries[0].contentRect;
      setStageSize({
        width: rect.width,
        height: rect.height,
      });
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);


  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header Bar */}
      <div className="h-14 shrink-0 border-b flex items-center px-4 justify-between bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 z-10">
        <div className="flex items-center gap-2">
          <Tooltip content="Back to Dashboard">
            <Button
              isIconOnly
              variant="light"
              onPress={() => navigate("/dashboard")}
              className="text-gray-700 dark:text-gray-300"
            >←</Button>
          </Tooltip>
          <div className="h-6 w-px bg-gray-300 dark:bg-gray-700 mx-2" />
          <Dropdown>
            <DropdownTrigger>
              <Button variant="light" size="sm" className="text-gray-700 dark:text-gray-300">File</Button>
            </DropdownTrigger>
            <DropdownMenu aria-label="File Actions">
              <DropdownItem key="new">New Diagram</DropdownItem>
              <DropdownItem key="save">Save Project (Ctrl+S)</DropdownItem>
              <DropdownItem key="export">Export as PDF</DropdownItem>
            </DropdownMenu>
          </Dropdown>

          <Dropdown>
            <DropdownTrigger>
              <Button variant="light" size="sm" className="text-gray-700 dark:text-gray-300">Edit</Button>
            </DropdownTrigger>
            <DropdownMenu aria-label="Edit Actions" disabledKeys={[!canUndo && 'undo', !canRedo && 'redo'].filter(Boolean) as string[]}>
              <DropdownItem key="undo" onPress={undo}>Undo (Ctrl+Z)</DropdownItem>
              <DropdownItem key="redo" onPress={redo}>Redo (Ctrl+Y)</DropdownItem>
              <DropdownItem key="delete" onPress={() => selectedItemId && handleDeleteItem(selectedItemId)}>
                Delete Selected (Del)
              </DropdownItem>
              <DropdownItem key="clear" onPress={handleClearSelection}>
                Clear Selection
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>

          <Dropdown>
            <DropdownTrigger>
              <Button variant="light" size="sm" className="text-gray-700 dark:text-gray-300">View</Button>
            </DropdownTrigger>
            <DropdownMenu aria-label="View Actions">
              <DropdownItem key="zoom-in">Zoom In (+)</DropdownItem>
              <DropdownItem key="zoom-out">Zoom Out (-)</DropdownItem>
              <DropdownItem key="fit">Fit to Screen</DropdownItem>
              <DropdownItem key="grid">Toggle Grid</DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </div>

        <div className="font-semibold text-gray-800 dark:text-gray-200">
          Diagram Editor <span className="text-xs ml-2 text-gray-600 dark:text-gray-400">ID: {projectId}</span>
        </div>

        <div className="flex gap-2">
          <ThemeSwitch />
          <Button
            size="sm"
            variant="bordered"
            className="border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300"
            onPress={() => setShowExportModal(true)}
            startContent={<FiDownload />}
          >
            Export
          </Button>
          <Button
            size="sm"
            variant="bordered"
            className="border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300"
            onPress={() => setShowExportModal(true)}
            startContent={<FiDownload />}
          >
            Generate Report
          </Button>
          <Button size="sm" className="bg-blue-600 text-white hover:bg-blue-700">Save Changes</Button>
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
            onClick={() => setLeftCollapsed(v => !v)}
            className="absolute top-2 right-2 z-10 w-7 h-7 flex items-center justify-center
            rounded-md bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700
            hover:bg-gray-100 dark:hover:bg-gray-700"
            title={leftCollapsed ? "Expand" : "Collapse"}
          >
            {!leftCollapsed ? <TbLayoutSidebarLeftCollapse />
              : <TbLayoutSidebarLeftExpand />
            }
          </button>

          {!leftCollapsed && (
            <ComponentLibrarySidebar
              components={components}
              onDragStart={handleDragStart}
              onSearch={setSearchQuery}
              initialSearchQuery={searchQuery}
            />
          )}

        </div>



        {/* Canvas Area - Konva */}
        <div
          ref={containerRef}
          className="relative min-w-0 overflow-hidden bg-white"
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          {/* CSS Grid Background */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(#9ca3af 1px, transparent 1px)',
              backgroundSize: `${20 * stageScale}px ${20 * stageScale}px`,
              backgroundPosition: `${stagePos.x}px ${stagePos.y}px`,
              opacity: 0.3
            }}
          />

          <Stage
            width={stageSize.width}
            height={stageSize.height}
            scaleX={stageScale}
            scaleY={stageScale}
            x={stagePos.x}
            y={stagePos.y}
            draggable
            onWheel={handleWheel}
            ref={stageRef}
            className="flex relative"
            onMouseDown={(e) => {
              const clickedOnEmpty = e.target === e.target.getStage();

              // While drawing a connection, clicking on empty canvas creates a waypoint
              if (clickedOnEmpty && isDrawingConnection && tempConnection) {
                const stage = stageRef.current;
                if (stage) {
                  const pointer = stage.getRelativePointerPosition();
                  if (pointer) {
                    setTempConnection(prev =>
                      prev
                        ? {
                          ...prev,
                          waypoints: [...prev.waypoints, { x: pointer.x, y: pointer.y }],
                        }
                        : prev
                    );
                  }
                }
                return;
              }

              // Otherwise, click on empty stage deselects
              if (clickedOnEmpty) {
                handleClearSelection();
                setSelectedConnectionId(null);
              }
            }}
            onMouseMove={() => {
              const stage = stageRef.current;
              if (stage) {
                const pointer = stage.getRelativePointerPosition();
                if (pointer) setCursorPos({ x: Math.round(pointer.x), y: Math.round(pointer.y) });
              }
              handleStageMouseMove();
            }}
            onMouseUp={handleStageMouseUp}
            onDragEnd={(e) => {
              // Update stage position state when panning finishes
              if (e.target === stageRef.current) {
                setStagePos({ x: e.target.x(), y: e.target.y() });
              }
            }}
          >
            <Layer>
              {/* Render Connections */}
              {connections.map((connection) => (
                <ConnectionLine
                  key={connection.id}
                  connection={connection}
                  items={droppedItems}
                  // We now pass pathData instead of points for rendering
                  // points is kept empty [] to satisfy type if needed, or we can just ignore it
                  points={[]}
                  pathData={connectionPaths[connection.id]}
                  isSelected={connection.id === selectedConnectionId}
                  onSelect={() => {
                    setSelectedConnectionId(connection.id);
                    setSelectedItemId(null);
                  }}
                />
              ))}

              {/* Render Temporary Connection Line (Drawing) */}
              {tempConnection && (
                <Line
                  points={[
                    tempConnection.startX,
                    tempConnection.startY,
                    ...tempConnection.waypoints.flatMap((p) => [p.x, p.y]),
                    tempConnection.currentX,
                    tempConnection.currentY,
                  ]}
                  stroke="#9ca3af"
                  strokeWidth={2}
                  dash={[10, 5]}
                  listening={false}
                />
              )}

              {/* Render Components */}
              {droppedItems.map((item) => (
                <CanvasItemImage
                  key={item.id}
                  item={item}
                  isSelected={item.id === selectedItemId}
                  onSelect={() => handleSelectItem(item.id)}
                  onChange={(newAttrs) => handleUpdateItem(newAttrs.id, newAttrs)}
                  onGripMouseDown={handleGripMouseDown}
                  onGripMouseEnter={handleGripMouseEnter}
                  onGripMouseLeave={handleGripMouseLeave}
                  isDrawingConnection={isDrawingConnection}
                  hoveredGrip={hoveredGrip}
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
              <div className="w-px h-3 bg-gray-400"></div>
              <div className="flex gap-2 dark:text-gray-200">
                <span className="font-bold text-gray-400">Y</span> {cursorPos.y}
              </div>


              <div className="w-px h-3 bg-gray-300"></div>

              {/* Zoom Controls */}
              <div className="flex items-center gap-2">
                {/* Zoom Out Button */}
                <button
                  onClick={handleZoomOut}
                  disabled={stageScale <= 0.1}
                  className="w-8 h-8 flex items-center justify-center rounded-full
                bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700
                border border-gray-300 dark:border-gray-600
                shadow-sm hover:shadow
                disabled:opacity-40 disabled:cursor-not-allowed
                transition-all duration-200"
                  title="Zoom Out"
                >
                  <MdZoomOut className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                </button>

                {/* Zoom Percentage Display & Reset */}
                <div className="flex items-center">
                  {/* Percentage Display */}
                  <div className="px-3 py-1.5 text-sm font-medium
                bg-gray-50 dark:bg-gray-800 
                rounded-l-md
                text-gray-700 dark:text-gray-300">
                    {Math.round(stageScale * 100)}%
                  </div>

                  {/* Reset Button */}

                </div>
                <button
                  onClick={handleCenterToContent}
                  disabled={droppedItems.length === 0}
                  className="w-8 h-8 flex items-center justify-center rounded-full
                bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700
                border border-gray-300 dark:border-gray-600
                shadow-sm hover:shadow
                disabled:opacity-40 disabled:cursor-not-allowed
                transition-all duration-200"
                  title="Center to Content"
                >
                  <MdCenterFocusWeak className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                </button>

                {/* Zoom In Button */}
                <button
                  onClick={handleZoomIn}
                  disabled={stageScale >= 3}
                  className="w-8 h-8 flex items-center justify-center rounded-full
                bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700
                border border-gray-300 dark:border-gray-600
                shadow-sm hover:shadow
                disabled:opacity-40 disabled:cursor-not-allowed
                transition-all duration-200"
                  title="Zoom In"
                >
                  <MdZoomIn className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                </button>
              </div>
            </div>
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
                </span>
              </div>
            </div>
          )}

          {/* Selection Guidance Overlay */}
          {!isDrawingConnection && (selectedItemId !== null || selectedConnectionId !== null) && (
            <div className="absolute top-6 left-1/2 -translate-x-1/2 pointer-events-none">
              <div className="px-4 py-2 bg-black/70 backdrop-blur text-white text-sm rounded-full shadow-lg border border-white/10 flex items-center gap-3">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  Selection Active
                </span>
                <div className="w-px h-3 bg-white/20" />
                <span className="text-white/80 text-xs">
                  Press 'Del', 'Backspace' or 'D' to delete selection
                </span>
              </div>
            </div>
          )}

          {/* Empty State Overlay */}
          {droppedItems.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center p-6 bg-white/80 backdrop-blur rounded-xl border border-gray-200 shadow-sm">
                <div className="text-gray-500 font-medium">Canvas Empty</div>
                <div className="text-xs text-gray-400 mt-1">Drag components from the sidebar</div>
              </div>
            </div>
          )}
        </div>
        {/* Right Sidebar - Canvas Properties/Items List */}

        <div className="relative overflow-hidden border-l border-gray-200 dark:border-gray-800 hidden lg:block">

          {/* Collapse Button */}
          <button
            onClick={() => setRightCollapsed(v => !v)}
            className="absolute top-2 left-2 z-10 w-7 h-7 flex items-center justify-center
      rounded-md bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700
      hover:bg-gray-100 dark:hover:bg-gray-700"
            title={rightCollapsed ? "Expand" : "Collapse"}
          >
            {!rightCollapsed ? <TbLayoutSidebarRightCollapse />
              : <TbLayoutSidebarRightExpand />}
          </button>

          {!rightCollapsed && (
            <CanvasPropertiesSidebar
              items={droppedItems}
              selectedItemId={selectedItemId || undefined}
              onSelectItem={handleSelectItem}
              onDeleteItem={handleDeleteItem}
              onUpdateItem={handleUpdateItem}
              showAllItemsByDefault
            />
          )}
        </div>
        <ExportModal
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          onExport={handleExport}
          isExporting={isExporting}
        />
      </div>
    </div>
  );
}