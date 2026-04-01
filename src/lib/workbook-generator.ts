/**
 * Workbook Generator — Creates real Excel workbooks from gateway queries
 *
 * The AI calls this as a tool during the agentic loop. Instead of returning
 * markdown tables, it builds an actual .xlsx file with multiple sheets,
 * proper headers, numeric formatting, and real data.
 */

import * as XLSX from 'xlsx';
import { gatewayFetch } from '@/lib/gateway';
import { type UserRole } from '@/lib/config/roles';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';

interface WorkbookSheet {
  name: string;
  endpoint: string;
  method: 'GET' | 'POST';
  body?: Record<string, unknown>;
  description?: string;
}

interface WorkbookRequest {
  title: string;
  sheets: WorkbookSheet[];
}

interface WorkbookResult {
  success: boolean;
  fileId?: string;
  fileName?: string;
  downloadUrl?: string;
  sheets?: Array<{ name: string; rows: number; columns: string[] }>;
  error?: string;
}

// Use /tmp for reliability across environments, serve via API
const EXPORT_DIR = join('/tmp', 'di-exports');

export async function generateWorkbook(
  request: WorkbookRequest,
  role: UserRole
): Promise<WorkbookResult> {
  try {
    // Ensure export directory exists
    if (!existsSync(EXPORT_DIR)) {
      mkdirSync(EXPORT_DIR, { recursive: true });
    }

    const wb = XLSX.utils.book_new();
    const sheetInfo: Array<{ name: string; rows: number; columns: string[] }> = [];

    for (const sheet of request.sheets) {
      const safeName = sheet.name.substring(0, 31).replace(/[\\/*?[\]]/g, '_');

      try {
        const result = await gatewayFetch(sheet.endpoint, role, {
          method: sheet.method,
          body: sheet.body,
          timeout: 30000,
        });

        const data = (result as Record<string, unknown>).data;
        if (Array.isArray(data) && data.length > 0) {
          const ws = XLSX.utils.json_to_sheet(data);

          // Auto-width columns
          const colWidths = Object.keys(data[0] as Record<string, unknown>).map(key => {
            const maxLen = Math.max(
              key.length,
              ...data.slice(0, 50).map(row => String((row as Record<string, unknown>)[key] ?? '').length)
            );
            return { wch: Math.min(maxLen + 2, 40) };
          });
          ws['!cols'] = colWidths;

          XLSX.utils.book_append_sheet(wb, ws, safeName);
          sheetInfo.push({
            name: safeName,
            rows: data.length,
            columns: Object.keys(data[0] as Record<string, unknown>),
          });
        } else {
          // Empty result — add sheet with note
          const ws = XLSX.utils.aoa_to_sheet([
            ['No data returned for this query'],
            [sheet.description ?? sheet.endpoint],
          ]);
          XLSX.utils.book_append_sheet(wb, ws, safeName);
          sheetInfo.push({ name: safeName, rows: 0, columns: [] });
        }
      } catch (err) {
        const ws = XLSX.utils.aoa_to_sheet([
          ['Error fetching data'],
          [err instanceof Error ? err.message : 'Unknown error'],
        ]);
        XLSX.utils.book_append_sheet(wb, ws, safeName);
        sheetInfo.push({ name: safeName, rows: 0, columns: [] });
      }
    }

    // Generate unique file ID and save
    const fileId = randomBytes(8).toString('hex');
    const fileName = `${request.title.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50)}_${fileId}.xlsx`;
    const filePath = join(EXPORT_DIR, fileName);

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    writeFileSync(filePath, buf);

    return {
      success: true,
      fileId,
      fileName,
      downloadUrl: `/api/workbooks/download?id=${fileName}`,
      sheets: sheetInfo,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Workbook generation failed',
    };
  }
}

/**
 * Anthropic tool definition for generate_workbook
 */
export const generateWorkbookTool = {
  name: 'generate_workbook',
  description: 'Generate a multi-sheet Excel workbook from gateway data queries. Use this when the user asks for a spreadsheet, Excel file, workbook, or downloadable data export. Each sheet runs a separate query.',
  input_schema: {
    type: 'object' as const,
    properties: {
      title: {
        type: 'string',
        description: 'Title for the workbook (used as filename)',
      },
      sheets: {
        type: 'array',
        description: 'Array of sheets to include. Each sheet runs one gateway query.',
        items: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Sheet name (max 31 chars)',
            },
            endpoint: {
              type: 'string',
              description: 'Gateway endpoint path (e.g. /ascend/query or /ascend/ar/aging)',
            },
            method: {
              type: 'string',
              enum: ['GET', 'POST'],
              description: 'HTTP method',
            },
            body: {
              type: 'object',
              description: 'Request body for POST (e.g. {"sql": "SELECT ..."})',
            },
            description: {
              type: 'string',
              description: 'Human-readable description of what this sheet contains',
            },
          },
          required: ['name', 'endpoint', 'method'],
        },
      },
    },
    required: ['title', 'sheets'],
  },
};
