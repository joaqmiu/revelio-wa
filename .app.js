const fs = require("fs");
const os = require("os");
const path = require("path");
const readline = require("readline");
const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion, downloadContentFromMessage, delay } = require("@whiskeysockets/baileys");
const Pino = require("pino");
const qrcode = require("qrcode-terminal");
const http = require('http');
const url = require('url');
const mime = require('mime-types');

const question = (query) => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(query, (answer) => { rl.close(); resolve(answer); }));
};

const onlyNumbers = (str) => str.replace(/\D/g, "");

const ensureDir = (dir) => { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); };

const mediaDir = path.join(__dirname, "midia_salva");
ensureDir(mediaDir);

let PORT = 3000;
let server = null;

const startServer = () => {
  return new Promise((resolve) => {
    const tryStartServer = (port) => {
      server = http.createServer((req, res) => {
        const parsedUrl = url.parse(req.url, true);
        const pathname = parsedUrl.pathname;
        
        if (pathname.startsWith('/media/')) {
          const filename = pathname.replace('/media/', '');
          const filePath = path.join(mediaDir, filename);
          
          if (fs.existsSync(filePath)) {
            const mimeType = mime.lookup(filePath) || 'application/octet-stream';
            res.writeHead(200, {
              'Content-Type': mimeType,
              'Access-Control-Allow-Origin': '*'
            });
            
            const fileStream = fs.createReadStream(filePath);
            fileStream.pipe(res);
          } else {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Arquivo não encontrado');
          }
        } else if (pathname === '/') {
          fs.readdir(mediaDir, (err, files) => {
            if (err) {
              res.writeHead(500, { 'Content-Type': 'text/plain' });
              res.end('Erro ao ler diretório');
              return;
            }
            
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.write(`
              <!DOCTYPE html>
              <html lang="pt-BR">
              <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Revelio</title>
                <style>
                  * { margin: 0; padding: 0; box-sizing: border-box; }
                  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #333; line-height: 1.6; padding: 20px; min-height: 100vh; }
                  .container { max-width: 1200px; margin: 0 auto; background: rgba(255, 255, 255, 0.95); border-radius: 15px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2); padding: 30px; }
                  header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 1px solid #eee; }
                  h1 { color: #764ba2; font-size: 2.5rem; margin-bottom: 10px; }
                  .subtitle { color: #667eea; font-size: 1.2rem; margin-bottom: 20px; }
                  .stats { display: flex; justify-content: center; gap: 20px; margin: 20px 0; }
                  .stat-box { background: #f8f9fa; padding: 15px; border-radius: 10px; text-align: center; min-width: 150px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
                  .stat-number { font-size: 2rem; color: #764ba2; font-weight: bold; }
                  .stat-label { color: #667eea; font-size: 0.9rem; }
                  .media-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 25px; margin-top: 30px; }
                  .media-card { background: white; border-radius: 12px; overflow: hidden; transition: transform 0.3s, box-shadow 0.3s; box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1); }
                  .media-card:hover { transform: translateY(-5px); box-shadow: 0 15px 30px rgba(0, 0, 0, 0.15); }
                  .media-content { height: 250px; overflow: hidden; display: flex; align-items: center; justify-content: center; background: #f8f9fa; }
                  .media-content img { width: 100%; height: 100%; object-fit: cover; }
                  .media-content video { width: 100%; height: 100%; object-fit: cover; }
                  .media-info { padding: 15px; }
                  .media-name { font-weight: bold; margin-bottom: 8px; color: #333; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                  .media-actions { display: flex; justify-content: space-between; margin-top: 10px; }
                  .btn { padding: 8px 15px; border: none; border-radius: 5px; cursor: pointer; font-weight: bold; transition: background 0.3s; text-decoration: none; display: inline-block; text-align: center; }
                  .btn-view { background: #667eea; color: white; }
                  .btn-view:hover { background: #5a6fd8; }
                  .btn-download { background: #764ba2; color: white; }
                  .btn-download:hover { background: #6a4190; }
                  .empty-state { text-align: center; padding: 40px; color: #6c757d; }
                  .empty-state i { font-size: 3rem; margin-bottom: 15px; display: block; color: #adb5bd; }
                  footer { text-align: center; margin-top: 40px; color: #6c757d; font-size: 0.9rem; }
                  @media (max-width: 768px) {
                    .media-grid { grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); }
                    .stats { flex-direction: column; align-items: center; }
                  }
                </style>
              </head>
              <body>
                <div class="container">
                  <header>
                    <h1>🧙 Revelio</h1>
                    <p class="subtitle">Visualize e faça download das mídias salvas</p>
                    <div class="stats">
                      <div class="stat-box">
                        <div class="stat-number">${files.length}</div>
                        <div class="stat-label">Arquivos</div>
                      </div>
                      <div class="stat-box">
                        <div class="stat-number">${Math.round(files.reduce((acc, file) => acc + fs.statSync(path.join(mediaDir, file)).size, 0) / (1024 * 1024))} MB</div>
                        <div class="stat-label">Espaço usado</div>
                      </div>
                    </div>
                  </header>
                  <main>
            `);
            
            if (files.length === 0) {
              res.write(`
                <div class="empty-state">
                  <i>📁</i>
                  <h2>Nenhuma mídia encontrada</h2>
                  <p>As mídias salvas aparecerão aqui</p>
                </div>
              `);
            } else {
              res.write('<div class="media-grid">');
              
              files.forEach(file => {
                const fileUrl = `/media/${file}`;
                const fileExt = path.extname(file).toLowerCase();
                const fileSize = (fs.statSync(path.join(mediaDir, file)).size / (1024 * 1024)).toFixed(2);
                const created = fs.statSync(path.join(mediaDir, file)).birthtime.toLocaleDateString('pt-BR');
                
                if (['.jpg', '.jpeg', '.png', '.gif'].includes(fileExt)) {
                  res.write(`
                    <div class="media-card">
                      <div class="media-content">
                        <img src="${fileUrl}" alt="${file}">
                      </div>
                      <div class="media-info">
                        <div class="media-name">${file}</div>
                        <div>${fileSize} MB • ${created}</div>
                        <div class="media-actions">
                          <a href="${fileUrl}" target="_blank" class="btn btn-view">Visualizar</a>
                          <a href="${fileUrl}" download class="btn btn-download">Download</a>
                        </div>
                      </div>
                    </div>
                  `);
                } else if (['.mp4', '.webm', '.mov'].includes(fileExt)) {
                  res.write(`
                    <div class="media-card">
                      <div class="media-content">
                        <video controls>
                          <source src="${fileUrl}" type="video/mp4">
                        </video>
                      </div>
                      <div class="media-info">
                        <div class="media-name">${file}</div>
                        <div>${fileSize} MB • ${created}</div>
                        <div class="media-actions">
                          <a href="${fileUrl}" target="_blank" class="btn btn-view">Assistir</a>
                          <a href="${fileUrl}" download class="btn btn-download">Download</a>
                        </div>
                      </div>
                    </div>
                  `);
                } else {
                  res.write(`
                    <div class="media-card">
                      <div class="media-content" style="display: flex; align-items: center; justify-content: center; font-size: 3rem;">
                        📄
                      </div>
                      <div class="media-info">
                        <div class="media-name">${file}</div>
                        <div>${fileSize} MB • ${created}</div>
                        <div class="media-actions">
                          <a href="${fileUrl}" download class="btn btn-download">Download</a>
                        </div>
                      </div>
                    </div>
                  `);
                }
              });
              
              res.write('</div>');
            }
            
            res.write(`
                  </main>
                  <footer>
                    <p>Revelio by Joaquim</p>
                  </footer>
                </div>
              </body>
              </html>
            `);
            res.end();
          });
        } else {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Página não encontrada');
        }
      });

      server.listen(port, () => {
        PORT = port;
        console.log(`🚀 Servidor de mídias rodando em: http://localhost:${PORT}`);
        resolve();
      });

      server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.log(`⚠️  Porta ${port} já está em uso. Tentando porta ${port + 1}...`);
          tryStartServer(port + 1);
        } else {
          console.log(`Erro no servidor: ${err.message}`);
          resolve();
        }
      });
    };

    tryStartServer(PORT);
  });
};

const bufferFromMessage = async (msg) => {
  let media = null;
  if (msg.message?.imageMessage) media = msg.message.imageMessage;
  if (msg.message?.videoMessage) media = msg.message.videoMessage;
  if (msg.message?.viewOnceMessage?.message?.imageMessage) media = msg.message.viewOnceMessage.message.imageMessage;
  if (msg.message?.viewOnceMessage?.message?.videoMessage) media = msg.message.viewOnceMessage.message.videoMessage;
  if (msg.message?.viewOnceMessageV2?.message?.imageMessage) media = msg.message.viewOnceMessageV2.message.imageMessage;
  if (msg.message?.viewOnceMessageV2?.message?.videoMessage) media = msg.message.viewOnceMessageV2.message.videoMessage;
  if (msg.message?.viewOnceMessageV2Extension?.message?.imageMessage) media = msg.message.viewOnceMessageV2Extension.message.imageMessage;
  if (msg.message?.viewOnceMessageV2Extension?.message?.videoMessage) media = msg.message.viewOnceMessageV2Extension.message.videoMessage;
  if (!media) return null;
  const type = media.mimetype?.includes("video") ? "video" : "image";
  const stream = await downloadContentFromMessage(media, type);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return { buffer: Buffer.concat(chunks), type };
};

const saveMedia = async (buffer, type, filename) => {
  const ext = type === "video" ? ".mp4" : ".png";
  const filePath = path.join(mediaDir, filename + ext);
  fs.writeFileSync(filePath, buffer);
  console.log(`📁 Mídia salva: ${filePath}`);
  console.log(`🌐 Disponível em: http://localhost:${PORT}/media/${filename + ext}`);
  return filePath;
};

const startBot = async () => {
  try {
    await startServer();

    const { state, saveCreds } = await useMultiFileAuthState("sessao");
    const { version } = await fetchLatestBaileysVersion();

    const sessionExists = fs.existsSync(path.join("sessao", "creds.json"));
    if (sessionExists) console.log("Sessão ativa encontrada. Iniciando sincronização de mensagens...");
    else console.log("Nenhuma sessão encontrada. Iniciando nova conexão...");

    const sock = makeWASocket({
      auth: state,
      logger: Pino({ level: "silent" }),
      version,
      browser: ["Ubuntu", "Chrome", "20.0.04"],
      printQRInTerminal: false,
      markOnlineOnConnect: true,
      syncFullHistory: true,
      fireInitQueries: true,
      defaultQueryTimeoutMs: undefined,
      shouldIgnoreJid: () => false
    });

    if (!sessionExists) {
      if (!sock.authState.creds.registered) {
        const phoneNumber = await question("Informe o seu número de telefone: ");
        if (!phoneNumber) throw new Error("Número de telefone inválido!");
        const code = await sock.requestPairingCode(onlyNumbers(phoneNumber));
        qrcode.generate(code, { small: true });
        console.log(`Código de pareamento: ${code}`);
      }
    }

    sock.ev.on("creds.update", saveCreds);

    if (sessionExists) {
      await new Promise((resolve) => {
        const syncHandler = async (update) => {
          if (update.connection === "open") {
            console.log("Sincronização concluída. Bot conectado.");
            sock.ev.off("connection.update", syncHandler);
            resolve();
          } else if (update.connection === "connecting") {
            console.log("Sincronizando mensagens...");
          }
        };
        sock.ev.on("connection.update", syncHandler);
      });
    }

    sock.ev.on("messages.upsert", async ({ messages }) => {
      try {
        const msg = messages?.[0];
        if (!msg || !msg.message) return;
        await sock.readMessages([{ remoteJid: msg.key.remoteJid, id: msg.key.id, participant: msg.key.participant }]);
        const quotedMessage = msg?.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        msg.quotedMessage = quotedMessage;
        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.ephemeralMessage?.message?.conversation || "";
        const command = text.trim().toLowerCase();
        if ((command === "." || command === "revelio") && msg.quotedMessage) {
          const mediaData = await bufferFromMessage({ message: msg.quotedMessage });
          if (!mediaData) return;
          if (command === ".") {
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
            const filename = `midia_${timestamp}`;
            await saveMedia(mediaData.buffer, mediaData.type, filename);
          } else if (command === "revelio") {
            if (mediaData.type === "image") {
              await sock.sendMessage(msg.key.remoteJid, { image: mediaData.buffer }, { quoted: msg });
            } else if (mediaData.type === "video") {
              await sock.sendMessage(msg.key.remoteJid, { video: mediaData.buffer }, { quoted: msg });
            }
          }
        }
      } catch (err) {}
    });

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect } = update;
      if (connection === "close") {
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        if (shouldReconnect) {
          console.log("Conexão perdida. Tentando reconectar...");
          await delay(5000);
          startBot();
        } else {
          console.log("Sessão finalizada. É necessário realizar login novamente.");
        }
      } else if (connection === "open") {
        console.log("Conectado!");
      }
    });

    process.on("uncaughtException", () => {});
    process.on("unhandledRejection", () => {});
  } catch (err) {
    await delay(5000);
    startBot();
  }
};

process.on('SIGINT', () => {
  console.log('\n🛑 Encerrando servidor...');
  if (server) {
    server.close(() => {
      console.log('Servidor HTTP encerrado.');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

startBot();