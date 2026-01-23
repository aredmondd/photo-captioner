/**
 * Photo Caption Automation Script
 * Automates the workflow of adding captions to photos in iCloud Photos
 */

import robot from "robotjs";
import { createInterface } from "readline";
import clipboardy from "clipboardy";
import {
  POSITIONS,
  POST_COPY_WAIT_TIME,
  DOUBLE_CHECK_CAPTION,
  TIME_EACH_PHOTO,
  AUTOSAVE_INTERVAL,
} from "./consts.js";
import {
  sleep,
  clickAndWait,
  typeText,
  loadProgress,
  navigateToLastPosition,
  conditionalSleep,
  promptResumeSession,
  isQuitCommand,
  saveAndNotify,
  handleShutdown,
  displayProgress,
} from "./utils.js";

/**
 * Processes a single photo by adding a caption to it
 * @param {string} caption - The caption text to add
 * @param {number} currentCount - The current photo number being processed
 * @returns {Promise<boolean>} Success status of the operation
 */
const processSinglePhoto = async (caption, currentCount) => {
  let success = true;
  const timer = TIME_EACH_PHOTO ? console.time : () => {};
  const timerEnd = TIME_EACH_PHOTO ? console.timeEnd : () => {};

  timer("processSinglePhoto");
  console.log(`[Photo ${currentCount}] Processing caption: "${caption}"`);

  try {
    // Focus the Photos application
    await clickAndWait(POSITIONS.photosWindow);

    // Open the info panel
    await clickAndWait(POSITIONS.infoIcon);

    // Navigate to caption field
    await clickAndWait(POSITIONS.infoPanel);
    await clickAndWait(POSITIONS.addTitle);

    // Clear existing content and add new caption
    robot.keyTap("tab");
    robot.keyTap("delete");
    await conditionalSleep();

    // Type
    typeText(caption);

    // Verify caption
    if (DOUBLE_CHECK_CAPTION) {
      // Reset back to addTitle field, and tab so we ensure it's in the caption field.
      await clickAndWait(POSITIONS.addTitle);
      robot.keyTap("tab");
      robot.keyTap("a", "command");
      robot.keyTap("c", "command");

      await sleep(POST_COPY_WAIT_TIME);
      success = caption === clipboardy.readSync();
    }

    await conditionalSleep();

    // Close info panel and return to photo view
    await clickAndWait(POSITIONS.infoIcon);
    await clickAndWait(POSITIONS.photosWindow);

    // Log result and move to next photo (or stay if failed)
    if (DOUBLE_CHECK_CAPTION) {
      console.log(
        success ? "✅ Caption saved successfully" : "❌ Caption save failed",
      );
      if (success) {
        robot.keyTap("right");
      }
    } else {
      robot.keyTap("right");
    }

    await conditionalSleep();

    // Return focus to terminal
    await clickAndWait(POSITIONS.terminal);
  } catch (error) {
    console.error(`❌ Error processing photo ${currentCount}:`, error.message);
    success = false;
  } finally {
    timerEnd("processSinglePhoto");
    console.log();
  }

  return success;
};

/**
 * Process user input and handle the photo caption workflow
 */
const processUserInput = async (
  caption,
  photosCompleted,
  rl,
  promptCallback,
) => {
  if (isQuitCommand(caption)) {
    handleShutdown(rl, photosCompleted);
    return photosCompleted;
  }

  if (caption === "") {
    console.log("⚠️  Skipping empty caption\n");
    promptCallback();
    return photosCompleted;
  }

  try {
    photosCompleted++;
    const success = await processSinglePhoto(caption, photosCompleted);

    if (!success) {
      console.log("⚠️  Consider retrying this photo\n");
    }

    // Auto-save at regular intervals
    if (photosCompleted % AUTOSAVE_INTERVAL === 0) {
      saveAndNotify(photosCompleted);
    }

    promptCallback();
  } catch (error) {
    console.error("❌ Unexpected error:", error.message);
    promptCallback();
  }

  return photosCompleted;
};

/**
 * Main function to start the interactive caption loop
 */
const startCaptionLoop = async () => {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const progress = loadProgress();
  let photosCompleted = 0;

  console.log("=== Photo Caption Automation ===\n");
  displayProgress(progress);

  if (progress.photosCompleted > 0) {
    const shouldResume = await promptResumeSession(rl);
    if (shouldResume) {
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
      photosCompleted = await processUserInput(
        caption,
        photosCompleted,
        rl,
        promptForCaption,
      );
    });
  };

  process.on("SIGINT", () => {
    handleShutdown(rl, photosCompleted);
    process.exit(0);
  });

  promptForCaption();
};

startCaptionLoop();
