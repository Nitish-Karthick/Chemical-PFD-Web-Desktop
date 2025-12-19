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
  RadioGroup,
  Radio,
  Card,
  CardBody,
  Tooltip,
} from "@heroui/react";
import { FiDownload, FiImage, FiGrid, FiType } from "react-icons/fi";
import { TbPhoto, TbFileTypePdf, TbFileTypeSvg } from "react-icons/tb";

import {
  ExportOptions,
  ExportFormat,
  ExportQuality,
  defaultExportOptions,
  exportPresets,
} from "@/components/Canvas/types";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (options: ExportOptions) => Promise<void>;
  isExporting: boolean;
}

const formatOptions = [
  { key: "png", label: "PNG", icon: <TbPhoto /> },
  { key: "jpg", label: "JPEG", icon: <FiImage /> },
  { key: "pdf", label: "PDF", icon: <TbFileTypePdf /> },
  { key: "svg", label: "SVG", icon: <TbFileTypeSvg /> },
];

const qualityOptions = [
  { key: "low", label: "Low" },
  { key: "medium", label: "Medium" },
  { key: "high", label: "High" },
];

export default function ExportModal({
  isOpen,
  onClose,
  onExport,
  isExporting,
}: ExportModalProps) {
  const [options, setOptions] = useState<ExportOptions>(defaultExportOptions);
  const [selectedPreset, setSelectedPreset] = useState<string>("presentation");

  const handlePresetSelect = (presetId: string) => {
    const preset = exportPresets.find((p) => p.id === presetId);

    if (preset) {
      setSelectedPreset(presetId);
      setOptions((prev) => ({
        ...prev,
        ...preset.options,
      }));
    }
  };

  const handleExport = async () => {
    await onExport(options);
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
          {/* Presets */}
          <div>
            <h3 className="text-sm font-medium mb-2">Quick Presets</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
              {exportPresets.map((preset) => (
                <Card
                  key={preset.id}
                  isHoverable
                  isPressable
                  className={`cursor-pointer transition-all ${
                    selectedPreset === preset.id
                      ? "ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20"
                      : ""
                  }`}
                  onPress={() => handlePresetSelect(preset.id)}
                >
                  <CardBody className="p-3">
                    <div className="text-sm font-medium">{preset.name}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {preset.description}
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            {/* Format Selection */}
            <div>
              <h3 className="text-sm font-medium mb-3">Format</h3>
              <RadioGroup
                orientation="horizontal"
                value={options.format}
                onValueChange={(value) =>
                  setOptions((prev) => ({
                    ...prev,
                    format: value as ExportFormat,
                  }))
                }
              >
                {formatOptions.map((format) => (
                  <Radio key={format.key} className="mr-4" value={format.key}>
                    <div className="flex items-center gap-2">
                      {format.icon}
                      {format.label}
                    </div>
                  </Radio>
                ))}
              </RadioGroup>
            </div>

            {/* Quality and Scale */}
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
                  <span className="text-sm text-gray-500">{options.scale}</span>
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

            {/* Advanced Options */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Advanced Options</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Switch
                  isSelected={options.includeGrid}
                  onValueChange={(value) =>
                    setOptions((prev) => ({ ...prev, includeGrid: value }))
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
                  value={options.watermarkText}
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
                          style={{ backgroundColor: color }}
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
            Export Diagram
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
