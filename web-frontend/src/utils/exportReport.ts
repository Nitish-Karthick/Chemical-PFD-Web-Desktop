// src/utils/exportReport.ts
export function exportToCSV(
  rows: {
    slNo: number;
    tagNo: string;
    type: string;
    description: string;
  }[]
) {
  const header = ["Sl No", "Tag No", "Type", "Description"];
  const csv = [
    header.join(","),
    ...rows.map((r) =>
      [
        r.slNo,
        `"${r.tagNo}"`,
        `"${r.type}"`,
        `"${r.description.replace(/"/g, '""')}"`,
      ].join(",")
    ),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `equipment-report-${Date.now()}.csv`;
  a.click();

  URL.revokeObjectURL(url);
}
