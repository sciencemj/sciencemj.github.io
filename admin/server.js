import { resolve } from "node:path";
import { createAdminApp } from "./app.js";

const ROOT = resolve(import.meta.dir, "..");
const PORT = Number(process.env.PORT) || 4747;
const app = createAdminApp({ root: ROOT, owner: "sciencemj", port: PORT });
Bun.serve({
  hostname: "127.0.0.1",
  port: PORT,
  fetch: app.fetch,
});

const homeUrl = "http://127.0.0.1:" + PORT + "/admin/";
console.log("Admin tool: " + homeUrl);
if (!process.argv.includes("--no-open")) {
  Bun.spawn(["open", homeUrl]);
}
