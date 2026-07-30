import { join } from "node:path";

export interface Config {
  port: number;
  dataDir: string;
  bindAddr: string;
  dbPath: string;
}

/** Configuration comes entirely from the environment so the same build
 *  runs locally and in the container. Bind defaults to loopback: opening
 *  to the network is an explicit choice. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const rawPort = env.PORT ?? "4173";
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`PORT must be an integer between 1 and 65535, got "${rawPort}"`);
  }

  const dataDir = env.DATA_DIR ?? "./data";
  return {
    port,
    dataDir,
    bindAddr: env.BIND_ADDR ?? "127.0.0.1",
    dbPath: join(dataDir, "baritonic.db"),
  };
}
