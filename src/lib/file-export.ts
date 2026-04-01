/**
 * File Export Library for Delta Intelligence
 *
 * Generates real downloadable files from report content:
 * - PDF (via jspdf)
 * - DOCX (via docx package)
 * - XLSX (via xlsx package)
 * - CSV (plain text)
 * - ZIP (bundles multiple files via jszip)
 */

import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, HeadingLevel, BorderStyle, AlignmentType,
  Header, Footer, PageNumber, ShadingType, TabStopType, TabStopPosition,
  convertInchesToTwip,
} from 'docx';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';

// ─── Markdown Table Parser ─────────────────────────────────────────

interface ParsedTable {
  headers: string[];
  rows: string[][];
}

export function parseMarkdownTables(markdown: string): ParsedTable[] {
  const tables: ParsedTable[] = [];
  const lines = markdown.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    if (line.startsWith('|') && line.endsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }
      if (tableLines.length >= 2) {
        const parseLine = (l: string) => l.split('|').slice(1, -1).map(c => c.trim());
        const headers = parseLine(tableLines[0]);
        const isSeparator = /^\|[\s\-:]+(\|[\s\-:]+)+\|?$/.test(tableLines[1]);
        const dataRows = (isSeparator ? tableLines.slice(2) : tableLines.slice(1)).map(parseLine);
        tables.push({ headers, rows: dataRows });
      }
    } else {
      i++;
    }
  }
  return tables;
}

export function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/#{1,6}\s+/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim();
}

// ─── CSV Export ────────────────────────────────────────────────────

export function generateCSV(markdown: string): string {
  const tables = parseMarkdownTables(markdown);
  if (tables.length === 0) return '';

  const parts: string[] = [];
  for (const table of tables) {
    parts.push(table.headers.map(h => `"${stripMarkdown(h)}"`).join(','));
    for (const row of table.rows) {
      parts.push(row.map(c => `"${stripMarkdown(c)}"`).join(','));
    }
    parts.push('');
  }
  return parts.join('\n');
}

// ─── XLSX Export ───────────────────────────────────────────────────

export function generateXLSX(markdown: string, title: string): Buffer {
  const tables = parseMarkdownTables(markdown);
  const wb = XLSX.utils.book_new();

  if (tables.length === 0) {
    const ws = XLSX.utils.aoa_to_sheet([['No table data found in report']]);
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
  } else {
    tables.forEach((table, idx) => {
      const data = [table.headers.map(stripMarkdown), ...table.rows.map(r => r.map(stripMarkdown))];
      const ws = XLSX.utils.aoa_to_sheet(data);
      const sheetName = `Table ${idx + 1}`.substring(0, 31);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });
  }

  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

// ─── DOCX Helpers ─────────────────────────────────────────────────

// Brand constants — Delta360 spec: #FE5000 orange, Georgia headings, Times New Roman body
const DOCX_FONT_BODY = 'Times New Roman';
const DOCX_FONT_HEADING = 'Georgia';
const DOCX_FONT_TABLE = 'Arial';
/** @deprecated Use DOCX_FONT_BODY for paragraphs; kept for legacy PDF/PPTX sections */
const DOCX_FONT = 'Helvetica';
const DOCX_ORANGE = 'FE5000';
const DOCX_BLACK = '000000';
const DOCX_GRAY_BORDER = 'CCCCCC';
const DOCX_LIGHT_GRAY = 'F5F5F5';
const DOCX_WHITE = 'FFFFFF';
const DOCX_TABLE_WIDTH = 9360; // twips — US Letter (12240) minus 2" margins = 10240, minus gutter

/** Parse inline markdown into an array of TextRun objects preserving bold. */
function parseInlineMarkdown(text: string, baseSizeHalf: number, font: string): TextRun[] {
  const runs: TextRun[] = [];
  const parts = text.split(/(\*\*[^*]+\*\*)/);
  for (const part of parts) {
    if (part.startsWith('**') && part.endsWith('**')) {
      runs.push(new TextRun({ text: part.slice(2, -2), bold: true, size: baseSizeHalf, font }));
    } else if (part.length > 0) {
      runs.push(new TextRun({ text: part, size: baseSizeHalf, font }));
    }
  }
  return runs;
}

/** Build a section-bar heading paragraph (orange bottom-border, Georgia font). */
function makeSectionHeading(text: string, level: 1 | 2 | 3): Paragraph {
  if (level === 1) {
    return new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 360, after: 120 },
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 8, color: DOCX_ORANGE, space: 4 },
      },
      children: [new TextRun({ text, bold: true, size: 36, font: DOCX_FONT_HEADING, color: DOCX_BLACK })],
    });
  }
  if (level === 2) {
    return new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 280, after: 100 },
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 4, color: DOCX_ORANGE, space: 4 },
      },
      children: [new TextRun({ text, bold: true, size: 28, font: DOCX_FONT_HEADING, color: DOCX_BLACK })],
    });
  }
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 80 },
    children: [new TextRun({ text, bold: true, size: 24, font: DOCX_FONT_HEADING, color: DOCX_BLACK })],
  });
}

/** Build an institutional table from headers + rows arrays. */
function makeInstitutionalTable(headers: string[], dataRows: string[][]): Table {
  const colWidth = Math.floor(DOCX_TABLE_WIDTH / Math.max(headers.length, 1));
  const cellMargins = { top: 60, bottom: 60, left: 100, right: 100, marginUnitType: WidthType.DXA };

  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map(h => new TableCell({
      children: [new Paragraph({
        spacing: { before: 20, after: 20 },
        children: [new TextRun({ text: stripMarkdown(h), bold: true, size: 20, font: DOCX_FONT_TABLE, color: DOCX_WHITE })],
      })],
      width: { size: colWidth, type: WidthType.DXA },
      shading: { fill: DOCX_ORANGE, type: ShadingType.CLEAR, color: 'auto' },
      margins: cellMargins,
    })),
  });

  const bodyRows = dataRows.map((row, ri) => new TableRow({
    children: row.map(cell => new TableCell({
      children: [new Paragraph({
        spacing: { before: 20, after: 20 },
        children: parseInlineMarkdown(cell, 20, DOCX_FONT_TABLE),
        alignment: /^\$|^\d|^[+-]/.test(cell.trim()) ? AlignmentType.RIGHT : AlignmentType.LEFT,
      })],
      width: { size: colWidth, type: WidthType.DXA },
      shading: ri % 2 === 0
        ? { fill: DOCX_WHITE, type: ShadingType.CLEAR, color: 'auto' }
        : { fill: DOCX_LIGHT_GRAY, type: ShadingType.CLEAR, color: 'auto' },
      margins: cellMargins,
    })),
  }));

  return new Table({
    rows: [headerRow, ...bodyRows],
    width: { size: DOCX_TABLE_WIDTH, type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: DOCX_GRAY_BORDER },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: DOCX_GRAY_BORDER },
      left: { style: BorderStyle.SINGLE, size: 1, color: DOCX_GRAY_BORDER },
      right: { style: BorderStyle.SINGLE, size: 1, color: DOCX_GRAY_BORDER },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: DOCX_GRAY_BORDER },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: DOCX_GRAY_BORDER },
    },
  });
}

/** Build a cover-page block for institutional reports. */
function makeCoverPage(title: string, subtitle: string, dateStr: string, preparedBy = 'Delta Intelligence'): Paragraph[] {
  return [
    new Paragraph({
      spacing: { after: 800 },
      children: [
        new TextRun({ text: 'DELTA360', bold: true, size: 28, font: DOCX_FONT_HEADING, color: DOCX_ORANGE }),
      ],
    }),
    new Paragraph({
      spacing: { after: 1200 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: DOCX_ORANGE, space: 4 } },
      children: [],
    }),
    new Paragraph({
      spacing: { after: 240 },
      children: [new TextRun({ text: title, bold: true, size: 64, font: DOCX_FONT_HEADING, color: DOCX_BLACK })],
    }),
    new Paragraph({
      spacing: { after: 200 },
      children: [new TextRun({ text: subtitle, size: 28, font: DOCX_FONT_BODY, color: '555555' })],
    }),
    new Paragraph({ spacing: { after: 1600 }, children: [] }),
    new Paragraph({
      spacing: { after: 80 },
      children: [new TextRun({ text: `Prepared by: ${preparedBy}`, size: 22, font: DOCX_FONT_BODY, color: '555555' })],
    }),
    new Paragraph({
      spacing: { after: 80 },
      children: [new TextRun({ text: `Date: ${dateStr}`, size: 22, font: DOCX_FONT_BODY, color: '555555' })],
    }),
    new Paragraph({
      spacing: { after: 200 },
      children: [new TextRun({ text: 'CONFIDENTIAL', bold: true, size: 22, font: DOCX_FONT_BODY, color: DOCX_ORANGE })],
    }),
  ];
}

// ─── DOCX Export ──────────────────────────────────────────────────

export type DocxTemplate =
  | 'executive-summary'
  | 'financial-analysis'
  | 'operations'
  | 'intelligence-briefing'
  | 'default';

/**
 * Parse markdown lines into Paragraph/Table children for the document body.
 * Uses institutional typography: Georgia headings, Times New Roman body.
 */
function parseMarkdownBody(markdown: string): (Paragraph | Table)[] {
  const lines = markdown.split('\n');
  const children: (Paragraph | Table)[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    // Headings — Georgia font with orange section bars
    if (line.startsWith('### ')) {
      children.push(makeSectionHeading(stripMarkdown(line.replace(/^###\s+/, '')), 3));
      i++; continue;
    }
    if (line.startsWith('## ')) {
      children.push(makeSectionHeading(stripMarkdown(line.replace(/^##\s+/, '')), 2));
      i++; continue;
    }
    if (line.startsWith('# ')) {
      children.push(makeSectionHeading(stripMarkdown(line.replace(/^#\s+/, '')), 1));
      i++; continue;
    }

    // Tables with institutional styling
    if (line.startsWith('|') && line.endsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }
      if (tableLines.length >= 2) {
        const parseLine = (l: string) => l.split('|').slice(1, -1).map(c => c.trim());
        const headers = parseLine(tableLines[0]);
        const isSep = /^\|[\s\-:]+(\|[\s\-:]+)+\|?$/.test(tableLines[1]);
        const dataRows = (isSep ? tableLines.slice(2) : tableLines.slice(1)).map(parseLine);
        children.push(makeInstitutionalTable(headers, dataRows));
        children.push(new Paragraph({ spacing: { after: 160 }, children: [] }));
      }
      continue;
    }

    // Horizontal rule
    if (line === '---' || line === '***') {
      children.push(new Paragraph({
        spacing: { before: 120, after: 120 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: DOCX_GRAY_BORDER, space: 4 } },
        children: [],
      }));
      i++; continue;
    }

    // Bullet points
    if (/^[-*]\s+/.test(line)) {
      const bulletText = line.replace(/^[-*]\s+/, '');
      children.push(new Paragraph({
        spacing: { before: 40, after: 40 },
        indent: { left: convertInchesToTwip(0.4), hanging: convertInchesToTwip(0.2) },
        children: [
          new TextRun({ text: '\u2022  ', size: 22, font: DOCX_FONT_BODY }),
          ...parseInlineMarkdown(bulletText, 22, DOCX_FONT_BODY),
        ],
      }));
      i++; continue;
    }

    // Numbered list
    if (/^\d+\.\s+/.test(line)) {
      const numMatch = line.match(/^(\d+)\.\s+(.*)/);
      const num = numMatch?.[1] ?? '';
      const numText = numMatch?.[2] ?? line;
      children.push(new Paragraph({
        spacing: { before: 40, after: 40 },
        indent: { left: convertInchesToTwip(0.4), hanging: convertInchesToTwip(0.2) },
        children: [
          new TextRun({ text: `${num}.  `, bold: true, size: 22, font: DOCX_FONT_BODY }),
          ...parseInlineMarkdown(numText, 22, DOCX_FONT_BODY),
        ],
      }));
      i++; continue;
    }

    // Empty line
    if (!line) {
      children.push(new Paragraph({ spacing: { after: 100 }, children: [] }));
      i++; continue;
    }

    // Regular paragraph — Times New Roman 11pt
    children.push(new Paragraph({
      spacing: { after: 100, line: 276, lineRule: 'auto' },
      children: parseInlineMarkdown(line, 22, DOCX_FONT_BODY),
    }));
    i++;
  }

  return children;
}

export async function generateDOCX(
  markdown: string,
  title: string,
  template: DocxTemplate = 'default',
): Promise<Buffer> {
  const cleanTitle = stripMarkdown(title);
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  // ── Build cover page based on template ──
  const coverChildren: (Paragraph | Table)[] = (() => {
    switch (template) {
      case 'executive-summary':
        return makeCoverPage(cleanTitle, 'Executive Summary Report', dateStr);
      case 'financial-analysis':
        return makeCoverPage(cleanTitle, 'Financial Analysis Report', dateStr);
      case 'operations':
        return makeCoverPage(cleanTitle, 'Operations Report', dateStr);
      case 'intelligence-briefing':
        return makeCoverPage(cleanTitle, 'Intelligence Briefing', dateStr);
      default:
        return [];
    }
  })();

  const hasCover = coverChildren.length > 0;

  // ── Default header block (used when no cover, or after cover) ──
  const defaultHeaderBlock: (Paragraph | Table)[] = hasCover ? [] : [
    new Paragraph({
      spacing: { after: 40 },
      children: [
        new TextRun({ text: 'DELTA360', bold: true, size: 22, font: DOCX_FONT_HEADING, color: DOCX_ORANGE }),
        new TextRun({ text: `    ${dateStr}`, size: 18, font: DOCX_FONT_BODY, color: '71717A' }),
      ],
    }),
    new Paragraph({
      spacing: { after: 200 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: DOCX_ORANGE, space: 4 } },
      children: [],
    }),
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 120 },
      children: [new TextRun({ text: cleanTitle, bold: true, size: 48, font: DOCX_FONT_HEADING, color: DOCX_BLACK })],
    }),
    new Paragraph({
      spacing: { after: 240 },
      children: [new TextRun({
        text: `Generated by Delta Intelligence | ${dateStr}`,
        size: 18, color: '71717A', font: DOCX_FONT_BODY, italics: true,
      })],
    }),
  ];

  // ── Parse markdown body ──
  const bodyChildren = parseMarkdownBody(markdown);

  // ── All content children ──
  const allChildren: (Paragraph | Table)[] = [
    ...defaultHeaderBlock,
    ...bodyChildren,
  ];

  // ── Build document sections ──
  // If cover page exists, put it in its own section so it gets a page break
  const pageMargins = {
    top: convertInchesToTwip(1),
    bottom: convertInchesToTwip(1),
    left: convertInchesToTwip(1),
    right: convertInchesToTwip(1),
  };

  const headerParagraph = new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: DOCX_ORANGE, space: 4 } },
    children: [
      new TextRun({ text: 'DELTA360', bold: true, size: 16, font: DOCX_FONT_HEADING, color: DOCX_ORANGE }),
      new TextRun({ text: `\t${cleanTitle}`, size: 14, font: DOCX_FONT_BODY, color: '71717A' }),
    ],
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
  });

  const footerParagraph = new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { before: 80 },
    border: { top: { style: BorderStyle.SINGLE, size: 1, color: DOCX_GRAY_BORDER, space: 4 } },
    children: [
      new TextRun({ text: 'Delta Intelligence  |  Confidential', size: 14, font: DOCX_FONT_BODY, color: 'A1A1AA' }),
      new TextRun({ text: '\tPage ', size: 14, font: DOCX_FONT_BODY, color: 'A1A1AA' }),
      new TextRun({ children: [PageNumber.CURRENT], size: 14, font: DOCX_FONT_BODY, color: 'A1A1AA' }),
      new TextRun({ text: ' of ', size: 14, font: DOCX_FONT_BODY, color: 'A1A1AA' }),
      new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 14, font: DOCX_FONT_BODY, color: 'A1A1AA' }),
    ],
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
  });

  const sections = hasCover
    ? [
        // Cover section — no header/footer
        {
          properties: { page: { margin: pageMargins } },
          children: coverChildren,
        },
        // Body section — with header/footer
        {
          properties: { page: { margin: pageMargins } },
          headers: { default: new Header({ children: [headerParagraph] }) },
          footers: { default: new Footer({ children: [footerParagraph] }) },
          children: allChildren,
        },
      ]
    : [
        {
          properties: { page: { margin: pageMargins } },
          headers: { default: new Header({ children: [headerParagraph] }) },
          footers: { default: new Footer({ children: [footerParagraph] }) },
          children: allChildren,
        },
      ];

  const doc = new Document({
    creator: 'Delta Intelligence',
    title: cleanTitle,
    description: `${cleanTitle} - Generated by Delta Intelligence, Delta360 Enterprise AI Platform`,
    sections,
  });

  return Buffer.from(await Packer.toBuffer(doc));
}

// ─── Typed export interfaces for templates ─────────────────────────

export interface ReportOptions {
  template?: DocxTemplate;
  depth?: 'summary' | 'detailed' | 'comprehensive';
  dateRange?: { from: string; to: string };
}

// ─── PDF Export (real PDF via jspdf) ───────────────────────────────

export async function generatePDF(markdown: string, title: string): Promise<Buffer> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const maxWidth = pageWidth - margin * 2;
  let y = 20;

  const checkPage = (needed: number) => {
    if (y + needed > doc.internal.pageSize.getHeight() - 15) {
      doc.addPage();
      y = 15;
    }
  };

  // Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(stripMarkdown(title), margin, y);
  y += 10;

  // Subtitle line
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(113, 113, 122);
  doc.text(`Delta Intelligence Export — ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, margin, y);
  y += 4;
  doc.setDrawColor(228, 228, 231);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;
  doc.setTextColor(9, 9, 11);

  // Parse content line by line
  const lines = markdown.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    // Skip empty lines
    if (!line) { y += 3; i++; continue; }

    // Headings
    if (line.startsWith('### ')) {
      checkPage(10);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(stripMarkdown(line.slice(4)), margin, y);
      y += 7;
      doc.setFont('helvetica', 'normal');
      i++; continue;
    }
    if (line.startsWith('## ')) {
      checkPage(12);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(stripMarkdown(line.slice(3)), margin, y);
      y += 8;
      doc.setFont('helvetica', 'normal');
      i++; continue;
    }
    if (line.startsWith('# ')) {
      checkPage(14);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(stripMarkdown(line.slice(2)), margin, y);
      y += 10;
      doc.setFont('helvetica', 'normal');
      i++; continue;
    }

    // Horizontal rule
    if (/^[-*]{3,}$/.test(line)) {
      checkPage(6);
      doc.setDrawColor(228, 228, 231);
      doc.line(margin, y, pageWidth - margin, y);
      y += 6;
      i++; continue;
    }

    // Tables
    if (line.startsWith('|') && line.endsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }
      if (tableLines.length >= 2) {
        const parseLine = (l: string) => l.split('|').slice(1, -1).map(c => stripMarkdown(c.trim()));
        const headers = parseLine(tableLines[0]);
        const isSep = /^\|[\s\-:]+(\|[\s\-:]+)+\|?$/.test(tableLines[1]);
        const dataRows = (isSep ? tableLines.slice(2) : tableLines.slice(1)).map(parseLine);

        const colWidth = maxWidth / headers.length;
        const rowHeight = 6;

        checkPage(rowHeight * (dataRows.length + 2));

        // Header
        doc.setFillColor(244, 244, 245);
        doc.rect(margin, y - 4, maxWidth, rowHeight, 'F');
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        headers.forEach((h, ci) => {
          doc.text(h.slice(0, 20), margin + ci * colWidth + 2, y);
        });
        y += rowHeight;

        // Data rows
        doc.setFont('helvetica', 'normal');
        for (const row of dataRows) {
          checkPage(rowHeight);
          row.forEach((cell, ci) => {
            doc.text(cell.slice(0, 25), margin + ci * colWidth + 2, y);
          });
          y += rowHeight - 1;
          doc.setDrawColor(244, 244, 245);
          doc.line(margin, y - 1, pageWidth - margin, y - 1);
        }
        y += 4;
      }
      continue;
    }

    // Bullet points
    if (/^[-*•]\s/.test(line)) {
      checkPage(6);
      doc.setFontSize(10);
      const text = stripMarkdown(line.replace(/^[-*•]\s+/, ''));
      const wrapped = doc.splitTextToSize(text, maxWidth - 8);
      doc.text('•', margin, y);
      doc.text(wrapped, margin + 5, y);
      y += wrapped.length * 5;
      i++; continue;
    }

    // Numbered items
    if (/^\d+\.\s/.test(line)) {
      checkPage(6);
      doc.setFontSize(10);
      const num = line.match(/^(\d+)\./)?.[1] ?? '';
      const text = stripMarkdown(line.replace(/^\d+\.\s+/, ''));
      const wrapped = doc.splitTextToSize(text, maxWidth - 10);
      doc.text(`${num}.`, margin, y);
      doc.text(wrapped, margin + 8, y);
      y += wrapped.length * 5;
      i++; continue;
    }

    // Regular text
    checkPage(6);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const cleaned = stripMarkdown(line);
    const wrapped = doc.splitTextToSize(cleaned, maxWidth);
    doc.text(wrapped, margin, y);
    y += wrapped.length * 5;
    i++;
  }

  // Footer on each page
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(161, 161, 170);
    doc.text(`Delta Intelligence — Page ${p} of ${pageCount}`, margin, doc.internal.pageSize.getHeight() - 8);
    doc.text(new Date().toLocaleDateString(), pageWidth - margin - 20, doc.internal.pageSize.getHeight() - 8);
  }

  return Buffer.from(doc.output('arraybuffer'));
}

// ─── Legacy PDF Export (HTML fallback) ────────────────────────────

export function generatePDFHtml(markdown: string, title: string): string {
  // Convert markdown to HTML for print-to-PDF
  let html = markdown
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code style="background:#f4f4f5;padding:1px 4px;border-radius:3px;font-size:12px">$1</code>')
    .replace(/^### (.+)$/gm, '<h3 style="margin:16px 0 8px;font-size:16px;font-weight:600">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="margin:20px 0 8px;font-size:18px;font-weight:600">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="margin:24px 0 12px;font-size:22px;font-weight:700">$1</h1>')
    .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid #e4e4e7;margin:16px 0">')
    .replace(/^\d+\.\s+(.+)$/gm, '<div style="margin-left:20px;margin-bottom:4px">$&</div>');

  // Tables
  html = html.replace(/(?:^|\n)((?:\|.+\|\n?)+)/gm, (_m, block: string) => {
    const rows = block.trim().split('\n');
    if (rows.length < 2) return block;
    const parseLine = (l: string) => l.split('|').slice(1, -1).map(c => c.trim());
    const isSep = /^\|[\s\-:]+(\|[\s\-:]+)+\|?$/.test(rows[1]);
    const headers = parseLine(rows[0]);
    const dataRows = (isSep ? rows.slice(2) : rows.slice(1)).map(parseLine);
    const thCells = headers.map(h => `<th style="padding:6px 10px;text-align:left;font-weight:600;background:#f4f4f5;border:1px solid #e4e4e7;font-size:12px">${h}</th>`).join('');
    const bodyRows = dataRows.map((r, i) => {
      const bg = i % 2 === 1 ? 'background:#fafafa;' : '';
      return `<tr>${r.map(c => `<td style="padding:6px 10px;border:1px solid #e4e4e7;font-size:12px;${bg}">${c}</td>`).join('')}</tr>`;
    }).join('');
    return `<table style="width:100%;border-collapse:collapse;margin:12px 0"><thead><tr>${thCells}</tr></thead><tbody>${bodyRows}</tbody></table>`;
  });

  // Paragraphs
  html = html.split('\n\n').map(block => {
    if (block.startsWith('<h') || block.startsWith('<table') || block.startsWith('<hr') || block.startsWith('<div')) return block;
    return `<p style="margin:8px 0;line-height:1.5">${block.replace(/\n/g, '<br>')}</p>`;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${stripMarkdown(title)} — Delta Intelligence</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', sans-serif; font-size: 14px; color: #09090b; max-width: 800px; margin: 0 auto; padding: 40px; }
  @media print {
    body { padding: 20px; }
    @page { margin: 1in; }
  }
</style>
</head>
<body>
<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #FE5000">
  <div>
    <div style="font-size:10px;color:#71717a;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Delta Intelligence Report</div>
    <h1 style="font-size:20px;font-weight:700;margin:0">${stripMarkdown(title)}</h1>
  </div>
  <div style="text-align:right;font-size:11px;color:#71717a">
    <div>Generated: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
    <div>Delta360</div>
  </div>
</div>
${html}
<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e4e4e7;font-size:10px;color:#a1a1aa;text-align:center">
  Generated by Delta Intelligence — Delta360 Enterprise AI Platform
</div>
</body>
</html>`;
}

// ─── ZIP Bundle ───────────────────────────────────────────────────

interface ZipEntry {
  filename: string;
  content: Buffer | string;
}

export async function generateZIP(entries: ZipEntry[]): Promise<Buffer> {
  const zip = new JSZip();
  for (const entry of entries) {
    zip.file(entry.filename, entry.content);
  }
  const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  return Buffer.from(buf);
}
