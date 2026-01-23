import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import robot from "robotjs";
import { POSITIONS, SPEED_MODE, WAIT_TIME } from "./consts.js";

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

export const conditionalSleep = async () => {
  if (!SPEED_MODE) await sleep(WAIT_TIME);
};

// -----------------------------------------------------------------------------
// Robot helpers
// -----------------------------------------------------------------------------

export const clickAndWait = async (position) => {
  robot.moveMouse(position.x, position.y);
  robot.mouseClick("left");
  await conditionalSleep();
};

export const typeText = (text) => {
  robot.typeString(text);
};

// -----------------------------------------------------------------------------
// Progress helpers
// -----------------------------------------------------------------------------

export const displayProgress = (progress) => {
  if (progress.photosCompleted === 0) return;

  console.log(
    `📊 Saved progress found: ${progress.photosCompleted} photos completed`,
  );
  if (progress.lastSession) {
    console.log(
      `   Last session: ${new Date(progress.lastSession).toLocaleString()}`,
    );
  }
  console.log(`   Remaining: ~${12000 - progress.photosCompleted} photos\n`);
};

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

export const promptResumeSession = async (rl) => {
  const answer = await new Promise((resolve) => {
    rl.question("Resume from last position? (y/n): ", resolve);
  });
  return answer.toLowerCase() === "y" || answer.toLowerCase() === "yes";
};

export const saveAndNotify = (photosCompleted) => {
  saveProgress(photosCompleted);
  console.log(`💾 Progress saved (${photosCompleted} photos completed)\n`);
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
  await clickAndWait(POSITIONS.photosWindow);

  // Step forward photo-by-photo
  for (let i = 0; i < count; i++) {
    robot.keyTap("right");

    if ((i + 1) % 10 === 0) {
      process.stdout.write(`\rNavigated: ${i + 1}/${count} photos...`);
    }
  }

  console.log(`\r✅ Navigated to photo #${count + 1}       `);

  // Refocus terminal
  await clickAndWait(POSITIONS.terminal);

  console.log("Ready to continue!\n");
};

// -----------------------------------------------------------------------------
// General
// -----------------------------------------------------------------------------
export const isQuitCommand = (input) => {
  const normalized = input.toLowerCase();
  return normalized === "quit" || normalized === "exit";
};

export const handleShutdown = (rl, photosCompleted) => {
  console.log(`\n✅ Saving progress... (${photosCompleted} photos completed)`);
  saveAndNotify(photosCompleted);
  console.log("Run the script again to resume.\n");
  rl.close();
};
