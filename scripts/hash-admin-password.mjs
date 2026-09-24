#!/usr/bin/env node
// Generates an ADMIN_PASSWORD_HASH value for .env / Vercel env vars.
// Usage: node scripts/hash-admin-password.mjs 'your-strong-password'
import { randomBytes, scryptSync } from "node:crypto";

const password = process.argv[2];
if (!password) {
  console.error("Usage: node scripts/hash-admin-password.mjs 'your-strong-password'");
  process.exit(1);
}

const salt = randomBytes(16);
const hash = scryptSync(password, salt, 64);
console.log(`scrypt:${salt.toString("hex")}:${hash.toString("hex")}`);
