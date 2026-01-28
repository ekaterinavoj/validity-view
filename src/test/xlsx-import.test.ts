import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";

describe("XLSX library functionality", () => {
  it("can create and read xlsx workbook", () => {
    // Create a simple workbook
    const testData = [
      { employee_number: "EMP001", email: "test@example.com", training_type_name: "BOZP", facility_code: "qlar-jenec-dc3", last_training_date: "2024-01-15" },
      { employee_number: "EMP002", email: "test2@example.com", training_type_name: "ATEX", facility_code: "qlar-jenec-dc3", last_training_date: "2024-02-20" },
    ];
    
    const ws = XLSX.utils.json_to_sheet(testData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "TestSheet");
    
    // Write to buffer using binary type
    const buffer = XLSX.write(wb, { type: "binary", bookType: "xlsx" });
    expect(buffer).toBeDefined();
    expect(buffer.length).toBeGreaterThan(0);
    
    // Read it back using binary type
    const readWb = XLSX.read(buffer, { type: "binary" });
    expect(readWb.SheetNames.length).toBeGreaterThan(0);
    
    const readWs = readWb.Sheets["TestSheet"];
    const readData = XLSX.utils.sheet_to_json(readWs);
    
    expect(readData).toHaveLength(2);
    expect(readData[0]).toHaveProperty("employee_number", "EMP001");
    expect(readData[0]).toHaveProperty("training_type_name", "BOZP");
    expect(readData[1]).toHaveProperty("employee_number", "EMP002");
    expect(readData[1]).toHaveProperty("training_type_name", "ATEX");
    expect(readData[0]).toHaveProperty("employee_number", "EMP001");
    expect(readData[0]).toHaveProperty("training_type_name", "BOZP");
    expect(readData[1]).toHaveProperty("employee_number", "EMP002");
    expect(readData[1]).toHaveProperty("training_type_name", "ATEX");
  });

  it("can export workbook to file", () => {
    const testData = [
      { name: "Test Training", date: "2024-01-15" },
    ];
    
    const ws = XLSX.utils.json_to_sheet(testData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Export");
    
    // Generate binary string (simulates file export)
    const xlsxData = XLSX.write(wb, { type: "binary", bookType: "xlsx" });
    expect(xlsxData).toBeDefined();
    expect(xlsxData.length).toBeGreaterThan(0);
  });

  it("handles empty data gracefully", () => {
    const emptyData: any[] = [];
    
    const ws = XLSX.utils.json_to_sheet(emptyData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Empty");
    
    const buffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    expect(buffer).toBeDefined();
    
    const readWb = XLSX.read(buffer, { type: "array" });
    const readData = XLSX.utils.sheet_to_json(readWb.Sheets["Empty"]);
    expect(readData).toHaveLength(0);
  });
});
