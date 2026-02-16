import type { Page } from "playwright";
import fs from "fs";
import path from "path";
import { logger } from "../utils/logger.js";
import { config } from "../utils/config.js";

interface RecordingEntry {
  timestamp: number;
  url: string;
  type: "navigation" | "xhr_request" | "xhr_response" | "dom_snapshot" | "screenshot";
  data: unknown;
}

export class BrowserRecorder {
  private recordings: RecordingEntry[] = [];
  private broker: string = "";
  private recording = false;

  async startRecording(page: Page, broker: string): Promise<void> {
    this.broker = broker;
    this.recordings = [];
    this.recording = true;

    logger.info(`Starting recording for ${broker}`);

    page.on("framenavigated", (frame) => {
      if (!this.recording) return;
      if (frame !== page.mainFrame()) return;

      this.recordings.push({
        timestamp: Date.now(),
        url: frame.url(),
        type: "navigation",
        data: { url: frame.url() },
      });
      logger.debug(`Recorded navigation: ${frame.url()}`);
    });

    page.on("request", (req) => {
      if (!this.recording) return;
      const resourceType = req.resourceType();
      if (resourceType !== "xhr" && resourceType !== "fetch") return;

      this.recordings.push({
        timestamp: Date.now(),
        url: req.url(),
        type: "xhr_request",
        data: {
          url: req.url(),
          method: req.method(),
          headers: req.headers(),
          postData: req.postData(),
        },
      });
    });

    page.on("response", async (res) => {
      if (!this.recording) return;
      const resourceType = res.request().resourceType();
      if (resourceType !== "xhr" && resourceType !== "fetch") return;

      try {
        const body = await res.json();
        this.recordings.push({
          timestamp: Date.now(),
          url: res.url(),
          type: "xhr_response",
          data: {
            url: res.url(),
            status: res.status(),
            headers: res.headers(),
            body,
          },
        });
      } catch {
        // Non-JSON response, record as text
        try {
          const text = await res.text();
          this.recordings.push({
            timestamp: Date.now(),
            url: res.url(),
            type: "xhr_response",
            data: {
              url: res.url(),
              status: res.status(),
              headers: res.headers(),
              body: text.substring(0, 5000),
            },
          });
        } catch {
          // Response body unavailable
        }
      }
    });
  }

  async snapshot(page: Page): Promise<void> {
    if (!this.recording) return;

    try {
      const tree = await page.evaluate(() => document.body.innerText);
      this.recordings.push({
        timestamp: Date.now(),
        url: page.url(),
        type: "dom_snapshot",
        data: tree,
      });
    } catch (err) {
      logger.warn(`Failed to capture accessibility snapshot: ${err}`);
    }

    try {
      const timestamp = Date.now();
      const screenshotDir = path.join(config.recordingsDir, this.broker, "screenshots");
      fs.mkdirSync(screenshotDir, { recursive: true });
      const screenshotPath = path.join(screenshotDir, `${timestamp}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });

      this.recordings.push({
        timestamp,
        url: page.url(),
        type: "screenshot",
        data: { path: screenshotPath },
      });
    } catch (err) {
      logger.warn(`Failed to capture screenshot: ${err}`);
    }
  }

  stopRecording(): void {
    this.recording = false;
  }

  async save(): Promise<string> {
    this.stopRecording();

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outDir = path.join(config.recordingsDir, this.broker, timestamp);
    fs.mkdirSync(outDir, { recursive: true });

    const outFile = path.join(outDir, "recording.json");
    fs.writeFileSync(outFile, JSON.stringify(this.recordings, null, 2));

    logger.info(`Recording saved to ${outFile} (${this.recordings.length} entries)`);
    return outDir;
  }
}
