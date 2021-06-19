import { createVercelFunction } from "@remastered/vercel";
import * as serverEntry from "../dist/server/entry.server";
import path from "path";
import fs from "fs-extra";
import os from "os";

const rootDir = path.join(__dirname, "..");

const dbDir = path.join(os.tmpdir(), "db");
fs.mkdirpSync(dbPath);
fs.copySync(path.join(__dirname, "../dist/db"), dbDir);

process.env.DATABASE_URL = `sqlite:${dbDir}/db.sqlite3`;

export default createVercelFunction({ rootDir, serverEntry });
