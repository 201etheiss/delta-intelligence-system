import UploadZone from '@/components/documents/UploadZone';
import RecentUploads from '@/components/documents/RecentUploads';

export const metadata = {
  title: 'Documents — Delta Intelligence',
  description: 'Upload documents and ask questions about them',
};

export default function DocumentsPage() {
  return (
    <div className="px-5 py-4 space-y-4 overflow-y-auto h-full bg-white dark:bg-[#09090B]">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <h2 className="text-lg font-bold text-[#09090B] dark:text-white">Document Intelligence</h2>
          <p className="mt-0.5 text-sm text-[#71717A] dark:text-[#A1A1AA]">
            Upload documents and ask questions about them
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
          {/* Upload zone — takes more space */}
          <div className="lg:col-span-3">
            <UploadZone />
          </div>

          {/* Supported formats info */}
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#18181B] p-3.5">
              <h3 className="text-xs font-semibold text-[#09090B] dark:text-white mb-2">Supported Formats</h3>
              <div className="space-y-2">
                {[
                  { ext: 'PDF', desc: 'Full text extraction' },
                  { ext: 'DOCX', desc: 'Word document parsing' },
                  { ext: 'XLSX / CSV', desc: 'Spreadsheet data' },
                  { ext: 'PPTX', desc: 'Slide text extraction' },
                  { ext: 'TXT / JSON', desc: 'Raw text / structured data' },
                  { ext: 'PNG / JPG', desc: 'Visual analysis ready' },
                  { ext: 'ZIP', desc: 'Archive contents listing' },
                ].map((f) => (
                  <div key={f.ext} className="flex items-center justify-between py-1">
                    <span className="text-xs font-mono text-[#FF5C00]">{f.ext}</span>
                    <span className="text-xs text-[#71717A]">{f.desc}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-[#E4E4E7] dark:border-[#27272A]">
                <p className="text-[11px] text-[#71717A]">
                  Max 10 MB per file. Content is extracted and made available to the AI chat.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Recent uploads listing */}
        <div className="mt-8">
          <RecentUploads />
        </div>
      </div>
    </div>
  );
}
