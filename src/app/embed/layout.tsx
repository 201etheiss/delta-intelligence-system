/**
 * Embed Layout
 *
 * Minimal layout for embeddable widgets — no sidebar, no header.
 * Renders children in a clean, standalone container.
 */
export default function EmbedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="w-full h-screen overflow-hidden">{children}</div>
  );
}
