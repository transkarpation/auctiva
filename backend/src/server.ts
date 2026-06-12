import { createApp } from "./app.js";
import { connectDB } from "./config/db.js";
import { env } from "./env.js";

async function start(): Promise<void> {
  try {
    await connectDB();
    const app = createApp();
    app.listen(env.port, () => {
      console.log(`Server listening on http://localhost:${env.port}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

void start();
