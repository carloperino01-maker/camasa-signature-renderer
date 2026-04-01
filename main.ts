import http from "http";
import fs from "fs";
import path from "path";

import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

chromium.use(StealthPlugin());

const port = Number(process.env.PORT || 8080);
const __dirname = process.cwd();


type RenderPayload = {
  projectId?: string;
  signatureCode?: string;
  documentType?: string;
  clientName?: string;
  projectName?: string;
  material?: string;
  location?: string;
  issueDate?: string;
};

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function hashCode(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function guessMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}

function assetToDataUri(relativePath: string): string | null {
  try {
    const filePath = path.join(__dirname, relativePath);
    if (!fs.existsSync(filePath)) return null;
    const buffer = fs.readFileSync(filePath);
    const mime = guessMimeType(filePath);
    return `data:${mime};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

function buildPseudoQrSvg(value: string): string {
  const seed = hashCode(value || "camasa");
  const size = 29;
  const cell = 6;
  const pad = 12;

  const isFinder = (x: number, y: number) => {
    const inTopLeft = x < 7 && y < 7;
    const inTopRight = x > size - 8 && y < 7;
    const inBottomLeft = x < 7 && y > size - 8;
    return inTopLeft || inTopRight || inBottomLeft;
  };

  const finderFill = (x: number, y: number) => {
    const localX = x < 7 ? x : x > size - 8 ? x - (size - 7) : x;
    const localY = y < 7 ? y : y > size - 8 ? y - (size - 7) : y;

    return (
      localX === 0 ||
      localX === 6 ||
      localY === 0 ||
      localY === 6 ||
      (localX >= 2 && localX <= 4 && localY >= 2 && localY <= 4)
    );
  };

  let rects = "";

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let fill = false;

      if (isFinder(x, y)) {
        fill = finderFill(x, y);
      } else {
        const n = (seed + x * 31 + y * 17 + x * y * 13) % 11;
        fill = n < 5;
      }

      if (fill) {
        rects += `<rect x="${pad + x * cell}" y="${pad + y * cell}" width="${cell}" height="${cell}" rx="1" ry="1" fill="#f3e7cf" />`;
      }
    }
  }

  const total = pad * 2 + size * cell;

  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="${total}" viewBox="0 0 ${total} ${total}">
    <rect width="${total}" height="${total}" rx="18" fill="#0b0b12"/>
    <rect x="4" y="4" width="${total - 8}" height="${total - 8}" rx="16" fill="none" stroke="rgba(197,165,114,0.55)" stroke-width="2"/>
    ${rects}
  </svg>`;
}

function buildIconSvg(kind: string): string {
  const stroke = "#d8bf8a";
  const common = `stroke="${stroke}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"`;
  const size = 28;

  const map: Record<string, string> = {
    material: `<path ${common} d="M6 9l8-4 8 4-8 4-8-4zm0 0v8l8 4 8-4V9" />`,
    category: `<path ${common} d="M6 7h16v14H6z" /><path ${common} d="M10 11h8M10 15h5" />`,
    blocks: `<path ${common} d="M7 7h6v6H7zM15 7h6v6h-6zM11 15h6v6h-6z" />`,
    preserve: `<path ${common} d="M14 5c4 3 7 5 7 9a7 7 0 1 1-14 0c0-4 3-6 7-9z" />`,
    protect: `<path ${common} d="M14 5l7 3v5c0 4-3 7-7 9-4-2-7-5-7-9V8l7-3z" />`,
    revisit: `<path ${common} d="M20 12a6 6 0 1 0 1.2 4" /><path ${common} d="M20 6v6h-6" />`,
    check: `<path ${common} d="M6 14l5 5 11-11" />`,
    play: `<path ${common} d="M10 8l8 6-8 6z" />`,
    circle: `<circle ${common} cx="14" cy="14" r="8" />`,
    clock: `<circle ${common} cx="14" cy="14" r="8" /><path ${common} d="M14 10v5l3 2" />`,
    project: `<path ${common} d="M7 20h14" /><path ${common} d="M9 20V9l5-3 5 3v11" />`,
    measure: `<path ${common} d="M6 18l12-12 4 4-12 12H6z" /><path ${common} d="M14 8l4 4" />`,
    finish: `<path ${common} d="M8 18c2-6 5-9 11-11-2 6-5 9-11 11z" />`,
    install: `<path ${common} d="M7 20h14" /><path ${common} d="M9 20V9l5-3 5 3v11" /><path ${common} d="M12 14h4" />`,
    final: `<path ${common} d="M7 14l4 4 10-10" />`,
    warning: `<path ${common} d="M14 6l8 14H6L14 6z" /><path ${common} d="M14 11v4M14 18h.01" />`,
  };

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 28 28" aria-hidden="true">
      ${map[kind] || map.category}
    </svg>
  `;
}

function buildLogoMarkup(logoDataUri: string | null, small = false): string {
  if (logoDataUri) {
    return `<img class="logo-real ${small ? "small" : ""}" src="${logoDataUri}" alt="CPS Camasa Process System" />`;
  }

  return `
    <div class="logo-fallback ${small ? "small" : ""}">
      <div class="logo-fallback-top">CPS <span>CAMASA</span></div>
      <div class="logo-fallback-bottom">Process System</div>
    </div>
  `;
}

function buildHtml(data: RenderPayload): string {
  const signatureCode = escapeHtml(data.signatureCode || "CSB-20260331-2344-XBGE");
  const documentType = escapeHtml(data.documentType || "Camasa Signature Book");
  const clientName = escapeHtml(data.clientName || "Ana");
  const projectName = escapeHtml(data.projectName || "Bancada em L");
  const material = escapeHtml(data.material || "Granito Verde Ubatuba");
  const location = escapeHtml(data.location || "São Paulo, SP");
  const issueDate = escapeHtml(data.issueDate || new Date().toLocaleDateString("pt-BR"));
  const projectId = escapeHtml(data.projectId || "600059b1-85f8-4ca1-81dc-ed5339a8a812");

  const qrSvg = buildPseudoQrSvg(`${signatureCode}|${projectId}|${clientName}`);
  const logoDataUri = assetToDataUri("assets/logotipo-camasa-process-system.jpg");
  const textureDataUri = assetToDataUri("assets/camasa-signature-book-completo.jpg");

  const logoMain = buildLogoMarkup(logoDataUri, false);
  const logoSmall = buildLogoMarkup(logoDataUri, true);

  const textureCss = textureDataUri
    ? `background-image: url('${textureDataUri}');`
    : `background:
         radial-gradient(circle at 15% 10%, rgba(255,255,255,0.06), transparent 18%),
         radial-gradient(circle at 82% 17%, rgba(199,165,105,0.08), transparent 18%),
         linear-gradient(180deg, rgba(8,8,12,0.88), rgba(15,15,22,0.94)),
         #090a0e;`;

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>${documentType}</title>
  <style>
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    :root {
      --bg: #0a0b10;
      --panel: rgba(18, 18, 24, 0.88);
      --panel-2: rgba(24, 24, 31, 0.94);
      --gold: #c7a569;
      --gold-2: #dfc58d;
      --line: rgba(199, 165, 105, 0.22);
      --line-strong: rgba(199, 165, 105, 0.42);
      --text: #f3e7d3;
      --muted: rgba(243, 231, 211, 0.72);
      --soft: rgba(243, 231, 211, 0.52);
      --shadow: 0 24px 70px rgba(0, 0, 0, 0.42);
      --ok: #96b084;
      --danger: #b86f64;
    }

    html, body {
      margin: 0;
      padding: 0;
      background: #171717;
      color: var(--text);
      font-family: Arial, Helvetica, sans-serif;
    }

    .page {
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      position: relative;
      overflow: hidden;
      page-break-after: always;
      background: #090a0e;
    }

    .texture {
      position: absolute;
      inset: 0;
      ${textureCss}
      background-size: cover;
      background-position: center;
      opacity: ${textureDataUri ? "0.14" : "1"};
      filter: ${textureDataUri ? "saturate(0.35) contrast(1.02) brightness(0.52)" : "none"};
      pointer-events: none;
    }

    .overlay {
      position: absolute;
      inset: 0;
      background:
        radial-gradient(circle at 22% 12%, rgba(255,255,255,0.05), transparent 16%),
        radial-gradient(circle at 76% 18%, rgba(199,165,105,0.08), transparent 18%),
        radial-gradient(circle at 52% 78%, rgba(255,255,255,0.03), transparent 20%),
        linear-gradient(180deg, rgba(7,8,12,0.72), rgba(10,10,16,0.88));
      pointer-events: none;
    }

    .grain {
      position: absolute;
      inset: 0;
      background:
        linear-gradient(115deg, rgba(255,255,255,0.04) 0%, transparent 18%, transparent 82%, rgba(255,255,255,0.03) 100%);
      opacity: 0.55;
      pointer-events: none;
    }

    .vein-a,
    .vein-b,
    .vein-c {
      position: absolute;
      background: linear-gradient(90deg, transparent, rgba(199,165,105,0.78), transparent);
      opacity: 0.16;
      filter: blur(0.4px);
      pointer-events: none;
    }

    .vein-a { width: 2px; height: 150%; right: 18mm; top: -18mm; transform: rotate(18deg); }
    .vein-b { width: 2px; height: 136%; right: 26mm; top: -12mm; transform: rotate(18deg); opacity: 0.11; }
    .vein-c { width: 2px; height: 122%; right: 34mm; top: -6mm; transform: rotate(18deg); opacity: 0.07; }

    .page-frame {
      position: absolute;
      inset: 10mm;
      border: 1px solid rgba(199,165,105,0.16);
      pointer-events: none;
    }

    .content {
      position: relative;
      z-index: 3;
      padding: 14mm 15mm 12mm;
    }

    .logo-real {
      width: 108mm;
      max-width: 100%;
      display: block;
      object-fit: contain;
      filter: drop-shadow(0 10px 28px rgba(0,0,0,0.48));
    }

    .logo-real.small {
      width: 72mm;
    }

    .logo-fallback {
      display: inline-flex;
      flex-direction: column;
      gap: 6px;
      color: #f3e7cf;
      text-shadow: 0 10px 24px rgba(0,0,0,0.5);
    }

    .logo-fallback.small {
      transform: scale(0.82);
      transform-origin: left top;
    }

    .logo-fallback-top {
      font-size: 30px;
      font-weight: 700;
      letter-spacing: 2px;
      color: #e8dcc5;
    }

    .logo-fallback-top span {
      color: var(--gold-2);
      font-size: 18px;
      margin-left: 8px;
      vertical-align: middle;
    }

    .logo-fallback-bottom {
      font-size: 18px;
      color: rgba(243,231,211,0.78);
      letter-spacing: 1px;
    }

    .cover-wrap {
      min-height: 268mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: center;
      text-align: center;
    }

    .cover-top {
      width: 100%;
      display: flex;
      justify-content: flex-start;
    }

    .cover-middle {
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      margin-top: 6mm;
    }

    .line {
      width: 86px;
      height: 2px;
      background: linear-gradient(90deg, rgba(199,165,105,0.28), var(--gold), rgba(199,165,105,0.28));
      margin: 14px auto 20px;
      box-shadow: 0 0 12px rgba(199,165,105,0.18);
    }

    .cover-title {
      font-size: 24px;
      line-height: 1.34;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin: 0 0 8px;
      color: #f7eddc;
    }

    .cover-subtitle {
      font-size: 12px;
      letter-spacing: 1.8px;
      text-transform: uppercase;
      color: var(--muted);
      margin-bottom: 24px;
    }

    .hero-project {
      font-size: 18px;
      color: #fff3de;
      margin-bottom: 8px;
    }

    .hero-client,
    .hero-location {
      font-size: 13px;
      color: var(--muted);
      margin-bottom: 4px;
    }

    .qr-box {
      margin-top: 18px;
      margin-bottom: 14px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
    }

    .code-pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 260px;
      padding: 10px 18px;
      border-radius: 10px;
      border: 1px solid rgba(199,165,105,0.38);
      background: rgba(255,255,255,0.03);
      color: #f7ebd6;
      font-size: 14px;
      letter-spacing: 0.9px;
      box-shadow: var(--shadow);
    }

    .issued {
      font-size: 10px;
      letter-spacing: 1.6px;
      text-transform: uppercase;
      color: rgba(242,231,210,0.56);
    }

    .page-title {
      font-size: 19px;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin: 0 0 6px;
      color: #f6ebd8;
    }

    .page-subtitle {
      font-size: 12px;
      line-height: 1.55;
      color: var(--muted);
      margin: 0 0 16px;
    }

    .headline-project {
      font-size: 17px;
      color: #fff2da;
      margin: 0 0 8px;
    }

    .headline-copy {
      font-size: 11px;
      line-height: 1.55;
      color: rgba(242,231,210,0.68);
      max-width: 520px;
      margin-bottom: 14px;
    }

    .card {
      background:
        linear-gradient(180deg, rgba(28,28,36,0.88), rgba(16,16,22,0.92));
      border: 1px solid var(--line);
      border-radius: 14px;
      box-shadow: var(--shadow);
      overflow: hidden;
    }

    .card.soft {
      background:
        linear-gradient(180deg, rgba(24,24,31,0.82), rgba(13,13,19,0.90));
    }

    .card-pad {
      padding: 14px;
    }

    .section-kicker {
      font-size: 10px;
      letter-spacing: 1.6px;
      text-transform: uppercase;
      color: var(--gold-2);
      margin-bottom: 8px;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr 1.2fr;
      gap: 10px;
      margin-bottom: 10px;
    }

    .stat-box {
      min-height: 108px;
      padding: 14px;
    }

    .stat-icon {
      width: 38px;
      height: 38px;
      border-radius: 12px;
      border: 1px solid rgba(199,165,105,0.30);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--gold-2);
      background: rgba(255,255,255,0.02);
      box-shadow: inset 0 0 0 1px rgba(255,255,255,0.015);
      margin-bottom: 12px;
    }

    .stat-icon svg,
    .care-icon svg,
    .stage-dot svg,
    .step-icon svg,
    .bullet-mark svg {
      width: 18px;
      height: 18px;
      display: block;
    }

    .stat-label {
      font-size: 10px;
      line-height: 1.35;
      color: rgba(242,231,210,0.72);
      text-transform: uppercase;
      letter-spacing: 1.2px;
      min-height: 28px;
    }

    .stat-value {
      font-size: 28px;
      color: #fff4dd;
      margin-top: 10px;
      line-height: 1;
    }

    .progress-card {
      padding: 14px;
      min-height: 108px;
    }

    .progress-head {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: center;
    }

    .mini-donut {
      width: 82px;
      height: 82px;
      border-radius: 50%;
      background: conic-gradient(var(--gold) 0 38%, rgba(255,255,255,0.08) 38% 100%);
      position: relative;
      box-shadow: inset 0 0 0 1px rgba(199,165,105,0.24);
    }

    .mini-donut::before {
      content: "";
      position: absolute;
      inset: 12px;
      border-radius: 50%;
      background: #0f1015;
      box-shadow: inset 0 0 0 1px rgba(199,165,105,0.20);
    }

    .mini-donut span {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      font-weight: 700;
      color: #fff3dd;
      z-index: 2;
    }

    .meta-list {
      font-size: 11px;
      line-height: 1.65;
      color: var(--muted);
    }

    .summary-grid {
      display: grid;
      grid-template-columns: 1.08fr 0.92fr;
      gap: 10px;
    }

    .distribution-card,
    .material-card-large {
      min-height: 130px;
    }

    .dist-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
      color: #f5ead6;
      margin-bottom: 8px;
    }

    .bar {
      height: 8px;
      border-radius: 999px;
      background: rgba(255,255,255,0.08);
      overflow: hidden;
      position: relative;
    }

    .bar::after {
      content: "";
      position: absolute;
      inset: 0;
      width: 100%;
      background: linear-gradient(90deg, #8f7a50, #c7a569);
    }

    .material-grid {
      display: grid;
      grid-template-columns: 94px 1fr;
      gap: 12px;
      align-items: stretch;
    }

    .stone-sample {
      min-height: 96px;
      border-radius: 10px;
      border: 1px solid rgba(199,165,105,0.22);
      background:
        radial-gradient(circle at 22% 26%, rgba(216,228,200,0.25), transparent 16%),
        radial-gradient(circle at 68% 36%, rgba(121,156,122,0.18), transparent 14%),
        radial-gradient(circle at 38% 68%, rgba(255,255,255,0.08), transparent 18%),
        linear-gradient(135deg, #2c3b2f 0%, #141b14 42%, #0d100d 100%);
      box-shadow: inset 0 0 0 1px rgba(255,255,255,0.02);
    }

    .photo-sample {
      min-height: 158px;
      border-radius: 10px;
      border: 1px solid rgba(199,165,105,0.22);
      background:
        linear-gradient(180deg, rgba(0,0,0,0.12), rgba(0,0,0,0.42)),
        linear-gradient(135deg, #c6b89d 0%, #8a735c 38%, #3c3027 100%);
      box-shadow: inset 0 0 0 1px rgba(255,255,255,0.02);
      position: relative;
      overflow: hidden;
    }

    .photo-sample::before {
      content: "";
      position: absolute;
      inset: 0;
      background:
        linear-gradient(90deg, rgba(20,20,20,0.26) 0 18%, transparent 18% 78%, rgba(10,10,10,0.32) 78% 100%);
      opacity: 0.55;
    }

    .photo-sample::after {
      content: "";
      position: absolute;
      left: 26%;
      right: 8%;
      bottom: 14%;
      height: 14px;
      background: linear-gradient(180deg, #1d1d22, #0f1015);
      border-radius: 4px;
      box-shadow: 0 8px 20px rgba(0,0,0,0.35);
    }

    .donut-layout {
      display: grid;
      grid-template-columns: 1.1fr 0.9fr;
      gap: 12px;
      align-items: start;
    }

    .big-ring-card {
      padding: 14px;
      min-height: 230px;
    }

    .big-ring-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2px 0 8px;
    }

    .big-ring {
      width: 196px;
      height: 196px;
      border-radius: 50%;
      background: conic-gradient(var(--gold) 0 38%, rgba(255,255,255,0.09) 38% 100%);
      position: relative;
      box-shadow: inset 0 0 0 1px rgba(199,165,105,0.24);
    }

    .big-ring::before {
      content: "";
      position: absolute;
      inset: 24px;
      border-radius: 50%;
      background: #101017;
      box-shadow: inset 0 0 0 1px rgba(199,165,105,0.18);
    }

    .big-ring-center {
      position: absolute;
      inset: 0;
      z-index: 2;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
    }

    .big-percent {
      font-size: 40px;
      line-height: 1;
      color: #fff4df;
      margin-bottom: 6px;
    }

    .big-copy {
      font-size: 11px;
      line-height: 1.5;
      color: rgba(242,231,210,0.70);
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .stage-side {
      display: grid;
      gap: 10px;
    }

    .stage-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 11px 12px;
      border: 1px solid var(--line);
      border-radius: 12px;
      background: rgba(255,255,255,0.02);
      box-shadow: inset 0 0 0 1px rgba(255,255,255,0.01);
    }

    .stage-dot {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      border: 1px solid rgba(199,165,105,0.44);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: var(--gold-2);
      flex: 0 0 18px;
    }

    .stage-dot svg {
      width: 10px;
      height: 10px;
    }

    .stage-title {
      font-size: 10px;
      letter-spacing: 1.2px;
      text-transform: uppercase;
      color: rgba(242,231,210,0.68);
    }

    .stage-value {
      font-size: 16px;
      color: #fff2dc;
      margin-top: 2px;
    }

    .timeline-card {
      margin-top: 12px;
      padding: 14px;
    }

    .timeline-label {
      font-size: 10px;
      letter-spacing: 1.4px;
      text-transform: uppercase;
      color: var(--gold-2);
      margin-bottom: 12px;
    }

    .timeline {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 6px;
      align-items: start;
    }

    .step {
      text-align: center;
      position: relative;
    }

    .step:not(:last-child)::after {
      content: "";
      position: absolute;
      top: 13px;
      left: 60%;
      right: -40%;
      height: 1px;
      background: rgba(199,165,105,0.34);
    }

    .step-icon {
      width: 26px;
      height: 26px;
      border-radius: 50%;
      margin: 0 auto 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid rgba(199,165,105,0.36);
      background: rgba(255,255,255,0.025);
      color: var(--gold-2);
      box-shadow: inset 0 0 0 1px rgba(255,255,255,0.01);
    }

    .step-icon svg {
      width: 12px;
      height: 12px;
    }

    .step.done .step-icon {
      border-color: rgba(156,184,143,0.48);
      background: rgba(156,184,143,0.10);
    }

    .step.active .step-icon {
      box-shadow: 0 0 0 4px rgba(199,165,105,0.10), inset 0 0 0 1px rgba(255,255,255,0.02);
    }

    .step-label {
      font-size: 10px;
      color: rgba(242,231,210,0.80);
    }

    .split-two {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .bullet-card {
      min-height: 178px;
      padding: 16px;
    }

    .bullet-card.ok {
      border-color: rgba(156,184,143,0.24);
    }

    .bullet-card.no {
      border-color: rgba(189,114,102,0.24);
    }

    .bullet-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: #fff0d8;
      margin-bottom: 12px;
    }

    .bullet-mark {
      width: 18px;
      height: 18px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: var(--gold-2);
    }

    .bullet-mark svg {
      width: 16px;
      height: 16px;
    }

    ul.clean {
      margin: 0;
      padding-left: 18px;
      font-size: 12px;
      line-height: 1.66;
      color: rgba(242,231,210,0.78);
    }

    .alert-card {
      margin-top: 12px;
      padding: 14px 16px;
    }

    .care-main {
      padding: 16px;
    }

    .care-title {
      font-size: 18px;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: #fff1d7;
      margin-bottom: 8px;
    }

    .care-copy {
      font-size: 12px;
      line-height: 1.68;
      color: rgba(242,231,210,0.75);
    }

    .care-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-top: 16px;
    }

    .care-item {
      padding: 14px 12px;
      text-align: center;
      min-height: 116px;
    }

    .care-icon {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      margin: 0 auto 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid rgba(199,165,105,0.38);
      color: var(--gold-2);
      background: rgba(255,255,255,0.02);
    }

    .care-item-title {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #f7ebd3;
      margin-bottom: 8px;
    }

    .care-item-copy {
      font-size: 11px;
      line-height: 1.58;
      color: rgba(242,231,210,0.72);
    }

    .cta {
      margin-top: 14px;
      padding: 12px 14px;
      border-radius: 12px;
      border: 1px solid rgba(199,165,105,0.34);
      background: rgba(255,255,255,0.03);
      font-size: 12px;
      color: rgba(242,231,210,0.82);
      box-shadow: inset 0 0 0 1px rgba(255,255,255,0.01);
    }

    .cert-wrap {
      min-height: 264mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    .cert-card {
      position: relative;
      padding: 16mm 15mm;
      border: 1px solid rgba(199,165,105,0.32);
      background:
        linear-gradient(180deg, rgba(27,27,34,0.88), rgba(15,15,22,0.94));
      box-shadow: var(--shadow);
    }

    .cert-corner {
      position: absolute;
      width: 22px;
      height: 22px;
      border-color: rgba(199,165,105,0.54);
      border-style: solid;
    }

    .cert-corner.tl { top: 10px; left: 10px; border-width: 2px 0 0 2px; }
    .cert-corner.tr { top: 10px; right: 10px; border-width: 2px 2px 0 0; }
    .cert-corner.bl { bottom: 10px; left: 10px; border-width: 0 0 2px 2px; }
    .cert-corner.br { bottom: 10px; right: 10px; border-width: 0 2px 2px 0; }

    .cert-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 20px;
      margin-bottom: 22px;
    }

    .cert-title {
      font-size: 18px;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin: 14px 0 6px;
      color: #fff2db;
    }

    .cert-sub {
      font-size: 10px;
      letter-spacing: 1.3px;
      text-transform: uppercase;
      color: rgba(242,231,210,0.66);
    }

    .cert-code {
      font-size: 28px;
      color: #fff4de;
      line-height: 1.2;
      margin: 20px 0 16px;
    }

    .cert-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px 18px;
      margin-bottom: 18px;
    }

    .cert-label {
      font-size: 10px;
      letter-spacing: 1.2px;
      text-transform: uppercase;
      color: var(--gold-2);
      margin-bottom: 5px;
    }

    .cert-value {
      font-size: 14px;
      color: #f8eedc;
      word-break: break-word;
    }

    .cert-copy {
      font-size: 12px;
      line-height: 1.75;
      color: rgba(242,231,210,0.78);
      margin-bottom: 18px;
    }

    .serial {
      font-size: 10px;
      color: rgba(242,231,210,0.42);
      word-break: break-all;
      line-height: 1.55;
      margin-top: 18px;
    }

    .cert-bottom {
      display: flex;
      justify-content: space-between;
      align-items: end;
      gap: 18px;
      margin-top: 22px;
    }

    .footer-brand {
      display: flex;
      justify-content: center;
      margin-top: 18px;
      opacity: 0.96;
    }

    .page-footer {
      position: absolute;
      left: 15mm;
      right: 15mm;
      bottom: 9mm;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 10px;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: rgba(242,231,210,0.55);
      z-index: 4;
    }

    .mini-mark {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }

    .mini-gold {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--gold);
      display: inline-block;
      box-shadow: 0 0 8px rgba(199,165,105,0.25);
    }

    .muted { color: var(--muted); }
    .soft { color: var(--soft); }
    .text-right { text-align: right; }

    .tag {
      display: inline-flex;
      align-items: center;
      padding: 6px 10px;
      border-radius: 999px;
      border: 1px solid rgba(199,165,105,0.28);
      font-size: 10px;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: rgba(242,231,210,0.82);
      background: rgba(255,255,255,0.02);
    }
  </style>
</head>
<body>
  <section class="page">
    <div class="texture"></div>
    <div class="overlay"></div>
    <div class="grain"></div>
    <div class="vein-a"></div>
    <div class="vein-b"></div>
    <div class="vein-c"></div>
    <div class="page-frame"></div>

    <div class="content cover-wrap">
      <div class="cover-top">
        ${logoMain}
      </div>

      <div class="cover-middle">
        <div class="line"></div>
        <div class="cover-title">Camasa<br/>Signature Book</div>
        <div class="cover-subtitle">Documento de entrega premium</div>

        <div class="hero-project">${projectName}</div>
        <div class="hero-client">${clientName}</div>
        <div class="hero-location">${location}</div>

        <div class="qr-box">
          ${qrSvg}
          <div class="code-pill">${signatureCode}</div>
          <div class="issued">Gerado em ${issueDate}</div>
        </div>
      </div>

      <div style="height: 20mm;"></div>
    </div>

    <div class="page-footer">
      <div class="mini-mark"><span class="mini-gold"></span> Camasa Mármores & Design</div>
      <div>${documentType}</div>
    </div>
  </section>

  <section class="page">
    <div class="texture"></div>
    <div class="overlay"></div>
    <div class="grain"></div>
    <div class="page-frame"></div>

    <div class="content">
      <div class="page-title">Resumo Executivo</div>
      <div class="headline-project">${projectName}</div>
      <div class="headline-copy">
        Este documento é o prontuário institucional premium conectado ao projeto e aos elementos rastreáveis vinculados ao fluxo Camasa.
      </div>

      <div class="stats-grid">
        <div class="card stat-box">
          <div class="stat-icon">${buildIconSvg("material")}</div>
          <div class="stat-label">Materiais certificados</div>
          <div class="stat-value">1</div>
        </div>

        <div class="card stat-box">
          <div class="stat-icon">${buildIconSvg("category")}</div>
          <div class="stat-label">Categorias técnicas</div>
          <div class="stat-value">1</div>
        </div>

        <div class="card stat-box">
          <div class="stat-icon">${buildIconSvg("blocks")}</div>
          <div class="stat-label">Blocos gerenciados</div>
          <div class="stat-value">1</div>
        </div>

        <div class="card progress-card">
          <div class="section-kicker">Progresso geral</div>
          <div class="progress-head">
            <div class="mini-donut"><span>38%</span></div>
            <div class="meta-list">
              <div><span class="soft">Etapa em evidência</span><br/>Instalação</div>
              <div style="margin-top: 8px;"><span class="soft">Entrega de referência</span><br/>09/04/2026</div>
            </div>
          </div>
        </div>
      </div>

      <div class="summary-grid">
        <div class="card distribution-card">
          <div class="card-pad">
            <div class="section-kicker">Distribuição por aplicação</div>
            <div class="dist-row">
              <span>${projectName}</span>
              <span>100%</span>
            </div>
            <div class="bar"></div>
          </div>
        </div>

        <div class="card material-card-large">
          <div class="card-pad">
            <div class="section-kicker">Materiais utilizados</div>
            <div class="material-grid">
              <div class="stone-sample"></div>
              <div>
                <div style="font-size: 16px; color: #fff2db;">${material}</div>
                <div class="muted" style="font-size: 12px; line-height: 1.65; margin-top: 8px;">
                  Cliente: ${clientName}<br/>
                  Aplicação: ${projectName}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="page-footer">
        <div class="mini-mark"><span class="mini-gold"></span> Camasa Mármores & Design</div>
        <div>Resumo Executivo</div>
      </div>
    </div>
  </section>

  <section class="page">
    <div class="texture"></div>
    <div class="overlay"></div>
    <div class="grain"></div>
    <div class="page-frame"></div>

    <div class="content">
      <div class="page-title">Etapas da Obra</div>
      <div class="page-subtitle">Visão geral da execução, leitura do andamento e marcos de entrega do projeto.</div>

      <div class="donut-layout">
        <div class="card big-ring-card">
          <div class="big-ring-wrap">
            <div class="big-ring">
              <div class="big-ring-center">
                <div class="big-percent">38%</div>
                <div class="big-copy">
                  Concluído<br/>
                  Referenciado em<br/>
                  09/04/2026
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="stage-side">
          <div class="stage-item">
            <div class="stage-dot">${buildIconSvg("check")}</div>
            <div>
              <div class="stage-title">Etapas concluídas</div>
              <div class="stage-value">6</div>
            </div>
          </div>

          <div class="stage-item">
            <div class="stage-dot">${buildIconSvg("play")}</div>
            <div>
              <div class="stage-title">Etapa em andamento</div>
              <div class="stage-value">Instalação</div>
            </div>
          </div>

          <div class="stage-item">
            <div class="stage-dot">${buildIconSvg("circle")}</div>
            <div>
              <div class="stage-title">Etapas restantes</div>
              <div class="stage-value">8</div>
            </div>
          </div>

          <div class="stage-item">
            <div class="stage-dot">${buildIconSvg("clock")}</div>
            <div>
              <div class="stage-title">Previsão de entrega</div>
              <div class="stage-value">09/04/2026</div>
            </div>
          </div>
        </div>
      </div>

      <div class="card timeline-card">
        <div class="timeline-label">Linhas de frente</div>
        <div class="timeline">
          <div class="step done">
            <div class="step-icon">${buildIconSvg("project")}</div>
            <div class="step-label">Projeto</div>
          </div>
          <div class="step done">
            <div class="step-icon">${buildIconSvg("measure")}</div>
            <div class="step-label">Medição</div>
          </div>
          <div class="step active">
            <div class="step-icon">${buildIconSvg("finish")}</div>
            <div class="step-label">Acabamento</div>
          </div>
          <div class="step">
            <div class="step-icon">${buildIconSvg("install")}</div>
            <div class="step-label">Instalação</div>
          </div>
          <div class="step">
            <div class="step-icon">${buildIconSvg("final")}</div>
            <div class="step-label">Finalização</div>
          </div>
        </div>
      </div>

      <div class="page-footer">
        <div class="mini-mark"><span class="mini-gold"></span> Camasa Mármores & Design</div>
        <div>Etapas da Obra</div>
      </div>
    </div>
  </section>

  <section class="page">
    <div class="texture"></div>
    <div class="overlay"></div>
    <div class="grain"></div>
    <div class="page-frame"></div>

    <div class="content">
      <div class="page-title">Painel de Materiais</div>
      <div class="page-subtitle">Demonstrativo institucional dos elementos nobres vinculados ao projeto.</div>

      <div class="split-two">
        <div class="card soft">
          <div class="card-pad">
            <div class="section-kicker">Material principal</div>
            <div class="material-grid">
              <div class="stone-sample"></div>
              <div>
                <div style="font-size: 16px; color: #fff2db;">${material}</div>
                <div class="muted" style="font-size: 12px; line-height: 1.68; margin-top: 8px;">
                  Aplicação: ${projectName}<br/>
                  Local: ${location}
                </div>
                <div style="margin-top: 12px;">
                  <span class="tag">Material certificado</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="card soft">
          <div class="card-pad">
            <div class="section-kicker">Materiais certificados</div>
            <div class="photo-sample"></div>
            <div class="muted" style="font-size: 12px; line-height: 1.7; margin-top: 12px;">
              Apresentação visual do material em contexto aplicado, reforçando estética, ambiente e resultado final do projeto.
            </div>
          </div>
        </div>
      </div>

      <div class="page-footer">
        <div class="mini-mark"><span class="mini-gold"></span> Camasa Mármores & Design</div>
        <div>Painel de Materiais</div>
      </div>
    </div>
  </section>

  <section class="page">
    <div class="texture"></div>
    <div class="overlay"></div>
    <div class="grain"></div>
    <div class="page-frame"></div>

    <div class="content">
      <div class="page-title">Manual de Uso e Conservação</div>
      <div class="page-subtitle">Orientações essenciais para preservar beleza, acabamento e longevidade.</div>

      <div class="split-two">
        <div class="card bullet-card ok">
          <div class="bullet-title"><span class="bullet-mark">${buildIconSvg("check")}</span> O que fazer</div>
          <ul class="clean">
            <li>Limpar com pano macio levemente umedecido.</li>
            <li>Utilizar detergente neutro em pequena quantidade.</li>
            <li>Remover resíduos líquidos rapidamente.</li>
            <li>Usar apoio para objetos quentes e utensílios pesados.</li>
            <li>Manter rotina preventiva de inspeção visual.</li>
          </ul>
        </div>

        <div class="card bullet-card no">
          <div class="bullet-title"><span class="bullet-mark">${buildIconSvg("warning")}</span> O que evitar</div>
          <ul class="clean">
            <li>Produtos ácidos, abrasivos ou clorados.</li>
            <li>Impactos concentrados em quinas e bordas.</li>
            <li>Arraste de peças metálicas sem proteção.</li>
            <li>Contato prolongado com agentes pigmentantes.</li>
            <li>Limpeza agressiva com discos ou esponjas duras.</li>
          </ul>
        </div>
      </div>

      <div class="card alert-card">
        <div class="section-kicker">Alertas importantes</div>
        <ul class="clean">
          <li>Pedras naturais podem apresentar variações próprias de sua formação.</li>
          <li>O uso incorreto de químicos pode comprometer acabamento, proteção e brilho.</li>
          <li>Qualquer intervenção corretiva deve respeitar orientação técnica especializada.</li>
        </ul>
      </div>

      <div class="page-footer">
        <div class="mini-mark"><span class="mini-gold"></span> Camasa Mármores & Design</div>
        <div>Manual de Uso e Conservação</div>
      </div>
    </div>
  </section>

  <section class="page">
    <div class="texture"></div>
    <div class="overlay"></div>
    <div class="grain"></div>
    <div class="page-frame"></div>

    <div class="content">
      <div class="page-title">Camasa Care</div>
      <div class="page-subtitle">Programa de acompanhamento, preservação estética e atenção contínua.</div>

      <div class="card care-main">
        <div class="care-title">Preserve a beleza</div>
        <div class="care-copy">
          Serviço pensado para manter valor estético, segurança de uso e consistência visual das superfícies nobres entregues pela Camasa.
        </div>

        <div class="care-grid">
          <div class="card care-item">
            <div class="care-icon">${buildIconSvg("preserve")}</div>
            <div class="care-item-title">Preservar</div>
            <div class="care-item-copy">Rotina de avaliação preventiva e leitura visual da superfície.</div>
          </div>

          <div class="card care-item">
            <div class="care-icon">${buildIconSvg("protect")}</div>
            <div class="care-item-title">Proteger</div>
            <div class="care-item-copy">Sugestões de cuidado para manter acabamento, toque e presença.</div>
          </div>

          <div class="card care-item">
            <div class="care-icon">${buildIconSvg("revisit")}</div>
            <div class="care-item-title">Revisitar</div>
            <div class="care-item-copy">Acompanhamento técnico periódico conforme necessidade do projeto.</div>
          </div>
        </div>

        <div class="cta">
          Atendimento Camasa Care disponível para projetos com demanda de acompanhamento contínuo e preservação estética.
        </div>
      </div>

      <div class="page-footer">
        <div class="mini-mark"><span class="mini-gold"></span> Camasa Mármores & Design</div>
        <div>Camasa Care</div>
      </div>
    </div>
  </section>

  <section class="page">
    <div class="texture"></div>
    <div class="overlay"></div>
    <div class="grain"></div>
    <div class="page-frame"></div>

    <div class="content cert-wrap">
      <div class="cert-card">
        <div class="cert-corner tl"></div>
        <div class="cert-corner tr"></div>
        <div class="cert-corner bl"></div>
        <div class="cert-corner br"></div>

        <div class="cert-header">
          <div>
            ${logoSmall}
            <div class="cert-title">Certificado de Autenticidade</div>
            <div class="cert-sub">Camasa Process System • Registro institucional</div>
          </div>

          <div>${qrSvg}</div>
        </div>

        <div class="cert-code">${signatureCode}</div>

        <div class="cert-grid">
          <div>
            <div class="cert-label">Projeto</div>
            <div class="cert-value">${projectName}</div>
          </div>
          <div>
            <div class="cert-label">Cliente</div>
            <div class="cert-value">${clientName}</div>
          </div>
          <div>
            <div class="cert-label">Local</div>
            <div class="cert-value">${location}</div>
          </div>
          <div>
            <div class="cert-label">Material</div>
            <div class="cert-value">${material}</div>
          </div>
          <div>
            <div class="cert-label">Project ID</div>
            <div class="cert-value">${projectId}</div>
          </div>
          <div>
            <div class="cert-label">Data de emissão</div>
            <div class="cert-value">${issueDate}</div>
          </div>
        </div>

        <div class="cert-copy">
          Este documento certifica a vinculação institucional deste projeto ao fluxo premium do Camasa Process System, com identificação, rastreabilidade documental e referência visual compatível com o padrão de entrega Camasa.
        </div>

        <div class="serial">
          8bca99f8d25e1a34f9d80d3e2${projectId.replace(/[^a-zA-Z0-9]/g, "")}cpssignaturebook${signatureCode.replace(/[^a-zA-Z0-9]/g, "")}
        </div>

        <div class="cert-bottom">
          <div>
            <div class="cert-label">Sistema</div>
            <div class="cert-value">CPS — Camasa Process System</div>
          </div>

          <div class="text-right">
            <div class="cert-label">Validação</div>
            <div class="cert-value">Documento premium institucional</div>
          </div>
        </div>
      </div>

      <div class="footer-brand">
        ${logoSmall}
      </div>

      <div class="page-footer">
        <div class="mini-mark"><span class="mini-gold"></span> Camasa Mármores & Design</div>
        <div>Certificado</div>
      </div>
    </div>
  </section>
</body>
</html>`;
}

async function generatePdfBuffer(data: RenderPayload): Promise<Buffer> {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  try {
    const page = await browser.newPage({
      viewport: { width: 1400, height: 1980 },
      deviceScaleFactor: 1.5
    });

    const html = buildHtml(data);
    await page.setContent(html, { waitUntil: "networkidle" });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "0mm",
        right: "0mm",
        bottom: "0mm",
        left: "0mm"
      }
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

function parseBody(body: string): RenderPayload {
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch {
    return {};
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://localhost:${port}`);

    if (req.method === "GET" && url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ ok: true, service: "camasa-signature-renderer" }));
      return;
    }

    if (req.method === "GET" && url.pathname === "/render-test") {
      const pdf = await generatePdfBuffer({
        projectId: "600059b1-85f8-4ca1-81dc-ed5339a8a812",
        signatureCode: "CSB-20260331-2344-XBGE",
        documentType: "Camasa Signature Book",
        clientName: "Ana",
        projectName: "Bancada em L",
        material: "Granito Verde Ubatuba",
        location: "São Paulo, SP",
        issueDate: "31/03/2026"
      });

      res.writeHead(200, {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="camasa-signature-book-test.pdf"',
        "Cache-Control": "no-store"
      });
      res.end(pdf);
      return;
    }

    if (req.method === "POST" && url.pathname === "/render") {
      let body = "";

      req.on("data", (chunk) => {
        body += chunk.toString();
      });

      req.on("end", async () => {
        try {
          const payload = parseBody(body);
          const pdf = await generatePdfBuffer(payload);

          res.writeHead(200, {
            "Content-Type": "application/pdf",
            "Content-Disposition": 'inline; filename="camasa-signature-book.pdf"',
            "Cache-Control": "no-store"
          });
          res.end(pdf);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Erro interno do servidor.";

          res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ error: message }));
        }
      });

      return;
    }

    const previewHtml = `
      <html>
        <body style="font-family:Arial;padding:20px;background:#111;color:#eee">
          <h2>Teste Camasa Renderer</h2>
          <button onclick="testar()">Gerar PDF</button>
          <pre id="out"></pre>
          <script>
            async function testar() {
              const out = document.getElementById('out');
              out.textContent = 'Gerando PDF...';
              try {
                const response = await fetch('/render', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    projectId: '600059b1-85f8-4ca1-81dc-ed5339a8a812',
                    signatureCode: 'CSB-20260331-2344-XBGE',
                    documentType: 'Camasa Signature Book',
                    clientName: 'Ana',
                    projectName: 'Bancada em L',
                    material: 'Granito Verde Ubatuba',
                    location: 'São Paulo, SP',
                    issueDate: '31/03/2026'
                  })
                });

                if (!response.ok) {
                  throw new Error(await response.text());
                }

                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                window.open(url, '_blank');
                out.textContent = 'PDF gerado com sucesso.';
              } catch (err) {
                out.textContent = 'ERRO: ' + (err && err.message ? err.message : String(err));
              }
            }
          </script>
        </body>
      </html>
    `;

    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(previewHtml);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro interno do servidor.";

    res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: message }));
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log("Camasa renderer running on port " + port);
});
