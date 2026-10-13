import { randomUUID } from "node:crypto";
import type { Express, Request, Response } from "express";
import { sql } from "drizzle-orm";
import { getDb } from "../db";
import { createRuntimeConfig, missingProductionConfiguration } from "../runtimeConfig";

type OperationalDependencies = { checkDatabase?: () => Promise<void>; isAcceptingTraffic?: () => boolean };

export function assertProductionConfiguration(environment: NodeJS.ProcessEnv = process.env) {
  const config = createRuntimeConfig(environment);
  if (!config.isProduction) return;
  const missing = missingProductionConfiguration(config);
  if (missing.length) throw new Error(`Missing required production environment variables: ${missing.join(", ")}`);
}

export function registerOperationalRoutes(app: Express, dependencies: OperationalDependencies = {}) {
  let acceptingTraffic = true;
  const checkDatabase = dependencies.checkDatabase ?? (async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    await db.execute(sql`SELECT 1`);
  });
  const isAcceptingTraffic = dependencies.isAcceptingTraffic ?? (() => acceptingTraffic);

  app.use((req: Request, res: Response, next) => {
    const requestId = req.header("x-request-id")?.slice(0, 128) || randomUUID();
    res.locals.requestId = requestId;
    res.setHeader("X-Request-Id", requestId);
    res.on("finish", () => {
      if (req.path.startsWith("/healthz") || req.path.startsWith("/readyz")) return;
      console.info(JSON.stringify({ event: "http_request", requestId, method: req.method, path: req.path, status: res.statusCode, durationMs: Date.now() - (res.locals.startedAt as number) }));
    });
    res.locals.startedAt = Date.now();
    next();
  });

  app.get("/healthz", (_req, res) => res.status(200).json({ ok: true, status: "live" }));
  app.get("/readyz", async (_req, res) => {
    if (!isAcceptingTraffic()) return res.status(503).json({ ok: false, status: "draining" });
    try {
      await checkDatabase();
      return res.status(200).json({ ok: true, status: "ready" });
    } catch (error) {
      console.error("[Readiness] Dependency check failed", error);
      return res.status(503).json({ ok: false, status: "not_ready" });
    }
  });

  return { beginDrain: () => { acceptingTraffic = false; } };
}
