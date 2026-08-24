#!/usr/bin/env tsx
import { bootstrapAdmin } from "../src/lib/auth/bootstrap-admin";

bootstrapAdmin()
  .then((result) => {
    console.log(result.created ? "Admin bootstrap created an account" : "Admin bootstrap completed");
  })
  .catch((error) => {
    console.error("Admin bootstrap failed");
    console.error(error instanceof Error ? error.message : "unknown error");
    process.exit(1);
  });
