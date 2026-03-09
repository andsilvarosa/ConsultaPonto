import express from "express";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import dotenv from "dotenv";
import Database from "better-sqlite3";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock D1 Database for local development
const sqlite = new Database("local.db");

const mockD1 = {
  prepare: (query: string) => {
    return {
      bind: (...params: any[]) => {
        const stmtObj = {
          all: async () => {
            try {
              const stmt = sqlite.prepare(query);
              const results = stmt.all(...params);
              return { results, success: true };
            } catch (e: any) {
              throw e;
            }
          },
          run: async () => {
            try {
              const stmt = sqlite.prepare(query);
              const info = stmt.run(...params);
              return { results: [], success: true, meta: { changes: info.changes } };
            } catch (e: any) {
              throw e;
            }
          },
          first: async () => {
            try {
              const stmt = sqlite.prepare(query);
              const result = stmt.get(...params);
              return result;
            } catch (e: any) {
              throw e;
            }
          },
          raw: async () => {
            try {
              const stmt = sqlite.prepare(query);
              const results = stmt.all(...params);
              return results.map(row => Object.values(row as any));
            } catch (e: any) {
              throw e;
            }
          }
        };
        return stmtObj;
      },
      all: async () => {
        try {
          const stmt = sqlite.prepare(query);
          const results = stmt.all();
          return { results, success: true };
        } catch (e: any) {
          throw e;
        }
      },
      run: async () => {
        try {
          const stmt = sqlite.prepare(query);
          const info = stmt.run();
          return { results: [], success: true, meta: { changes: info.changes } };
        } catch (e: any) {
          throw e;
        }
      },
      first: async () => {
        try {
          const stmt = sqlite.prepare(query);
          const result = stmt.get();
          return result;
        } catch (e: any) {
          throw e;
        }
      },
      raw: async () => {
        try {
          const stmt = sqlite.prepare(query);
          const results = stmt.all();
          return results.map(row => Object.values(row as any));
        } catch (e: any) {
          throw e;
        }
      }
    };
  },
  exec: async (query: string) => {
    sqlite.exec(query);
  },
  batch: async (statements: any[]) => {
    const results = [];
    for (const stmt of statements) {
      results.push(await stmt.all());
    }
    return results;
  }
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Helper to simulate Cloudflare Pages context
  const createCfContext = (req: express.Request) => ({
    request: {
      json: async () => req.body,
      text: async () => JSON.stringify(req.body),
      headers: {
        get: (name: string) => req.header(name)
      }
    },
    env: {
      DB: mockD1,
    },
  });

  // Map /api routes to /functions/api
  app.all("/api/*", async (req, res) => {
    try {
      const apiPath = req.path.replace("/api/", "");
      let modulePath = path.join(__dirname, "functions", "api", `${apiPath}.ts`);
      
      // Handle index routes (e.g., /api/entries -> /functions/api/entries.ts)
      if (!fs.existsSync(modulePath)) {
        modulePath = path.join(__dirname, "functions", "api", apiPath, "index.ts");
      }
      
      // Handle dynamic routes (e.g., /api/entries/123 -> /functions/api/entries/[date].ts)
      if (!fs.existsSync(modulePath)) {
        const parts = apiPath.split("/");
        if (parts.length === 2 && parts[0] === "entries") {
          modulePath = path.join(__dirname, "functions", "api", "entries", "[date].ts");
          req.params["date"] = parts[1];
        }
      }

      if (fs.existsSync(modulePath)) {
        const moduleUrl = pathToFileURL(modulePath).href;
        const module = await import(moduleUrl);
        const method = req.method.toLowerCase();
        const handlerName = `onRequest${method.charAt(0).toUpperCase() + method.slice(1)}`;
        
        if (module[handlerName]) {
          const context = createCfContext(req);
          if (req.params["date"]) {
            (context as any).params = { date: req.params["date"] };
          }
          
          const response = await module[handlerName](context);
          
          if (response instanceof Response) {
            const text = await response.text();
            res.status(response.status).set(Object.fromEntries(response.headers.entries())).send(text);
          } else {
            res.json(response);
          }
          return;
        }
      }
      
      res.status(404).json({ error: "Not found" });
    } catch (error: any) {
      console.error("API Error:", error);
      res.status(500).json({ error: "Internal Server Error", details: error.message });
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
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
