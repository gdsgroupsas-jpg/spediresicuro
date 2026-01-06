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
import { join } from "path";

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
    const uploadsDir = join(process.cwd(), "uploads", "price-lists");
    if (!existsSync(uploadsDir)) {
      mkdirSync(uploadsDir, { recursive: true });
    }

    // Sanitize filename (Fix Audit P0)
    // Rimuove caratteri non sicuri e previene path traversal
    const sanitizedFileName = fileName
      .replace(/[^a-zA-Z0-9.-]/g, "_")
      .replace(/^_+/, "");
    const safeFileName = sanitizedFileName || `upload-${Date.now()}.dat`; // Fallback se nome diventa vuoto

    const timestamp = Date.now();
    const tempFileName = `${timestamp}-${safeFileName}`;
    const tempFilePath = join(uploadsDir, tempFileName);

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(tempFilePath, buffer);

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
 * Parse CSV file
 */
async function parseCSV(filePath: string): Promise<any[]> {
  const fs = await import("fs/promises");
  const content = await fs.readFile(filePath, "utf-8");
  const lines = content.split("\n").filter((line) => line.trim());

  if (lines.length === 0) return [];

  // Estrai header
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());

  // Parse righe
  const rows: any[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim());
    const row: any = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || "";
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
    // Prova a importare xlsx, se non disponibile usa fallback
    let XLSX: any;
    try {
      XLSX = await import("xlsx");
    } catch {
      throw new Error("Libreria xlsx non installata. Esegui: npm install xlsx");
    }

    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    return data as any[];
  } catch (error: any) {
    if (error.message.includes("non installata")) {
      throw error;
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
