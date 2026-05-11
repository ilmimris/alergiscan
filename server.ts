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
    const query = req.query.query as string;
    if (!query) {
      return res.status(400).json({ error: "Query is required" });
    }

    try {
      // 1. Initial request to get session cookies and CSRF token
      const initialResponse = await fetch('https://cekbpom.pom.go.id/all-produk', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        }
      });
      
      const html = await initialResponse.text();
      
      // Better cookie handling using getSetCookie if available
      const setCookies = (initialResponse.headers as any).getSetCookie 
        ? (initialResponse.headers as any).getSetCookie() 
        : (initialResponse.headers.get('set-cookie')?.split(',') || []);
      
      const cookieString = setCookies.map((c: string) => c.split(';')[0]).join('; ');
      
      // Extract CSRF token from meta tag with more robust regex
      const tokenMatch = html.match(/name=["']csrf-token["']\s+content=["']([^"']+)["']/) 
                      || html.match(/content=["']([^"']+)["']\s+name=["']csrf-token["']/);
      const token = (tokenMatch ? tokenMatch[1] : '').trim();

      // 2. Post to the AJAX endpoint
      const formData = new URLSearchParams();
      formData.append('draw', '1');
      formData.append('start', '0');
      formData.append('length', '10');
      formData.append('query', query);
      const fields = ['product_register', 'product_name', 'product_brand', 'product_package', 'product_form', 'ingredients', 'manufacturer_name', 'status', 'release_date'];
      fields.forEach(f => formData.append(f, ''));

      const response = await fetch('https://cekbpom.pom.go.id/produk-dt/all', {
        method: 'POST',
        headers: {
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-CSRF-TOKEN': token,
          'X-Requested-With': 'XMLHttpRequest',
          'Cookie': cookieString.trim(),
          'Referer': `https://cekbpom.pom.go.id/all-produk?query=${encodeURIComponent(query)}`,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Origin': 'https://cekbpom.pom.go.id'
        },
        body: formData.toString()
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`BPOM API Error (${response.status}):`, errText);
        return res.status(response.status).json({ error: "BPOM service error" });
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("BPOM Proxy Error:", error);
      res.status(500).json({ error: "Gagal menghubungkan ke server BPOM" });
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
