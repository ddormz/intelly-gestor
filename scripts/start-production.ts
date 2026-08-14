import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { runProductionBootstrap } from "../src/bootstrap/production";

await runProductionBootstrap();

const nextBin = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));
const child = spawn(process.execPath, [nextBin, "start"], {
  stdio: "inherit",
  env: process.env,
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => child.kill(signal));
}

child.once("error", () => {
  console.error("Unable to start the application process.");
  process.exitCode = 1;
});

child.once("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exitCode = code ?? 1;
});
