interface PptSlidesPreviewItem {
  description?: string;
  imageSrc: string;
  page: number | string;
  title: string;
}

interface BuildPptSlidesPreviewHtmlArgs {
  items: PptSlidesPreviewItem[];
  title: string;
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttribute(value: unknown): string {
  return escapeHtml(value).replace(/"/g, '&quot;');
}

export function buildPptSlidesPreviewHtml({
  items,
  title,
}: BuildPptSlidesPreviewHtmlArgs): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>PPT 导出预览</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0b1020; color: #e5e7eb; margin: 0; padding: 20px; }
    h1 { font-size: 18px; margin: 0 0 16px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 16px; }
    .card { background: #121a2f; border: 1px solid #23304f; border-radius: 10px; overflow: hidden; }
    .meta { padding: 10px 12px; font-size: 12px; line-height: 1.4; }
    .title { color: #7dd3fc; font-weight: 600; margin-bottom: 6px; }
    img { width: 100%; display: block; background: #0f172a; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="grid">
    ${items.map((item) => `
      <div class="card">
        <img src="${escapeAttribute(item.imageSrc)}" alt="${escapeAttribute(item.title)}" />
        <div class="meta">
          <div class="title">第 ${escapeHtml(item.page)} 页 · ${escapeHtml(item.title)}</div>
          <div>${escapeHtml(item.description || '')}</div>
        </div>
      </div>`).join('')}
  </div>
</body>
</html>`;
}
