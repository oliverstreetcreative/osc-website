// Runs once when the Next.js server boots. The client site's boot work
// (staging schema push + client book sync) lives in lib/client/boot.ts.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { boot } = await import("./lib/client/boot")
    await boot()
  }
}
