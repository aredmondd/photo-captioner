/**
 * Photo Caption Automation Script
 * Automates the workflow of adding captions to photos in iCloud Photos
 *
 * Requirements:
 * - npm install robotjs readline
 * - Configure POSITIONS object with actual pixel coordinates
 */

const robot = require("robotjs");
const readline = require("readline");
const fs = require("fs");
const path = require("path");
const clipboardy = require("clipboardy");
const { POSITIONS, WAIT_TIME, POST_COPY_WAIT_TIME } = require("./consts");

const PROGRESS_FILE = path.join(__dirname, ".photo_progress.json");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const clickAt = async (x, y) => {
  robot.moveMouse(x, y);
  robot.mouseClick("left");
};

const typeText = (text) => {
  robot.typeString(text);
};

// Progress tracking functions
const loadProgress = () => {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      const data = fs.readFileSync(PROGRESS_FILE, "utf8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Error loading progress:", error.message);
  }
  return { photosCompleted: 0, lastSession: null };
};

const saveProgress = (photosCompleted) => {
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

const navigateToLastPosition = async (count) => {
  if (count === 0) return;

  console.log(`\nNavigating to photo #${count + 1}...`);
  console.log("Make sure Photos app is focused and a photo is selected!");
  console.log("Starting in 3 seconds...\n");

  await sleep(3000);

  // Click on Photos window to ensure it's focused
  await clickAt(POSITIONS.photosWindow.x, POSITIONS.photosWindow.y);

  // Press right arrow 'count' times
  for (let i = 0; i < count; i++) {
    robot.keyTap("right");

    // Show progress every 10 photos
    if ((i + 1) % 10 === 0) {
      process.stdout.write(`\rNavigated: ${i + 1}/${count} photos...`);
    }
  }

  console.log(`\r✅ Navigated to photo #${count + 1}       `);

  // Click back on terminal
  await clickAt(POSITIONS.terminal.x, POSITIONS.terminal.y);

  console.log("Ready to continue!\n");
};

// Main workflow automation
const processSinglePhoto = async (caption, currentCount) => {
  let success = true;

  console.time("processSinglePhoto");
  console.log(`[Photo ${currentCount}] Processing caption: "${caption}"`);

  // 1. Click on Photos window
  await clickAt(POSITIONS.photosWindow.x, POSITIONS.photosWindow.y);
  await sleep(WAIT_TIME);

  // 2. Open info panel
  await clickAt(POSITIONS.infoIcon.x, POSITIONS.infoIcon.y);
  await sleep(WAIT_TIME);

  // 3. Click on info panel and caption box
  await clickAt(POSITIONS.infoPanel.x, POSITIONS.infoPanel.y);
  await sleep(WAIT_TIME);

  await clickAt(POSITIONS.addTitle.x, POSITIONS.addTitle.y);
  robot.keyTap("tab");
  robot.keyTap("delete"); // in case there is already something in there.
  await sleep(WAIT_TIME);

  // 4. Type the caption
  typeText(caption);
  robot.keyTap("a", "command");
  robot.keyTap("c", "command");
  await sleep(POST_COPY_WAIT_TIME);
  if (caption !== clipboardy.default.readSync()) {
    success = false;
  }
  await sleep(WAIT_TIME);

  // 5. Close info panel (Command + I)
  await clickAt(POSITIONS.infoIcon.x, POSITIONS.infoIcon.y);
  await sleep(WAIT_TIME);

  // 6. Click on Photos window
  await clickAt(POSITIONS.photosWindow.x, POSITIONS.photosWindow.y);
  await sleep(WAIT_TIME);

  if (success) {
    // Move to next photo (Right arrow)
    robot.keyTap("right");
    console.log("✅ SAVED THE FIELD.");
  } else {
    console.log("❌ DID NOT SAVE THE FIELD");
  }
  await sleep(WAIT_TIME);

  // 8. Click back on terminal
  await clickAt(POSITIONS.terminal.x, POSITIONS.terminal.y);
  await sleep(WAIT_TIME);

  console.timeEnd("processSinglePhoto");
  console.log();
};

// Interactive prompt loop
const startCaptionLoop = async () => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // Load progress
  const progress = loadProgress();
  let photosCompleted = 0;

  console.log("=== Photo Caption Automation ===\n");

  // Check if there's saved progress
  if (progress.photosCompleted > 0) {
    console.log(
      `📊 Found saved progress: ${progress.photosCompleted} photos completed`,
    );
    if (progress.lastSession) {
      console.log(
        `   Last session: ${new Date(progress.lastSession).toLocaleString()}`,
      );
    }
    console.log(`   Remaining: ~${12000 - progress.photosCompleted} photos\n`);

    const answer = await new Promise((resolve) => {
      rl.question("Resume from last position? (y/n): ", resolve);
    });

    if (answer.toLowerCase() === "y" || answer.toLowerCase() === "yes") {
      photosCompleted = progress.photosCompleted;
      await navigateToLastPosition(photosCompleted);
    } else {
      console.log("Starting from the beginning...\n");
    }
  }

  console.log("Type your caption and press Enter");
  console.log(
    'Type "quit", "exit", or press Ctrl+C to stop and save progress\n',
  );

  const promptForCaption = () => {
    rl.question("Caption: ", async (answer) => {
      const caption = answer.trim();

      if (
        caption.toLowerCase() === "quit" ||
        caption.toLowerCase() === "exit"
      ) {
        console.log(
          `\n✓ Saving progress... (${photosCompleted} photos completed)`,
        );
        saveProgress(photosCompleted);
        console.log("Progress saved! Run the script again to resume.\n");
        rl.close();
        return;
      }

      if (caption === "") {
        console.log("Skipping empty caption\n");
        promptForCaption();
        return;
      }

      try {
        photosCompleted++;
        await processSinglePhoto(caption, photosCompleted);

        // Auto-save progress every 10 photos
        if (photosCompleted % 10 === 0) {
          saveProgress(photosCompleted);
          console.log(`💾 Progress auto-saved (${photosCompleted} photos)\n`);
        }

        promptForCaption();
      } catch (error) {
        console.error("Error:", error.message);
        promptForCaption();
      }
    });
  };

  // Handle Ctrl+C to save progress
  process.on("SIGINT", () => {
    console.log(
      `\n\n✓ Saving progress... (${photosCompleted} photos completed)`,
    );
    saveProgress(photosCompleted);
    console.log("Progress saved! Run the script again to resume.\n");
    rl.close();
    process.exit(0);
  });

  promptForCaption();
};

startCaptionLoop();
