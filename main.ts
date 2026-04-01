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

function buildHtml(data: RenderPayload): string {
  const signatureCode = escapeHtml(data.signatureCode || "CSB-DEMO-001");
  const documentType = escapeHtml(data.documentType || "Signature Book");
  const clientName = escapeHtml(data.clientName || "Cliente Camasa");
  const projectName = escapeHtml(data.projectName || "Projeto Premium");
  const material = escapeHtml(data.material || "Travertino");
  const location = escapeHtml(data.location || "São Paulo");
  const issueDate = escapeHtml(
    data.issueDate || new Date().toLocaleDateString("pt-BR")
  );
  const projectId = escapeHtml(data.projectId || "N/A");

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Camasa Signature Book</title>
  <style>
    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      font-family: Arial, Helvetica, sans-serif;
      background: #0b0b12;
      color: #f5f1e8;
    }

    .page {
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      padding: 28mm 20mm;
      background:
        radial-gradient(circle at top left, rgba(197,165,114,0.10), transparent 28%),
        linear-gradient(180deg, #0b0b12 0%, #12121a 100%);
      position: relative;
    }

    .line {
      width: 72px;
      height: 3px;
      background: #c5a572;
      margin-bottom: 18px;
    }

    .kicker {
      color: #c5a572;
      letter-spacing: 2px;
      font-size: 12px;
      text-transform: uppercase;
      margin-bottom: 14px;
    }

    h1 {
      font-size: 36px;
      line-height: 1.1;
      margin: 0 0 10px 0;
      color: #f3e7cf;
    }

    .subtitle {
      font-size: 16px;
      line-height: 1.7;
      color: #d8d1c3;
      max-width: 540px;
      margin-bottom: 28px;
    }

    .card {
      border: 1px solid rgba(197,165,114,0.28);
      border-radius: 18px;
      padding: 22px;
      background: rgba(255,255,255,0.03);
      box-shadow: 0 14px 40px rgba(0,0,0,0.28);
      margin-bottom: 18px;
    }

    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }

    .label {
      font-size: 11px;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: #c5a572;
      margin-bottom: 6px;
    }

    .value {
      font-size: 17px;
      color: #f7f3ea;
      line-height: 1.5;
      word-break: break-word;
    }

    .footer {
      position: absolute;
      left: 20mm;
      right: 20mm;
      bottom: 16mm;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
      color: #cfc7b8;
      border-top: 1px solid rgba(197,165,114,0.22);
      padding-top: 10px;
    }

    .brand {
      font-weight: bold;
      color: #f3e7cf;
    }

    .note {
      margin-top: 22px;
      font-size: 14px;
      line-height: 1.8;
      color: #ddd6c8;
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="line"></div>
    <div class="kicker">Camasa Mármores & Design</div>
    <h1>${documentType}</h1>
    <div class="subtitle">
      Documento renderizado pelo Camasa Signature Renderer para validação do fluxo premium
      de geração de PDF no Railway.
    </div>

    <div class="card">
      <div class="grid">
        <div>
          <div class="label">Signature Code</div>
          <div class="value">${signatureCode}</div>
        </div>
        <div>
          <div class="label">Project ID</div>
          <div class="value">${projectId}</div>
        </div>
        <div>
          <div class="label">Cliente</div>
          <div class="value">${clientName}</div>
        </div>
        <div>
          <div class="label">Projeto</div>
          <div class="value">${projectName}</div>
        </div>
        <div>
          <div class="label">Material</div>
          <div class="value">${material}</div>
        </div>
        <div>
          <div class="label">Local</div>
          <div class="value">${location}</div>
        </div>
        <div>
          <div class="label">Data de emissão</div>
          <div class="value">${issueDate}</div>
        </div>
        <div>
          <div class="label">Status</div>
          <div class="value">Renderização operacional</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="label">Observação</div>
      <div class="note">
        Este PDF confirma que o serviço está apto a receber dados via POST, montar
        um layout institucional e devolver um documento em padrão premium.
        O próximo refinamento será evoluir este modelo para o Signature Book completo.
      </div>
    </div>

    <div class="footer">
      <div class="brand">Camasa Signature Book</div>
      <div>www.camasa.com.br</div>
    </div>
  </div>
</body>
</html>
`;
}

function readJsonBody(req: http.IncomingMessage): Promise<RenderPayload> {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", () => {
      try {
        if (!body.trim()) {
          resolve({});
          return;
        }
        const parsed = JSON.parse(body) as RenderPayload;
        resolve(parsed);
      } catch (error) {
        reject(new Error("JSON inválido no body da requisição."));
      }
    });

    req.on("error", () => {
      reject(new Error("Erro ao ler o body da requisição."));
    });
  });
}

async function generatePdfBuffer(data: RenderPayload): Promise<Buffer> {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
  });

  try {
    const page = await browser.newPage();
    const html = buildHtml(data);

    await page.setContent(html, {
      waitUntil: "networkidle"
    });

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

const server = http.createServer(async (req, res) => {
  try {
    const method = req.method || "GET";
    const url = req.url || "/";

    if (method === "GET" && url === "/") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(buildHtml({}));
      return;
    }

    if (method === "GET" && url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ ok: true, service: "camasa-signature-renderer" }));
      return;
    }

    if (method === "POST" && url === "/render") {
      const payload = await readJsonBody(req);
      const pdfBuffer = await generatePdfBuffer(payload);

      res.writeHead(200, {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline; filename=camasa-signature-book.pdf",
        "Content-Length": String(pdfBuffer.length),
        "Cache-Control": "no-store"
      });

      res.end(pdfBuffer);
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: "Rota não encontrada." }));
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
