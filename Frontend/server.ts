import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route: Get all supernovae from summary payload and check file existence
  app.get("/api/supernovae", (req, res) => {
    try {
      const dataDir = path.join(process.cwd(), "data");
      const summaryPath = path.join(dataDir, "summary.json");

      if (!fs.existsSync(summaryPath)) {
        return res.status(404).json({ error: "Summary payload data not found on server." });
      }

      const summaryRaw = fs.readFileSync(summaryPath, "utf-8");
      const summaryList = JSON.parse(summaryRaw);

      // Enhance summary items with lightcurve availability
      const enhancedList = summaryList.map((item: any) => {
        const lcFile = path.join(dataDir, `${item.object_id}_lc.json`);
        return {
          ...item,
          has_light_curve: fs.existsSync(lcFile),
        };
      });

      res.json(enhancedList);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to read supernovae data: " + error.message });
    }
  });

  // API Route: Get individual light curve by object ID
  app.get("/api/supernovae/:id", (req, res) => {
    try {
      const { id } = req.params;
      const lcFile = path.join(process.cwd(), "data", `${id}_lc.json`);

      if (!fs.existsSync(lcFile)) {
        return res.status(404).json({ error: `Light curve file for ${id} not found.` });
      }

      const lcRaw = fs.readFileSync(lcFile, "utf-8");
      const lcData = JSON.parse(lcRaw);
      res.json(lcData);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to read light curve data: " + error.message });
    }
  });

  // Serve static data folder in production if needed, or dev assets
  // Vite assets middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start fullstack server", err);
});
