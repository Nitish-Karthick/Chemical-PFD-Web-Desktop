// src/components/Export/ExportReportModal.tsx
import React, { useMemo } from "react";
import { useEditorStore } from "@/store/useEditorStore";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Tooltip,
} from "@heroui/react";
import { FiDownload, FiPrinter, FiFileText } from "react-icons/fi";

interface ExportReportModalProps {
  editorId: string;
  open: boolean;
  onClose: () => void;
}

interface ReportItem {
  slNo: number;
  tagNo: string;
  type: string;
  description: string;
}

export const ExportReportModal: React.FC<ExportReportModalProps> = ({
  editorId,
  open,
  onClose,
}) => {
  const editorState = useEditorStore((s) => s.editors[editorId]);

  // Transform editor items to report items
  const items = useMemo(() => {
    if (!editorState?.items) return [];
    
    return [...editorState.items]
      .sort((a, b) => (a.sequence || 0) - (b.sequence || 0))
      .map((item, index) => ({
        slNo: index + 1,
        tagNo: item.label || `TAG-${index + 1}`, // Use label property
        type: item.object || item.name || "N/A", // Use object or name
        description: item.description || "No description",
        originalItem: item
      })) as ReportItem[];
  }, [editorState]);

  // Function to export to CSV
  const exportToCSV = (items: ReportItem[]) => {
    if (items.length === 0) return;

    const headers = ["Sl No", "Tag No", "Type", "Description"];
    const csvContent = [
      headers.join(","),
      ...items.map(item => 
        `"${item.slNo}","${item.tagNo}","${item.type}","${item.description}"`
      )
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `equipment-report-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  // Handle Print/PDF with better print styling
  const handlePrint = () => {
    // Create a print-friendly version
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Equipment Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .print-header { text-align: center; margin-bottom: 30px; }
            .print-header h1 { margin: 0; color: #333; }
            .print-header .date { color: #666; margin-top: 5px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background-color: #f3f4f6; font-weight: 600; }
            th, td { border: 1px solid #d1d5db; padding: 12px 8px; text-align: left; }
            .footer { margin-top: 30px; text-align: right; color: #666; }
          </style>
        </head>
        <body>
          <div class="print-header">
            <h1>Equipment Report</h1>
            <div class="date">Generated on ${new Date().toLocaleDateString()}</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Sl No</th>
                <th>Tag No</th>
                <th>Type</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(item => `
                <tr>
                  <td>${item.slNo}</td>
                  <td><strong>${item.tagNo}</strong></td>
                  <td>${item.type}</td>
                  <td>${item.description}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="footer">
            Total Items: ${items.length}
          </div>
          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() {
                window.close();
              };
            }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
  };

  return (
    <Modal
      backdrop="blur"
      isOpen={open}
      scrollBehavior="inside"
      size="2xl"
      onClose={onClose}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <FiDownload className="text-xl" />
            <span>Export Equipment Report</span>
          </div>
          <p className="text-sm text-gray-500 font-normal">
            Review and export your diagram components as a report
          </p>
        </ModalHeader>

        <ModalBody>
          {/* Stats Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/20">
              <div className="text-2xl font-bold">{items.length}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Total Items</div>
            </div>
            <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/20">
              <div className="text-2xl font-bold">
                {new Set(items.map(i => i.type)).size}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Unique Types</div>
            </div>
            <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/20">
              <div className="text-2xl font-bold">
                {items.filter(i => i.description && i.description !== "No description").length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">With Description</div>
            </div>
            <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-800/20">
              <div className="text-2xl font-bold">
                {items.filter(i => i.tagNo.startsWith('TAG-')).length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Auto-tagged</div>
            </div>
          </div>

          {/* Report Table */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Components List</h3>
              {items.length > 0 && (
                <div className="text-sm text-gray-500">
                  Showing {items.length} items
                </div>
              )}
            </div>

            <div className="max-h-[400px] overflow-auto rounded-lg border border-gray-200 dark:border-gray-800">
              <Table
                aria-label="Equipment Report Table"
                classNames={{
                  base: "min-h-[200px]",
                  wrapper: "shadow-none",
                }}
                removeWrapper
              >
                <TableHeader>
                  <TableColumn className="bg-gray-50 dark:bg-gray-800">
                    <div className="font-semibold">Sl No</div>
                  </TableColumn>
                  <TableColumn className="bg-gray-50 dark:bg-gray-800">
                    <div className="font-semibold">Tag No</div>
                  </TableColumn>
                  <TableColumn className="bg-gray-50 dark:bg-gray-800">
                    <div className="font-semibold">Type</div>
                  </TableColumn>
                  <TableColumn className="bg-gray-50 dark:bg-gray-800">
                    <div className="font-semibold">Description</div>
                  </TableColumn>
                </TableHeader>
                <TableBody
                  items={items}
                  emptyContent={
                    <div className="py-12 text-center">
                      <div className="text-gray-500 mb-2">No components found</div>
                      <div className="text-sm text-gray-400">
                        Add components to your diagram to generate a report
                      </div>
                    </div>
                  }
                >
                  {(item) => (
                    <TableRow key={`${item.slNo}-${item.tagNo}`}>
                      <TableCell>{item.slNo}</TableCell>
                      <TableCell>
                        <div className="font-medium text-blue-600 dark:text-blue-400">
                          {item.tagNo}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          {item.type}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        {item.description}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Export Options */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
              <h3 className="text-sm font-medium mb-3">Export Options</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm text-gray-600 dark:text-gray-400">
                    CSV Export
                  </label>
                  <div className="text-xs text-gray-500">
                    Comma-separated values, editable in spreadsheet software
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-gray-600 dark:text-gray-400">
                    Print/PDF
                  </label>
                  <div className="text-xs text-gray-500">
                    Print-ready format or save as PDF from print dialog
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ModalBody>

        <ModalFooter>
          <Button variant="light" onPress={onClose}>
            Cancel
          </Button>
          <div className="flex gap-2">
            <Tooltip content="Export as CSV file">
              <Button
                color="primary"
                variant="bordered"
                startContent={<FiFileText />}
                onPress={() => exportToCSV(items)}
                isDisabled={items.length === 0}
              >
                CSV
              </Button>
            </Tooltip>
            <Tooltip content="Print or save as PDF">
              <Button
                color="primary"
                startContent={<FiPrinter />}
                onPress={handlePrint}
                isDisabled={items.length === 0}
              >
                Print/PDF
              </Button>
            </Tooltip>
          </div>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};