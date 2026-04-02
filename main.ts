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
    { title: "PRESERVAR", subtitle: "Rotina correta de limpeza e conservação" },
    { title: "PROTEGER", subtitle: "Uso consciente e prevenção de manchas" },
    { title: "REVISAR", subtitle: "Acompanhamento técnico e manutenção visual" },
  ];
}

function buildSteps(percent: number): string {
  const steps = ["Projeto", "Medição", "Acabamento", "Instalação", "Finalização"];
  const activeIndex =
    percent >= 100
      ? steps.length - 1
      : Math.max(0, Math.min(steps.length - 1, Math.floor(percent / 20)));

  return steps
    .map((label, index) => {
      const state =
        index < activeIndex ? "done" : index === activeIndex ? "current" : "pending";

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
  const documentType = escapeHtml(data.documentType || "DOCUMENTO DE ENTREGA PREMIUM");
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
  const applicationPercent = Math.max(0, Math.min(100, Number(data.applicationPercent ?? 100)));
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
    "Manter inspeção visual periódica em quinas e áreas críticas.",
  ]);

  const dontList = normalizeArray(data.dontList, [
    "Não usar ácido, cloro, saponáceo ou produto abrasivo.",
    "Não apoiar panelas superaquecidas diretamente na peça.",
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
      background: #151517;
      color: #f3e8d1;
      font-family: "Helvetica Neue", Arial, sans-serif;
    }

    body {
      background:
        radial-gradient(circle at 50% 0%, rgba(255,255,255,0.04), transparent 24%),
        linear-gradient(180deg, #18181b 0%, #202025 100%);
    }

    .page {
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      position: relative;
      overflow: hidden;
      page-break-after: always;
      background:
        radial-gradient(circle at 48% 10%, rgba(255,255,255,0.02), transparent 18%),
        linear-gradient(180deg, #1a1a1d 0%, #24242a 100%);
    }

    .page:last-child {
      page-break-after: auto;
    }

    .page::before {
      content: "";
      position: absolute;
      inset: 0;
      background:
        radial-gradient(circle at 12% 18%, rgba(214,178,107,0.12), transparent 16%),
        radial-gradient(circle at 82% 14%, rgba(214,178,107,0.10), transparent 15%),
        radial-gradient(circle at 84% 88%, rgba(214,178,107,0.12), transparent 18%),
        linear-gradient(118deg,
          transparent 0%,
          rgba(255,255,255,0.02) 8%,
          transparent 14%,
          transparent 20%,
          rgba(214,178,107,0.08) 26%,
          transparent 33%,
          transparent 43%,
          rgba(255,255,255,0.02) 49%,
          transparent 56%,
          transparent 68%,
          rgba(214,178,107,0.07) 74%,
          transparent 80%,
          transparent 100%
        ),
        linear-gradient(24deg,
          transparent 0%,
          transparent 14%,
          rgba(255,255,255,0.018) 19%,
          transparent 25%,
          transparent 38%,
          rgba(214,178,107,0.08) 44%,
          transparent 50%,
          transparent 63%,
          rgba(255,255,255,0.016) 68%,
          transparent 73%,
          transparent 88%,
          rgba(214,178,107,0.05) 93%,
          transparent 100%
        ),
        linear-gradient(144deg,
          rgba(255,255,255,0.015) 0%,
          transparent 5%,
          transparent 17%,
          rgba(214,178,107,0.045) 21%,
          transparent 28%,
          transparent 39%,
          rgba(255,255,255,0.015) 44%,
          transparent 51%,
          transparent 67%,
          rgba(214,178,107,0.045) 72%,
          transparent 79%,
          transparent 100%
        ),
        repeating-linear-gradient(
          104deg,
          rgba(255,255,255,0.012) 0px,
          rgba(255,255,255,0.012) 1px,
          transparent 1px,
          transparent 120px
        ),
        repeating-linear-gradient(
          77deg,
          rgba(214,178,107,0.022) 0px,
          rgba(214,178,107,0.022) 1px,
          transparent 1px,
          transparent 150px
        );
      opacity: 1;
      pointer-events: none;
      mix-blend-mode: screen;
    }

    .page::after {
      content: "";
      position: absolute;
      inset: 7mm;
      border: 1px solid rgba(214,178,107,0.09);
      box-shadow:
        inset 0 0 0 1px rgba(255,255,255,0.008),
        inset 0 0 90px rgba(0,0,0,0.14);
      pointer-events: none;
    }

    .page-inner {
      position: relative;
      z-index: 2;
      padding: 14mm;
      min-height: 297mm;
    }

    .cover .page-inner {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 15mm 14mm 13mm 14mm;
    }

    .cover-main {
      min-height: 258mm;
      position: relative;
      border: 1px solid rgba(214,178,107,0.12);
      background:
        linear-gradient(180deg, rgba(255,255,255,0.012), transparent 18%, transparent 82%, rgba(255,255,255,0.007)),
        linear-gradient(180deg, rgba(36,36,40,0.70), rgba(20,20,23,0.80));
      box-shadow:
        inset 0 0 90px rgba(0,0,0,0.24),
        0 18px 44px rgba(0,0,0,0.12);
      padding: 13mm 12mm 10mm 12mm;
      overflow: hidden;
    }

    .cover-main::before {
      content: "";
      position: absolute;
      inset: 0;
      background:
        linear-gradient(132deg, transparent 0%, transparent 84%, rgba(214,178,107,0.08) 100%),
        linear-gradient(318deg, transparent 0%, transparent 84%, rgba(214,178,107,0.06) 100%);
      pointer-events: none;
    }

    .cover-main::after {
      content: "";
      position: absolute;
      left: 12mm;
      top: 12mm;
      right: 12mm;
      bottom: 12mm;
      border: 1px solid rgba(214,178,107,0.06);
      pointer-events: none;
    }

    .brand-row {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      min-height: 40mm;
      margin-bottom: 5mm;
    }

    .brand-logo {
      max-width: 154mm;
      max-height: 39mm;
      object-fit: contain;
      filter:
        drop-shadow(0 10px 24px rgba(0,0,0,0.34))
        drop-shadow(0 2px 2px rgba(255,255,255,0.04));
    }

    .brand-fallback {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #f6f1e7;
    }

    .brand-fallback-cps {
      font-size: 34px;
      font-weight: 800;
      color: #d8b36c;
      letter-spacing: 1px;
    }

    .brand-fallback-camasa {
      font-size: 20px;
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
      background: linear-gradient(90deg, rgba(0,0,0,0), #c79946 18%, #f0cd83 50%, #c79946 82%, rgba(0,0,0,0));
      box-shadow: 0 0 16px rgba(214,178,107,0.12);
      margin: 5mm 0 10mm 0;
    }

    .cover-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      flex: 1;
      justify-content: center;
      margin-top: 2mm;
    }

    .cover-title {
      color: #f7f1e5;
      font-size: 21px;
      letter-spacing: 2.8px;
      text-transform: uppercase;
      line-height: 1.25;
      margin-bottom: 2mm;
      text-shadow: 0 1px 0 rgba(255,255,255,0.02);
    }

    .cover-title strong {
      display: block;
      font-size: 31px;
      font-weight: 500;
      letter-spacing: 2.8px;
      margin-top: 2mm;
    }

    .cover-subtitle {
      color: #d7ccb7;
      font-size: 10px;
      letter-spacing: 2px;
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
      border: 1px solid rgba(214,178,107,0.42);
      box-shadow:
        0 16px 34px rgba(0,0,0,0.24),
        inset 0 0 0 1px rgba(255,255,255,0.08);
    }

    .code-pill {
      display: inline-block;
      border: 1px solid rgba(214,178,107,0.28);
      border-radius: 3.2mm;
      padding: 3.4mm 8mm;
      background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.012));
      color: #ecd59f;
      letter-spacing: 1px;
      font-size: 12px;
      box-shadow: inset 0 0 14px rgba(255,255,255,0.015);
    }

    .cover-footer {
      text-align: center;
      color: #d4c9b5;
      font-size: 9px;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-top: 10mm;
    }

    .section-title {
      color: #f8f2e6;
      font-size: 19px;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-bottom: 2.2mm;
      font-weight: 500;
      text-shadow: 0 1px 0 rgba(255,255,255,0.02);
    }

    .section-kicker {
      color: #d8b36c;
      font-size: 10px;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-bottom: 2mm;
    }

    .section-subtitle {
      color: #d6cab6;
      font-size: 11px;
      line-height: 1.65;
      max-width: 128mm;
      margin-bottom: 6mm;
    }

    .grid-2 {
      display: grid;
      grid-template-columns: 1.22fr 0.78fr;
      gap: 5mm;
    }

    .card {
      position: relative;
      overflow: hidden;
      background:
        linear-gradient(180deg, rgba(255,255,255,0.02), transparent 20%),
        linear-gradient(180deg, rgba(30,30,34,0.66), rgba(18,18,21,0.76));
      border: 1px solid rgba(214,178,107,0.12);
      border-radius: 4mm;
      padding: 5mm;
      box-shadow:
        inset 0 0 36px rgba(255,255,255,0.01),
        0 16px 28px rgba(0,0,0,0.10);
    }

    .card::after {
      content: "";
      position: absolute;
      inset: 0;
      background:
        linear-gradient(180deg, rgba(255,255,255,0.010), transparent 24%),
        linear-gradient(115deg, transparent 0%, transparent 75%, rgba(214,178,107,0.03) 100%);
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
      border: 1px solid rgba(214,178,107,0.11);
      background:
        linear-gradient(180deg, rgba(255,255,255,0.015), rgba(255,255,255,0.006)),
        rgba(8,8,9,0.14);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }

    .metric-icon {
      color: #d8b36c;
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

    .executive-lower-grid {
      display: grid;
      grid-template-columns: 0.82fr 1.18fr;
      gap: 4mm;
    }

    .distribution-line {
      width: 100%;
      height: 3mm;
      background: rgba(255,255,255,0.06);
      border-radius: 999px;
      overflow: hidden;
      margin-top: 2mm;
    }

    .distribution-fill {
      height: 100%;
      background: linear-gradient(90deg, #b78f48 0%, #e8c77f 50%, #d8b36c 100%);
      box-shadow: 0 0 16px rgba(214,178,107,0.10);
    }

    .executive-material-row {
      display: grid;
      grid-template-columns: 38mm minmax(0, 1fr);
      gap: 4mm;
      align-items: start;
    }

    .executive-material-thumb {
      min-height: 38mm;
      border-radius: 3mm;
      border: 1px solid rgba(214,178,107,0.14);
      background:
        radial-gradient(circle at 28% 24%, rgba(255,255,255,0.12), transparent 11%),
        radial-gradient(circle at 62% 34%, rgba(255,255,255,0.08), transparent 9%),
        linear-gradient(145deg, #1d2023 0%, #414750 16%, #24272b 29%, #636b74 45%, #2d3237 60%, #1f2124 75%, #555c64 90%, #25282b 100%);
      box-shadow: inset 0 0 22px rgba(255,255,255,0.015);
    }

    .executive-material-content {
      min-width: 0;
    }

    .executive-material-name {
      color: #f8f2e6;
      font-size: 15px;
      line-height: 1.28;
      margin-bottom: 2mm;
      white-space: normal;
      word-break: keep-all;
      overflow-wrap: break-word;
    }

    .executive-material-meta {
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
        radial-gradient(circle at center, #161618 50%, transparent 51%),
        conic-gradient(#d8b36c calc(var(--p) * 1%), rgba(255,255,255,0.07) 0);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto;
      box-shadow:
        0 10px 22px rgba(0,0,0,0.18),
        inset 0 0 10px rgba(255,255,255,0.02);
    }

    .ring-inner {
      width: 18mm;
      height: 18mm;
      border-radius: 50%;
      background: linear-gradient(180deg, rgba(28,28,30,0.98), rgba(18,18,20,0.98));
      display: flex;
      align-items: center;
      justify-content: center;
      color: #f7eedb;
      font-size: 14px;
      font-weight: 600;
    }

    .ring-side-title {
      color: #d8b36c;
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
        radial-gradient(circle at center, #161618 44%, transparent 45%),
        conic-gradient(#d8b36c calc(var(--p) * 1%), rgba(255,255,255,0.08) 0);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-left: auto;
      box-shadow:
        0 14px 28px rgba(0,0,0,0.18),
        inset 0 0 14px rgba(255,255,255,0.02);
    }

    .ring-big-inner {
      width: 24mm;
      height: 24mm;
      border-radius: 50%;
      background: linear-gradient(180deg, rgba(29,29,31,0.98), rgba(18,18,20,0.98));
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
      border: 1px solid rgba(214,178,107,0.34);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #d8b36c;
      font-size: 9px;
      background: rgba(255,255,255,0.02);
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
      background: rgba(214,178,107,0.25);
    }

    .timeline-dot {
      width: 7mm;
      height: 7mm;
      margin: 0 auto 2mm auto;
      border-radius: 50%;
      border: 1px solid rgba(214,178,107,0.34);
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255,255,255,0.02);
      color: #d8b36c;
      font-size: 9px;
      position: relative;
      z-index: 2;
    }

    .timeline-step.done .timeline-dot,
    .timeline-step.current .timeline-dot {
      background: radial-gradient(circle at center, rgba(214,178,107,0.18), rgba(0,0,0,0.22));
      box-shadow: 0 0 10px rgba(214,178,107,0.10);
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
      border: 1px solid rgba(214,178,107,0.14);
      background:
        radial-gradient(circle at 22% 20%, rgba(255,255,255,0.10), transparent 10%),
        radial-gradient(circle at 60% 26%, rgba(255,255,255,0.07), transparent 8%),
        linear-gradient(145deg, #202327 0%, #444b54 16%, #292d31 30%, #67717b 46%, #33383d 63%, #222528 80%, #5d6670 92%, #2a2d31 100%);
      box-shadow: inset 0 0 24px rgba(255,255,255,0.012);
      margin-bottom: 4mm;
    }

    .badge-row {
      display: flex;
      flex-wrap: wrap;
      gap: 2mm;
      margin-bottom: 3mm;
    }

    .badge {
      border: 1px solid rgba(214,178,107,0.20);
      border-radius: 999px;
      padding: 1.3mm 3mm;
      font-size: 9px;
      color: #e9dcc2;
      background: rgba(255,255,255,0.018);
    }

    .material-title {
      color: #f8f2e6;
      font-size: 13px;
      line-height: 1.35;
      margin-bottom: 1.6mm;
      white-space: normal;
      word-break: normal;
      overflow-wrap: break-word;
    }

    .material-small {
      color: #d0c6b5;
      font-size: 10px;
      line-height: 1.45;
      margin-bottom: 1mm;
    }

    .photo-panel {
      min-height: 65mm;
      border-radius: 3mm;
      border: 1px solid rgba(214,178,107,0.14);
      position: relative;
      overflow: hidden;
      background:
        radial-gradient(circle at 20% 18%, rgba(255,255,255,0.05), transparent 10%),
        radial-gradient(circle at 80% 82%, rgba(214,178,107,0.08), transparent 18%),
        linear-gradient(155deg,
          #1a1a1c 0%,
          #252528 18%,
          #171719 38%,
          #2f2f33 58%,
          #19191b 74%,
          #242427 100%
        );
      box-shadow: inset 0 0 28px rgba(255,255,255,0.012);
    }

    .photo-panel::before {
      content: "";
      position: absolute;
      inset: 8%;
      border: 1px solid rgba(214,178,107,0.14);
      transform: rotate(-5deg);
    }

    .photo-panel::after {
      content: "";
      position: absolute;
      inset: 0;
      background:
        linear-gradient(118deg,
          transparent 0%,
          transparent 20%,
          rgba(255,255,255,0.02) 25%,
          transparent 31%,
          transparent 56%,
          rgba(214,178,107,0.04) 61%,
          transparent 67%,
          transparent 100%
        ),
        linear-gradient(28deg,
          transparent 0%,
          transparent 18%,
          rgba(255,255,255,0.016) 22%,
          transparent 28%,
          transparent 70%,
          rgba(214,178,107,0.03) 74%,
          transparent 80%
        );
      pointer-events: none;
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
      border: 1px solid rgba(214,178,107,0.24);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 8px;
      margin-top: 0.35mm;
    }

    .bullet.good { color: #dcc67c; }
    .bullet.bad { color: #d98e85; }
    .bullet.alert { color: #e1c57a; }

    .care-hero {
      margin-top: 4mm;
      margin-bottom: 5mm;
      border: 1px solid rgba(214,178,107,0.14);
      border-radius: 3mm;
      padding: 5mm;
      background:
        linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01)),
        rgba(10,10,10,0.10);
    }

    .care-hero-title {
      color: #f8f1e3;
      font-size: 15px;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 2mm;
    }

    .care-hero-text {
      color: #d6ccbb;
      font-size: 10px;
      line-height: 1.65;
    }

    .pillars-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 4mm;
      margin-top: 4mm;
      margin-bottom: 4mm;
    }

    .pillar-card {
      min-height: 40mm;
      border-radius: 3mm;
      border: 1px solid rgba(214,178,107,0.14);
      background:
        linear-gradient(180deg, rgba(255,255,255,0.015), rgba(255,255,255,0.008)),
        rgba(10,10,10,0.10);
      text-align: center;
      padding: 4mm 3mm;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }

    .pillar-icon {
      color: #d8b36c;
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
      border: 1px solid rgba(214,178,107,0.14);
      border-radius: 3mm;
      padding: 4mm;
      color: #d6ccbb;
      font-size: 10px;
      background: rgba(255,255,255,0.014);
      line-height: 1.6;
    }

    .certificate .page-inner {
      padding-top: 15mm;
    }

    .certificate-shell {
      position: relative;
      min-height: 258mm;
      border: 1px solid rgba(214,178,107,0.15);
      padding: 10mm;
      background:
        linear-gradient(180deg, rgba(255,255,255,0.012), transparent 18%),
        linear-gradient(180deg, rgba(29,29,32,0.70), rgba(17,17,19,0.82));
      box-shadow:
        inset 0 0 90px rgba(0,0,0,0.24),
        0 20px 44px rgba(0,0,0,0.12);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow: hidden;
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
      top: 7mm;
      left: 7mm;
      border-top: 1px solid rgba(214,178,107,0.26);
      border-left: 1px solid rgba(214,178,107,0.26);
    }

    .certificate-shell::after {
      right: 7mm;
      bottom: 7mm;
      border-right: 1px solid rgba(214,178,107,0.26);
      border-bottom: 1px solid rgba(214,178,107,0.26);
    }

    .certificate-top {
      display: flex;
      justify-content: center;
      margin-top: 6mm;
      margin-bottom: 6mm;
    }

    .certificate-top .brand-logo {
      max-width: 132mm;
      max-height: 34mm;
    }

    .certificate-title {
      text-align: center;
      color: #f7f0e3;
      font-size: 19px;
      text-transform: uppercase;
      letter-spacing: 2.2px;
      margin-bottom: 2mm;
      font-weight: 500;
    }

    .certificate-sub {
      text-align: center;
      color: #d8b36c;
      font-size: 10px;
      letter-spacing: 1.8px;
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
      border-bottom: 1px solid rgba(214,178,107,0.16);
      padding-bottom: 2mm;
    }

    .field-label {
      color: #d8b36c;
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
      max-width: 96mm;
      max-height: 26mm;
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
          <div class="cover-title">
            CAMASA
            <strong>SIGNATURE BOOK</strong>
          </div>
          <div class="cover-subtitle">${documentType}</div>

          <div class="cover-project-name">${projectName}</div>
          <div class="cover-meta">${clientName}</div>
          <div class="cover-meta">${location}</div>

          <div class="qr-box">
            <div class="qr-shell" style="display:flex;align-items:center;justify-content:center;background:linear-gradient(180deg,#fff,#f3f3f3);">
              <div style="width:24mm;height:24mm;border:2px solid #111;display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr);gap:1.2mm;padding:1.6mm;">
                <div style="background:#111;"></div><div style="background:#111;"></div><div style="background:#111;"></div>
                <div style="background:#111;"></div><div style="background:#fff;border:1px solid #111;"></div><div style="background:#111;"></div>
                <div style="background:#111;"></div><div style="background:#111;"></div><div style="background:#111;"></div>
              </div>
            </div>
          </div>

          <div class="code-pill">${signatureCode}</div>
        </div>

        <div class="cover-footer">
          GERADO EM ${issueDate}
        </div>
      </div>
    </div>
  </section>

  <section class="page">
    <div class="page-inner">
      <div class="section-title">RESUMO EXECUTIVO</div>
      <div style="color:#f7f0e2;font-size:20px;margin-bottom:2mm;">${projectName}</div>
      <div class="section-subtitle">
        Documento de garantia, conexão estética e leitura executiva do projeto, organizado em padrão
        premium para acompanhamento técnico e visual.
      </div>

      <div class="grid-2">
        <div>
          <div class="card" style="margin-bottom:5mm;">
            <div class="metric-grid">
              <div class="metric-card">
                <div class="metric-icon">♡</div>
                <div class="metric-label">MATERIAIS CERTIFICADOS</div>
                <div class="metric-value">1</div>
              </div>
              <div class="metric-card">
                <div class="metric-icon">⌂</div>
                <div class="metric-label">CATEGORIAS TÉCNICAS</div>
                <div class="metric-value">1</div>
              </div>
              <div class="metric-card">
                <div class="metric-icon">▣</div>
                <div class="metric-label">BLOCOS DE ORIENTAÇÃO</div>
                <div class="metric-value">1</div>
              </div>
              <div class="metric-card">
                <div class="metric-icon">◎</div>
                <div class="metric-label">PROGRESSO GERAL</div>
                <div class="metric-value">${progressPercent}%</div>
              </div>
            </div>

            <div class="executive-lower-grid">
              <div class="card" style="margin:0; min-height:46mm;">
                <div class="section-kicker">DISTRIBUIÇÃO POR APLICAÇÃO</div>
                <div style="color:#f7efdf; font-size:12px; margin-bottom:3mm;">${applicationLabel}</div>
                <div class="distribution-line">
                  <div class="distribution-fill" style="width:${applicationPercent}%"></div>
                </div>
                <div style="text-align:right; color:#d4c8b6; font-size:10px; margin-top:1.8mm;">${applicationPercent}%</div>
              </div>

              <div class="card" style="margin:0; min-height:46mm;">
                <div class="section-kicker">MATERIAIS UTILIZADOS</div>
                <div class="executive-material-row">
                  <div class="executive-material-thumb"></div>
                  <div class="executive-material-content">
                    <div class="executive-material-name">${material}</div>
                    <div class="executive-material-meta">${materialCategory} • ${materialFinish}</div>
                    <div class="executive-material-meta">${materialUsage}</div>
                    <div class="executive-material-meta">${materialCareText}</div>
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
                <div class="ring-side-title">PROGRESSO GERAL</div>
                <div class="ring-side-line">${currentStage}</div>
                <div class="ring-side-small">Documento emitido em ${issueDate}</div>
                <div class="ring-side-small">Previsão de entrega ${forecastDate}</div>
              </div>
            </div>
          </div>

          <div class="card" style="margin-top:5mm;">
            <div class="section-kicker">INFORMAÇÕES CENTRAIS</div>
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
      <div class="section-title">ETAPAS DA OBRA</div>
      <div class="section-subtitle">
        Visão executiva das etapas principais, percentual realizado, etapa em andamento e previsão de
        entrega.
      </div>

      <div class="card">
        <div class="big-ring-area">
          <div>
            <div class="status-list">
              <div class="status-row"><span class="status-icon">✓</span><span>ETAPAS CONCLUÍDAS <strong style="margin-left:3px;">${completedSteps}</strong></span></div>
              <div class="status-row"><span class="status-icon">◔</span><span>ETAPA EM ANDAMENTO <strong style="margin-left:3px;">${currentStage}</strong></span></div>
              <div class="status-row"><span class="status-icon"></span><span>ETAPAS RESTANTES <strong style="margin-left:3px;">${remainingSteps}</strong></span></div>
              <div class="status-row"><span class="status-icon">⌛</span><span>PREVISÃO DE ENTREGA <strong style="margin-left:3px;">${forecastDate}</strong></span></div>
            </div>
          </div>

          <div class="ring-big" style="--p:${progressPercent}">
            <div class="ring-big-inner">
              <div class="ring-big-percent">${progressPercent}%</div>
              <div class="ring-big-caption">CONCLUÍDO</div>
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
      <div class="section-title">PAINEL DE MATERIAIS</div>
      <div class="section-subtitle">
        Identidade material do projeto, leitura visual e associação da peça com a linguagem premium do
        documento.
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
          <div class="section-kicker">MATERIAIS CERTIFICADOS</div>
          <div class="photo-panel"></div>
          <div class="panel-caption">
            Registro visual referencial e posicionamento institucional do material
            dentro do universo Camasa.
          </div>
          <div class="panel-caption">
            ${materialCareText}
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="page">
    <div class="page-inner">
      <div class="section-title">MANUAL DE USO E CONSERVAÇÃO</div>
      <div class="section-subtitle">
        Orientações práticas para preservar a estética, a integridade e a leitura nobre da superfície ao
        longo do tempo.
      </div>

      <div class="list-grid">
        <div class="card list-card">
          <div class="list-card-title">O QUE FAZER</div>
          <ul>
            ${buildList(doList, "good")}
          </ul>
        </div>

        <div class="card list-card">
          <div class="list-card-title">O QUE EVITAR</div>
          <ul>
            ${buildList(dontList, "bad")}
          </ul>
        </div>
      </div>

      <div class="card list-card">
        <div class="list-card-title">ALERTAS IMPORTANTES</div>
        <ul>
          ${buildList(alerts, "alert")}
        </ul>
      </div>
    </div>
  </section>

  <section class="page">
    <div class="page-inner">
      <div class="section-title">CAMASA CARE</div>
      <div style="color:#f7f0e2;font-size:16px;margin-bottom:2mm;text-transform:uppercase;letter-spacing:1px;">PRESERVE A BELEZA</div>
      <div class="section-subtitle">
        Projeto de conservação contínua, orientação preventiva e manutenção coerente com materiais
        nobres e obras de alto padrão.
      </div>

      <div class="care-hero">
        <div class="care-hero-title">Programa de cuidado contínuo</div>
        <div class="care-hero-text">
          O Camasa Care não substitui o uso correto; ele amplia a proteção estética da obra no longo prazo.
          Seu papel é orientar, preservar leitura visual, reduzir desgaste prematuro e reforçar um padrão
          superior de pós-venda para superfícies nobres.
        </div>
      </div>

      <div class="card">
        <div class="pillars-grid">
          ${buildCarePillars(carePillars)}
        </div>

        <div class="care-footer">
          A manutenção Camasa Care foi pensada para prolongar a estética da obra, reduzir desgaste
          prematuro e manter coerência entre uso, cuidado, revisão e apresentação.
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

          <div class="certificate-title">CERTIFICADO DE AUTENTICIDADE</div>
          <div class="certificate-sub">${material}</div>
          <div class="certificate-sub">PROJETO RASTREADO PELO CAMASA PROCESS SYSTEM</div>

          <div class="certificate-code">${signatureCode}</div>

          <div class="certificate-grid">
            <div class="certificate-field">
              <div class="field-label">PROJETO</div>
              <div class="field-value">${projectName}</div>
            </div>
            <div class="certificate-field">
              <div class="field-label">CLIENTE</div>
              <div class="field-value">${clientName}</div>
            </div>
            <div class="certificate-field">
              <div class="field-label">FAMÍLIA</div>
              <div class="field-value">${certificateFamily}</div>
            </div>
            <div class="certificate-field">
              <div class="field-label">ORIGEM</div>
              <div class="field-value">${certificateOrigin}</div>
            </div>
            <div class="certificate-field">
              <div class="field-label">LOTE / BATCH</div>
              <div class="field-value">${certificateBatch}</div>
            </div>
            <div class="certificate-field">
              <div class="field-label">EMISSÃO</div>
              <div class="field-value">${issueDate}</div>
            </div>
          </div>

          <div class="certificate-qr">
            <div class="qr-shell" style="width:28mm;height:28mm;display:flex;align-items:center;justify-content:center;background:linear-gradient(180deg,#fff,#f3f3f3);">
              <div style="width:20mm;height:20mm;border:2px solid #111;display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr);gap:1mm;padding:1.2mm;">
                <div style="background:#111;"></div><div style="background:#111;"></div><div style="background:#111;"></div>
                <div style="background:#111;"></div><div style="background:#fff;border:1px solid #111;"></div><div style="background:#111;"></div>
                <div style="background:#111;"></div><div style="background:#111;"></div><div style="background:#111;"></div>
              </div>
            </div>
          </div>

          <div class="footer-note">
            Este documento integra rastreabilidade visual, técnica e institucional, vinculando material,
            aplicação, cuidado e identidade documental em padrão premium.
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
      waitUntil: "domcontentloaded",
      timeout: 30000,
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

function parseBody(rawBody: string): RenderPayload {
  if (!rawBody || !rawBody.trim()) return {};
  try {
    return JSON.parse(rawBody) as RenderPayload;
  } catch {
    return {};
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
        documentType: "DOCUMENTO DE ENTREGA PREMIUM",
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
