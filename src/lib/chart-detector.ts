/**
 * Chart detection utility — parses markdown tables and suggests chart types.
 */

export interface ParsedTable {
  headers: string[];
  rows: string[][];
  numericColumns: number[];
}

export interface ChartSuggestion {
  type: 'bar' | 'horizontal-bar' | 'sparkline' | 'donut' | 'progress' | 'line' | 'stacked-bar';
  table: ParsedTable;
  labelColumn: number;
  valueColumns: number[];
}

export interface DetectionResult {
  tables: ParsedTable[];
  suggestions: ChartSuggestion[];
}

/**
 * Strip markdown formatting from a cell value (bold, italic, links, emojis)
 */
function stripMarkdown(val: string): string {
  return val
    .replace(/\*\*(.+?)\*\*/g, '$1')     // **bold** → bold
    .replace(/\*([^*]+)\*/g, '$1')         // *italic* → italic
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [text](url) → text
    .replace(/[\u2600-\u26FF\u2700-\u27BF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDEFF]|\uD83E[\uDD00-\uDFFF]/g, '') // strip emojis
    .trim();
}

function isNumericValue(val: string): boolean {
  const cleaned = val.replace(/\*\*/g, '').replace(/[$,%()]/g, '').replace(/,/g, '').trim();
  if (!cleaned) return false;
  return !isNaN(Number(cleaned));
}

function parseNumericValue(val: string): number {
  const cleaned = val.replace(/\*\*/g, '').replace(/[$,%()]/g, '').replace(/,/g, '').trim();
  const num = Number(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Check if a row is a summary/total row that should be excluded from charts
 */
function isSummaryRow(row: string[], labelCol: number): boolean {
  const label = (row[labelCol] ?? '').toLowerCase().trim();
  return /^(total|grand total|subtotal|sum|all|overall|combined|aggregate|active pipeline total)/.test(label)
    || label.endsWith(' total')
    || label.startsWith('total ');
}

function parseMarkdownTable(tableBlock: string): ParsedTable | null {
  const lines = tableBlock.trim().split('\n').filter(Boolean);
  if (lines.length < 2) return null;

  const parseLine = (line: string): string[] =>
    line.split('|').slice(1, -1).map((c) => stripMarkdown(c));

  const headers = parseLine(lines[0]);
  if (headers.length < 2) return null;

  // Check for separator row
  const isSeparator = /^\|[\s\-:]+(\|[\s\-:]+)+\|?$/.test(lines[1]);
  const dataStartIdx = isSeparator ? 2 : 1;
  const rows = lines.slice(dataStartIdx).map(parseLine);

  if (rows.length === 0) return null;

  // Identify numeric columns: a column is numeric if >60% of non-empty cells are numbers
  const numericColumns: number[] = [];
  for (let col = 0; col < headers.length; col++) {
    let numericCount = 0;
    let totalNonEmpty = 0;
    for (const row of rows) {
      const cell = row[col] ?? '';
      if (cell.trim()) {
        totalNonEmpty++;
        if (isNumericValue(cell)) numericCount++;
      }
    }
    if (totalNonEmpty > 0 && numericCount / totalNonEmpty > 0.6) {
      numericColumns.push(col);
    }
  }

  return { headers, rows, numericColumns };
}

function suggestChartType(table: ParsedTable): ChartSuggestion | null {
  const { headers, numericColumns, rows } = table;
  if (numericColumns.length === 0) return null;

  // Find the best label column (first non-numeric column)
  const labelColumn = headers.findIndex((_, i) => !numericColumns.includes(i));
  if (labelColumn === -1) return null;

  // Skip chart suggestion for financial statements — these are best as tables
  const allLabels = rows.map(r => (r[labelColumn] ?? '').toLowerCase()).join(' ');
  const headerStr = headers.join(' ').toLowerCase();
  const isFinancialStatement =
    /\b(total assets|total liabilities|equity|retained earnings|balance sheet|income statement)\b/.test(allLabels) ||
    /\b(assets|liabilities|equity|debit|credit|beg\s*bal|end\s*bal)\b/.test(headerStr);
  if (isFinancialStatement) return null;

  // Skip if too many rows with zero values (section headers in financial data)
  const zeroCount = rows.filter(r => numericColumns.every(c => parseNumericValue(r[c] ?? '0') === 0)).length;
  if (zeroCount > rows.length * 0.3) return null;

  const valueColumns = numericColumns;
  const rowCount = table.rows.length;

  // Time-series detection: label column looks like dates/months/years
  const firstLabel = (table.rows[0]?.[labelColumn] ?? '').toLowerCase();
  const isTimeSeries =
    /^\d{4}/.test(firstLabel) ||
    /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(firstLabel) ||
    /^q[1-4]/i.test(firstLabel) ||
    /^\d{1,2}\/\d{1,2}/.test(firstLabel);

  // Single numeric column with few rows and proportional data -> donut
  if (valueColumns.length === 1 && rowCount >= 2 && rowCount <= 8) {
    const values = table.rows.map((r) => parseNumericValue(r[valueColumns[0]] ?? '0'));
    const allPositive = values.every((v) => v >= 0);
    const headerLower = headers[valueColumns[0]].toLowerCase();
    const isProportional =
      headerLower.includes('%') ||
      headerLower.includes('share') ||
      headerLower.includes('portion') ||
      headerLower.includes('mix') ||
      allPositive;

    if (isProportional && !isTimeSeries) {
      return { type: 'donut', table, labelColumn, valueColumns };
    }
  }

  // Time series with multiple value columns -> line chart
  if (isTimeSeries && valueColumns.length >= 2 && rowCount >= 3) {
    return { type: 'line', table, labelColumn, valueColumns };
  }

  // Time series with single value -> sparkline
  if (isTimeSeries && rowCount >= 3) {
    return { type: 'sparkline', table, labelColumn, valueColumns };
  }

  // Multiple value columns with few categories -> stacked bar
  if (valueColumns.length >= 2 && rowCount >= 2 && rowCount <= 12) {
    return { type: 'stacked-bar', table, labelColumn, valueColumns };
  }

  // Many rows -> horizontal bar (easier to read)
  if (rowCount > 6) {
    return { type: 'horizontal-bar', table, labelColumn, valueColumns };
  }

  // Default -> vertical bar
  return { type: 'bar', table, labelColumn, valueColumns };
}

/**
 * Detects chartable markdown tables in raw markdown content.
 * Returns parsed tables and chart type suggestions.
 */
export function detectChartableData(markdown: string): DetectionResult {
  const tables: ParsedTable[] = [];
  const suggestions: ChartSuggestion[] = [];

  // Find markdown table blocks (lines starting with |)
  const tablePattern = /(?:^|\n)((?:\|.+\|\n?)+)/gm;
  let match: RegExpExecArray | null;

  while ((match = tablePattern.exec(markdown)) !== null) {
    const parsed = parseMarkdownTable(match[1]);
    if (parsed && parsed.numericColumns.length > 0) {
      tables.push(parsed);
      const suggestion = suggestChartType(parsed);
      if (suggestion) {
        suggestions.push(suggestion);
      }
    }
  }

  return { tables, suggestions };
}

export { parseNumericValue, isSummaryRow };
