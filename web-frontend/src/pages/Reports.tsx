import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from "@heroui/react";

interface Equipment {
  slNo: number;
  tagNo: string;
  type: string;
  description: string;
}

const equipmentList: Equipment[] = [
  { slNo: 1, tagNo: "P-01-A/B", type: "Hand Pump", description: "Hand Pump with Drum" },
  { slNo: 2, tagNo: "P-02-A/B", type: "Reciprocating Pump", description: "" },
  { slNo: 3, tagNo: "E-01", type: "Heat Exchanger", description: "" },
  { slNo: 4, tagNo: "P-03-A/B", type: "Hand Pump", description: "Hand Pump with Drum" },
  { slNo: 5, tagNo: "P-04-A/B", type: "Proportioning Pump", description: "" },
  { slNo: 6, tagNo: "P-05-A/B", type: "Proportioning Pump", description: "" },
  { slNo: 7, tagNo: "C-01-A/B", type: "Centrifugal Compressor", description: "" },
  { slNo: 8, tagNo: "C-02-A/B", type: "Turbine", description: "" },
  { slNo: 9, tagNo: "PRV-01-A/B", type: "Gate Valve", description: "" },
  { slNo: 10, tagNo: "SR-01", type: "Jaw Crusher", description: "" },
];

export default function EquipmentTable() {
  return (
    <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-sm">
      <h2 className="text-xl font-semibold mb-4">List of Equipment</h2>

      <Table
        aria-label="Equipment list table"
        removeWrapper
        classNames={{
          th: "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300",
          td: "text-gray-600 dark:text-gray-300",
        }}
      >
        <TableHeader>
          <TableColumn>Sl No</TableColumn>
          <TableColumn>Tag No</TableColumn>
          <TableColumn>Type</TableColumn>
          <TableColumn>Description</TableColumn>
        </TableHeader>

        <TableBody>
          {equipmentList.map((item) => (
            <TableRow key={item.slNo}>
              <TableCell>{item.slNo}</TableCell>
              <TableCell className="font-medium">{item.tagNo}</TableCell>
              <TableCell>{item.type}</TableCell>
              <TableCell>
                {item.description || "-"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
