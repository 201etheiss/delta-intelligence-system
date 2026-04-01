import { type NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const ALLOWED_TYPES: Record<string, string> = {
  // Documents
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.ms-excel': 'xlsx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'pptx',
  'application/msword': 'docx',
  'application/rtf': 'txt',
  // Text
  'text/csv': 'csv',
  'text/plain': 'txt',
  'text/markdown': 'txt',
  'text/html': 'txt',
  'text/xml': 'txt',
  'text/tab-separated-values': 'csv',
  // Data
  'application/json': 'json',
  'application/xml': 'txt',
  'application/x-yaml': 'txt',
  // Archives
  'application/zip': 'zip',
  'application/x-zip-compressed': 'zip',
  'application/gzip': 'zip',
  'application/x-tar': 'zip',
  'application/x-7z-compressed': 'zip',
  'application/x-rar-compressed': 'zip',
  // Images
  'image/png': 'image',
  'image/jpeg': 'image',
  'image/gif': 'image',
  'image/webp': 'image',
  'image/svg+xml': 'image',
  'image/bmp': 'image',
  'image/tiff': 'image',
  // Catch-all binary
  'application/octet-stream': 'binary',
};

function extFromName(name: string): string {
  return name.split('.').pop()?.toLowerCase() ?? '';
}

function resolveFileType(mimeType: string, fileName: string): string | null {
  if (ALLOWED_TYPES[mimeType]) {
    return ALLOWED_TYPES[mimeType];
  }
  // Fall back to extension for cases where mime is generic (e.g. octet-stream)
  const ext = extFromName(fileName);
  const byExt: Record<string, string> = {
    // Documents
    pdf: 'pdf', docx: 'docx', doc: 'docx', pptx: 'pptx', ppt: 'pptx',
    xlsx: 'xlsx', xls: 'xlsx', rtf: 'txt', odt: 'txt', ods: 'xlsx', odp: 'pptx',
    // Text
    csv: 'csv', tsv: 'csv', txt: 'txt', md: 'txt', log: 'txt',
    html: 'txt', htm: 'txt', xml: 'txt', yaml: 'txt', yml: 'txt', toml: 'txt', ini: 'txt',
    // Data
    json: 'json', jsonl: 'json', geojson: 'json', ndjson: 'json',
    // Code (read as text)
    py: 'txt', js: 'txt', ts: 'txt', jsx: 'txt', tsx: 'txt',
    sql: 'txt', sh: 'txt', bat: 'txt', ps1: 'txt', r: 'txt',
    // Archives
    zip: 'zip', gz: 'zip', tar: 'zip', '7z': 'zip', rar: 'zip', bz2: 'zip',
    // Images
    png: 'image', jpg: 'image', jpeg: 'image', gif: 'image',
    webp: 'image', svg: 'image', bmp: 'image', tiff: 'image', tif: 'image', ico: 'image',
  };
  return byExt[ext] ?? null;
}

async function extractPdf(buffer: Buffer): Promise<string> {
  try {
    const mod = await import('pdf-parse');
    const pdfParse = typeof mod === 'function' ? mod : (mod as { default?: unknown }).default ?? mod;
    if (typeof pdfParse !== 'function') {
      return '[PDF parser unavailable]';
    }
    const result = await (pdfParse as (buf: Buffer) => Promise<{ text: string }>)(buffer);
    return result.text ?? '';
  } catch {
    return '[PDF content could not be fully extracted. The file was uploaded successfully.]';
  }
}

async function extractDocx(buffer: Buffer): Promise<string> {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ buffer });
  return result.value ?? '';
}

async function extractXlsx(buffer: Buffer): Promise<string> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return '';
  const worksheet = workbook.Sheets[firstSheetName];
  if (!worksheet) return '';
  const rows: unknown[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
  return JSON.stringify(rows, null, 2);
}

async function extractPptx(buffer: Buffer): Promise<string> {
  try {
    // Extract text from PPTX using JSZip to read slide XML
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(buffer);
    const slides: string[] = [];
    const slideFiles = Object.keys(zip.files).filter(f => f.match(/^ppt\/slides\/slide\d+\.xml$/)).sort();
    for (const slideFile of slideFiles) {
      const xml = await zip.files[slideFile].async('string');
      // Extract text content from XML tags
      const textMatches = xml.match(/<a:t[^>]*>([^<]+)<\/a:t>/g) ?? [];
      const texts = textMatches.map(m => m.replace(/<[^>]+>/g, '').trim()).filter(Boolean);
      if (texts.length > 0) {
        slides.push(`Slide ${slides.length + 1}: ${texts.join(' | ')}`);
      }
    }
    return slides.join('\n\n');
  } catch {
    return '[PPTX content could not be fully extracted]';
  }
}

async function extractZip(buffer: Buffer): Promise<string> {
  try {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(buffer);
    const fileList = Object.keys(zip.files).filter(f => !f.endsWith('/'));
    const parts: string[] = [`Archive contents (${fileList.length} files):\n`];

    // Extract text from readable files inside the ZIP
    const textExts = new Set(['txt', 'csv', 'json', 'md', 'xml', 'html', 'sql', 'py', 'js', 'ts', 'yaml', 'yml', 'log', 'tsv']);
    let extractedCount = 0;
    for (const fileName of fileList.slice(0, 20)) { // Limit to 20 files
      const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
      if (textExts.has(ext)) {
        try {
          const content = await zip.files[fileName].async('string');
          parts.push(`--- ${fileName} ---`);
          parts.push(content.slice(0, 5000)); // Cap per file
          extractedCount++;
        } catch {
          parts.push(`--- ${fileName} --- [could not extract]`);
        }
      } else {
        parts.push(`  ${fileName} (${ext})`);
      }
    }
    if (fileList.length > 20) {
      parts.push(`\n... and ${fileList.length - 20} more files`);
    }
    if (extractedCount === 0) {
      parts.push('\nNo text-readable files found in archive. File listing provided above.');
    }
    return parts.join('\n');
  } catch {
    return '[ZIP archive could not be extracted]';
  }
}

function extractJson(buffer: Buffer): string {
  try {
    const raw = buffer.toString('utf-8');
    const parsed = JSON.parse(raw);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return buffer.toString('utf-8');
  }
}

function bufferToBase64(buffer: Buffer): string {
  return buffer.toString('base64');
}

export interface UploadedFile {
  name: string;
  type: string;
  content: string;
  size: number;
}

export interface UploadResponse {
  success: boolean;
  files?: UploadedFile[];
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<UploadResponse>> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid multipart form data' }, { status: 400 });
  }

  const rawFiles = formData.getAll('files');
  if (!rawFiles.length) {
    return NextResponse.json({ success: false, error: 'No files provided' }, { status: 400 });
  }

  const results: UploadedFile[] = [];

  for (const entry of rawFiles) {
    if (!(entry instanceof File)) {
      continue;
    }

    const file = entry;

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: `File "${file.name}" exceeds the 10MB size limit` },
        { status: 413 }
      );
    }

    const fileType = resolveFileType(file.type, file.name);
    if (!fileType) {
      return NextResponse.json(
        { success: false, error: `File type not supported for "${file.name}"` },
        { status: 415 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let content: string;
    try {
      switch (fileType) {
        case 'pdf':
          content = await extractPdf(buffer);
          break;
        case 'docx':
          content = await extractDocx(buffer);
          break;
        case 'xlsx':
          content = await extractXlsx(buffer);
          break;
        case 'pptx':
          content = await extractPptx(buffer);
          break;
        case 'json':
          content = extractJson(buffer);
          break;
        case 'csv':
        case 'txt':
          content = buffer.toString('utf-8');
          break;
        case 'zip':
          content = await extractZip(buffer);
          break;
        case 'image':
          content = `data:${file.type};base64,${bufferToBase64(buffer)}`;
          break;
        case 'binary':
          content = `[Binary file: ${file.name}, ${(buffer.length / 1024).toFixed(1)}KB]`;
          break;
        default:
          content = buffer.toString('utf-8').slice(0, 20000); // Attempt text extraction as fallback
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown extraction error';
      return NextResponse.json(
        { success: false, error: `Failed to extract content from "${file.name}": ${message}` },
        { status: 422 }
      );
    }

    results.push({
      name: file.name,
      type: fileType,
      content,
      size: file.size,
    });
  }

  return NextResponse.json({ success: true, files: results });
}
