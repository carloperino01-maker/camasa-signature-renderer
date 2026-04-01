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
  progressPercent?: number;
  completedSteps?: number;
  currentStage?: string;
  remainingSteps?: number;
  forecastDate?: string;
  applicationLabel?: string;
  applicationPercent?: number;
  materialCategory?: string;
  materialFinish?: string;
  materialUsage?: string;
  materialCare?: string[];
  doList?: string[];
  dontList?: string[];
  alerts?: string[];
  carePillars?: Array<{
    title: string;
    subtitle: string;
  }>;
  certificateFamily?: string;
  certificateOrigin?: string;
  certificateBatch?: string;
};

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function assetDataUri(relativePath: string): string | null {
  try {
    const filePath = path.join(__dirname, relativePath);
    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();

    let mime = "application/octet-stream";
    if (ext === ".jpg" || ext === ".jpeg") mime = "image/jpeg";
    if (ext === ".png") mime = "image/png";
    if (ext === ".webp") mime = "image/webp";

    return `data:${mime};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

function formatDatePtBr(input?: string): string {
  if (!input) return new Date().toLocaleDateString("pt-BR");
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return escapeHtml(input);
  return d.toLocaleDateString("pt-BR");
}

function normalizeArray(input: unknown, fallback: string[]): string[] {
  if (Array.isArray(input)) {
    const cleaned = input
      .map((item) => String(item ?? "").trim())
      .filter(Boolean);
    if (cleaned.length) return cleaned;
  }
  return fallback;
}

function normalizePillars(
  input: unknown,
): Array<{ title: string; subtitle: string }> {
  if (Array.isArray(input)) {
    const cleaned = input
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const row = item as Record<string, unknown>;
        const title = String(row.title ?? "").trim();
        const subtitle = String(row.subtitle ?? "").trim();
        if (!title) return null;
        return { title, subtitle };
      })
      .filter(Boolean) as Array<{ title: string; subtitle: string }>;

    if (cleaned.length) return cleaned;
  }

  return [
    { title: "Preservar", subtitle: "Limpeza correta e rotina adequada" },
    { title: "Proteger", subtitle: "Uso consciente e prevenção de manchas" },
    { title: "Revisar", subtitle: "Acompanhamento e manutenção preventiva" },
  ];
}

function buildSteps(percent: number): string {
  const steps = [
    "Projeto",
    "Medição",
    "Acabamento",
    "Instalação",
    "Finalização",
  ];
  const activeIndex =
    percent >= 100 ? steps.length - 1 : Math.max(0, Math.min(4, Math.floor(percent / 20)));

  return steps
    .map((label, index) => {
      const state =
        index < activeIndex
          ? "done"
          : index === activeIndex
            ? "current"
            : "pending";

      return `
        <div class="timeline-step ${state}">
          <div class="timeline-dot">${state === "done" ? "✓" : state === "current" ? "◔" : ""}</div>
          <div class="timeline-label">${escapeHtml(label)}</div>
        </div>
      `;
    })
    .join("");
}

function buildList(items: string[], variant: "good" | "bad" | "alert"): string {
  return items
    .map((item) => {
      const icon = variant === "good" ? "✓" : variant === "bad" ? "✕" : "△";
      return `<li><span class="bullet ${variant}">${icon}</span><span>${escapeHtml(item)}</span></li>`;
    })
    .join("");
}

function buildCarePillars(items: Array<{ title: string; subtitle: string }>): string {
  return items
    .map(
      (item) => `
      <div class="pillar-card">
        <div class="pillar-icon">◌</div>
        <div class="pillar-title">${escapeHtml(item.title)}</div>
        <div class="pillar-subtitle">${escapeHtml(item.subtitle)}</div>
      </div>
    `,
    )
    .join("");
}

function buildHtml(data: RenderPayload): string {
  const logoAsset =
    assetDataUri("assets/logotipo-camasa-process-system.jpg") ||
    assetDataUri("assets/logotipo-camasa-process-system.jpeg") ||
    assetDataUri("assets/logotipo-camasa-process-system.png");

  const referenceAsset =
    assetDataUri("assets/camasa-signature-book-completo.jpg") ||
    assetDataUri("assets/camasa-signature-book-completo.jpeg") ||
    assetDataUri("assets/camasa-signature-book-completo.png");

  const signatureCode = escapeHtml(data.signatureCode || "CSB-20260331-2344-XBGE");
  const documentType = escapeHtml(data.documentType || "CAMASA SIGNATURE BOOK");
  const clientName = escapeHtml(data.clientName || "Ana");
  const projectName = escapeHtml(data.projectName || "Bancada em L");
  const material = escapeHtml(data.material || "Granito Verde Ubatuba");
  const location = escapeHtml(data.location || "São Paulo, SP");
  const issueDate = formatDatePtBr(data.issueDate);
  const forecastDate = formatDatePtBr(data.forecastDate || data.issueDate);
  const progressPercent = Math.max(0, Math.min(100, Number(data.progressPercent ?? 38)));
  const completedSteps = Math.max(0, Number(data.completedSteps ?? 6));
  const remainingSteps = Math.max(0, Number(data.remainingSteps ?? 8));
  const currentStage = escapeHtml(data.currentStage || "Instalação");
  const applicationLabel = escapeHtml(data.applicationLabel || projectName);
  const applicationPercent = Math.max(0, Math.min(100, Number(data.applicationPercent ?? 100)));
  const materialCategory = escapeHtml(data.materialCategory || "Granito");
  const materialFinish = escapeHtml(data.materialFinish || "Polido");
  const materialUsage = escapeHtml(data.materialUsage || projectName);
  const materialCare = escapeHtml(data.materialUsage || "Uso interno e vedado");
  const certificateFamily = escapeHtml(data.certificateFamily || materialCategory);
  const certificateOrigin = escapeHtml(data.certificateOrigin || "Brasil");
  const certificateBatch = escapeHtml(data.certificateBatch || "AM");

  const doList = normalizeArray(data.doList, [
    "Limpar com pano macio e detergente neutro.",
    "Secar após limpeza e contato com líquidos.",
    "Usar apoios adequados para objetos quentes.",
    "Manter rotina de cuidado e inspeção visual.",
  ]);

  const dontList = normalizeArray(data.dontList, [
    "Não usar ácido, cloro ou produtos abrasivos.",
    "Não apoiar panelas ou peças superaquecidas diretamente.",
    "Não deixar líquidos pigmentados por longos períodos.",
    "Não usar lâmina, palha de aço ou solvente forte.",
  ]);

  const alerts = normalizeArray(data.alerts, [
    "Heróis da limpeza agressiva causam dano silencioso.",
    "Óleo, vinho e café devem ser removidos rapidamente.",
    "Choques mecânicos em quinas exigem atenção permanente.",
  ]);

  const carePillars = normalizePillars(data.carePillars);

  const coverBackground = referenceAsset
    ? `
      linear-gradient(180deg, rgba(8,8,10,0.72), rgba(10,10,12,0.88)),
      radial-gradient(circle at top center, rgba(255,255,255,0.06), transparent 36%),
      url("${referenceAsset}")
    `
    : `
      linear-gradient(180deg, rgba(8,8,10,0.86), rgba(10,10,12,0.96)),
      radial-gradient(circle at top center, rgba(255,255,255,0.06), transparent 36%)
    `;

  const pageTexture = referenceAsset
    ? `
      linear-gradient(180deg, rgba(8,8,10,0.84), rgba(12,12,14,0.92)),
      radial-gradient(circle at top center, rgba(255,255,255,0.04), transparent 30%),
      url("${referenceAsset}")
    `
    : `
      linear-gradient(180deg, rgba(8,8,10,0.94), rgba(12,12,14,0.98)),
      radial-gradient(circle at top center, rgba(255,255,255,0.04), transparent 30%)
    `;

  const logoHtml = logoAsset
    ? `<img class="brand-logo" src="${logoAsset}" alt="CPS Camasa Process System" />`
    : `
      <div class="brand-fallback">
        <div class="brand-fallback-top">CPS</div>
        <div class="brand-fallback-right">
          <div>CAMASA</div>
          <div class="small">Process System</div>
        </div>
      </div>
    `;

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Camasa Signature Book</title>
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #0a0a0c;
      color: #f1e5c8;
      font-family: "Helvetica Neue", Arial, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    body {
      background:
        radial-gradient(circle at top, rgba(255,255,255,0.03), transparent 22%),
        linear-gradient(180deg, #070708 0%, #111114 100%);
    }

    .page {
      width: 210mm;
      min-height: 297mm;
      padding: 14mm;
      margin: 0 auto;
      position: relative;
      page-break-after: always;
      overflow: hidden;
      background: ${pageTexture};
      background-size: cover;
      background-position: center;
    }

    .page:last-child {
      page-break-after: auto;
    }

    .page::before {
      content: "";
      position: absolute;
      inset: 8mm;
      border: 1px solid rgba(202, 170, 103, 0.20);
      pointer-events: none;
    }

    .page::after {
      content: "";
      position: absolute;
      inset: 0;
      background:
        linear-gradient(135deg, rgba(255,255,255,0.02), transparent 18%, transparent 82%, rgba(255,255,255,0.018)),
        radial-gradient(circle at top center, rgba(255,255,255,0.04), transparent 40%);
      pointer-events: none;
    }

    .cover {
      background: ${coverBackground};
      background-size: cover;
      background-position: center;
      display: flex;
      align-items: stretch;
    }

    .cover-grid {
      position: relative;
      z-index: 2;
      display: grid;
      grid-template-columns: 1fr;
      width: 100%;
      min-height: calc(297mm - 28mm);
      border: 1px solid rgba(203, 171, 106, 0.18);
      background: linear-gradient(180deg, rgba(8,8,10,0.34), rgba(8,8,10,0.54));
      box-shadow: inset 0 0 80px rgba(0,0,0,0.35);
      padding: 18mm 16mm 14mm 16mm;
    }

    .gold-line {
      width: 100%;
      height: 2px;
      background: linear-gradient(90deg, rgba(0,0,0,0), #d0ab63, rgba(0,0,0,0));
      opacity: 0.95;
      margin: 9mm 0 7mm 0;
    }

    .brand-box {
      display: flex;
      justify-content: flex-start;
      align-items: center;
      min-height: 38mm;
      margin-bottom: 10mm;
    }

    .brand-logo {
      max-width: 132mm;
      max-height: 34mm;
      object-fit: contain;
      filter: drop-shadow(0 8px 18px rgba(0,0,0,0.35));
    }

    .brand-fallback {
      display: flex;
      align-items: center;
      gap: 10px;
      color: #f2efe9;
    }

    .brand-fallback-top {
      font-size: 30px;
      font-weight: 800;
      letter-spacing: 1px;
      color: #d0ab63;
    }

    .brand-fallback-right {
      font-size: 18px;
      font-weight: 700;
      line-height: 1.05;
    }

    .brand-fallback-right .small {
      font-size: 13px;
      font-weight: 400;
      color: #d8d0c2;
    }

    .cover-title-wrap {
      text-align: center;
      margin-top: 10mm;
    }

    .cover-title {
      font-size: 17px;
      letter-spacing: 3px;
      text-transform: uppercase;
      color: #f5efe1;
      margin-bottom: 3mm;
    }

    .cover-title strong {
      display: block;
      font-size: 23px;
      letter-spacing: 2.2px;
      margin-top: 2mm;
    }

    .cover-subtitle {
      text-align: center;
      color: #d8cfbf;
      font-size: 11px;
      letter-spacing: 1.6px;
      text-transform: uppercase;
      margin-bottom: 13mm;
    }

    .cover-project {
      text-align: center;
      margin-top: 2mm;
    }

    .cover-project-name {
      font-size: 20px;
      color: #f6f0e3;
      margin-bottom: 3mm;
    }

    .cover-client,
    .cover-location {
      color: #d8cfbf;
      font-size: 13px;
      margin-bottom: 2mm;
    }

    .qr-box {
      display: flex;
      justify-content: center;
      margin-top: 10mm;
      margin-bottom: 8mm;
    }

    .qr-shell {
      width: 34mm;
      height: 34mm;
      background: rgba(255,255,255,0.95);
      border: 1px solid rgba(208,171,99,0.55);
      border-radius: 5mm;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      box-shadow: 0 10px 30px rgba(0,0,0,0.28);
    }

    .code-pill {
      margin: 0 auto;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 4mm 8mm;
      border: 1px solid rgba(208,171,99,0.45);
      border-radius: 3mm;
      font-size: 13px;
      letter-spacing: 1px;
      color: #ead5a5;
      background: rgba(0,0,0,0.24);
      box-shadow: inset 0 0 12px rgba(255,255,255,0.03);
    }

    .cover-footer-date {
      text-align: center;
      margin-top: auto;
      font-size: 10px;
      color: #d4cabb;
      letter-spacing: 1.8px;
      text-transform: uppercase;
    }

    .section-kicker {
      color: #d0ab63;
      letter-spacing: 2px;
      text-transform: uppercase;
      font-size: 10px;
      margin-bottom: 2mm;
    }

    .section-title {
      color: #f5efe1;
      font-size: 18px;
      letter-spacing: 1.2px;
      text-transform: uppercase;
      margin-bottom: 3mm;
    }

    .section-subtitle {
      color: #d5cbba;
      font-size: 11px;
      line-height: 1.6;
      margin-bottom: 6mm;
      max-width: 120mm;
    }

    .grid-2 {
      display: grid;
      grid-template-columns: 1.15fr 0.85fr;
      gap: 6mm;
      position: relative;
      z-index: 2;
    }

    .grid-3 {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 5mm;
    }

    .card {
      background: linear-gradient(180deg, rgba(25,25,28,0.76), rgba(14,14,16,0.86));
      border: 1px solid rgba(208,171,99,0.20);
      border-radius: 4mm;
      padding: 5mm;
      box-shadow:
        inset 0 0 26px rgba(255,255,255,0.02),
        0 16px 32px rgba(0,0,0,0.22);
      position: relative;
      overflow: hidden;
    }

    .card::before {
      content: "";
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, rgba(255,255,255,0.018), transparent 26%);
      pointer-events: none;
    }

    .metric-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 4mm;
      margin-bottom: 5mm;
    }

    .metric-card {
      min-height: 33mm;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      background: rgba(10,10,12,0.34);
      border: 1px solid rgba(208,171,99,0.18);
      border-radius: 3.5mm;
      padding: 3mm;
    }

    .metric-icon {
      color: #d0ab63;
      font-size: 13px;
      margin-bottom: 2mm;
    }

    .metric-label {
      color: #d3c8b8;
      font-size: 8px;
      line-height: 1.35;
      letter-spacing: 1px;
      text-transform: uppercase;
      min-height: 10mm;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .metric-value {
      color: #f5efe1;
      font-size: 18px;
      margin-top: 1mm;
    }

    .mini-ring-panel {
      display: grid;
      grid-template-columns: 33mm 1fr;
      gap: 4mm;
      align-items: center;
      min-height: 44mm;
    }

    .ring {
      --p: 38;
      width: 30mm;
      height: 30mm;
      border-radius: 50%;
      background:
        radial-gradient(circle at center, #0d0d11 49%, transparent 50%),
        conic-gradient(#d0ab63 calc(var(--p) * 1%), rgba(255,255,255,0.08) 0);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 22px rgba(0,0,0,0.35), inset 0 0 12px rgba(255,255,255,0.04);
      margin: 0 auto;
    }

    .ring-inner {
      width: 18mm;
      height: 18mm;
      border-radius: 50%;
      background: radial-gradient(circle at center, rgba(255,255,255,0.03), rgba(0,0,0,0.42));
      display: flex;
      align-items: center;
      justify-content: center;
      color: #f4ead6;
      font-size: 15px;
      font-weight: 600;
    }

    .ring-side-title {
      color: #d0ab63;
      font-size: 8px;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 1.4mm;
    }

    .ring-side-line {
      color: #f4ead6;
      font-size: 13px;
      margin-bottom: 1.2mm;
    }

    .ring-side-small {
      color: #cfc5b5;
      font-size: 10px;
      line-height: 1.45;
    }

    .distribution-line {
      margin-top: 2.5mm;
      width: 100%;
      height: 2.8mm;
      background: rgba(255,255,255,0.08);
      border-radius: 999px;
      overflow: hidden;
    }

    .distribution-fill {
      height: 100%;
      background: linear-gradient(90deg, #d0ab63, #f2d38f);
      border-radius: 999px;
    }

    .material-spot {
      display: grid;
      grid-template-columns: 34mm 1fr;
      gap: 4mm;
      align-items: stretch;
    }

    .material-thumb {
      border-radius: 3mm;
      min-height: 30mm;
      background:
        linear-gradient(180deg, rgba(0,0,0,0.12), rgba(0,0,0,0.42)),
        radial-gradient(circle at 30% 30%, rgba(255,255,255,0.10), transparent 18%),
        linear-gradient(135deg, #303338 0%, #1b1e22 26%, #495057 48%, #16191d 72%, #2e3338 100%);
      border: 1px solid rgba(208,171,99,0.18);
      box-shadow: inset 0 0 24px rgba(255,255,255,0.03);
    }

    .material-title {
      color: #f4ead6;
      font-size: 13px;
      margin-bottom: 1.5mm;
    }

    .material-small {
      color: #cdc2b3;
      font-size: 10px;
      line-height: 1.45;
    }

    .progress-ring-big-wrap {
      display: grid;
      grid-template-columns: 1fr 48mm;
      gap: 5mm;
      align-items: start;
    }

    .ring-big {
      --p: 38;
      width: 47mm;
      height: 47mm;
      border-radius: 50%;
      background:
        radial-gradient(circle at center, #0d0d11 43%, transparent 44%),
        conic-gradient(#d0ab63 calc(var(--p) * 1%), rgba(255,255,255,0.08) 0);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-left: auto;
      box-shadow: 0 10px 28px rgba(0,0,0,0.28), inset 0 0 14px rgba(255,255,255,0.04);
    }

    .ring-big-inner {
      width: 24mm;
      height: 24mm;
      border-radius: 50%;
      background: linear-gradient(180deg, rgba(18,18,20,0.96), rgba(10,10,12,0.94));
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: #f4ead6;
      text-align: center;
      line-height: 1.05;
    }

    .ring-big-percent {
      font-size: 17px;
      font-weight: 700;
    }

    .ring-big-caption {
      font-size: 7px;
      color: #d2c8b7;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .status-list {
      display: flex;
      flex-direction: column;
      gap: 3mm;
    }

    .status-row {
      display: flex;
      align-items: center;
      gap: 2.8mm;
      color: #eee3cc;
      font-size: 11px;
    }

    .status-icon {
      width: 6mm;
      height: 6mm;
      border-radius: 50%;
      border: 1px solid rgba(208,171,99,0.45);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #d0ab63;
      font-size: 9px;
      background: rgba(255,255,255,0.03);
      flex: 0 0 auto;
    }

    .timeline {
      margin-top: 5mm;
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 2mm;
      align-items: start;
    }

    .timeline-step {
      text-align: center;
      position: relative;
    }

    .timeline-step:not(:last-child)::after {
      content: "";
      position: absolute;
      top: 2.8mm;
      left: calc(50% + 4mm);
      width: calc(100% - 8mm);
      height: 1px;
      background: rgba(208,171,99,0.35);
    }

    .timeline-dot {
      width: 7mm;
      height: 7mm;
      margin: 0 auto 2mm auto;
      border-radius: 50%;
      border: 1px solid rgba(208,171,99,0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255,255,255,0.03);
      color: #d0ab63;
      font-size: 9px;
      position: relative;
      z-index: 2;
    }

    .timeline-step.done .timeline-dot,
    .timeline-step.current .timeline-dot {
      background: radial-gradient(circle at center, rgba(208,171,99,0.28), rgba(0,0,0,0.35));
      box-shadow: 0 0 12px rgba(208,171,99,0.18);
    }

    .timeline-label {
      color: #d3c8b8;
      font-size: 9px;
      line-height: 1.35;
    }

    .material-panel-grid {
      display: grid;
      grid-template-columns: 0.95fr 1.05fr;
      gap: 5mm;
    }

    .material-sheet {
      min-height: 64mm;
      background:
        linear-gradient(180deg, rgba(255,255,255,0.06), rgba(0,0,0,0.14)),
        radial-gradient(circle at 18% 24%, rgba(255,255,255,0.11), transparent 10%),
        radial-gradient(circle at 60% 30%, rgba(255,255,255,0.08), transparent 9%),
        linear-gradient(145deg, #1b1e20 0%, #3b4046 18%, #17191c 32%, #5f666d 44%, #202428 56%, #111315 73%, #434850 86%, #16191c 100%);
      border: 1px solid rgba(208,171,99,0.22);
      border-radius: 3mm;
      box-shadow: inset 0 0 28px rgba(255,255,255,0.02);
      margin-bottom: 4mm;
    }

    .badge-row {
      display: flex;
      gap: 2mm;
      flex-wrap: wrap;
      margin-top: 3mm;
      margin-bottom: 3mm;
    }

    .badge {
      border: 1px solid rgba(208,171,99,0.28);
      border-radius: 999px;
      padding: 1.5mm 3mm;
      font-size: 9px;
      color: #e8dcc3;
      background: rgba(255,255,255,0.03);
    }

    .photo-panel {
      min-height: 65mm;
      border-radius: 3mm;
      border: 1px solid rgba(208,171,99,0.22);
      background:
        linear-gradient(180deg, rgba(255,255,255,0.04), rgba(0,0,0,0.08)),
        url("${referenceAsset || ""}");
      background-size: cover;
      background-position: center;
      box-shadow: inset 0 0 34px rgba(0,0,0,0.25);
    }

    .panel-caption {
      color: #d4cab7;
      font-size: 10px;
      line-height: 1.55;
      margin-top: 3mm;
    }

    .list-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 5mm;
      margin-bottom: 5mm;
    }

    .list-card-title {
      color: #f4ead6;
      font-size: 13px;
      margin-bottom: 3mm;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .list-card ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 2.2mm;
    }

    .list-card li {
      display: flex;
      gap: 2.5mm;
      align-items: flex-start;
      color: #d6ccbb;
      font-size: 10px;
      line-height: 1.45;
    }

    .bullet {
      flex: 0 0 auto;
      width: 5mm;
      height: 5mm;
      border-radius: 50%;
      border: 1px solid rgba(208,171,99,0.32);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 8px;
      margin-top: 0.4mm;
    }

    .bullet.good { color: #d9c37f; }
    .bullet.bad { color: #d58b82; }
    .bullet.alert { color: #e0c47a; }

    .alerts-box {
      margin-top: 1mm;
    }

    .pillars-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 4mm;
      margin-top: 4mm;
      margin-bottom: 4mm;
    }

    .pillar-card {
      min-height: 36mm;
      border-radius: 3mm;
      border: 1px solid rgba(208,171,99,0.20);
      background: rgba(255,255,255,0.03);
      text-align: center;
      padding: 4mm 3mm;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }

    .pillar-icon {
      color: #d0ab63;
      font-size: 14px;
      margin-bottom: 2mm;
    }

    .pillar-title {
      color: #f5efe1;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 1.5mm;
    }

    .pillar-subtitle {
      color: #d4cab7;
      font-size: 9px;
      line-height: 1.4;
    }

    .care-footer {
      margin-top: 4mm;
      border: 1px solid rgba(208,171,99,0.20);
      border-radius: 3mm;
      padding: 4mm;
      color: #d6ccbb;
      font-size: 10px;
      background: rgba(255,255,255,0.025);
    }

    .certificate-page {
      background: ${pageTexture};
      background-size: cover;
      background-position: center;
      display: flex;
      align-items: stretch;
    }

    .certificate-shell {
      position: relative;
      z-index: 2;
      width: 100%;
      min-height: calc(297mm - 28mm);
      border: 1px solid rgba(208,171,99,0.22);
      padding: 10mm;
      background:
        linear-gradient(180deg, rgba(8,8,10,0.72), rgba(8,8,10,0.85)),
        radial-gradient(circle at top center, rgba(255,255,255,0.04), transparent 34%);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      box-shadow: inset 0 0 80px rgba(0,0,0,0.30);
    }

    .certificate-shell::before,
    .certificate-shell::after {
      content: "";
      position: absolute;
      width: 18mm;
      height: 18mm;
      border-color: rgba(208,171,99,0.42);
      pointer-events: none;
    }

    .certificate-shell::before {
      top: 6mm;
      left: 6mm;
      border-top: 1px solid rgba(208,171,99,0.42);
      border-left: 1px solid rgba(208,171,99,0.42);
    }

    .certificate-shell::after {
      right: 6mm;
      bottom: 6mm;
      border-right: 1px solid rgba(208,171,99,0.42);
      border-bottom: 1px solid rgba(208,171,99,0.42);
    }

    .certificate-top {
      display: flex;
      justify-content: center;
      margin-top: 6mm;
      margin-bottom: 6mm;
    }

    .certificate-title {
      text-align: center;
      color: #f5efe1;
      text-transform: uppercase;
      letter-spacing: 2px;
      font-size: 17px;
      margin-bottom: 2.5mm;
    }

    .certificate-sub {
      text-align: center;
      color: #d0ab63;
      font-size: 10px;
      letter-spacing: 1.7px;
      text-transform: uppercase;
      margin-bottom: 2mm;
    }

    .certificate-code {
      text-align: center;
      color: #f5efe1;
      font-size: 18px;
      letter-spacing: 1px;
      margin: 6mm 0 8mm 0;
    }

    .certificate-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4mm 8mm;
      margin: 0 auto;
      max-width: 128mm;
      width: 100%;
    }

    .certificate-field {
      border-bottom: 1px solid rgba(208,171,99,0.18);
      padding-bottom: 2mm;
    }

    .field-label {
      color: #d0ab63;
      font-size: 8px;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 1mm;
    }

    .field-value {
      color: #f2ead8;
      font-size: 12px;
    }

    .certificate-qr {
      display: flex;
      justify-content: center;
      margin-top: 8mm;
      margin-bottom: 6mm;
    }

    .certificate-bottom-logo {
      display: flex;
      justify-content: center;
      margin-top: auto;
      padding-top: 8mm;
    }

    .certificate-bottom-logo .brand-logo {
      max-width: 82mm;
      max-height: 22mm;
      opacity: 0.96;
    }

    .footer-note {
      text-align: center;
      color: #cfc5b5;
      font-size: 8.5px;
      line-height: 1.5;
      margin-top: 5mm;
      letter-spacing: 0.4px;
    }

    .smallcaps {
      text-transform: uppercase;
      letter-spacing: 1px;
    }
  </style>
</head>
<body>
  <section class="page cover">
    <div class="cover-grid">
      <div class="brand-box">
        ${logoHtml}
      </div>

      <div class="gold-line"></div>

      <div class="cover-title-wrap">
        <div class="cover-title">CAMASA <strong>SIGNATURE BOOK</strong></div>
        <div class="cover-subtitle">${documentType}<br/>Documento de entrega premium</div>

        <div class="cover-project">
          <div class="cover-project-name">${projectName}</div>
          <div class="cover-client">${clientName}</div>
          <div class="cover-location">${location}</div>
        </div>

        <div class="qr-box">
          <div class="qr-shell">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(signatureCode)}" alt="QR Code" style="width:100%;height:100%;object-fit:cover;" />
          </div>
        </div>

        <div style="text-align:center;">
          <div class="code-pill">${signatureCode}</div>
        </div>
      </div>

      <div class="cover-footer-date">
        Gerado em ${issueDate}
      </div>
    </div>
  </section>

  <section class="page">
    <div class="section-kicker">Resumo Executivo</div>
    <div class="section-title">${projectName}</div>
    <div class="section-subtitle">
      Documento de garantia, rastreabilidade e orientação de uso do projeto.
      Esta composição segue o padrão premium do Camasa Process System.
    </div>

    <div class="grid-2">
      <div>
        <div class="card" style="margin-bottom:5mm;">
          <div class="metric-grid">
            <div class="metric-card">
              <div class="metric-icon">♡</div>
              <div class="metric-label">Materiais Certificados</div>
              <div class="metric-value">1</div>
            </div>
            <div class="metric-card">
              <div class="metric-icon">⌂</div>
              <div class="metric-label">Categorias Técnicas</div>
              <div class="metric-value">1</div>
            </div>
            <div class="metric-card">
              <div class="metric-icon">▣</div>
              <div class="metric-label">Blocos de Orientação</div>
              <div class="metric-value">1</div>
            </div>
            <div class="metric-card">
              <div class="metric-icon">◎</div>
              <div class="metric-label">Registro Premium</div>
              <div class="metric-value">1</div>
            </div>
          </div>

          <div class="grid-2" style="grid-template-columns: 1.05fr 0.95fr; gap:4mm;">
            <div class="card" style="margin:0; min-height:36mm;">
              <div class="section-kicker" style="margin-bottom:1.4mm;">Distribuição por aplicação</div>
              <div style="color:#f5efe1; font-size:12px;">${applicationLabel}</div>
              <div class="distribution-line">
                <div class="distribution-fill" style="width:${applicationPercent}%"></div>
              </div>
              <div style="text-align:right; color:#d6cbba; font-size:10px; margin-top:1.8mm;">${applicationPercent}%</div>
            </div>

            <div class="card" style="margin:0; min-height:36mm;">
              <div class="section-kicker" style="margin-bottom:1.4mm;">Materiais Utilizados</div>
              <div class="material-spot">
                <div class="material-thumb"></div>
                <div>
                  <div class="material-title">${material}</div>
                  <div class="material-small">${materialCategory} • ${materialFinish}</div>
                  <div class="material-small">${materialUsage}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <div class="card">
          <div class="mini-ring-panel">
            <div class="ring" style="--p:${progressPercent}">
              <div class="ring-inner">${progressPercent}%</div>
            </div>
            <div>
              <div class="ring-side-title">Progresso Geral</div>
              <div class="ring-side-line">${progressPercent}% concluído</div>
              <div class="ring-side-small">Etapa atual: ${currentStage}</div>
              <div class="ring-side-small">Emissão do documento: ${issueDate}</div>
            </div>
          </div>
        </div>

        <div class="card" style="margin-top:5mm;">
          <div class="section-kicker">Informações centrais</div>
          <div class="ring-side-small">Cliente: ${clientName}</div>
          <div class="ring-side-small">Projeto: ${projectName}</div>
          <div class="ring-side-small">Local: ${location}</div>
          <div class="ring-side-small">Código: ${signatureCode}</div>
          <div class="ring-side-small">Material principal: ${material}</div>
        </div>
      </div>
    </div>
  </section>

  <section class="page">
    <div class="section-kicker">Etapas da Obra</div>
    <div class="section-title">Acompanhamento e rastreabilidade</div>
    <div class="section-subtitle">
      Visão executiva das etapas principais do projeto, percentual realizado e previsão de entrega.
    </div>

    <div class="card">
      <div class="progress-ring-big-wrap">
        <div>
          <div class="status-list">
            <div class="status-row"><span class="status-icon">✓</span><span>Etapas concluídas <strong style="margin-left:3px;">${completedSteps}</strong></span></div>
            <div class="status-row"><span class="status-icon">◔</span><span>Etapa em andamento <strong style="margin-left:3px;">${currentStage}</strong></span></div>
            <div class="status-row"><span class="status-icon"></span><span>Etapas restantes <strong style="margin-left:3px;">${remainingSteps}</strong></span></div>
            <div class="status-row"><span class="status-icon">⌛</span><span>Previsão de entrega <strong style="margin-left:3px;">${forecastDate}</strong></span></div>
          </div>
        </div>

        <div class="ring-big" style="--p:${progressPercent}">
          <div class="ring-big-inner">
            <div class="ring-big-percent">${progressPercent}%</div>
            <div class="ring-big-caption">Concluído</div>
          </div>
        </div>
      </div>

      <div class="timeline">
        ${buildSteps(progressPercent)}
      </div>
    </div>
  </section>

  <section class="page">
    <div class="section-kicker">Painel de Materiais</div>
    <div class="section-title">${material}</div>
    <div class="section-subtitle">
      Referência cadastrada, categoria técnica, acabamento e uso principal da peça aplicada no projeto.
    </div>

    <div class="material-panel-grid">
      <div class="card">
        <div class="material-sheet"></div>
        <div class="badge-row">
          <span class="badge">${materialCategory}</span>
          <span class="badge">${materialFinish}</span>
          <span class="badge">${materialUsage}</span>
        </div>
        <div class="material-title">${material}</div>
        <div class="material-small">Aplicação: ${projectName}</div>
        <div class="material-small">Local: ${location}</div>
        <div class="material-small">Classificação: material certificado</div>
      </div>

      <div class="card">
        <div class="photo-panel"></div>
        <div class="panel-caption">
          Referencial visual do ambiente, registro premium do projeto e associação direta com a peça especificada.
        </div>
        <div class="panel-caption">
          Uso previsto: ${materialCare}
        </div>
      </div>
    </div>
  </section>

  <section class="page">
    <div class="section-kicker">Manual de Uso e Conservação</div>
    <div class="section-title">Cuidados essenciais</div>
    <div class="section-subtitle">
      Orientações práticas para preservar a estética, integridade e desempenho da superfície ao longo do tempo.
    </div>

    <div class="list-grid">
      <div class="card list-card">
        <div class="list-card-title">O que fazer</div>
        <ul>
          ${buildList(doList, "good")}
        </ul>
      </div>

      <div class="card list-card">
        <div class="list-card-title">O que evitar</div>
        <ul>
          ${buildList(dontList, "bad")}
        </ul>
      </div>
    </div>

    <div class="card alerts-box list-card">
      <div class="list-card-title">Alertas importantes</div>
      <ul>
        ${buildList(alerts, "alert")}
      </ul>
    </div>
  </section>

  <section class="page">
    <div class="section-kicker">Camasa Care</div>
    <div class="section-title">Preserve a beleza</div>
    <div class="section-subtitle">
      Projeto de conservação contínua, orientação preventiva e manutenção visual coerente com materiais nobres.
    </div>

    <div class="card">
      <div class="pillars-grid">
        ${buildCarePillars(carePillars)}
      </div>

      <div class="care-footer">
        A manutenção Camasa Care foi pensada para prolongar a estética da obra,
        reduzir desgaste prematuro e manter coerência entre uso, cuidado e apresentação.
      </div>
    </div>
  </section>

  <section class="page certificate-page">
    <div class="certificate-shell">
      <div>
        <div class="certificate-top">
          ${logoHtml}
        </div>

        <div class="gold-line" style="margin-top:0; margin-bottom:7mm;"></div>

        <div class="certificate-title">Certificado de Autenticidade</div>
        <div class="certificate-sub">${material}</div>
        <div class="certificate-sub">Projeto rastreado pelo Camasa Process System</div>

        <div class="certificate-code">${signatureCode}</div>

        <div class="certificate-grid">
          <div class="certificate-field">
            <div class="field-label">Projeto</div>
            <div class="field-value">${projectName}</div>
          </div>
          <div class="certificate-field">
            <div class="field-label">Cliente</div>
            <div class="field-value">${clientName}</div>
          </div>
          <div class="certificate-field">
            <div class="field-label">Família</div>
            <div class="field-value">${certificateFamily}</div>
          </div>
          <div class="certificate-field">
            <div class="field-label">Origem</div>
            <div class="field-value">${certificateOrigin}</div>
          </div>
          <div class="certificate-field">
            <div class="field-label">Lote / Batch</div>
            <div class="field-value">${certificateBatch}</div>
          </div>
          <div class="certificate-field">
            <div class="field-label">Emissão</div>
            <div class="field-value">${issueDate}</div>
          </div>
        </div>

        <div class="certificate-qr">
          <div class="qr-shell" style="width:28mm;height:28mm;">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(signatureCode)}" alt="QR Code" style="width:100%;height:100%;object-fit:cover;" />
          </div>
        </div>

        <div class="footer-note">
          Este documento integra a rastreabilidade visual, técnica e institucional do projeto,
          vinculando material, aplicação, cuidado e identidade documental em padrão premium.
        </div>
      </div>

      <div class="certificate-bottom-logo">
        ${logoHtml}
      </div>
    </div>
  </section>
</body>
</html>
  `;
}

function parseBody(rawBody: string): RenderPayload {
  if (!rawBody || !rawBody.trim()) return {};
  try {
    return JSON.parse(rawBody) as RenderPayload;
  } catch {
    return {};
  }
}

async function generatePdfBuffer(payload: RenderPayload): Promise<Buffer> {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage({
      viewport: { width: 1600, height: 2200 },
      deviceScaleFactor: 1.5,
    });

    const html = buildHtml(payload);

    await page.setContent(html, {
      waitUntil: "networkidle",
      timeout: 120000,
    });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "0",
        right: "0",
        bottom: "0",
        left: "0",
      },
      preferCSSPageSize: true,
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const method = req.method || "GET";
    const url = req.url || "/";

    if (method === "GET" && url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (method === "GET" && url === "/render-test") {
      const pdf = await generatePdfBuffer({
        signatureCode: "CSB-20260331-2344-XBGE",
        documentType: "Camasa Signature Book",
        clientName: "Ana",
        projectName: "Bancada em L",
        material: "Granito Verde Ubatuba",
        location: "São Paulo, SP",
        issueDate: "2026-03-31",
        progressPercent: 38,
        completedSteps: 6,
        currentStage: "Instalação",
        remainingSteps: 8,
        forecastDate: "2026-04-09",
        applicationLabel: "Bancada em L",
        applicationPercent: 100,
        materialCategory: "Granito",
        materialFinish: "Polido",
        materialUsage: "Bancada em L",
        certificateFamily: "Granito",
        certificateOrigin: "Brasil",
        certificateBatch: "AM",
      });

      res.writeHead(200, {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="camasa-signature-book-test.pdf"',
        "Access-Control-Allow-Origin": "*",
      });
      res.end(pdf);
      return;
    }

    if (method === "POST" && url === "/render") {
      const chunks: Buffer[] = [];

      req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      req.on("end", async () => {
        try {
          const rawBody = Buffer.concat(chunks).toString("utf-8");
          const payload = parseBody(rawBody);
          const pdf = await generatePdfBuffer(payload);

          res.writeHead(200, {
            "Content-Type": "application/pdf",
            "Content-Disposition": `inline; filename="${payload.projectId || "signature-book"}.pdf"`,
            "Access-Control-Allow-Origin": "*",
          });
          res.end(pdf);
        } catch (error) {
          res.writeHead(500, {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          });
          res.end(
            JSON.stringify({
              error: "Erro ao gerar PDF.",
              details: error instanceof Error ? error.message : String(error),
            }),
          );
        }
      });
      return;
    }

    res.writeHead(404, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(JSON.stringify({ error: "Rota não encontrada." }));
  } catch (error) {
    res.writeHead(500, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(
      JSON.stringify({
        error: "Erro interno no renderer.",
        details: error instanceof Error ? error.message : String(error),
      }),
    );
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Camasa Signature Renderer running on port ${port}`);
});
