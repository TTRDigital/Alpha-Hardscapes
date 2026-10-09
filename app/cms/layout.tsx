/** Root layout for the Sanity Studio. The public site is served by app/[[...path]]/route.ts. */
export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
