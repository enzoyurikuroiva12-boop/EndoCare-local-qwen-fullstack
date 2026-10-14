import { createConnection } from "node:net";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const backendDirectory = fileURLToPath(new URL("../", import.meta.url));
const backendUrl = "http://127.0.0.1:3000";

function isListening(host) {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host, port: 3000 });
    const finish = (busy) => {
      socket.destroy();
      resolve(busy);
    };
    socket.once("connect", () => finish(true));
    socket.once("error", (error) => {
      socket.destroy();
      if (["ECONNREFUSED", "EAFNOSUPPORT", "EADDRNOTAVAIL"].includes(error.code)) resolve(false);
      else reject(error);
    });
    socket.setTimeout(1500, () => {
      socket.destroy();
      reject(new Error(`Nao foi possivel verificar a porta 3000 em ${host}.`));
    });
  });
}

async function isEndoCare() {
  try {
    const response = await fetch(`${backendUrl}/api/health`, {
      signal: AbortSignal.timeout(8000),
    });
    const body = await response.json();
    return body?.service === "endobot";
  } catch {
    return false;
  }
}

async function main() {
  const [ipv4Busy, ipv6Busy] = await Promise.all([
    isListening("127.0.0.1"),
    isListening("::1"),
  ]);
  if (ipv4Busy || ipv6Busy) {
    if (ipv4Busy && await isEndoCare()) {
      console.log(`Backend EndoCare ja esta em execucao em ${backendUrl}.`);
      console.log("A instancia existente sera utilizada.");
      return;
    }
    throw new Error("A porta 3000 esta ocupada por outro programa ou por um backend que nao responde. Feche esse programa antes de iniciar o EndoCare.");
  }

  const windows = process.platform === "win32";
  const localServer = fileURLToPath(new URL("./local-server.ts", import.meta.url));
  const child = spawn(process.execPath, ["--env-file=.env", "--import", "tsx", localServer], {
    cwd: backendDirectory,
    stdio: "inherit",
  });

  let forcedExitCode;
  function stopChild(exitCode) {
    if (forcedExitCode !== undefined) return;
    forcedExitCode = exitCode;
    if (!child.pid) return;
    if (windows) {
      const taskkill = spawn("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
      taskkill.once("error", () => child.kill());
      taskkill.once("close", (code) => {
        if (code !== 0 && child.exitCode === null) child.kill();
      });
    } else {
      child.kill("SIGTERM");
    }
  }

  child.once("error", (error) => {
    console.error(`Nao foi possivel iniciar o backend local: ${error.message}`);
    process.exitCode = 1;
  });
  child.once("close", (code) => {
    process.exitCode = forcedExitCode ?? code ?? 1;
  });
  process.once("SIGINT", () => stopChild(130));
  process.once("SIGTERM", () => stopChild(143));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
