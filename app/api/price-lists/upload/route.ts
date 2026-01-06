/**
 * API Route: Upload Tariffe
 *
 * Gestisce caricamento tariffe da:
 * - CSV
 * - Excel (.xlsx, .xls)
 * - PDF (con OCR)
 * - Immagini (screenshot con OCR)
 */

import { auth } from "@/lib/auth-config";
import { existsSync, mkdirSync } from "fs";
import { unlink, writeFile } from "fs/promises";
import { NextRequest, NextResponse } from "next/server";
import path from "path"; // ✅ FIX P0-3: Import path module
import crypto from "crypto"; // ✅ FIX P0-3: For secure random filenames

// Limite upload: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    // Verifica autenticazione
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const priceListId = formData.get("priceListId") as string;
    const sourceType = (formData.get("sourceType") as string) || "manual";

    if (!file) {
      return NextResponse.json({ error: "File mancante" }, { status: 400 });
    }

    // Verifica dimensione
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: `File troppo grande. Massimo ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        },
        { status: 400 }
      );
    }

    // Verifica tipo file
    const fileType = file.type || "";
    const fileName = file.name;
    const fileExtension = fileName.split(".").pop()?.toLowerCase();

    const allowedTypes = [
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/jpg",
    ];

    if (
      !allowedTypes.includes(fileType) &&
      !["csv", "xls", "xlsx", "pdf", "jpg", "jpeg", "png"].includes(
        fileExtension || ""
      )
    ) {
      return NextResponse.json(
        { error: "Tipo file non supportato. Usa CSV, Excel, PDF o immagini" },
        { status: 400 }
      );
    }

    // Salva file temporaneo
    const uploadsDir = path.join(process.cwd(), "uploads", "price-lists");
    if (!existsSync(uploadsDir)) {
      mkdirSync(uploadsDir, { recursive: true });
    }

    // ✅ FIX P0-3: Enhanced filename sanitization
    // Step 1: Rimuovi caratteri pericolosi
    let sanitizedFileName = fileName
      .replace(/[^a-zA-Z0-9.-]/g, "_")
      .replace(/^\.+/, "") // Rimuovi leading dots
      .replace(/\.+/g, "."); // Replace multiple dots con single dot

    // Step 2: Usa solo basename (elimina directory components)
    sanitizedFileName = path.basename(sanitizedFileName);

    // Step 3: Limita lunghezza filename
    if (sanitizedFileName.length > 100) {
      const ext = path.extname(sanitizedFileName);
      const base = path.basename(sanitizedFileName, ext).substring(0, 95);
      sanitizedFileName = base + ext;
    }

    // Step 4: Fallback se nome diventa vuoto
    const safeFileName = sanitizedFileName || `upload-${Date.now()}.dat`;

    // ✅ FIX P0-3: Usa random ID invece di timestamp (previene race condition)
    const randomId = crypto.randomBytes(16).toString("hex");
    const tempFileName = `${randomId}-${safeFileName}`;
    const tempFilePath = path.join(uploadsDir, tempFileName);

    // ✅ FIX P0-3: Verifica che il path finale sia dentro uploadsDir
    const resolvedUploadPath = path.resolve(tempFilePath);
    const resolvedUploadDir = path.resolve(uploadsDir);

    if (!resolvedUploadPath.startsWith(resolvedUploadDir)) {
      console.error(
        `[SECURITY] Path traversal attempt detected: ${fileName} → ${resolvedUploadPath}`
      );
      return NextResponse.json(
        { error: "Invalid filename: path traversal attempt detected" },
        { status: 400 }
      );
    }

    // ✅ FIX P0-3: Verifica che il file non esista già
    if (existsSync(tempFilePath)) {
      console.error(`[SECURITY] File collision detected: ${tempFilePath}`);
      return NextResponse.json(
        { error: "File collision detected, please retry" },
        { status: 500 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // ✅ FIX P0-3: Write atomico con flag 'wx' (fails se file esiste)
    try {
      await writeFile(tempFilePath, buffer, { flag: "wx" });
    } catch (writeError: any) {
      if (writeError.code === "EEXIST") {
        console.error(`[SECURITY] Race condition in file write: ${tempFilePath}`);
        return NextResponse.json(
          { error: "File write collision, please retry" },
          { status: 500 }
        );
      }
      throw writeError;
    }

    // Processa file in base al tipo
    let parsedData: any[] = [];
    let metadata: any = {
      fileName: safeFileName,
      originalFileName: fileName, // Mantieni nome originale per UI (audit fix mitigation)
      fileSize: file.size,
      fileType,
      uploadedAt: new Date().toISOString(),
    };

    try {
      if (fileExtension === "csv") {
        parsedData = await parseCSV(tempFilePath);
      } else if (fileExtension === "xlsx" || fileExtension === "xls") {
        parsedData = await parseExcel(tempFilePath);
      } else if (fileExtension === "pdf") {
        parsedData = await parsePDF(tempFilePath);
        metadata.ocrUsed = true;
      } else if (["jpg", "jpeg", "png"].includes(fileExtension || "")) {
        parsedData = await parseImageOCR(tempFilePath);
        metadata.ocrUsed = true;
      }

      // Pulisci file temporaneo
      await unlink(tempFilePath).catch(() => {});

      return NextResponse.json({
        success: true,
        data: parsedData,
        metadata,
        message: `File processato: ${parsedData.length} righe trovate`,
      });
    } catch (parseError: any) {
      // Pulisci file temporaneo anche in caso di errore
      await unlink(tempFilePath).catch(() => {});

      return NextResponse.json(
        { error: `Errore parsing file: ${parseError.message}` },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Errore upload tariffe:", error);
    return NextResponse.json(
      { error: error.message || "Errore sconosciuto" },
      { status: 500 }
    );
  }
}

/**
 * ✅ FIX P0-4: Sanitize CSV cell per prevenire formula injection
 *
 * Formula injection characters: = + - @ | % (Excel, Google Sheets, LibreOffice)
 */
function sanitizeCSVCell(value: string): string {
  if (!value || typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();

  // Lista di caratteri pericolosi all'inizio della cella
  const dangerousChars = ["=", "+", "-", "@", "|", "%", "\t", "\r"];

  // Se la cella inizia con carattere pericoloso, prefix con apostrofo
  // L'apostrofo disabilita l'esecuzione di formule in Excel/Sheets
  if (dangerousChars.some((char) => trimmed.startsWith(char))) {
    return `'${trimmed}`;
  }

  // Rimuovi carriage return e tab interni (possono causare cell splitting)
  return trimmed.replace(/[\r\t]/g, " ");
}

/**
 * Parse CSV file (CON PROTEZIONE CSV INJECTION)
 * ✅ FIX P0-4: Aggiunta sanitizzazione celle per prevenire formula injection
 */
async function parseCSV(filePath: string): Promise<any[]> {
  const fs = await import("fs/promises");
  const content = await fs.readFile(filePath, "utf-8");

  // ✅ FIX P0-4: Normalize line endings (handle \r\n, \n, \r)
  const normalizedContent = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalizedContent.split("\n").filter((line) => line.trim());

  if (lines.length === 0) return [];

  // Estrai header (sanitizza anche gli headers)
  const headers = lines[0]
    .split(",")
    .map((h) => sanitizeCSVCell(h).trim().toLowerCase());

  // Parse righe
  const rows: any[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim());
    const row: any = {};
    headers.forEach((header, index) => {
      // ✅ FIX P0-4: Sanitize OGNI cella prima di salvarla
      const rawValue = values[index] || "";
      row[header] = sanitizeCSVCell(rawValue);
    });
    if (Object.keys(row).length > 0) {
      rows.push(row);
    }
  }

  return rows;
}

/**
 * Parse Excel file
 */
async function parseExcel(filePath: string): Promise<any[]> {
  try {
    // Usa ExcelJS (alternativa sicura a xlsx)
    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    
    await workbook.xlsx.readFile(filePath);
    
    // Leggi il primo worksheet
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new Error("Nessun worksheet trovato nel file Excel");
    }

    // Converti in array di oggetti
    const data: any[] = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        // Prima riga = header, salta
        return;
      }
      
      const rowData: any = {};
      row.eachCell((cell, colNumber) => {
        const headerCell = worksheet.getRow(1).getCell(colNumber);
        const header = headerCell.value?.toString() || `Column${colNumber}`;
        rowData[header] = cell.value;
      });
      
      if (Object.keys(rowData).length > 0) {
        data.push(rowData);
      }
    });

    return data;
  } catch (error: any) {
    if (error.message.includes("non installata") || error.message.includes("Cannot find module")) {
      throw new Error("Libreria exceljs non installata. Esegui: npm install exceljs");
    }
    throw new Error(`Errore lettura file Excel: ${error.message}`);
  }
}

/**
 * Parse PDF con OCR (semplificato - richiede libreria OCR)
 */
async function parsePDF(filePath: string): Promise<any[]> {
  // TODO: Implementare OCR PDF con Tesseract o Google Vision
  // Per ora restituisce array vuoto
  console.warn("Parsing PDF non ancora implementato completamente");
  return [];
}

/**
 * Parse immagine con OCR
 */
async function parseImageOCR(filePath: string): Promise<any[]> {
  // TODO: Implementare OCR immagini con Tesseract
  // Per ora restituisce array vuoto
  console.warn("OCR immagini non ancora implementato completamente");
  return [];
}
