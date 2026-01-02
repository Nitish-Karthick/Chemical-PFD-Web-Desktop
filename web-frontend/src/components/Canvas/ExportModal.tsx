import React, { useState } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Select,
  SelectItem,
  Slider,
  Switch,
  Input,
  Card,
  CardBody,
  Tooltip,
} from "@heroui/react";
import { FiDownload, FiImage, FiGrid, FiType, FiEdit2 } from "react-icons/fi";
import { TbPhoto, TbFileTypePdf, TbFileExport } from "react-icons/tb";

import {
  ExportOptions,
  ExportFormat,
  ExportQuality,
  defaultExportOptions,
} from "@/components/Canvas/types";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (options: ExportOptions) => Promise<void>;
  isExporting: boolean;
}

// Format options as export buttons (previously presets)
const formatOptions = [
  { 
    key: "png", 
    label: "PNG", 
    icon: <TbPhoto />,
    description: "High-quality raster image",
    color: "bg-blue-50 dark:bg-blue-900/20",
    borderColor: "border-blue-200 dark:border-blue-800",
    extension: ".png"
  },
  { 
    key: "jpg", 
    label: "JPEG", 
    icon: <FiImage />,
    description: "Compressed image format",
    color: "bg-green-50 dark:bg-green-900/20",
    borderColor: "border-green-200 dark:border-green-800",
    extension: ".jpg"
  },
  { 
    key: "pdf", 
    label: "PDF", 
    icon: <TbFileTypePdf />,
    description: "Vector document format",
    color: "bg-red-50 dark:bg-red-900/20",
    borderColor: "border-red-200 dark:border-red-800",
    extension: ".pdf"
  },
  { 
    key: "export", 
    label: "Diagram File", 
    icon: <TbFileExport />,
    description: "Complete diagram state",
    color: "bg-purple-50 dark:bg-purple-900/20",
    borderColor: "border-purple-200 dark:border-purple-800",
    extension: ".pfd"
  },
];

const qualityOptions = [
  { key: "low", label: "Low" },
  { key: "medium", label: "Medium" },
  { key: "high", label: "High" },
];

// Default filename base
const DEFAULT_FILENAME = "diagram";

export default function ExportModal({
  isOpen,
  onClose,
  onExport,
  isExporting,
}: ExportModalProps) {
  const [options, setOptions] = useState<ExportOptions>(defaultExportOptions);
  const [filename, setFilename] = useState<string>(DEFAULT_FILENAME);
  const [isEditingName, setIsEditingName] = useState<boolean>(false);
  
  const isDiagramFormat = options.format === 'export';
  const currentFormat = formatOptions.find(f => f.key === options.format);
  const fullFilename = `${filename}${currentFormat?.extension || ''}`;

  const handleFormatSelect = (formatKey: ExportFormat) => {
    setOptions((prev) => ({
      ...prev,
      format: formatKey,
      // Set default options based on format
      ...(formatKey === 'export' 
        ? { includeGrid: false, includeWatermark: false }
        : formatKey === 'pdf' 
          ? { scale: 2, quality: 'high' }
          : {}
      ),
    }));
  };

  const handleExport = async () => {
    await onExport({
      ...options,
      filename: filename.trim() || DEFAULT_FILENAME,
    });
  };

  const handleNameEdit = () => {
    setIsEditingName(true);
  };

  const handleNameSave = () => {
    setIsEditingName(false);
    // Trim and validate filename
    const trimmed = filename.trim();
    if (trimmed) {
      setFilename(trimmed);
    } else {
      setFilename(DEFAULT_FILENAME);
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Remove extension if user tries to add it
    let newName = e.target.value;
    const formatExt = currentFormat?.extension || '';
    if (formatExt && newName.endsWith(formatExt)) {
      newName = newName.slice(0, -formatExt.length);
    }
    
    // Basic filename validation (no illegal characters)
    const sanitized = newName.replace(/[<>:"/\\|?*]/g, '');
    setFilename(sanitized);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNameSave();
    } else if (e.key === 'Escape') {
      setIsEditingName(false);
      setFilename(filename.trim() || DEFAULT_FILENAME);
    }
  };

  return (
    <Modal
      backdrop="blur"
      isOpen={isOpen}
      scrollBehavior="inside"
      size="2xl"
      onClose={onClose}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <FiDownload className="text-xl" />
            <span>Export Diagram</span>
          </div>
          <p className="text-sm text-gray-500 font-normal">
            Choose export format and settings
          </p>
        </ModalHeader>

        <ModalBody>
          {/* Export Filename Section - ADD THIS */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-medium">Export Name</h3>
              {!isEditingName && (
                <Button
                  size="sm"
                  variant="light"
                  startContent={<FiEdit2 className="text-sm" />}
                  onPress={handleNameEdit}
                >
                  Edit Name
                </Button>
              )}
            </div>
            
            {isEditingName ? (
              <div className="flex gap-2">
                <Input
                  autoFocus
                  className="flex-1"
                  placeholder="Enter filename"
                  size="sm"
                  value={filename}
                  onChange={handleNameChange}
                  onKeyDown={handleKeyDown}
                  onBlur={handleNameSave}
                  endContent={
                    <span className="text-gray-400 text-sm">
                      {currentFormat?.extension}
                    </span>
                  }
                />
                <Button
                  size="sm"
                  color="primary"
                  onPress={handleNameSave}
                >
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="light"
                  onPress={() => {
                    setIsEditingName(false);
                    setFilename(filename.trim() || DEFAULT_FILENAME);
                  }}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-gray-800 dark:text-gray-200">
                      {filename}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400">
                      {currentFormat?.extension}
                    </span>
                  </div>
                  <span className="text-sm text-gray-500">
                    Full name: {fullFilename}
                  </span>
                </div>
              </div>
            )}
            
            <p className="text-xs text-gray-500 mt-2">
              The exported file will be saved as "{fullFilename}"
            </p>
          </div>

          {/* Export Format Buttons (replacing presets) */}
          <div>
            <h3 className="text-sm font-medium mb-2">Export Format</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
              {formatOptions.map((format) => (
                <Card
                  key={format.key}
                  isHoverable
                  isPressable
                  className={`cursor-pointer transition-all ${
                    options.format === format.key
                      ? `ring-2 ring-blue-500 ${format.color} border-2 ${format.borderColor}`
                      : ""
                  }`}
                  onPress={() => handleFormatSelect(format.key as ExportFormat)}
                >
                  <CardBody className="p-3">
                    <div className="flex items-center gap-2">
                      {format.icon}
                      <span className="text-sm font-medium">{format.label}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {format.description}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {format.extension}
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            {/* Quality and Scale */}
            {!isDiagramFormat && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="flex justify-between mb-2">
                    <h3 className="text-sm font-medium">Quality</h3>
                    <span className="text-sm text-gray-500 capitalize">
                      {options.quality}
                    </span>
                  </div>
                  <Select
                    selectedKeys={[options.quality]}
                    size="sm"
                    onChange={(e) =>
                      setOptions((prev) => ({
                        ...prev,
                        quality: e.target.value as ExportQuality,
                      }))
                    }
                  >
                    {qualityOptions.map((quality) => (
                      <SelectItem key={quality.key}>{quality.label}</SelectItem>
                    ))}
                  </Select>
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <h3 className="text-sm font-medium">Scale</h3>
                    <span className="text-sm text-gray-500">{options.scale}x</span>
                  </div>
                  <Slider
                    className="max-w-md"
                    maxValue={3}
                    minValue={0.5}
                    size="sm"
                    step={0.1}
                    value={options.scale}
                    onChange={(value) =>
                      setOptions((prev) => ({ ...prev, scale: value as number }))
                    }
                  />
                </div>
              </div>
            )}

            {/* Advanced Options for image formats */}
            {!isDiagramFormat && (
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Advanced Options</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Switch
                    isSelected={options.includeGrid}
                    onValueChange={(value) =>
                      setOptions((prev) => ({ 
                        ...prev, 
                        includeGrid: value
                      }))
                    }
                  >
                    <div className="flex items-center gap-2">
                      <FiGrid />
                      Include Grid
                    </div>
                  </Switch>

                  <Switch
                    isSelected={options.includeWatermark}
                    onValueChange={(value) =>
                      setOptions((prev) => ({ ...prev, includeWatermark: value }))
                    }
                  >
                    <div className="flex items-center gap-2">
                      <FiType />
                      Watermark
                    </div>
                  </Switch>
                </div>

                {options.includeWatermark && (
                  <Input
                    label="Watermark Text"
                    placeholder="Enter watermark text"
                    size="sm"
                    value={options.watermarkText || ""}
                    onChange={(e) =>
                      setOptions((prev) => ({
                        ...prev,
                        watermarkText: e.target.value,
                      }))
                    }
                  />
                )}

                <div>
                  <div className="flex justify-between mb-2">
                    <h3 className="text-sm font-medium">Padding</h3>
                    <span className="text-sm text-gray-500">
                      {options.padding}px
                    </span>
                  </div>
                  <Slider
                    className="max-w-md"
                    maxValue={100}
                    minValue={0}
                    size="sm"
                    step={5}
                    value={options.padding}
                    onChange={(value) =>
                      setOptions((prev) => ({
                        ...prev,
                        padding: value as number,
                      }))
                    }
                  />
                </div>

                <div>
                  <h3 className="text-sm font-medium mb-2">Background Color</h3>
                  <div className="flex gap-2">
                    {["#ffffff", "#f8fafc", "#1e293b", "transparent"].map(
                      (color) => (
                        <Tooltip
                          key={color}
                          content={
                            color === "transparent" ? "Transparent" : color
                          }
                        >
                          <button
                            className={`w-8 h-8 rounded border ${
                              options.backgroundColor === color
                                ? "ring-2 ring-blue-500 ring-offset-2"
                                : ""
                            }`}
                            style={{ 
                              backgroundColor: color === "transparent" ? "#ffffff" : color,
                              borderColor: color === "transparent" ? "#e5e7eb" : color
                            }}
                            onClick={() =>
                              setOptions((prev) => ({
                                ...prev,
                                backgroundColor: color,
                              }))
                            }
                          />
                        </Tooltip>
                      ),
                    )}
                    <Input
                      className="flex-1"
                      placeholder="#ffffff"
                      size="sm"
                      value={options.backgroundColor}
                      onChange={(e) =>
                        setOptions((prev) => ({
                          ...prev,
                          backgroundColor: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Diagram format info */}
            {isDiagramFormat && (
              <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                <div className="flex items-center gap-2 text-purple-700 dark:text-purple-300 mb-2">
                  <TbFileExport className="text-lg" />
                  <span className="text-sm font-medium">Diagram File Export</span>
                </div>
                <p className="text-sm text-purple-600 dark:text-purple-400">
                  Saves the complete diagram state including all components, connections, and viewport settings. 
                  Can be reopened later to continue editing.
                </p>
                <div className="mt-3 text-xs text-purple-500 dark:text-purple-400">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full bg-purple-400"></div>
                    <span>Saves all component positions and properties</span>
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full bg-purple-400"></div>
                    <span>Preserves all connections and waypoints</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-purple-400"></div>
                    <span>Saves current viewport zoom and position</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ModalBody>

        <ModalFooter>
          <Button variant="light" onPress={onClose}>
            Cancel
          </Button>
          <Button
            color="primary"
            isLoading={isExporting}
            startContent={!isExporting && <FiDownload />}
            onPress={handleExport}
          >
            Export {fullFilename}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}