import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Proxy for BPOM API to avoid CORS issues
  app.get("/api/bpom", async (req, res) => {
    const query = req.query.query;
    if (!query) {
      return res.status(400).json({ error: "Query is required" });
    }

    try {
      const response = await fetch(`https://cekbpom.pom.go.id/all-produk?query=${query}`);
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("BPOM Proxy Error:", error);
      res.status(500).json({ error: "Gagal mengambil data BPOM" });
    }
  });

  // Vite middleware for development
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

startServer();
