import http from "http";

const port = Number(process.env.PORT || 8080);

const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Camasa Signature Renderer</title>
  <style>
    body {
      margin: 0;
      font-family: Arial, Helvetica, sans-serif;
      background: #111;
      color: #f5f5f5;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .card {
      max-width: 720px;
      margin: 24px;
      padding: 32px;
      border: 1px solid rgba(197,165,114,.35);
      border-radius: 20px;
      background: #1b1b1b;
      box-shadow: 0 20px 60px rgba(0,0,0,.35);
    }
    h1 {
      margin: 0 0 12px;
      color: #C5A572;
      font-size: 40px;
    }
    p {
      margin: 0;
      font-size: 18px;
      line-height: 1.6;
      color: #d8d8d8;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>Camasa Signature Renderer</h1>
    <p>Servidor HTTP ativo no Railway. Próximo passo: transformar este endpoint no renderizador premium do Signature Book.</p>
  </div>
</body>
</html>`;

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
});

server.listen(port, "0.0.0.0", () => {
  console.log("Camasa renderer running on port " + port);
});
