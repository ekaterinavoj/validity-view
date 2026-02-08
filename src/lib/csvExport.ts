import Papa from "papaparse";

interface ExportToCSVOptions {
  filename: string;
  data: Record<string, any>[];
  delimiter?: string;
}

/**
 * Export data to CSV file with UTF-8 BOM encoding
 */
export const exportToCSV = ({ filename, data, delimiter = ";" }: ExportToCSVOptions): void => {
  if (data.length === 0) {
    throw new Error("Žádná data k exportu");
  }

  const csv = Papa.unparse(data, { delimiter });
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename.endsWith(".csv") ? filename : `${filename}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Download CSV template with sample data
 */
export const downloadCSVTemplate = (
  filename: string, 
  templateData: Record<string, any>[],
  delimiter: string = ";"
): void => {
  exportToCSV({ filename, data: templateData, delimiter });
};
