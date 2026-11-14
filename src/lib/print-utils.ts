/**
 * Wait for the self-hosted Noto Sans Bengali variable font before opening
 * the browser print dialog. This keeps Bengali and Latin glyphs consistent
 * in exported PDFs, including offline/PWA use after the app shell is cached.
 */
export async function waitForNotoReportFont(doc: Document = document): Promise<void> {
  try {
    if (!doc.fonts) return;

    const sample = 'ভূমি ও আমিন দখল পরিমাপ BHOA 0123456789';
    await Promise.all([
      doc.fonts.load('400 12px "Noto Sans Bengali"', sample),
      doc.fonts.load('700 12px "Noto Sans Bengali"', sample),
      doc.fonts.load('900 12px "Noto Sans Bengali"', sample),
    ]);
    await doc.fonts.ready;
  } catch {
    // If a very old browser does not support FontFaceSet, still allow printing
    // with its Unicode-capable system fallback.
  }
}

export async function printWithNoto(): Promise<void> {
  await waitForNotoReportFont();
  window.print();
}
