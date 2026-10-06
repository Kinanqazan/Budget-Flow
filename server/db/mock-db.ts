import fs from "fs";
import path from "path";
import crypto from "crypto";

interface User {
  id: string;
  username: string;
  password_hash: string;
  created_at: string;
}

interface BudgetData {
  id: string;
  user_id: string;
  finance_data: string;
  dark_mode: number;
  currency: string;
  updated_at: string;
}

interface DBState {
  users: User[];
  budget_data: BudgetData[];
}

export class MockDatabase {
  private filePath: string;
  private state: DBState;

  constructor(dbPath: string) {
    this.filePath = dbPath.endsWith(".db") ? dbPath.replace(/\.db$/, ".json") : dbPath;
    this.state = { users: [], budget_data: [] };
    this.load();
  }

  private load() {
    if (process.env.NODE_ENV === "test") {
      this.state = { users: [], budget_data: [] };
      return;
    }
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, "utf-8");
        this.state = JSON.parse(raw);
        if (!this.state.users) this.state.users = [];
        if (!this.state.budget_data) this.state.budget_data = [];
      } else {
        this.save();
      }
    } catch (e) {
      console.error("Failed to load mock database JSON file, initializing empty:", e);
      this.state = { users: [], budget_data: [] };
    }
  }

  private save() {
    if (process.env.NODE_ENV === "test") {
      return;
    }
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.state, null, 2));
    } catch (e) {
      console.error("Failed to save mock database JSON file:", e);
    }
  }

  public pragma(sql: string): string | number | undefined {
    // Ignore pragmas
    return undefined;
  }

  public exec(sql: string): void {
    // Ignore schema tables creations
    if (sql.includes("INSERT OR IGNORE INTO users")) {
      const exists = this.state.users.some(u => u.username === "admin" || u.id === "default");
      if (!exists) {
        this.state.users.push({
          id: "default",
          username: "admin",
          password_hash: "disabled",
          created_at: new Date().toISOString(),
        });
        this.save();
      }
    }
  }

  public prepare(sql: string) {
    const sanitized = sql.replace(/\s+/g, " ").trim();

    return {
      get: (...params: (string | number | boolean | null)[]): unknown => {
        if (/SELECT\s+id,\s+username,\s+password_hash\s+FROM\s+users\s+WHERE\s+username\s+=\s+\?/i.test(sanitized)) {
          const username = params[0] as string;
          const user = this.state.users.find((u) => u.username === username);
          return user ? { id: user.id, username: user.username, password_hash: user.password_hash } : undefined;
        }

        if (/SELECT\s+finance_data,\s+dark_mode,\s+currency,\s+updated_at\s+FROM\s+budget_data\s+WHERE\s+user_id\s+=\s+\?/i.test(sanitized)) {
          const userId = params[0] as string;
          const row = this.state.budget_data.find((b) => b.user_id === userId);
          return row
            ? {
                finance_data: row.finance_data,
                dark_mode: row.dark_mode,
                currency: row.currency,
                updated_at: row.updated_at,
              }
            : undefined;
        }

        if (/SELECT\s+COUNT\(\*\)\s+as\s+count\s+FROM\s+users/i.test(sanitized)) {
          return { count: this.state.users.length };
        }

        if (/INSERT\s+INTO\s+users\s+\(username,\s+password_hash\)\s+SELECT\s+\?,\s+\?\s+WHERE\s+NOT\s+EXISTS\s+\(SELECT\s+1\s+FROM\s+users\)\s+RETURNING\s+id/i.test(sanitized)) {
          if (this.state.users.length > 0) return undefined;

          const username = params[0] as string;
          const passwordHash = params[1] as string;

          if (this.state.users.some(u => u.username === username)) {
            throw new Error("UNIQUE constraint failed: users.username");
          }

          const newUser: User = {
            id: crypto.randomUUID(),
            username,
            password_hash: passwordHash,
            created_at: new Date().toISOString(),
          };

          this.state.users.push(newUser);
          this.save();
          return { id: newUser.id };
        }

        throw new Error(`MockDatabase query get not implemented: ${sql}`);
      },

      run: (...params: (string | number | boolean | null)[]): { changes: number } => {
        if (/INSERT\s+OR\s+IGNORE\s+INTO\s+users/i.test(sanitized)) {
          let id = params[0] as string;
          let username = params[1] as string;
          let passwordHash = params[2] as string;

          if (params.length === 0) {
            // Hardcoded fallback values (e.g. from schema.ts setup when auth is disabled)
            id = "default";
            username = "admin";
            passwordHash = "disabled";
          }

          const exists = this.state.users.some(u => u.id === id || u.username === username);
          if (!exists) {
            this.state.users.push({
              id,
              username,
              password_hash: passwordHash,
              created_at: new Date().toISOString(),
            });
            this.save();
            return { changes: 1 };
          }
          return { changes: 0 };
        }

        if (/INSERT\s+INTO\s+budget_data/i.test(sanitized)) {
          const userId = params[0] as string;
          const financeData = params[1] as string;
          const darkMode = params[2] as number;
          const currency = params[3] as string;

          const idx = this.state.budget_data.findIndex(b => b.user_id === userId);
          if (idx !== -1) {
            this.state.budget_data[idx] = {
              ...this.state.budget_data[idx],
              finance_data: financeData,
              dark_mode: darkMode,
              currency,
              updated_at: new Date().toISOString(),
            };
          } else {
            this.state.budget_data.push({
              id: crypto.randomUUID(),
              user_id: userId,
              finance_data: financeData,
              dark_mode: darkMode,
              currency,
              updated_at: new Date().toISOString(),
            });
          }
          this.save();
          return { changes: 1 };
        }

        if (/DELETE\s+FROM\s+users\s+WHERE\s+id\s+=\s+\?/i.test(sanitized)) {
          const userId = params[0] as string;
          const initialLen = this.state.users.length;
          this.state.users = this.state.users.filter(u => u.id !== userId);
          this.state.budget_data = this.state.budget_data.filter(b => b.user_id !== userId);
          this.save();
          return { changes: initialLen - this.state.users.length };
        }

        throw new Error(`MockDatabase query run not implemented: ${sql}`);
      },
    };
  }
}
