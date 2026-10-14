import { createConnection } from "node:net";
import { spawn, execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const frontendDirectory = fileURLToPath(new URL("../frontend/", import.meta.url));
const viteScript = fileURLToPath(new URL("../frontend/node_modules/vite/bin/vite.js", import.meta.url));
const frontendUrl = "http://127.0.0.1:5173";

function isListening(host) {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host, port: 5173 });
    const finish = (busy) => { socket.destroy(); resolve(busy); };
    socket.once("connect", () => finish(true));
    socket.once("error", (error) => {
      socket.destroy();
      if (["ECONNREFUSED", "EAFNOSUPPORT", "EADDRNOTAVAIL"].includes(error.code)) resolve(false);
      else reject(error);
    });
    socket.setTimeout(1500, () => { socket.destroy(); reject(new Error("Nao foi possivel verificar a porta 5173.")); });
  });
}

async function isOurFrontend() {
  if (process.platform !== "win32") return false;
  const { stdout } = await promisify(execFile)("powershell.exe", ["-NoProfile", "-Command",
    "Get-NetTCPConnection -State Listen -LocalPort 5173 -ErrorAction SilentlyContinue | ForEach-Object { Get-CimInstance Win32_Process -Filter ('ProcessId=' + $_.OwningProcess) } | Select-Object -ExpandProperty CommandLine",
  ], { timeout: 8000, windowsHide: true });
  const normalize = (value) => value.replace(/\\+/g, "\\").toLowerCase();
  return stdout.split(/\r?\n/).some((command) =>
    normalize(command).includes(normalize(frontendDirectory)) && /[\\/]vite[\\/]bin[\\/]vite\.js/i.test(command));
}

async function main() {
  const [ipv4Busy, ipv6Busy] = await Promise.all([isListening("127.0.0.1"), isListening("::1")]);
  if (ipv4Busy || ipv6Busy) {
    if (await isOurFrontend()) {
      console.log(`Frontend EndoCare ja esta em execucao em ${frontendUrl}. A instancia existente sera utilizada.`);
      return;
    }
    throw new Error("A porta 5173 esta ocupada por outro programa. Encerre esse programa antes de iniciar o EndoCare.");
  }
  const child = spawn(process.execPath, [viteScript, "--host", "127.0.0.1", "--port", "5173", "--strictPort"], {
    cwd: frontendDirectory,
    stdio: "inherit",
  });
  let stopping = false;
  const stop = () => {
    if (stopping || !child.pid || child.exitCode !== null) return;
    stopping = true;
    if (process.platform === "win32") {
      const killer = spawn("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
      killer.once("error", () => child.kill());
    } else child.kill("SIGTERM");
  };
  child.once("error", (error) => { console.error(`Nao foi possivel iniciar o frontend: ${error.message}`); process.exitCode = 1; });
  child.once("close", (code) => { process.exitCode = code ?? 1; });
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
