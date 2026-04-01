import http from "http";
import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

chromium.use(StealthPlugin());

const port = Number(process.env.PORT || 8080);

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
  return value
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
    const localX =
      x < 7 ? x : x > size - 8 ? x - (size - 7) : x;
    const localY =
      y < 7 ? y : y > size - 8 ? y - (size - 7) : y;

    if (
      localX === 0 ||
      localX === 6 ||
      localY === 0 ||
      localY === 6 ||
      (localX >= 2 && localX <= 4 && localY >= 2 && localY <= 4)
    ) {
      return true;
    }
    return false;
  };

  let rects = "";

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let fill = false;

      if (isFinder(x, y)) {
        fill = finderFill(x, y);
      } else {
        const n =
          (seed + x * 31 + y * 17 + (x * y * 13)) %
          11;
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

function buildHtml(data: RenderPayload): string {
  const signatureCode = escapeHtml(data.signatureCode || "CSB-20260401-001");
  const documentType = escapeHtml(data.documentType || "Camasa Signature Book");
  const clientName = escapeHtml(data.clientName || "Cliente Camasa");
  const projectName = escapeHtml(data.projectName || "Projeto Premium");
  const material = escapeHtml(data.material || "Travertino Turco Light");
  const location = escapeHtml(data.location || "São Paulo, SP");
  const issueDate = escapeHtml(
    data.issueDate || new Date().toLocaleDateString("pt-BR")
  );
  const projectId = escapeHtml(data.projectId || "N/A");
  const qrSvg = buildPseudoQrSvg(`${signatureCode}|${projectId}|${clientName}`);

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
      --bg: #0b0b10;
      --bg-2: #111116;
      --panel: rgba(255,255,255,0.045);
      --panel-2: rgba(255,255,255,0.025);
      --gold: #c6a46b;
      --gold-soft: rgba(198,164,107,0.28);
      --text: #f1e8d7;
      --muted: #d4c7b0;
      --line: rgba(198,164,107,0.24);
      --danger: #b56a61;
      --ok: #98b68c;
      --shadow: 0 22px 60px rgba(0,0,0,0.42);
    }

    html, body {
      margin: 0;
      padding: 0;
      background: #161616;
      color: var(--text);
      font-family: Arial, Helvetica, sans-serif;
    }

    body {
      counter-reset: pageIndex;
    }

    .page {
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      position: relative;
      overflow: hidden;
      page-break-after: always;
      background:
        radial-gradient(circle at 8% 6%, rgba(255,255,255,0.08), transparent 18%),
        radial-gradient(circle at 80% 14%, rgba(198,164,107,0.09), transparent 22%),
        linear-gradient(135deg, rgba(255,255,255,0.03), transparent 24%),
        linear-gradient(180deg, #0b0b10 0%, #111116 100%);
    }

    .stone {
      position: absolute;
      inset: 0;
      background:
        radial-gradient(circle at 12% 18%, rgba(255,255,255,0.06), transparent 10%),
        radial-gradient(circle at 76% 22%, rgba(255,255,255,0.04), transparent 12%),
        radial-gradient(circle at 30% 78%, rgba(255,255,255,0.03), transparent 16%),
        linear-gradient(115deg, rgba(255,255,255,0.05) 0%, transparent 18%, transparent 82%, rgba(255,255,255,0.03) 100%);
      opacity: 0.72;
      pointer-events: none;
    }

    .veins {
      position: absolute;
      inset: 0;
      pointer-events: none;
      opacity: 0.18;
      background:
        linear-gradient(102deg, transparent 0 12%, rgba(198,164,107,0.55) 12.3%, transparent 12.7%, transparent 63%, rgba(198,164,107,0.4) 63.25%, transparent 63.75%, transparent),
        linear-gradient(107deg, transparent 0 77%, rgba(198,164,107,0.35) 77.25%, transparent 77.7%, transparent),
        linear-gradient(98deg, transparent 0 89%, rgba(198,164,107,0.35) 89.15%, transparent 89.6%, transparent);
    }

    .frame {
      position: absolute;
      inset: 10mm;
      border: 1px solid rgba(198,164,107,0.2);
      pointer-events: none;
    }

    .content {
      position: relative;
      z-index: 2;
      padding: 16mm 16mm 14mm 16mm;
    }

    .brand-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 10mm;
    }

    .brand-logo {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .cps-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 126px;
      height: 50px;
      padding: 0 14px;
      border-radius: 14px;
      background: linear-gradient(180deg, rgba(255,255,255,0.11), rgba(255,255,255,0.04));
      border: 1px solid rgba(198,164,107,0.35);
      box-shadow: var(--shadow);
      font-size: 28px;
      font-weight: 800;
      color: #f4ead7;
      letter-spacing: 0.5px;
    }

    .logo-stack {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .logo-main {
      font-size: 20px;
      letter-spacing: 1px;
      font-weight: 700;
    }

    .logo-sub {
      font-size: 11px;
      color: var(--muted);
      letter-spacing: 1.2px;
      text-transform: uppercase;
    }

    .version {
      color: rgba(241,232,215,0.55);
      font-size: 10px;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-top: 6px;
    }

    .line {
      width: 72px;
      height: 3px;
      background: var(--gold);
      margin: 8mm 0 6mm;
    }

    .kicker {
      color: var(--gold);
      letter-spacing: 2px;
      text-transform: uppercase;
      font-size: 12px;
      margin-bottom: 12px;
    }

    .hero-title {
      font-size: 24px;
      letter-spacing: 2px;
      text-transform: uppercase;
      line-height: 1.28;
      margin: 0 0 8px;
    }

    .hero-subtitle {
      font-size: 13px;
      line-height: 1.6;
      color: rgba(241,232,215,0.82);
      margin: 0 0 22px;
    }

    .hero-project {
      font-size: 18px;
      line-height: 1.3;
      margin: 14px 0 8px;
      color: #fff7ea;
    }

    .hero-client,
    .hero-location {
      font-size: 13px;
      color: rgba(241,232,215,0.82);
      margin: 0 0 4px;
    }

    .qr-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      margin: 16px 0 18px;
    }

    .code-pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 8px 18px;
      border: 1px solid rgba(198,164,107,0.35);
      border-radius: 10px;
      background: rgba(255,255,255,0.03);
      font-size: 14px;
      letter-spacing: 1px;
      color: #f4ead7;
    }

    .issued {
      font-size: 11px;
      letter-spacing: 1.6px;
      text-transform: uppercase;
      color: rgba(241,232,215,0.62);
    }

    .cover-center {
      min-height: 238mm;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
    }

    .card {
      background: linear-gradient(180deg, var(--panel), var(--panel-2));
      border: 1px solid var(--line);
      border-radius: 16px;
      box-shadow: var(--shadow);
    }

    .section-title {
      font-size: 13px;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: #f0e2c6;
      margin: 0 0 10px;
    }

    .page-title {
      font-size: 18px;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      margin: 0 0 10px;
    }

    .page-sub {
      font-size: 12px;
      color: rgba(241,232,215,0.7);
      margin: 0 0 18px;
      line-height: 1.55;
    }

    .two-col {
      display: grid;
      grid-template-columns: 1.15fr 0.85fr;
      gap: 12px;
    }

    .three-col {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr) 1.2fr;
      gap: 10px;
      margin-bottom: 12px;
    }

    .stat-box {
      padding: 14px;
      min-height: 92px;
    }

    .stat-icon {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      border: 1px solid rgba(198,164,107,0.38);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--gold);
      font-size: 16px;
      margin-bottom: 10px;
    }

    .stat-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 1.3px;
      color: rgba(241,232,215,0.72);
      line-height: 1.35;
      min-height: 28px;
    }

    .stat-value {
      font-size: 26px;
      color: #fff3da;
      margin-top: 8px;
    }

    .progress-box {
      padding: 16px;
      min-height: 92px;
    }

    .progress-label {
      font-size: 10px;
      text-transform: uppercase;
      color: var(--gold);
      letter-spacing: 1.3px;
      margin-bottom: 10px;
    }

    .ring-inline {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .small-ring {
      width: 82px;
      height: 82px;
      border-radius: 50%;
      background: conic-gradient(var(--gold) 0 38%, rgba(255,255,255,0.1) 38% 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: inset 0 0 0 1px rgba(198,164,107,0.25);
    }

    .small-ring::before {
      content: "";
      width: 58px;
      height: 58px;
      border-radius: 50%;
      background: #101017;
      box-shadow: inset 0 0 0 1px rgba(198,164,107,0.24);
    }

    .small-ring span {
      position: absolute;
      font-size: 22px;
      font-weight: 700;
      color: #fff4dc;
    }

    .ring-meta {
      font-size: 11px;
      color: rgba(241,232,215,0.8);
      line-height: 1.65;
    }

    .panel {
      padding: 16px;
    }

    .label {
      font-size: 10px;
      color: var(--gold);
      letter-spacing: 1.3px;
      text-transform: uppercase;
      margin-bottom: 6px;
    }

    .value {
      font-size: 14px;
      color: #fff0d2;
    }

    .distribution {
      margin-top: 12px;
    }

    .bar {
      position: relative;
      height: 8px;
      border-radius: 999px;
      background: rgba(255,255,255,0.08);
      overflow: hidden;
      margin-top: 8px;
    }

    .bar::after {
      content: "";
      display: block;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, #8a7751, #c6a46b);
    }

    .material-card {
      display: grid;
      grid-template-columns: 92px 1fr;
      gap: 12px;
      align-items: stretch;
      margin-top: 12px;
    }

    .stone-thumb,
    .photo-thumb {
      border-radius: 10px;
      border: 1px solid rgba(198,164,107,0.22);
      min-height: 92px;
      background:
        radial-gradient(circle at 20% 20%, rgba(255,255,255,0.12), transparent 18%),
        radial-gradient(circle at 70% 35%, rgba(255,255,255,0.08), transparent 16%),
        linear-gradient(135deg, #26262c 0%, #1b1b20 40%, #0f0f14 100%);
      box-shadow: inset 0 0 0 1px rgba(255,255,255,0.02);
    }

    .stone-thumb.green {
      background:
        radial-gradient(circle at 18% 20%, rgba(197,215,190,0.22), transparent 18%),
        radial-gradient(circle at 76% 30%, rgba(121,153,124,0.18), transparent 16%),
        linear-gradient(135deg, #243127 0%, #0f1711 40%, #0b0f0b 100%);
    }

    .kpis {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
      margin-top: 10px;
    }

    .donut-layout {
      display: grid;
      grid-template-columns: 1.05fr 0.95fr;
      gap: 14px;
      align-items: center;
    }

    .big-ring-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 4px 0 8px;
    }

    .big-ring {
      width: 188px;
      height: 188px;
      border-radius: 50%;
      background:
        conic-gradient(var(--gold) 0 38%, rgba(255,255,255,0.08) 38% 100%);
      position: relative;
      box-shadow: inset 0 0 0 1px rgba(198,164,107,0.26);
    }

    .big-ring::before {
      content: "";
      position: absolute;
      inset: 24px;
      border-radius: 50%;
      background: #101017;
      box-shadow: inset 0 0 0 1px rgba(198,164,107,0.22);
    }

    .big-ring-center {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      text-align: center;
      z-index: 2;
    }

    .big-percent {
      font-size: 34px;
      font-weight: 700;
      color: #fff1d6;
      line-height: 1;
      margin-bottom: 8px;
    }

    .big-meta {
      font-size: 10px;
      line-height: 1.45;
      color: rgba(241,232,215,0.7);
      letter-spacing: 1px;
      text-transform: uppercase;
    }

    .stage-side {
      display: grid;
      gap: 10px;
    }

    .side-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border: 1px solid var(--line);
      border-radius: 12px;
      background: rgba(255,255,255,0.03);
    }

    .side-dot {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      border: 1px solid rgba(198,164,107,0.45);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: var(--gold);
      font-size: 12px;
    }

    .side-title {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 1.2px;
      color: rgba(241,232,215,0.68);
    }

    .side-value {
      font-size: 16px;
      color: #fff0d2;
      margin-top: 2px;
    }

    .timeline {
      margin-top: 16px;
      padding-top: 14px;
      border-top: 1px solid rgba(198,164,107,0.18);
    }

    .timeline-line {
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
      top: 14px;
      left: 60%;
      right: -40%;
      height: 1px;
      background: rgba(198,164,107,0.35);
    }

    .step-icon {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      margin: 0 auto 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid rgba(198,164,107,0.4);
      background: rgba(255,255,255,0.03);
      color: var(--gold);
      font-size: 13px;
    }

    .step.done .step-icon {
      background: rgba(152,182,140,0.12);
      border-color: rgba(152,182,140,0.5);
      color: #cde2c3;
    }

    .step.active .step-icon {
      box-shadow: 0 0 0 4px rgba(198,164,107,0.12);
    }

    .step-label {
      font-size: 10px;
      color: rgba(241,232,215,0.78);
    }

    .split-two {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .bullet-card {
      padding: 16px;
      min-height: 154px;
    }

    .bullet-card.ok {
      border-color: rgba(152,182,140,0.25);
    }

    .bullet-card.no {
      border-color: rgba(181,106,97,0.25);
    }

    .bullet-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      margin-bottom: 12px;
      color: #fff0d2;
    }

    ul.clean {
      margin: 0;
      padding-left: 18px;
      color: rgba(241,232,215,0.78);
      line-height: 1.65;
      font-size: 12px;
    }

    .alert-box {
      margin-top: 12px;
      padding: 14px 16px;
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
      min-height: 108px;
    }

    .care-icon {
      width: 36px;
      height: 36px;
      margin: 0 auto 10px;
      border-radius: 50%;
      border: 1px solid rgba(198,164,107,0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--gold);
      font-size: 15px;
    }

    .care-title {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #f7ead0;
      margin-bottom: 8px;
    }

    .care-text {
      font-size: 11px;
      line-height: 1.55;
      color: rgba(241,232,215,0.74);
    }

    .cta-box {
      margin-top: 14px;
      padding: 12px 14px;
      border: 1px solid rgba(198,164,107,0.35);
      border-radius: 12px;
      background: rgba(255,255,255,0.03);
      font-size: 12px;
      color: rgba(241,232,215,0.82);
    }

    .cert-page {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      min-height: 265mm;
    }

    .cert-frame {
      border: 1px solid rgba(198,164,107,0.35);
      padding: 18mm 16mm;
      position: relative;
      background: linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.015));
      box-shadow: var(--shadow);
    }

    .cert-corner {
      position: absolute;
      width: 22px;
      height: 22px;
      border-color: rgba(198,164,107,0.55);
      border-style: solid;
    }

    .cert-corner.tl { top: 10px; left: 10px; border-width: 2px 0 0 2px; }
    .cert-corner.tr { top: 10px; right: 10px; border-width: 2px 2px 0 0; }
    .cert-corner.bl { bottom: 10px; left: 10px; border-width: 0 0 2px 2px; }
    .cert-corner.br { bottom: 10px; right: 10px; border-width: 0 2px 2px 0; }

    .cert-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 18px;
      margin-bottom: 24px;
    }

    .cert-title {
      font-size: 18px;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin: 12px 0 6px;
    }

    .cert-sub {
      font-size: 11px;
      color: rgba(241,232,215,0.72);
      letter-spacing: 1.2px;
      text-transform: uppercase;
    }

    .cert-code {
      font-size: 26px;
      color: #fff1d6;
      margin: 18px 0 14px;
      letter-spacing: 0.5px;
    }

    .cert-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 14px 18px;
      margin: 20px 0 24px;
    }

    .cert-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 1.2px;
      color: var(--gold);
      margin-bottom: 5px;
    }

    .cert-value {
      font-size: 14px;
      color: #f7ecd8;
    }

    .cert-foot {
      display: flex;
      justify-content: space-between;
      align-items: end;
      gap: 18px;
      margin-top: 24px;
    }

    .serial {
      margin-top: 22px;
      font-size: 10px;
      color: rgba(241,232,215,0.45);
      word-break: break-all;
      line-height: 1.5;
    }

    .footer-brand {
      display: flex;
      justify-content: center;
      margin-top: 18px;
      opacity: 0.95;
    }

    .page-footer {
      position: absolute;
      left: 16mm;
      right: 16mm;
      bottom: 10mm;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 10px;
      color: rgba(241,232,215,0.55);
      letter-spacing: 1px;
      text-transform: uppercase;
      z-index: 2;
    }

    .mini-logo {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: rgba(241,232,215,0.7);
    }

    .mini-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--gold);
      display: inline-block;
    }

    .centered {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .muted {
      color: rgba(241,232,215,0.72);
    }

    .text-right {
      text-align: right;
    }
  </style>
</head>
<body>
  <section class="page">
    <div class="stone"></div>
    <div class="veins"></div>
    <div class="frame"></div>
    <div class="content cover-center">
      <div class="brand-top" style="width:100%;">
        <div class="brand-logo">
          <div class="cps-badge">CPS</div>
          <div class="logo-stack">
            <div class="logo-main">CAMASA</div>
            <div class="logo-sub">Process System</div>
          </div>
        </div>
        <div class="version">Documento Premium</div>
      </div>

      <div class="line"></div>
      <div class="hero-title">Camasa<br/>Signature Book</div>
      <div class="hero-subtitle">Documento de entrega premium</div>

      <div class="hero-project">${projectName}</div>
      <div class="hero-client">${clientName}</div>
      <div class="hero-location">${location}</div>

      <div class="qr-wrap">
        ${qrSvg}
        <div class="code-pill">${signatureCode}</div>
        <div class="issued">Gerado em ${issueDate}</div>
      </div>
    </div>

    <div class="page-footer">
      <div class="mini-logo"><span class="mini-dot"></span> Camasa Mármores & Design</div>
      <div>${documentType}</div>
    </div>
  </section>

  <section class="page">
    <div class="stone"></div>
    <div class="veins"></div>
    <div class="frame"></div>
    <div class="content">
      <div class="page-title">Resumo Executivo</div>
      <div class="page-sub">${projectName}<br/>Documento premium de referência institucional conectado ao projeto e ao fluxo oficial do CPS.</div>

      <div class="stats-grid">
        <div class="card stat-box">
          <div class="stat-icon">♥</div>
          <div class="stat-label">Materiais certificados</div>
          <div class="stat-value">1</div>
        </div>
        <div class="card stat-box">
          <div class="stat-icon">⌂</div>
          <div class="stat-label">Categorias técnicas</div>
          <div class="stat-value">1</div>
        </div>
        <div class="card stat-box">
          <div class="stat-icon">▣</div>
          <div class="stat-label">Blocos gerenciados</div>
          <div class="stat-value">1</div>
        </div>
        <div class="card progress-box">
          <div class="progress-label">Progresso geral</div>
          <div class="ring-inline">
            <div class="small-ring"><span>38%</span></div>
            <div class="ring-meta">
              <div><strong>Etapa atual:</strong> Instalação</div>
              <div><strong>Entrega prevista:</strong> ${issueDate}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="two-col">
        <div class="card panel">
          <div class="section-title">Distribuição por aplicação</div>
          <div class="value">${projectName}</div>
          <div class="distribution">
            <div class="bar"></div>
            <div class="text-right muted" style="margin-top:8px;font-size:12px;">100%</div>
          </div>
        </div>

        <div class="card panel">
          <div class="section-title">Materiais utilizados</div>
          <div class="material-card">
            <div class="stone-thumb green"></div>
            <div>
              <div class="value">${material}</div>
              <div class="muted" style="font-size:12px;line-height:1.6;margin-top:8px;">
                Cliente: ${clientName}<br/>
                Aplicação: ${projectName}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="page-footer">
        <div class="mini-logo"><span class="mini-dot"></span> Camasa Mármores & Design</div>
        <div>Resumo Executivo</div>
      </div>
    </div>
  </section>

  <section class="page">
    <div class="stone"></div>
    <div class="veins"></div>
    <div class="frame"></div>
    <div class="content">
      <div class="page-title">Etapas da Obra</div>
      <div class="page-sub">Visão geral do andamento, etapas concluídas e previsão de entrega.</div>

      <div class="donut-layout">
        <div class="card panel">
          <div class="big-ring-wrap">
            <div class="big-ring">
              <div class="big-ring-center">
                <div class="big-percent">38%</div>
                <div class="big-meta">
                  Concluído<br/>
                  Referenciado em ${issueDate}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="stage-side">
          <div class="side-item">
            <div class="side-dot">✓</div>
            <div>
              <div class="side-title">Etapas concluídas</div>
              <div class="side-value">6</div>
            </div>
          </div>
          <div class="side-item">
            <div class="side-dot">▶</div>
            <div>
              <div class="side-title">Etapa em andamento</div>
              <div class="side-value">Instalação</div>
            </div>
          </div>
          <div class="side-item">
            <div class="side-dot">○</div>
            <div>
              <div class="side-title">Etapas restantes</div>
              <div class="side-value">8</div>
            </div>
          </div>
          <div class="side-item">
            <div class="side-dot">⏳</div>
            <div>
              <div class="side-title">Previsão de entrega</div>
              <div class="side-value">${issueDate}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="card panel timeline">
        <div class="section-title">Linhas de frente</div>
        <div class="timeline-line">
          <div class="step done">
            <div class="step-icon">✓</div>
            <div class="step-label">Projeto</div>
          </div>
          <div class="step done">
            <div class="step-icon">✓</div>
            <div class="step-label">Medição</div>
          </div>
          <div class="step active">
            <div class="step-icon">↺</div>
            <div class="step-label">Acabamento</div>
          </div>
          <div class="step">
            <div class="step-icon">⛭</div>
            <div class="step-label">Instalação</div>
          </div>
          <div class="step">
            <div class="step-icon">×</div>
            <div class="step-label">Finalização</div>
          </div>
        </div>
      </div>

      <div class="page-footer">
        <div class="mini-logo"><span class="mini-dot"></span> Camasa Mármores & Design</div>
        <div>Etapas da Obra</div>
      </div>
    </div>
  </section>

  <section class="page">
    <div class="stone"></div>
    <div class="veins"></div>
    <div class="frame"></div>
    <div class="content">
      <div class="page-title">Painel de Materiais</div>
      <div class="page-sub">Demonstrativo mestre dos elementos nobres vinculados ao projeto.</div>

      <div class="two-col">
        <div class="card panel">
          <div class="section-title">Material principal</div>
          <div class="material-card">
            <div class="stone-thumb green"></div>
            <div>
              <div class="value">${material}</div>
              <div class="muted" style="font-size:12px;line-height:1.65;margin-top:8px;">
                Aplicação: ${projectName}<br/>
                Local: ${location}<br/>
                Referência institucional vinculada
              </div>
            </div>
          </div>
          <div class="cta-box" style="margin-top:16px;">Material certificado</div>
        </div>

        <div class="card panel">
          <div class="section-title">Materiais certificados</div>
          <div class="photo-thumb"></div>
          <div class="muted" style="font-size:12px;line-height:1.7;margin-top:12px;">
            Apresentação visual do material em ambiente aplicado, conectando estética, contexto e experiência final do projeto.
          </div>
        </div>
      </div>

      <div class="page-footer">
        <div class="mini-logo"><span class="mini-dot"></span> Camasa Mármores & Design</div>
        <div>Painel de Materiais</div>
      </div>
    </div>
  </section>

  <section class="page">
    <div class="stone"></div>
    <div class="veins"></div>
    <div class="frame"></div>
    <div class="content">
      <div class="page-title">Manual de Uso e Conservação</div>
      <div class="page-sub">Orientações essenciais para preservar beleza, integridade e durabilidade.</div>

      <div class="split-two">
        <div class="card bullet-card ok">
          <div class="bullet-title">✓ O que fazer</div>
          <ul class="clean">
            <li>Limpar com pano macio levemente umedecido.</li>
            <li>Utilizar detergente neutro em pequena quantidade.</li>
            <li>Remover resíduos líquidos rapidamente.</li>
            <li>Usar apoio para objetos quentes e utensílios pesados.</li>
            <li>Manter rotina preventiva de inspeção visual.</li>
          </ul>
        </div>

        <div class="card bullet-card no">
          <div class="bullet-title">✕ O que evitar</div>
          <ul class="clean">
            <li>Produtos ácidos, abrasivos ou clorados.</li>
            <li>Impactos concentrados em quinas e bordas.</li>
            <li>Arraste de peças metálicas sem proteção.</li>
            <li>Contato prolongado com agentes pigmentantes.</li>
            <li>Limpeza agressiva com discos ou esponjas duras.</li>
          </ul>
        </div>
      </div>

      <div class="card alert-box">
        <div class="section-title">Alertas importantes</div>
        <ul class="clean">
          <li>Pedras naturais podem apresentar variações estéticas próprias de sua formação.</li>
          <li>O uso incorreto de químicos pode comprometer acabamento, proteção e brilho.</li>
          <li>Qualquer intervenção corretiva deve respeitar orientação técnica especializada.</li>
        </ul>
      </div>

      <div class="page-footer">
        <div class="mini-logo"><span class="mini-dot"></span> Camasa Mármores & Design</div>
        <div>Manual de Uso</div>
      </div>
    </div>
  </section>

  <section class="page">
    <div class="stone"></div>
    <div class="veins"></div>
    <div class="frame"></div>
    <div class="content">
      <div class="page-title">Camasa Care</div>
      <div class="page-sub">Programa de atenção contínua, preservação e acompanhamento técnico.</div>

      <div class="card panel">
        <div class="section-title">Preserve a beleza</div>
        <div class="muted" style="font-size:12px;line-height:1.7;">
          Serviço pensado para manter valor estético, segurança de uso e consistência visual das superfícies nobres.
        </div>

        <div class="care-grid">
          <div class="card care-item">
            <div class="care-icon">◔</div>
            <div class="care-title">Preservar</div>
            <div class="care-text">Rotina de avaliação preventiva e leitura visual da superfície.</div>
          </div>
          <div class="card care-item">
            <div class="care-icon">✦</div>
            <div class="care-title">Proteger</div>
            <div class="care-text">Sugestões de cuidado para manter acabamento, toque e presença.</div>
          </div>
          <div class="card care-item">
            <div class="care-icon">↺</div>
            <div class="care-title">Revisitar</div>
            <div class="care-text">Acompanhamento técnico periódico conforme necessidade do projeto.</div>
          </div>
        </div>

        <div class="cta-box">
          Atendimento Camasa Care disponível para projetos com necessidade de acompanhamento contínuo e preservação estética.
        </div>
      </div>

      <div class="page-footer">
        <div class="mini-logo"><span class="mini-dot"></span> Camasa Mármores & Design</div>
        <div>Camasa Care</div>
      </div>
    </div>
  </section>

  <section class="page">
    <div class="stone"></div>
    <div class="veins"></div>
    <div class="frame"></div>
    <div class="content cert-page">
      <div class="cert-frame">
        <div class="cert-corner tl"></div>
        <div class="cert-corner tr"></div>
        <div class="cert-corner bl"></div>
        <div class="cert-corner br"></div>

        <div class="cert-head">
          <div>
            <div class="brand-logo">
              <div class="cps-badge">CPS</div>
              <div class="logo-stack">
                <div class="logo-main">CAMASA</div>
                <div class="logo-sub">Process System</div>
              </div>
            </div>

            <div class="cert-title">Certificado de Autenticidade</div>
            <div class="cert-sub">Granite • Materials • Bona</div>
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
            <div class="cert-label">Projeto ID</div>
            <div class="cert-value">${projectId}</div>
          </div>
          <div>
            <div class="cert-label">Data de emissão</div>
            <div class="cert-value">${issueDate}</div>
          </div>
        </div>

        <div class="muted" style="font-size:12px;line-height:1.8;">
          Este documento certifica a vinculação institucional deste projeto ao fluxo premium do Camasa Process System, com identificação, rastreabilidade documental e referência visual compatível com o padrão de entrega Camasa.
        </div>

        <div class="serial">
          8bca99f8d25e1a34f9d80d3e2${projectId.replace(/[^a-zA-Z0-9]/g, "")}cpssignaturebook${signatureCode.replace(/[^a-zA-Z0-9]/g, "")}
        </div>

        <div class="cert-foot">
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
        <div class="brand-logo">
          <div class="cps-badge">CPS</div>
          <div class="logo-stack">
            <div class="logo-main">CAMASA</div>
            <div class="logo-sub">Process System</div>
          </div>
        </div>
      </div>

      <div class="page-footer">
        <div class="mini-logo"><span class="mini-dot"></span> Camasa Mármores & Design</div>
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
        "Content-Disposition": 'inline; filename="camasa-signature-book-test.pdf"'
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
        <body style="font-family:Arial;padding:20px">
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
