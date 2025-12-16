import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Stage, Layer } from "react-konva";
import Konva from "konva";
import { Button, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Tooltip } from "@heroui/react";
import { ThemeSwitch } from "@/components/theme-switch";
import { componentsConfig } from "@/assets/config/items";
import { CanvasItemImage } from "@/components/Canvas/CanvasItemImage";
import { ComponentLibrarySidebar,CanvasPropertiesSidebar } from "@/components/Canvas/ComponentLibrarySidebar"; 
import { ComponentItem, CanvasItem } from "@/components/Canvas/types";

export default function Editor() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  
  // State
  const [components, setComponents] = useState<Record<string, Record<string, ComponentItem>>>({});
  const [droppedItems, setDroppedItems] = useState<CanvasItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Canvas Viewport State
  const [stageScale, setStageScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });

  // Refs
  const stageRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragItemRef = useRef<ComponentItem | null>(null);

  useEffect(() => {
    setComponents(componentsConfig);
  }, []);

  // --- Handlers ---

  const handleDragStart = (e: React.DragEvent, item: ComponentItem) => {
    dragItemRef.current = item;
    
    // Set drag image (ghost)
    if (item.svg) {
      const img = new Image();
      img.src = item.svg;
      // White background for drag preview
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
    
    // If we dropped a sidebar item
    if (dragItemRef.current && stage) {
      stage.setPointersPositions(e);
      const pointer = stage.getRelativePointerPosition();
      
      if (pointer) {
        const newItem: CanvasItem = {
          ...dragItemRef.current,
          id: Date.now(),
          x: pointer.x - 40, // Center based on 80px width
          y: pointer.y - 40,
          width: 80,
          height: 80,
          rotation: 0
        };
        
        setDroppedItems(prev => [...prev, newItem]);
        setSelectedItemId(newItem.id);
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
    setDroppedItems(prev => prev.filter(item => item.id !== itemId));
    if (selectedItemId === itemId) {
      setSelectedItemId(null);
    }
  };

  const handleUpdateItem = (itemId: number, updates: Partial<CanvasItem>) => {
    setDroppedItems(prev => 
      prev.map(item => 
        item.id === itemId ? { ...item, ...updates } : item
      )
    );
  };

  const handleSelectItem = (itemId: number) => {
    setSelectedItemId(itemId);
  };

  const handleClearSelection = () => {
    setSelectedItemId(null);
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header Bar - Preserved */}
      <div className="h-14 border-b flex items-center px-4 justify-between bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 z-10">
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
            <DropdownMenu aria-label="Edit Actions">
              <DropdownItem key="undo">Undo (Ctrl+Z)</DropdownItem>
              <DropdownItem key="redo">Redo (Ctrl+Y)</DropdownItem>
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
          <Button size="sm" variant="bordered" className="border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300">
            Share
          </Button>
          <Button size="sm" className="bg-blue-600 text-white hover:bg-blue-700">Save Changes</Button>
        </div>
      </div>

      {/* Main workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Component Library */}
        <ComponentLibrarySidebar
          components={components}
          onDragStart={handleDragStart}
          onSearch={setSearchQuery}
          initialSearchQuery={searchQuery}
        />
        
        {/* Canvas Area - Konva */}
        <div
          className="flex-1 relative overflow-hidden bg-white"
          ref={containerRef}
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
            width={window.innerWidth - (64 + 72 + 16)} // 64(left) + 72(right) + 16(padding)
            height={window.innerHeight - 56}
            scaleX={stageScale}
            scaleY={stageScale}
            x={stagePos.x}
            y={stagePos.y}
            draggable
            onWheel={handleWheel}
            ref={stageRef}
            onMouseDown={(e) => {
              // Click on stage deselects
              const clickedOnEmpty = e.target === e.target.getStage();
              if (clickedOnEmpty) {
                handleClearSelection();
              }
            }}
            onMouseMove={() => {
              const stage = stageRef.current;
              if (stage) {
                const pointer = stage.getRelativePointerPosition();
                if(pointer) setCursorPos({ x: Math.round(pointer.x), y: Math.round(pointer.y) });
              }
            }}
            onDragEnd={(e) => {
               // Update stage position state when panning finishes
               if(e.target === stageRef.current) {
                   setStagePos({ x: e.target.x(), y: e.target.y() });
               }
            }}
          >
            <Layer>
              {droppedItems.map((item) => (
                <CanvasItemImage
                  key={item.id}
                  item={item}
                  isSelected={item.id === selectedItemId}
                  onSelect={() => handleSelectItem(item.id)}
                  onChange={(newAttrs) => {
                    setDroppedItems(prev => 
                      prev.map(i => i.id === newAttrs.id ? newAttrs : i)
                    );
                  }}
                />
              ))}
            </Layer>
          </Stage>

          {/* Independent Floating Bubble */}
          <div className="absolute bottom-6 right-[45%] flex flex-col items-end gap-2 pointer-events-none">
             {/* Coordinate Bubble */}
             <div className="flex items-center gap-3 px-4 py-2 bg-white/90 dark:bg-[#1f2938]  backdrop-blur shadow-lg border border-gray-200 rounded-full text-xs font-mono text-gray-600 pointer-events-auto">
                <div className="flex gap-2 dark:text-gray-200">
                    <span className="font-bold text-gray-400">X</span> {cursorPos.x}
                </div>
                <div className="w-px h-3 bg-gray-400"></div>
                <div className="flex gap-2 dark:text-gray-200">
                    <span className="font-bold text-gray-400">Y</span> {cursorPos.y}
                </div>
                <div className="w-px h-3 bg-gray-300"></div>
                <div className="font-semibold text-blue-600">
                    {Math.round(stageScale * 100)}%
                </div>
             </div>

             {/* Help Bubble */}
             
          </div>
          
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
        <CanvasPropertiesSidebar
          items={droppedItems}
          selectedItemId={selectedItemId}
          onSelectItem={handleSelectItem}
          onDeleteItem={handleDeleteItem}
          onUpdateItem={handleUpdateItem}
          className="hidden lg:flex"
          showAllItemsByDefault={true}
        />
      </div>
    </div>
  );
}