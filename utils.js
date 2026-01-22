import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import robot from "robotjs";
import { POSITIONS } from "./consts.js";

// -----------------------------------------------------------------------------
// Paths
// -----------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROGRESS_FILE = path.join(__dirname, ".photo_progress.json");

// -----------------------------------------------------------------------------
// Timing helpers
// -----------------------------------------------------------------------------

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// -----------------------------------------------------------------------------
// Robot helpers
// -----------------------------------------------------------------------------

export const clickAt = async (x, y) => {
  robot.moveMouse(x, y);
  robot.mouseClick("left");
};

export const typeText = (text) => {
  robot.typeString(text);
};

// -----------------------------------------------------------------------------
// Progress helpers
// -----------------------------------------------------------------------------

export const loadProgress = () => {
  try {
    if (!fs.existsSync(PROGRESS_FILE)) {
      return { photosCompleted: 0, lastSession: null };
    }

    const data = fs.readFileSync(PROGRESS_FILE, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Error loading progress:", error.message);
    return { photosCompleted: 0, lastSession: null };
  }
};

export const saveProgress = (photosCompleted) => {
  try {
    const data = {
      photosCompleted,
      lastSession: new Date().toISOString(),
      totalPhotos: 12000,
    };

    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Error saving progress:", error.message);
  }
};

// -----------------------------------------------------------------------------
// Navigation
// -----------------------------------------------------------------------------

export const navigateToLastPosition = async (count) => {
  if (count === 0) return;

  console.log(`\nNavigating to photo #${count + 1}...`);
  console.log("Make sure Photos app is focused and a photo is selected!");
  console.log("Starting in 3 seconds...\n");

  await sleep(3000);

  // Focus Photos
  await clickAt(POSITIONS.photosWindow.x, POSITIONS.photosWindow.y);

  // Step forward photo-by-photo
  for (let i = 0; i < count; i++) {
    robot.keyTap("right");

    if ((i + 1) % 10 === 0) {
      process.stdout.write(`\rNavigated: ${i + 1}/${count} photos...`);
    }
  }

  console.log(`\r✅ Navigated to photo #${count + 1}       `);

  // Refocus terminal
  await clickAt(POSITIONS.terminal.x, POSITIONS.terminal.y);

  console.log("Ready to continue!\n");
};
