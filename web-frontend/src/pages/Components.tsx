import React, { useState, useRef } from "react";
import {
  Button,
  Input,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Select,
  SelectItem,
  Card,
  CardBody,
  CardFooter,
  Image,
  Tooltip,
} from "@heroui/react";

import { useComponents } from "@/context/ComponentContext";
import { ComponentItem, Grip } from "@/components/Canvas/types";

export default function Components() {
  const { components, addComponent, updateComponent, deleteComponent, isLoading, error } =
    useComponents();
  const { isOpen, onOpen, onOpenChange } = useDisclosure();

  // Local type for handling input state (allows strings for "62.0")
  type EditableGrip = Omit<Grip, "x" | "y"> & {
    x: string | number;
    y: string | number;
  };
  const [grips, setGrips] = useState<EditableGrip[]>([]);

  // Form State
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [iconFile, setIconFile] = useState<string | null>(null);
  const [svgFile, setSvgFile] = useState<string | null>(null);
  const [legend, setLegend] = useState("");
  const [suffix, setSuffix] = useState("");

  // Interactive Grip State
  const [activeGripIndex, setActiveGripIndex] = useState<number | null>(0);
  const imageRef = useRef<HTMLImageElement>(null);

  // Edit State
  const [editingComponent, setEditingComponent] = useState<{
    category: string;
    name: string;
  } | null>(null);

  // Helpers
  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "icon" | "svg",
  ) => {
    const file = e.target.files?.[0];

    if (file) {
      const reader = new FileReader();

      reader.onloadend = () => {
        if (type === "icon") setIconFile(reader.result as string);
        else setSvgFile(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGripCountChange = (count: number) => {
    if (count < 0) return;

    setGrips((prev) => {
      if (count > prev.length) {
        // Add new grips
        const newGrips = [...prev];

        for (let i = prev.length; i < count; i++) {
          newGrips.push({ x: 50, y: 50, side: "right" });
        }

        return newGrips;
      } else {
        // Remove grips
        return prev.slice(0, count);
      }
    });

    // Reset active index logic if needed
    if (count > 0 && (activeGripIndex === null || activeGripIndex >= count)) {
      setActiveGripIndex(0);
    } else if (count === 0) {
      setActiveGripIndex(null);
    }
  };

  const updateGrip = (index: number, field: keyof EditableGrip, value: any) => {
    const newGrips = [...grips];

    newGrips[index] = { ...newGrips[index], [field]: value };
    setGrips(newGrips);
  };

  const removeGrip = (index: number) => {
    const newGrips = grips.filter((_, i) => i !== index);

    setGrips(newGrips);
    // Adjust active index
    if (activeGripIndex === index) {
      setActiveGripIndex(null);
    } else if (activeGripIndex !== null && activeGripIndex > index) {
      setActiveGripIndex(activeGripIndex - 1);
    }
  };

  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeGripIndex === null || activeGripIndex >= grips.length) return;

    // Use currentTarget (the wrapper) to get accurate dimensions relative to the image
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Calculate percentage relative to wrapper dimensions (which match image dimensions)
    const xPercent = parseFloat(((x / rect.width) * 100).toFixed(4));
    const yPercent = parseFloat(((y / rect.height) * 100).toFixed(4));

    const clampedX = Math.max(0, Math.min(100, xPercent));
    const clampedY = Math.max(0, Math.min(100, yPercent));

    // Determine side based on proximity to edges (simple heuristic)
    let side: "top" | "bottom" | "left" | "right" = grips[activeGripIndex].side;
    const distTop = clampedY;
    const distBottom = 100 - clampedY;
    const distLeft = clampedX;
    const distRight = 100 - clampedX;
    const minDist = Math.min(distTop, distBottom, distLeft, distRight);

    if (minDist === distTop) side = "top";
    else if (minDist === distBottom) side = "bottom";
    else if (minDist === distLeft) side = "left";
    else if (minDist === distRight) side = "right";

    const newGrips = [...grips];

    newGrips[activeGripIndex] = { x: clampedX, y: 100 - clampedY, side };
    setGrips(newGrips);

    // Auto-advance
    if (activeGripIndex < grips.length - 1) {
      setActiveGripIndex(activeGripIndex + 1);
    }
  };

  // Open modal specific for editing
  const handleEdit = (catName: string, item: ComponentItem) => {
    setEditingComponent({ category: catName, name: item.name });

    // Prefill form
    setName(item.name);
    setCategory(catName);
    setNewCategory("");
    setLegend(item.legend || "");
    setSuffix(item.suffix || "");
    setIconFile(
      typeof item.icon === "string" ? item.icon : (item.icon as any)?.src || "",
    );
    setSvgFile(
      typeof item.svg === "string" ? item.svg : (item.svg as any)?.src || "",
    );

    const initialGrips = item.grips ? item.grips.map((g) => ({ ...g })) : [];

    setGrips(initialGrips);
    setActiveGripIndex(initialGrips.length > 0 ? 0 : null);

    onOpen();
  };

  // Open modal for new
  const handleAddNew = () => {
    setEditingComponent(null);
    setName("");
    setCategory("");
    setNewCategory("");
    setLegend("");
    setSuffix("");
    setIconFile(null);
    setSvgFile(null);
    setGrips([]);
    setActiveGripIndex(null);
    onOpen();
  };

  const handleDelete = async (onClose: () => void) => {
    if (!editingComponent) return;
    if (
      window.confirm(
        `Are you sure you want to delete "${editingComponent.name}"? This cannot be undone.`,
      )
    ) {
      try {
        await deleteComponent(editingComponent.category, editingComponent.name);
        alert("Component deleted successfully!");
        onClose();
      } catch (err: any) {
        alert(`Error: ${err.message || "Failed to delete component"}`);
      }
    }
  };

  const handleSubmit = async (onClose: () => void) => {
    if (!name || (!category && !newCategory)) return;

    const finalCategory = newCategory || category;

    // Clean grips to ensure they are numbers for the final object
    const cleanGrips: Grip[] = grips.map((g) => ({
      ...g,
      x: typeof g.x === "string" ? parseFloat(g.x) || 0 : g.x,
      y: typeof g.y === "string" ? parseFloat(g.y) || 0 : g.y,
    }));

    // Construct new component object as per requirements
    const newComponent: ComponentItem = {
      id: 0,
      name,
      icon: iconFile || "",
      svg: svgFile || iconFile || "", // Fallback to icon if SVG not provided
      class: finalCategory,
      object: name.replace(/\s+/g, ""),
      args: [],
      grips: cleanGrips,
      legend,
      suffix,
    };

    try {
      if (editingComponent) {
        await updateComponent(
          editingComponent.category,
          editingComponent.name,
          finalCategory,
          newComponent,
        );
        alert("Component updated successfully!");
      } else {
        await addComponent(finalCategory, newComponent);
        alert("Component created successfully!");
      }

      // Reset form
      setName("");
      setCategory("");
      setNewCategory("");
      setIconFile(null);
      setSvgFile(null);
      setLegend("");
      setSuffix("");
      setGrips([]);
      setEditingComponent(null);
      onClose();
    } catch (err: any) {
      alert(`Error: ${err.message || "Failed to save component"}`);
    }
  };

  const categories = Object.keys(components);

  return (
    <div className="p-8 h-full overflow-y-auto bg-gray-50 dark:bg-gray-900">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
            Component Library
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Manage and add custom components
          </p>
        </div>
        <Button color="primary" onPress={handleAddNew}>
          Add Component
        </Button>
      </div>

      <div className="space-y-8">
        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <p className="text-red-500 dark:text-red-400 mb-4">{error}</p>
            <Button color="primary" onPress={() => window.location.reload()}>
              Retry
            </Button>
          </div>
        ) : Object.keys(components).length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              No components yet. Click "Add Component" to create your first component.
            </p>
          </div>
        ) : (
          Object.entries(components).map(([catName, items]) => (
            <div key={catName}>
              <h2 className="text-xl font-semibold mb-4 text-gray-700 dark:text-gray-300 border-b pb-2 border-gray-200 dark:border-gray-700">
                {catName}
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {Object.values(items).map((item) => (
                  <Tooltip
                    key={item.name}
                    content={
                      <div className="text-xs">
                        <div className="font-bold">{item.name}</div>
                      </div>
                    }
                  >
                    <Card
                      className="border-none bg-white dark:bg-gray-800 shadow-sm hover:shadow-md group relative"
                    >
                      <CardBody className="p-4 flex items-center justify-center bg-gray-50/50 dark:bg-gray-900/50">
                        <div className="w-16 h-16 flex items-center justify-center">
                          <Image
                            src={
                              typeof item.icon === "string"
                                ? item.icon
                                : (item.icon as any)?.src || item.icon
                            } // Handle imported image module vs string
                            alt={item.name}
                            className="max-w-full max-h-full object-contain"
                            radius="none"
                          />
                        </div>
                      </CardBody>
                      <CardFooter className="justify-between">
                        <div className="text-small font-medium truncate w-full text-center text-gray-700 dark:text-gray-300">
                          {item.name}
                        </div>
                        <Button
                          isIconOnly
                          aria-label="Edit"
                          className="absolute top-1 right-1 opacity-100 group-hover:opacity-100 transition-opacity bg-white/50 backdrop-blur-sm z-20"
                          size="sm"
                          variant="light"
                          onPress={() => {
                            handleEdit(catName, item);
                          }}
                        >
                          <span className="text-lg">✎</span>
                        </Button>
                      </CardFooter>
                    </Card>
                  </Tooltip>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Component Modal */}
      <Modal
        isOpen={isOpen}
        scrollBehavior="inside"
        size="3xl"
        onOpenChange={onOpenChange}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                {editingComponent
                  ? `Edit ${editingComponent.name}`
                  : "Add New Component"}
              </ModalHeader>
              <ModalBody>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left Column: Form Fields */}
                  <div className="space-y-4">
                    <Input
                      isRequired
                      label="Component Name"
                      placeholder="e.g. My Custom Heat Exchanger"
                      value={name}
                      onValueChange={setName}
                    />

                    <Select
                      label="Category"
                      placeholder="Select category"
                      selectedKeys={category ? [category] : []}
                      onChange={(e) => {
                        setCategory(e.target.value);
                        setNewCategory("");
                      }}
                    >
                      {categories.map((cat) => (
                        <SelectItem key={cat}>{cat}</SelectItem>
                      ))}
                    </Select>

                    <Input
                      label="New Category (Optional)"
                      placeholder="Or create new..."
                      value={newCategory}
                      onValueChange={(val) => {
                        setNewCategory(val);
                        if (val) setCategory("");
                      }}
                    />

                    <div className="flex gap-4">
                      <div className="flex-1">
                        <Input
                          label="Legend"
                          placeholder="e.g. HEX"
                          value={legend}
                          onValueChange={setLegend}
                        />
                      </div>
                      <div className="flex-1">
                        <Input
                          label="Suffix"
                          placeholder="e.g. A/B"
                          value={suffix}
                          onValueChange={setSuffix}
                        />
                      </div>
                    </div>

                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                      <label className="block text-sm font-medium mb-2 text-gray-600 dark:text-gray-400">
                        Component Images
                      </label>
                      <div className="flex flex-col gap-3">
                        <Input
                          accept="image/png"
                          label="Toolbar Icon (PNG)"
                          labelPlacement="outside"
                          type="file"
                          onChange={(e) => handleFileChange(e, "icon")}
                        />
                        <Input
                          accept="image/svg+xml,image/png,image/jpeg"
                          label="Canvas SVG"
                          labelPlacement="outside"
                          type="file"
                          onChange={(e) => handleFileChange(e, "svg")}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Grip Editor */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-gray-700 dark:text-gray-300">
                      Grip Configuration
                    </h3>

                    {/* Grip Count Input */}
                    <div className="flex items-center justify-between gap-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <label className="text-sm font-medium">
                        Number of Grips:
                      </label>
                      <Input
                        className="w-24"
                        max={20}
                        min={0}
                        type="number"
                        value={grips.length.toString()}
                        onValueChange={(v) =>
                          handleGripCountChange(parseInt(v) || 0)
                        }
                      />
                    </div>

                    {/* Preview Area */}
                    <div className="relative w-full aspect-video bg-gray-100 dark:bg-gray-800 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center overflow-hidden p-4">
                      {svgFile ? (
                        <div
                          className="relative inline-flex justify-center items-center cursor-crosshair group"
                          style={{ maxWidth: "100%", maxHeight: "100%" }}
                          onClick={handleImageClick}
                        >
                          <img
                            ref={imageRef}
                            alt="Grip Preview"
                            className="max-w-full max-h-full object-contain pointer-events-none select-none"
                            src={svgFile}
                            style={{ width: "auto", height: "auto" }}
                          />

                          {/* Grip Markers */}
                          {grips.map((grip, idx) => (
                            <div
                              key={idx}
                              className={`absolute w-5 h-5 -ml-2.5 -mt-2.5 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-transform hover:scale-125
                                                                ${activeGripIndex === idx ? "bg-primary text-white border-white ring-2 ring-primary/50" : "bg-white text-gray-700 border-gray-400"}
                                                            `}
                              style={{
                                left: `${grip.x}%`,
                                top: `${100 - Number(grip.y)}%`,
                              }}
                              // Stop propagation
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveGripIndex(idx);
                              }}
                            >
                              {idx + 1}
                            </div>
                          ))}

                          {/* Hover hint removed as requested/implied for cleanliness */}
                        </div>
                      ) : (
                        <div className="text-center text-gray-400 p-4">
                          <p>
                            Upload an SVG/Image to place grips interactively
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Grip List */}
                    <div className="space-y-2 max-h-60 overflow-y-auto p-1 text-sm">
                      {grips.map((grip, idx) => (
                        <div
                          key={idx}
                          className={`
                                                        grid grid-cols-12 gap-2 items-center p-2 rounded-lg border transition-colors cursor-pointer
                                                        ${activeGripIndex === idx ? "bg-primary/5 border-primary" : "bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"}
                                                    `}
                          onClick={() => setActiveGripIndex(idx)}
                        >
                          <div className="col-span-1 flex justify-center">
                            <div
                              className={`h-5 w-5 rounded-full flex items-center justify-center text-xs font-bold
                                                             ${activeGripIndex === idx ? "bg-primary text-white" : "bg-gray-200 text-gray-500"}
                                                        `}
                            >
                              {idx + 1}
                            </div>
                          </div>
                          <div className="col-span-10 grid grid-cols-3 gap-2">
                            <Input
                              classNames={{ input: "text-right" }}
                              size="sm"
                              startContent={
                                <span className="text-xs text-gray-400">
                                  X%
                                </span>
                              }
                              type="text"
                              value={grip.x.toString()}
                              onValueChange={(v) => updateGrip(idx, "x", v)}
                            />
                            <Input
                              classNames={{ input: "text-right" }}
                              size="sm"
                              startContent={
                                <span className="text-xs text-gray-400">
                                  Y%
                                </span>
                              }
                              type="text"
                              value={grip.y.toString()}
                              onValueChange={(v) => updateGrip(idx, "y", v)}
                            />
                            <Select
                              aria-label="Grip Side"
                              selectedKeys={[grip.side]}
                              size="sm"
                              onChange={(e) =>
                                updateGrip(idx, "side", e.target.value)
                              }
                            >
                              <SelectItem key="top">Top</SelectItem>
                              <SelectItem key="bottom">Bottom</SelectItem>
                              <SelectItem key="left">Left</SelectItem>
                              <SelectItem key="right">Right</SelectItem>
                            </Select>
                          </div>
                          <div className="col-span-1 flex justify-end">
                            <Button
                              isIconOnly
                              color="danger"
                              size="sm"
                              variant="light"
                              onPress={() => removeGrip(idx)}
                            >
                              <span className="text-lg">×</span>
                            </Button>
                          </div>
                        </div>
                      ))}
                      {grips.length === 0 && (
                        <div className="text-center text-gray-400 italic py-2">
                          Set number of grips above
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </ModalBody>
              <ModalFooter className="flex justify-between">
                <div>
                  {editingComponent && (
                    <Button
                      color="danger"
                      variant="flat"
                      onPress={() => handleDelete(onClose)}
                    >
                      Delete Component
                    </Button>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button color="danger" variant="light" onPress={onClose}>
                    Cancel
                  </Button>
                  <Button color="primary" onPress={() => handleSubmit(onClose)}>
                    {editingComponent ? "Save Changes" : "Create Component"}
                  </Button>
                </div>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
