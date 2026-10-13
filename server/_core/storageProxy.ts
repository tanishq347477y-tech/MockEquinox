import type { Express } from "express";
import { ENV } from "./env";
import { sdk } from "./sdk";
import { storageGetSignedUrl } from "../storage";

export function registerStorageProxy(app: Express) {
  app.get("/api/storage/*key", async (req, res) => {
    const rawKey = (req.params as Record<string, string | string[]>).key;
    const key = Array.isArray(rawKey) ? rawKey.join("/") : rawKey;
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }

    // Owner source PDFs are private review material. The AI pipeline fetches a
    // signed URL server-side; proxy access is intentionally owner-only.
    if (key.startsWith("owner-imports/")) {
      try {
        const user = await sdk.authenticateRequest(req);
        if (!user || !ENV.ownerEmail || user.email?.toLowerCase() !== ENV.ownerEmail) {
          res.status(404).send("Not found");
          return;
        }
      } catch {
        res.status(404).send("Not found");
        return;
      }
    }

    try {
      const url = await storageGetSignedUrl(key);
      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}
