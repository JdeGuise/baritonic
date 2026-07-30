import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createApp } from "./app.ts";
import { loadConfig } from "./config.ts";
import { openDatabase } from "./db/connection.ts";
import { migrate } from "./db/migrations.ts";

const config = loadConfig();
const db = openDatabase(config.dbPath);
const version = migrate(db);

const webDist = resolve(import.meta.dirname, "../../web/dist");
const staticDir = existsSync(webDist) ? webDist : undefined;

const app = createApp({ db, staticDir });

const server = app.listen(config.port, config.bindAddr, () => {
  console.log(`baritonic listening on http://${config.bindAddr}:${config.port}`);
  console.log(`  database:   ${config.dbPath} (schema v${version})`);
  console.log(`  web assets: ${staticDir ?? "not built — API only"}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(() => {
      db.close();
      process.exit(0);
    });
  });
}
