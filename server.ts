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
      console.log(`[BPOM Proxy] Checking query: ${query}...`);
      
      // 1. Initial request to get session cookies and CSRF token
      const initialResponse = await fetch('https://cekbpom.pom.go.id/all-produk', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
        }
      });
      
      const html = await initialResponse.text();
      
      // Extract cookies carefully
      const rawCookies = initialResponse.headers.get('set-cookie');
      let cookieString = '';
      if (rawCookies) {
        // Laravel usually sends XSRF-TOKEN and webreg_session
        cookieString = rawCookies.split(',').map(c => c.split(';')[0].trim()).join('; ');
      }
      
      // Extract CSRF token from meta tag
      const tokenMatch = html.match(/name=["']csrf-token["']\s+content=["']([^"']+)["']/) 
                      || html.match(/content=["']([^"']+)["']\s+name=["']csrf-token["']/);
      const token = (tokenMatch ? tokenMatch[1] : '').trim();

      if (!token) {
        console.error("[BPOM Proxy] Failed to extract CSRF token. HTML length:", html.length);
        // Fallback or log if we're being redirected/blocked
        if (html.includes("Checking your browser") || html.includes("Cloudflare")) {
          return res.status(503).json({ error: "BPOM dilindungi oleh proteksi anti-bot. Coba buka dari tab baru." });
        }
      }

      // 2. Post to the AJAX endpoint
      const formData = new URLSearchParams();
      formData.append('draw', '1');
      formData.append('start', '0');
      formData.append('length', '10');
      formData.append('query', query);
      
      // Add required empty fields (Laravel DataTables requirement)
      const fields = [
        'product_register', 'product_name', 'product_brand', 
        'product_package', 'product_form', 'ingredients', 
        'manufacturer_name', 'status', 'release_date',
        'manufacturer', 'registrar'
      ];
      fields.forEach(f => formData.append(f, ''));

      const response = await fetch('https://cekbpom.pom.go.id/produk-dt/all', {
        method: 'POST',
        headers: {
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-CSRF-TOKEN': token,
          'X-Requested-With': 'XMLHttpRequest',
          'Cookie': cookieString,
          'Referer': `https://cekbpom.pom.go.id/all-produk?query=${encodeURIComponent(query)}`,
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Origin': 'https://cekbpom.pom.go.id',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-origin',
        },
        body: formData.toString()
      });

      const contentType = response.headers.get("content-type");
      
      if (!response.ok) {
        const errText = await response.text();
        console.error(`[BPOM Proxy] POST Error (${response.status}):`, errText.substring(0, 500));
        return res.status(response.status).json({ error: "Server BPOM menolak permintaan (403/500)" });
      }

      if (contentType && contentType.includes("application/json")) {
        const data = await response.json();
        res.json(data);
      } else {
        const text = await response.text();
        console.error("[BPOM Proxy] Expected JSON but got HTML. First 200 chars:", text.substring(0, 200));
        res.status(502).json({ error: "Format respon tidak valid dari BPOM" });
      }
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
