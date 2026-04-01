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
  materialCareText?: string;
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
    percent >= 100
      ? steps.length - 1
      : Math.max(0, Math.min(steps.length - 1, Math.floor(percent / 20)));

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

  const signatureCode = escapeHtml(data.signatureCode || "CSB-20260331-2344-XBGE");
  const documentType = escapeHtml(data.documentType || "Camasa Signature Book");
  const clientName = escapeHtml(data.clientName || "Ana");
  const projectName = escapeHtml(data.projectName || "Bancada em L");
  const material = escapeHtml(data.material || "Granito Verde Ubatuba");
  const location = escapeHtml(data.location || "São Paulo, SP");
  const issueDate = formatDatePtBr(data.issueDate || "2026-03-31");
  const forecastDate = formatDatePtBr(data.forecastDate || "2026-04-09");
  const progressPercent = Math.max(0, Math.min(100, Number(data.progressPercent ?? 38)));
  const completedSteps = Math.max(0, Number(data.completedSteps ?? 6));
  const remainingSteps = Math.max(0, Number(data.remainingSteps ?? 8));
  const currentStage = escapeHtml(data.currentStage || "Instalação");
  const applicationLabel = escapeHtml(data.applicationLabel || "Bancada em L");
  const applicationPercent = Math.max(
    0,
    Math.min(100, Number(data.applicationPercent ?? 100)),
  );
  const materialCategory = escapeHtml(data.materialCategory || "Granito");
  const materialFinish = escapeHtml(data.materialFinish || "Polido");
  const materialUsage = escapeHtml(data.materialUsage || "Bancada em L");
  const materialCareText = escapeHtml(
    data.materialCareText || "Uso interno • vedado • limpeza controlada",
  );
  const certificateFamily = escapeHtml(data.certificateFamily || "Granito");
  const certificateOrigin = escapeHtml(data.certificateOrigin || "Brasil");
  const certificateBatch = escapeHtml(data.certificateBatch || "AM");

  const doList = normalizeArray(data.doList, [
    "Limpar com pano macio, água e detergente neutro.",
    "Secar a superfície após a limpeza ou contato com líquidos.",
    "Usar apoio para panelas, objetos quentes e peças metálicas.",
    "Manter rotina de inspeção visual em quinas e áreas de uso intenso.",
  ]);

  const dontList = normalizeArray(data.dontList, [
    "Não usar ácido, cloro, saponáceo ou produto abrasivo.",
    "Não apoiar panelas superaquecidas diretamente sobre a peça.",
    "Não deixar vinho, café, óleo ou pigmentos por tempo prolongado.",
    "Não usar lâmina, palha de aço ou solvente agressivo.",
  ]);

  const alerts = normalizeArray(data.alerts, [
    "Choques mecânicos em bordas e quinas podem causar danos localizados.",
    "Produtos agressivos degradam brilho, vedação e leitura estética da peça.",
    "Substâncias pigmentadas devem ser removidas com rapidez.",
  ]);

  const carePillars = normalizePillars(data.carePillars);

  const logoHtml = logoAsset
    ? `<img class="brand-logo" src="${logoAsset}" alt="CPS Camasa Process System" />`
    : `
      <div class="brand-fallback">
        <div class="brand-fallback-cps">CPS</div>
        <div class="brand-fallback-right">
          <div class="brand-fallback-camasa">CAMASA</div>
          <div class="brand-fallback-sub">Process System</div>
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
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    html, body {
      margin: 0;
      padding: 0;
      background: #070707;
      color: #f4ead7;
      font-family: "Helvetica Neue", Arial, sans-serif;
    }

    body {
      background:
        radial-gradient(circle at 50% 0%, rgba(255,255,255,0.04), transparent 24%),
        linear-gradient(180deg, #060606 0%, #111111 100%);
    }

    .page {
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      position: relative;
      overflow: hidden;
      page-break-after: always;
      background:
        radial-gradient(circle at 50% 0%, rgba(255,255,255,0.035), transparent 22%),
        radial-gradient(circle at 20% 18%, rgba(208,171,99,0.06), transparent 16%),
        radial-gradient(circle at 80% 12%, rgba(208,171,99,0.05), transparent 14%),
        linear-gradient(180deg, #0a0a0b 0%, #111113 100%);
    }

    .page:last-child {
      page-break-after: auto;
    }

    .page::before {
      content: "";
      position: absolute;
      inset: 0;
      background:
        linear-gradient(180deg, rgba(255,255,255,0.015), transparent 16%, transparent 84%, rgba(255,255,255,0.012)),
        repeating-linear-gradient(
          90deg,
          rgba(255,255,255,0.006) 0px,
          rgba(255,255,255,0.006) 1px,
          transparent 1px,
          transparent 90px
        ),
        repeating-linear-gradient(
          0deg,
          rgba(255,255,255,0.004) 0px,
          rgba(255,255,255,0.004) 1px,
          transparent 1px,
          transparent 80px
        );
      opacity: 0.38;
      pointer-events: none;
    }

    .page::after {
      content: "";
      position: absolute;
      inset: 8mm;
      border: 1px solid rgba(208,171,99,0.14);
      box-shadow:
        inset 0 0 0 1px rgba(255,255,255,0.015),
        inset 0 0 60px rgba(0,0,0,0.20);
      pointer-events: none;
    }

    .page-inner {
      position: relative;
      z-index: 2;
      padding: 14mm;
      min-height: 297mm;
    }

    .cover .page-inner {
      padding: 15mm 14mm 13mm 14mm;
      display: flex;
      flex-direction: column;
      min-height: 297mm;
      justify-content: space-between;
    }

    .cover {
      background:
        radial-gradient(circle at 50% 14%, rgba(255,255,255,0.05), transparent 18%),
        linear-gradient(180deg, #090909 0%, #101011 100%);
    }

    .cover-main {
      border: 1px solid rgba(208,171,99,0.18);
      min-height: 258mm;
      position: relative;
      padding: 14mm 12mm 10mm 12mm;
      box-shadow:
        inset 0 0 80px rgba(0,0,0,0.28),
        0 20px 50px rgba(0,0,0,0.20);
      background:
        linear-gradient(180deg, rgba(255,255,255,0.018), transparent 22%, transparent 78%, rgba(255,255,255,0.01)),
        radial-gradient(circle at 50% 6%, rgba(255,255,255,0.035), transparent 22%),
        linear-gradient(180deg, rgba(18,18,19,0.82), rgba(10,10,11,0.88));
    }

    .cover-main::before {
      content: "";
      position: absolute;
      inset: 0;
      background:
        linear-gradient(135deg, transparent 0%, transparent 84%, rgba(208,171,99,0.10) 100%),
        linear-gradient(315deg, transparent 0%, transparent 84%, rgba(208,171,99,0.08) 100%);
      pointer-events: none;
    }

    .cover-main::after {
      content: "";
      position: absolute;
      left: 9mm;
      top: 9mm;
      right: 9mm;
      bottom: 9mm;
      border: 1px solid rgba(208,171,99,0.10);
      pointer-events: none;
    }

    .brand-row {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      min-height: 36mm;
      margin-bottom: 5mm;
    }

    .brand-logo {
      max-width: 126mm;
      max-height: 32mm;
      object-fit: contain;
      filter:
        drop-shadow(0 8px 20px rgba(0,0,0,0.45))
        drop-shadow(0 2px 2px rgba(255,255,255,0.05));
    }

    .brand-fallback {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #f7f1e5;
    }

    .brand-fallback-cps {
      font-size: 30px;
      font-weight: 800;
      color: #d0ab63;
      letter-spacing: 1px;
    }

    .brand-fallback-camasa {
      font-size: 19px;
      font-weight: 700;
      letter-spacing: 1px;
    }

    .brand-fallback-sub {
      font-size: 12px;
      color: #d9cfbd;
      margin-top: 1px;
    }

    .gold-divider {
      width: 100%;
      height: 2px;
      background: linear-gradient(90deg, rgba(0,0,0,0), #d0ab63 16%, #f0d292 50%, #d0ab63 84%, rgba(0,0,0,0));
      box-shadow: 0 0 20px rgba(208,171,99,0.12);
      margin: 4mm 0 10mm 0;
    }

    .cover-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      margin-top: 4mm;
      flex: 1;
      justify-content: center;
    }

    .cover-kicker {
      color: #d4b16b;
      font-size: 10px;
      letter-spacing: 2.8px;
      text-transform: uppercase;
      margin-bottom: 5mm;
    }

    .cover-title {
      color: #f8f2e6;
      font-size: 21px;
      letter-spacing: 3px;
      text-transform: uppercase;
      line-height: 1.3;
      margin-bottom: 2mm;
    }

    .cover-title strong {
      display: block;
      font-size: 31px;
      letter-spacing: 2.4px;
      margin-top: 2mm;
      font-weight: 500;
    }

    .cover-subtitle {
      color: #d8cdb8;
      font-size: 10px;
      letter-spacing: 1.8px;
      text-transform: uppercase;
      margin-bottom: 12mm;
    }

    .cover-project-name {
      color: #f7f0e2;
      font-size: 21px;
      margin-bottom: 3mm;
    }

    .cover-meta {
      color: #d6cbb8;
      font-size: 13px;
      margin-bottom: 1.5mm;
    }

    .qr-box {
      display: flex;
      justify-content: center;
      margin-top: 10mm;
      margin-bottom: 8mm;
    }

    .qr-shell {
      width: 33mm;
      height: 33mm;
      border-radius: 4.5mm;
      background: #fff;
      padding: 2.4mm;
      border: 1px solid rgba(208,171,99,0.50);
      box-shadow:
        0 16px 34px rgba(0,0,0,0.30),
        inset 0 0 0 1px rgba(255,255,255,0.10);
    }

    .code-pill {
      display: inline-block;
      border: 1px solid rgba(208,171,99,0.34);
      border-radius: 3.2mm;
      padding: 3.4mm 8mm;
      background: linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015));
      color: #ecd59f;
      letter-spacing: 1px;
      font-size: 12px;
      box-shadow: inset 0 0 14px rgba(255,255,255,0.02);
    }

    .cover-footer {
      text-align: center;
      color: #d4c9b5;
      font-size: 9px;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-top: 10mm;
    }

    .section-kicker {
      color: #d0ab63;
      font-size: 10px;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-bottom: 2mm;
    }

    .section-title {
      color: #f8f2e6;
      font-size: 18px;
      letter-spacing: 1.6px;
      text-transform: uppercase;
      margin-bottom: 2.4mm;
    }

    .section-subtitle {
      color: #d4cab8;
      font-size: 11px;
      line-height: 1.65;
      max-width: 126mm;
      margin-bottom: 6mm;
    }

    .grid-2 {
      display: grid;
      grid-template-columns: 1.12fr 0.88fr;
      gap: 5mm;
    }

    .card {
      background:
        linear-gradient(180deg, rgba(255,255,255,0.025), transparent 20%),
        linear-gradient(180deg, rgba(22,22,24,0.78), rgba(11,11,12,0.90));
      border: 1px solid rgba(208,171,99,0.18);
      border-radius: 4mm;
      padding: 5mm;
      box-shadow:
        inset 0 0 30px rgba(255,255,255,0.015),
        0 18px 34px rgba(0,0,0,0.18);
      position: relative;
      overflow: hidden;
    }

    .card::after {
      content: "";
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, rgba(255,255,255,0.01), transparent 24%);
      pointer-events: none;
    }

    .metric-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 4mm;
      margin-bottom: 4mm;
    }

    .metric-card {
      min-height: 30mm;
      padding: 3mm 2.5mm;
      text-align: center;
      border-radius: 3.2mm;
      border: 1px solid rgba(208,171,99,0.16);
      background:
        linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.008)),
        rgba(8,8,9,0.26);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }

    .metric-icon {
      color: #d0ab63;
      font-size: 12px;
      margin-bottom: 2mm;
    }

    .metric-label {
      color: #d7ccba;
      font-size: 8px;
      line-height: 1.35;
      min-height: 8mm;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .metric-value {
      color: #f8f2e6;
      font-size: 18px;
      margin-top: 1.5mm;
    }

    .mini-two {
      display: grid;
      grid-template-columns: 1.02fr 0.98fr;
      gap: 4mm;
    }

    .distribution-line {
      width: 100%;
      height: 3mm;
      background: rgba(255,255,255,0.07);
      border-radius: 999px;
      overflow: hidden;
      margin-top: 2mm;
    }

    .distribution-fill {
      height: 100%;
      background: linear-gradient(90deg, #b38d49 0%, #e6c983 45%, #d0ab63 100%);
      box-shadow: 0 0 20px rgba(208,171,99,0.14);
    }

    .material-spot {
      display: grid;
      grid-template-columns: 33mm 1fr;
      gap: 4mm;
      align-items: stretch;
    }

    .material-thumb {
      min-height: 31mm;
      border-radius: 3mm;
      border: 1px solid rgba(208,171,99,0.16);
      background:
        radial-gradient(circle at 28% 24%, rgba(255,255,255,0.14), transparent 11%),
        radial-gradient(circle at 62% 34%, rgba(255,255,255,0.10), transparent 9%),
        linear-gradient(145deg, #0f1112 0%, #2d3238 14%, #131517 29%, #515860 45%, #1a1d20 61%, #111214 76%, #454b53 90%, #16191b 100%);
      box-shadow: inset 0 0 24px rgba(255,255,255,0.02);
    }

    .material-title {
      color: #f8f2e6;
      font-size: 13px;
      margin-bottom: 1.2mm;
    }

    .material-small {
      color: #d0c6b5;
      font-size: 10px;
      line-height: 1.45;
      margin-bottom: 1mm;
    }

    .ring-wrap {
      display: grid;
      grid-template-columns: 33mm 1fr;
      gap: 4mm;
      align-items: center;
    }

    .ring {
      width: 30mm;
      height: 30mm;
      border-radius: 50%;
      background:
        radial-gradient(circle at center, #0d0d10 50%, transparent 51%),
        conic-gradient(#d0ab63 calc(var(--p) * 1%), rgba(255,255,255,0.08) 0);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto;
      box-shadow:
        0 12px 26px rgba(0,0,0,0.28),
        inset 0 0 12px rgba(255,255,255,0.03);
    }

    .ring-inner {
      width: 18mm;
      height: 18mm;
      border-radius: 50%;
      background: linear-gradient(180deg, rgba(18,18,19,0.98), rgba(8,8,9,0.96));
      display: flex;
      align-items: center;
      justify-content: center;
      color: #f7eedb;
      font-size: 14px;
      font-weight: 600;
    }

    .ring-side-title {
      color: #d0ab63;
      font-size: 8px;
      letter-spacing: 1px;
      text-transform: uppercase;
      margin-bottom: 1.5mm;
    }

    .ring-side-line {
      color: #f5eddf;
      font-size: 12px;
      margin-bottom: 1.5mm;
    }

    .ring-side-small {
      color: #d0c6b5;
      font-size: 10px;
      line-height: 1.5;
      margin-bottom: 1mm;
    }

    .big-ring-area {
      display: grid;
      grid-template-columns: 1fr 50mm;
      gap: 5mm;
      align-items: start;
    }

    .ring-big {
      width: 48mm;
      height: 48mm;
      border-radius: 50%;
      background:
        radial-gradient(circle at center, #0d0d10 44%, transparent 45%),
        conic-gradient(#d0ab63 calc(var(--p) * 1%), rgba(255,255,255,0.09) 0);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-left: auto;
      box-shadow:
        0 16px 34px rgba(0,0,0,0.32),
        inset 0 0 14px rgba(255,255,255,0.03);
    }

    .ring-big-inner {
      width: 24mm;
      height: 24mm;
      border-radius: 50%;
      background: linear-gradient(180deg, rgba(18,18,19,0.98), rgba(8,8,9,0.98));
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: #f7eedb;
      text-align: center;
    }

    .ring-big-percent {
      font-size: 17px;
      font-weight: 700;
      line-height: 1;
    }

    .ring-big-caption {
      font-size: 7px;
      color: #d8cebc;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-top: 1mm;
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
      border: 1px solid rgba(208,171,99,0.44);
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
      background: rgba(208,171,99,0.32);
    }

    .timeline-dot {
      width: 7mm;
      height: 7mm;
      margin: 0 auto 2mm auto;
      border-radius: 50%;
      border: 1px solid rgba(208,171,99,0.44);
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
      background: radial-gradient(circle at center, rgba(208,171,99,0.25), rgba(0,0,0,0.36));
      box-shadow: 0 0 14px rgba(208,171,99,0.15);
    }

    .timeline-label {
      color: #d4cab8;
      font-size: 9px;
      line-height: 1.35;
    }

    .material-panel-grid {
      display: grid;
      grid-template-columns: 0.94fr 1.06fr;
      gap: 5mm;
    }

    .material-sheet {
      min-height: 64mm;
      border-radius: 3mm;
      border: 1px solid rgba(208,171,99,0.18);
      background:
        radial-gradient(circle at 22% 20%, rgba(255,255,255,0.12), transparent 10%),
        radial-gradient(circle at 60% 26%, rgba(255,255,255,0.08), transparent 8%),
        linear-gradient(145deg, #111315 0%, #2e343a 14%, #15171a 30%, #59616a 46%, #202428 63%, #111214 80%, #484f58 92%, #181b1d 100%);
      box-shadow: inset 0 0 26px rgba(255,255,255,0.02);
      margin-bottom: 4mm;
    }

    .badge-row {
      display: flex;
      flex-wrap: wrap;
      gap: 2mm;
      margin-bottom: 3mm;
    }

    .badge {
      border: 1px solid rgba(208,171,99,0.25);
      border-radius: 999px;
      padding: 1.3mm 3mm;
      font-size: 9px;
      color: #e9dcc2;
      background: rgba(255,255,255,0.025);
    }

    .photo-panel {
      min-height: 65mm;
      border-radius: 3mm;
      border: 1px solid rgba(208,171,99,0.18);
      background:
        radial-gradient(circle at 50% 0%, rgba(255,255,255,0.05), transparent 18%),
        linear-gradient(160deg, #131313 0%, #1e1e20 18%, #0d0d0e 40%, #252527 64%, #0b0b0c 100%);
      position: relative;
      overflow: hidden;
    }

    .photo-panel::before {
      content: "";
      position: absolute;
      inset: 10%;
      border: 1px solid rgba(208,171,99,0.12);
      transform: rotate(-6deg);
    }

    .photo-panel::after {
      content: "CAMASA";
      position: absolute;
      right: 8mm;
      bottom: 7mm;
      color: rgba(208,171,99,0.20);
      font-size: 18px;
      letter-spacing: 3px;
    }

    .panel-caption {
      color: #d3c8b6;
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
      color: #f6efdf;
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
      gap: 2.4mm;
      align-items: flex-start;
      color: #d4c9b8;
      font-size: 10px;
      line-height: 1.45;
    }

    .bullet {
      flex: 0 0 auto;
      width: 5mm;
      height: 5mm;
      border-radius: 50%;
      border: 1px solid rgba(208,171,99,0.30);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 8px;
      margin-top: 0.35mm;
    }

    .bullet.good { color: #dcc67c; }
    .bullet.bad { color: #d98e85; }
    .bullet.alert { color: #e1c57a; }

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
      border: 1px solid rgba(208,171,99,0.18);
      background:
        linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,255,255,0.01)),
        rgba(10,10,10,0.18);
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
      color: #f8f1e3;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 1.5mm;
    }

    .pillar-subtitle {
      color: #d3c9b7;
      font-size: 9px;
      line-height: 1.4;
    }

    .care-footer {
      margin-top: 4mm;
      border: 1px solid rgba(208,171,99,0.18);
      border-radius: 3mm;
      padding: 4mm;
      color: #d6ccbb;
      font-size: 10px;
      background: rgba(255,255,255,0.02);
      line-height: 1.6;
    }

    .certificate {
      background:
        radial-gradient(circle at 50% 8%, rgba(255,255,255,0.05), transparent 20%),
        linear-gradient(180deg, #090909 0%, #111113 100%);
    }

    .certificate-shell {
      position: relative;
      min-height: 258mm;
      border: 1px solid rgba(208,171,99,0.20);
      padding: 10mm;
      background:
        linear-gradient(180deg, rgba(255,255,255,0.018), transparent 18%),
        linear-gradient(180deg, rgba(17,17,18,0.82), rgba(8,8,9,0.90));
      box-shadow:
        inset 0 0 80px rgba(0,0,0,0.30),
        0 20px 44px rgba(0,0,0,0.18);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    .certificate-shell::before,
    .certificate-shell::after {
      content: "";
      position: absolute;
      width: 18mm;
      height: 18mm;
      pointer-events: none;
    }

    .certificate-shell::before {
      top: 6mm;
      left: 6mm;
      border-top: 1px solid rgba(208,171,99,0.40);
      border-left: 1px solid rgba(208,171,99,0.40);
    }

    .certificate-shell::after {
      right: 6mm;
      bottom: 6mm;
      border-right: 1px solid rgba(208,171,99,0.40);
      border-bottom: 1px solid rgba(208,171,99,0.40);
    }

    .certificate-top {
      display: flex;
      justify-content: center;
      margin-top: 6mm;
      margin-bottom: 6mm;
    }

    .certificate-top .brand-logo {
      max-width: 108mm;
      max-height: 28mm;
    }

    .certificate-title {
      text-align: center;
      color: #f7f0e3;
      font-size: 18px;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-bottom: 2mm;
    }

    .certificate-sub {
      text-align: center;
      color: #d0ab63;
      font-size: 10px;
      letter-spacing: 1.6px;
      text-transform: uppercase;
      margin-bottom: 1.5mm;
    }

    .certificate-code {
      text-align: center;
      color: #f7efdd;
      font-size: 19px;
      letter-spacing: 1px;
      margin: 7mm 0 8mm 0;
    }

    .certificate-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4mm 8mm;
      width: 100%;
      max-width: 128mm;
      margin: 0 auto;
    }

    .certificate-field {
      border-bottom: 1px solid rgba(208,171,99,0.18);
      padding-bottom: 2mm;
    }

    .field-label {
      color: #d0ab63;
      font-size: 8px;
      letter-spacing: 1px;
      text-transform: uppercase;
      margin-bottom: 1mm;
    }

    .field-value {
      color: #f5ecdd;
      font-size: 12px;
    }

    .certificate-qr {
      display: flex;
      justify-content: center;
      margin-top: 8mm;
      margin-bottom: 6mm;
    }

    .footer-note {
      text-align: center;
      color: #cfc5b4;
      font-size: 8.5px;
      line-height: 1.55;
      margin-top: 5mm;
      max-width: 130mm;
      margin-left: auto;
      margin-right: auto;
    }

    .certificate-bottom-logo {
      display: flex;
      justify-content: center;
      padding-top: 8mm;
    }

    .certificate-bottom-logo .brand-logo {
      max-width: 82mm;
      max-height: 22mm;
      opacity: 0.96;
    }
  </style>
</head>
<body>
  <section class="page cover">
    <div class="page-inner">
      <div class="cover-main">
        <div class="brand-row">
          ${logoHtml}
        </div>

        <div class="gold-divider"></div>

        <div class="cover-content">
          <div class="cover-kicker">Camasa Process System</div>
          <div class="cover-title">
            Camasa
            <strong>Signature Book</strong>
          </div>
          <div class="cover-subtitle">
            ${documentType}<br />
            Documento de entrega premium
          </div>

          <div class="cover-project-name">${projectName}</div>
          <div class="cover-meta">${clientName}</div>
          <div class="cover-meta">${location}</div>

          <div class="qr-box">
            <div class="qr-shell">
              <img
                src="https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(signatureCode)}"
                alt="QR Code"
                style="width:100%;height:100%;object-fit:cover;"
              />
            </div>
          </div>

          <div class="code-pill">${signatureCode}</div>
        </div>

        <div class="cover-footer">
          Gerado em ${issueDate}
        </div>
      </div>
    </div>
  </section>

  <section class="page">
    <div class="page-inner">
      <div class="section-kicker">Resumo Executivo</div>
      <div class="section-title">${projectName}</div>
      <div class="section-subtitle">
        Documento de garantia, rastreabilidade e orientação de uso do projeto.
        Composição premium para leitura institucional, técnica e visual.
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

            <div class="mini-two">
              <div class="card" style="margin:0; min-height:36mm;">
                <div class="section-kicker" style="margin-bottom:1.5mm;">Distribuição por aplicação</div>
                <div style="color:#f7efdf; font-size:12px;">${applicationLabel}</div>
                <div class="distribution-line">
                  <div class="distribution-fill" style="width:${applicationPercent}%"></div>
                </div>
                <div style="text-align:right; color:#d4c8b6; font-size:10px; margin-top:1.8mm;">${applicationPercent}%</div>
              </div>

              <div class="card" style="margin:0; min-height:36mm;">
                <div class="section-kicker" style="margin-bottom:1.5mm;">Material Utilizado</div>
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
            <div class="ring-wrap">
              <div class="ring" style="--p:${progressPercent}">
                <div class="ring-inner">${progressPercent}%</div>
              </div>
              <div>
                <div class="ring-side-title">Progresso Geral</div>
                <div class="ring-side-line">${progressPercent}% concluído</div>
                <div class="ring-side-small">Etapa atual: ${currentStage}</div>
                <div class="ring-side-small">Documento emitido em ${issueDate}</div>
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
    </div>
  </section>

  <section class="page">
    <div class="page-inner">
      <div class="section-kicker">Etapas da Obra</div>
      <div class="section-title">Acompanhamento e rastreabilidade</div>
      <div class="section-subtitle">
        Visão executiva das etapas principais do projeto, progresso realizado
        e previsão de entrega.
      </div>

      <div class="card">
        <div class="big-ring-area">
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
    </div>
  </section>

  <section class="page">
    <div class="page-inner">
      <div class="section-kicker">Painel de Materiais</div>
      <div class="section-title">${material}</div>
      <div class="section-subtitle">
        Referência cadastrada, categoria técnica, acabamento e aplicação principal
        da peça especificada no projeto.
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
            Registro visual institucional do projeto e associação do material
            com a linguagem premium do documento.
          </div>
          <div class="panel-caption">
            Uso previsto: ${materialCareText}
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="page">
    <div class="page-inner">
      <div class="section-kicker">Manual de Uso e Conservação</div>
      <div class="section-title">Cuidados essenciais</div>
      <div class="section-subtitle">
        Orientações práticas para preservar estética, integridade e desempenho
        da superfície ao longo do tempo.
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

      <div class="card list-card">
        <div class="list-card-title">Alertas importantes</div>
        <ul>
          ${buildList(alerts, "alert")}
        </ul>
      </div>
    </div>
  </section>

  <section class="page">
    <div class="page-inner">
      <div class="section-kicker">Camasa Care</div>
      <div class="section-title">Preserve a beleza</div>
      <div class="section-subtitle">
        Conservação contínua, orientação preventiva e manutenção coerente com
        materiais nobres e projetos de alto padrão.
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
    </div>
  </section>

  <section class="page certificate">
    <div class="page-inner">
      <div class="certificate-shell">
        <div>
          <div class="certificate-top">
            ${logoHtml}
          </div>

          <div class="gold-divider" style="margin-top:0; margin-bottom:7mm;"></div>

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
              <img
                src="https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(signatureCode)}"
                alt="QR Code"
                style="width:100%;height:100%;object-fit:cover;"
              />
            </div>
          </div>

          <div class="footer-note">
            Este documento integra rastreabilidade visual, técnica e institucional,
            vinculando material, aplicação, cuidado e identidade documental em padrão premium.
          </div>
        </div>

        <div class="certificate-bottom-logo">
          ${logoHtml}
        </div>
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
        materialCareText: "Uso interno • vedado • limpeza controlada",
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
