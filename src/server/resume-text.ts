import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";

/**
 * Extracts plain text from an already-validated resume upload (PDF or
 * DOCX — the only two types validateUpload allows for `kind: "resume"`).
 * The extracted text is what actually gets sent to the LLM; we never send
 * the LLM a raw PDF/DOCX so the same code path works identically across
 * all three providers.
 */
export async function extractResumeText(buffer: Buffer, mimeType: string): Promise<string> {
  if (mimeType === "application/pdf") {
    const parser = new PDFParse({ data: buffer });
    try {
      // pageJoiner: "" — default appends a "-- N of M --" marker per page,
      // which is noise we don't want feeding into the extraction prompt.
      const result = await parser.getText({ pageJoiner: "" });
      return result.text;
    } finally {
      await parser.destroy();
    }
  }

  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}
