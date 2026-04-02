const svgCache = new Map();

async function getSvgMarkup(src) {
  if (!src) return null;
  const iconUrl = new URL(src, window.location.origin).href;
  if (!svgCache.has(iconUrl)) {
    svgCache.set(iconUrl, fetch(iconUrl).then((response) => {
      if (!response.ok) throw new Error(`Failed to load SVG: ${iconUrl}`);
      return response.text();
    }));
  }
  return svgCache.get(iconUrl);
}

function buildInlineSvg(markup, sourceImg) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(markup, 'image/svg+xml');
  const svg = doc.querySelector('svg');
  if (!svg) return null;

  const inlineSvg = svg.cloneNode(true);
  const className = sourceImg.getAttribute('class');
  if (className) inlineSvg.setAttribute('class', className);

  const alt = (sourceImg.getAttribute('alt') ?? '').trim();
  if (alt) {
    inlineSvg.setAttribute('role', 'img');
    inlineSvg.setAttribute('aria-label', alt);
  } else {
    inlineSvg.setAttribute('aria-hidden', 'true');
  }

  inlineSvg.setAttribute('focusable', 'false');
  return inlineSvg;
}

export async function applyThemeIcons(root = document) {
  const scope = root instanceof Element || root instanceof Document ? root : document;
  const iconImages = scope.querySelectorAll('img[data-theme-icon]');

  await Promise.all(Array.from(iconImages).map(async (img) => {
    const src = img.getAttribute('src');
    if (!src) return;

    try {
      const markup = await getSvgMarkup(src);
      const inlineSvg = buildInlineSvg(markup, img);
      if (inlineSvg) img.replaceWith(inlineSvg);
    } catch (error) {
      console.warn('Theme icon inline conversion failed:', error);
    }
  }));
}

