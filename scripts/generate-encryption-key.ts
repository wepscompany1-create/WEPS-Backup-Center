#!/usr/bin/env tsx
import { randomBytes } from "node:crypto";

const key = randomBytes(32);
console.log("hex:", key.toString("hex"));
console.log("base64:", key.toString("base64"));
