/**
 * Photo Caption Automation Script
 * Automates the workflow of adding captions to photos in iCloud Photos
 */

import robot from "robotjs";
import { createInterface } from "readline";
import clipboardy from "clipboardy";
import {
  POSITIONS,
  WAIT_TIME,
  POST_COPY_WAIT_TIME,
  SPEED_MODE,
  DOUBLE_CHECK_CAPTION,
  TIME_EACH_PHOTO,
} from "./consts.js";
import {
  sleep,
  clickAt,
  typeText,
  loadProgress,
  saveProgress,
  navigateToLastPosition,
} from "./utils.js";

const processSinglePhoto = async (caption, currentCount) => {
  let success = true;

  if (TIME_EACH_PHOTO) {
    console.time("processSinglePhoto");
  }
  console.log(`[Photo ${currentCount}] Processing caption: "${caption}"`);

  // 1. Click on Photos window
  await clickAt(POSITIONS.photosWindow.x, POSITIONS.photosWindow.y);
  if (!SPEED_MODE) {
    await sleep(WAIT_TIME);
  }

  // 2. Open info panel
  await clickAt(POSITIONS.infoIcon.x, POSITIONS.infoIcon.y);
  if (!SPEED_MODE) {
    await sleep(WAIT_TIME);
  }

  // 3. Click on info panel and caption box
  await clickAt(POSITIONS.infoPanel.x, POSITIONS.infoPanel.y);
  if (!SPEED_MODE) {
    await sleep(WAIT_TIME);
  }

  await clickAt(POSITIONS.addTitle.x, POSITIONS.addTitle.y);
  robot.keyTap("tab");
  robot.keyTap("delete"); // delete in case there is already something in there.
  if (!SPEED_MODE) {
    await sleep(WAIT_TIME);
  }

  // 4. Type the caption
  typeText(caption);
  robot.keyTap("a", "command");
  robot.keyTap("c", "command");

  // this is a completely optional step,
  // that will check at the end of the process if the caption was actually inputted.
  //   it will print various messages around line 140 based on the success flag.
  if (DOUBLE_CHECK_CAPTION) {
    await sleep(POST_COPY_WAIT_TIME);
    if (caption !== clipboardy.readSync()) {
      success = false;
    }
  }

  if (!SPEED_MODE) {
    await sleep(WAIT_TIME);
  }

  // 5. Close info panel (Command + I)
  await clickAt(POSITIONS.infoIcon.x, POSITIONS.infoIcon.y);

  if (!SPEED_MODE) {
    await sleep(WAIT_TIME);
  }

  // 6. Click on Photos window
  await clickAt(POSITIONS.photosWindow.x, POSITIONS.photosWindow.y);
  if (!SPEED_MODE) {
    await sleep(WAIT_TIME);
  }

  if (DOUBLE_CHECK_CAPTION) {
    if (success) {
      // Move to next photo (Right arrow)
      robot.keyTap("right");
      console.log("✅ SAVED THE FIELD.");
    } else {
      console.log("❌ DID NOT SAVE THE FIELD");
    }
  }

  if (!SPEED_MODE) {
    await sleep(WAIT_TIME);
  }

  // 8. Click back on terminal
  await clickAt(POSITIONS.terminal.x, POSITIONS.terminal.y);
  if (!SPEED_MODE) {
    await sleep(WAIT_TIME);
  }

  if (TIME_EACH_PHOTO) {
    console.timeEnd("processSinglePhoto");
  }

  console.log();
};

// Interactive prompt loop
const startCaptionLoop = async () => {
  const rl = createInterface({
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
          `\n✅ Saving progress... (${photosCompleted} photos completed)`,
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
