import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  generateCSV,
  generateXLSX,
  generateDOCX,
  generatePDF,
  generatePDFHtml,
  generateZIP,
  stripMarkdown,
  parseMarkdownTables,
} from '@/lib/file-export';
import { ReportExportSchema, validateRequest } from '@/lib/validation';

interface ExportRequest {
  reports: Array<{
    title: string;
    content: string; // markdown
  }>;
  format: 'csv' | 'xlsx' | 'docx' | 'pdf' | 'pptx' | 'md' | 'txt' | 'json' | 'html';
  bundle?: boolean; // if true and multiple reports, return ZIP
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const raw = await request.json();
    const validated = validateRequest(ReportExportSchema, raw);
    if (!validated.success) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }
    const body = validated.data as ExportRequest;
    const { reports, format, bundle } = body;

    // Generate all file contents
    const entries: Array<{ filename: string; content: Buffer | string }> = [];
    for (const report of reports) {
      const safeName = stripMarkdown(report.title).replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50);
      const ext = getExtension(format);
      const fileContent = await generateFileContent(report.content, report.title, format);
      entries.push({ filename: `${safeName}.${ext}`, content: fileContent });
    }

    // Single report — return file directly
    if (entries.length === 1 && !bundle) {
      const entry = entries[0];
      const contentType = getContentType(format);
      const buf = typeof entry.content === 'string' ? Buffer.from(entry.content) : entry.content;
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename="${entry.filename}"`,
        },
      });
    }

    // Multiple reports — ZIP bundle
    const zipBuffer = await generateZIP(entries);
    return new NextResponse(new Uint8Array(zipBuffer), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="delta-intelligence-reports.zip"`,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Export failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function getExtension(format: string): string {
  const map: Record<string, string> = {
    csv: 'csv', xlsx: 'xlsx', docx: 'docx', pdf: 'pdf',
    pptx: 'pptx', md: 'md', txt: 'txt', json: 'json', html: 'html',
  };
  return map[format] ?? 'txt';
}

function getContentType(format: string): string {
  const map: Record<string, string> = {
    csv: 'text/csv',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    pdf: 'application/pdf',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    md: 'text/markdown',
    txt: 'text/plain',
    json: 'application/json',
    html: 'text/html',
  };
  return map[format] ?? 'application/octet-stream';
}

async function generateFileContent(markdown: string, title: string, format: string): Promise<Buffer | string> {
  switch (format) {
    case 'csv':
      return generateCSV(markdown);
    case 'xlsx':
      return generateXLSX(markdown, title);
    case 'docx':
      return await generateDOCX(markdown, title);
    case 'pdf':
      return await generatePDF(markdown, title);
    case 'html':
      return generatePDFHtml(markdown, title);
    case 'md':
      return `# ${stripMarkdown(title)}\n\n${markdown}`;
    case 'txt':
      return stripMarkdown(markdown);
    case 'json': {
      const tables = parseMarkdownTables(markdown);
      return JSON.stringify({ title: stripMarkdown(title), tables, generatedAt: new Date().toISOString() }, null, 2);
    }
    case 'pptx':
      return await generatePPTX(markdown, title);
    default:
      return markdown;
  }
}

const PPTX_FONT = 'Helvetica';
const PPTX_ORANGE = 'FF5C00';
const PPTX_BLACK = '09090B';
const PPTX_GRAY = '71717A';
const PPTX_LIGHT_GRAY = 'F4F4F5';

/** Add a branded footer bar with slide number to every content slide. */
function addSlideFooter(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  slide: any,
  slideNum: number,
  totalSlides: number,
): void {
  // Bottom orange rule
  slide.addShape('rect', {
    x: 0, y: 5.15, w: 10, h: 0.03, fill: { color: PPTX_ORANGE },
  });
  // Footer text
  slide.addText(
    [
      { text: 'Delta Intelligence', options: { fontSize: 8, color: PPTX_GRAY, fontFace: PPTX_FONT, bold: true } },
      { text: `   |   Slide ${slideNum} of ${totalSlides}`, options: { fontSize: 8, color: 'A1A1AA', fontFace: PPTX_FONT } },
    ],
    { x: 0.4, y: 5.18, w: 9.2, h: 0.3 },
  );
}

/** Parse section content into bullet lines and table blocks. */
function parseSectionBlocks(content: string): { bullets: string[]; tableHeaders: string[]; tableRows: string[][] } {
  const bullets: string[] = [];
  let tableHeaders: string[] = [];
  let tableRows: string[][] = [];
  const contentLines = content.split('\n');
  let li = 0;

  while (li < contentLines.length) {
    const cl = contentLines[li].trim();
    // Table block
    if (cl.startsWith('|') && cl.endsWith('|')) {
      const tLines: string[] = [];
      while (li < contentLines.length && contentLines[li].trim().startsWith('|')) {
        tLines.push(contentLines[li].trim());
        li++;
      }
      if (tLines.length >= 2) {
        const parseLine = (l: string) => l.split('|').slice(1, -1).map(c => stripMarkdown(c.trim()));
        tableHeaders = parseLine(tLines[0]);
        const isSep = /^\|[\s\-:]+/.test(tLines[1] ?? '');
        tableRows = (isSep ? tLines.slice(2) : tLines.slice(1)).map(parseLine).slice(0, 12);
      }
      continue;
    }
    // Bullet or numbered
    if (/^[-*]\s+/.test(cl) || /^\d+\.\s+/.test(cl)) {
      bullets.push(stripMarkdown(cl.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, '')));
    } else if (cl.length > 0 && !cl.startsWith('#')) {
      bullets.push(stripMarkdown(cl));
    }
    li++;
  }

  return { bullets, tableHeaders, tableRows };
}

async function generatePPTX(markdown: string, title: string): Promise<Buffer> {
  const PptxGenJS = (await import('pptxgenjs')).default;
  const pptx = new PptxGenJS();
  const cleanTitle = stripMarkdown(title);
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  pptx.author = 'Delta Intelligence';
  pptx.company = 'Delta360';
  pptx.title = cleanTitle;
  pptx.subject = `${cleanTitle} - Delta Intelligence Report`;
  pptx.layout = 'LAYOUT_WIDE';

  // ── Title slide ──
  const titleSlide = pptx.addSlide();
  titleSlide.background = { color: PPTX_BLACK };
  // Orange accent bar at top
  titleSlide.addShape('rect', {
    x: 0, y: 0, w: 13.33, h: 0.06, fill: { color: PPTX_ORANGE },
  });
  // Main title
  titleSlide.addText(cleanTitle, {
    x: 0.8, y: 1.8, w: 11.5, h: 1.8,
    fontSize: 32, bold: true, color: 'FFFFFF', fontFace: PPTX_FONT,
    wrap: true,
  });
  // Subtitle label
  titleSlide.addText('Delta Intelligence Report', {
    x: 0.8, y: 3.8, w: 11.5, h: 0.5,
    fontSize: 16, color: PPTX_ORANGE, fontFace: PPTX_FONT, bold: true,
  });
  // Date
  titleSlide.addText(dateStr, {
    x: 0.8, y: 4.35, w: 11.5, h: 0.4,
    fontSize: 13, color: 'A1A1AA', fontFace: PPTX_FONT,
  });
  // Bottom bar
  titleSlide.addShape('rect', {
    x: 0, y: 7.0, w: 13.33, h: 0.06, fill: { color: PPTX_ORANGE },
  });
  // Attribution
  titleSlide.addText('Delta360 Enterprise AI Platform', {
    x: 0.8, y: 6.5, w: 11.5, h: 0.4,
    fontSize: 10, color: '52525B', fontFace: PPTX_FONT,
  });

  // ── Parse content into sections ──
  const sections = markdown.split(/^##\s+/gm).filter(Boolean);

  // Pre-calculate total slides for footer numbering: title + content slides
  const totalSlides = 1 + sections.length;
  let slideNum = 1;

  for (const section of sections) {
    const sectionLines = section.split('\n');
    const sectionTitle = stripMarkdown(sectionLines[0]?.trim() ?? '');
    const sectionContent = sectionLines.slice(1).join('\n').trim();
    const { bullets, tableHeaders, tableRows } = parseSectionBlocks(sectionContent);

    slideNum++;
    const slide = pptx.addSlide();

    // Section title
    slide.addText(sectionTitle, {
      x: 0.5, y: 0.25, w: 12, h: 0.65,
      fontSize: 22, bold: true, color: PPTX_BLACK, fontFace: PPTX_FONT,
    });

    // Orange accent bar
    slide.addShape('rect', {
      x: 0.5, y: 0.9, w: 2, h: 0.04, fill: { color: PPTX_ORANGE },
    });

    // Table content
    if (tableHeaders.length > 0) {
      // Header row with orange background, white text
      const headerRowCells = tableHeaders.map(h => ({
        text: h,
        options: { fontSize: 10, fontFace: PPTX_FONT, color: 'FFFFFF', bold: true, fill: { color: PPTX_ORANGE } },
      }));
      // Data rows with alternating shading
      const dataRowCells = tableRows.map((row, ri) =>
        row.map(cell => ({
          text: cell,
          options: {
            fontSize: 10,
            fontFace: PPTX_FONT,
            color: '27272A',
            fill: { color: ri % 2 === 0 ? 'FFFFFF' : PPTX_LIGHT_GRAY },
          },
        }))
      );

      const allRows = [headerRowCells, ...dataRowCells];
      const colW = tableHeaders.map(() => 11.5 / tableHeaders.length);

      slide.addTable(allRows, {
        x: 0.5, y: 1.15, w: 11.5,
        border: { type: 'solid', pt: 0.5, color: 'D4D4D8' },
        colW,
        autoPage: false,
        margin: [4, 6, 4, 6],
      });

      // Add bullet text below table if any
      if (bullets.length > 0) {
        const bulletText = bullets.slice(0, 4).map(b => ({ text: `  \u2022  ${b}\n`, options: { fontSize: 11, fontFace: PPTX_FONT, color: '52525B', breakType: 'none' as const } }));
        const tableHeight = 0.3 * (tableRows.length + 1) + 1.15;
        slide.addText(bulletText, {
          x: 0.5, y: Math.min(tableHeight + 0.2, 4.0), w: 11.5, h: 1.5,
          valign: 'top', wrap: true,
        });
      }
    } else if (bullets.length > 0) {
      // Bullet-only slide
      const bulletText = bullets.slice(0, 10).map(b => ({
        text: `  \u2022  ${b}\n`,
        options: { fontSize: 13, fontFace: PPTX_FONT, color: '27272A', breakType: 'none' as const, lineSpacingMultiple: 1.4 },
      }));
      slide.addText(bulletText, {
        x: 0.5, y: 1.15, w: 11.5, h: 3.8,
        valign: 'top', wrap: true,
      });
    } else {
      // Plain text fallback
      const textContent = stripMarkdown(sectionContent).substring(0, 1000);
      slide.addText(textContent, {
        x: 0.5, y: 1.15, w: 11.5, h: 3.8,
        fontSize: 13, color: '52525B', fontFace: PPTX_FONT,
        valign: 'top', wrap: true, lineSpacingMultiple: 1.3,
      });
    }

    // Slide footer with number
    addSlideFooter(slide, slideNum, totalSlides);
  }

  const buf = await pptx.write({ outputType: 'nodebuffer' });
  return Buffer.from(buf as ArrayBuffer);
}
