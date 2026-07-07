import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { generateWeeklyFleetSummaryEmail, sendEmail } from "./email-service";
import { storage } from "./storage";
import { runDailyBackupEmail } from "./email-backup";
import { runStartupMigrations } from "./startup-migrations";

console.log("[startup] Job Flow server starting");

// Global crash guards — log and keep running instead of exiting
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Run schema migrations before anything else — adds missing columns/tables
  // automatically on every deploy so Railway's production DB stays in sync.
  await runStartupMigrations();

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ── Weekly fleet summary scheduler ────────────────────────────────────────
  // Fires every hour; sends report on Monday between 07:00–07:59 SAST (UTC+2)
  let weeklySummarySentThisWeek = false;
  setInterval(async () => {
    const now = new Date();
    const saTime = new Date(now.getTime() + 2 * 60 * 60 * 1000); // UTC→SAST
    const isMonday = saTime.getUTCDay() === 1;
    const isSevenAm = saTime.getUTCHours() === 7;
    if (isMonday && isSevenAm && !weeklySummarySentThisWeek) {
      weeklySummarySentThisWeek = true;
      try {
        const params = await generateWeeklyFleetSummaryEmail(storage);
        if (params) {
          await sendEmail(params);
          log("Weekly fleet summary email sent to " + params.to);
        }
      } catch (e) {
        console.error("Weekly fleet summary failed:", e);
        weeklySummarySentThisWeek = false; // allow retry next hour
      }
    }
    // Reset flag on Tuesday so it fires again next Monday
    if (saTime.getUTCDay() === 2) weeklySummarySentThisWeek = false;
  }, 60 * 60 * 1000);

  // ── Daily backup scheduler (Email) ────────────────────────────────────────
  // Fires every minute; runs at 21:30 UTC (23:30 SAST) once per day
  let lastDailyEmailDate = "";
  setInterval(async () => {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const utcHours = now.getUTCHours();
    const utcMins = now.getUTCMinutes();
    if (!(utcHours === 21 && utcMins >= 30)) return;

    if (lastDailyEmailDate !== todayStr) {
      lastDailyEmailDate = todayStr;
      try {
        const result = await runDailyBackupEmail("auto");
        if (result.status === "success") {
          log(`Daily backup email sent to ${result.recipient}`);
        } else {
          console.error(`Daily backup email failed: ${result.errorMessage}`);
        }
      } catch (e: any) {
        console.error("Daily backup email crashed:", e.message);
      }
    }
  }, 60 * 1000);

  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(port, "0.0.0.0", () => {
    console.log(`[startup] Server listening on port: ${port}`);
    log(`serving on port ${port}`);
    log(`Mobile app available at: http://0.0.0.0:${port}/mobile`);
  });
})();
