export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startRuntime } = await import("./server/runtime");
    await startRuntime();
  }
}
