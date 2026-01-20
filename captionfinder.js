const path = require("path");
const fs = require("fs");
const screenshot = require("screenshot-desktop");
const PNG = require("pngjs").PNG;
const pixelmatchLib = require("pixelmatch");
const pixelmatch = pixelmatchLib.default || pixelmatchLib;

// Coordinates of the area where the caption box might appear
const CAPTION_SEARCH_AREA = {
  x: 760 * 2, // left
  y: 360 * 2, // top
  width: 150 * 2, // horizontal range
  height: 75 * 2, // vertical range
};

// Load template image (the caption box template)
const templatePath = path.join(__dirname, "captionTemplate2.png");
if (!fs.existsSync(templatePath)) {
  throw new Error(`Template image not found at ${templatePath}`);
}

const templateBuffer = fs.readFileSync(templatePath);
const templateImg = PNG.sync.read(templateBuffer);
const templateWidth = templateImg.width;
const templateHeight = templateImg.height;

const findCaptionBox = async () => {
  console.time("findCaptionBox");
  try {
    // Take a full screenshot first
    const imgBuffer = await screenshot({
      format: "png",
      screen: 0,
    });

    const fullImg = PNG.sync.read(imgBuffer);
    const fullWidth = fullImg.width;
    const fullHeight = fullImg.height;

    // Validate search area is within screen bounds
    if (
      CAPTION_SEARCH_AREA.x + CAPTION_SEARCH_AREA.width > fullWidth ||
      CAPTION_SEARCH_AREA.y + CAPTION_SEARCH_AREA.height > fullHeight
    ) {
      throw new Error("Search area exceeds screen bounds");
    }

    // Manually crop to the search area
    const croppedImg = new PNG({
      width: CAPTION_SEARCH_AREA.width,
      height: CAPTION_SEARCH_AREA.height,
    });

    for (let y = 0; y < CAPTION_SEARCH_AREA.height; y++) {
      for (let x = 0; x < CAPTION_SEARCH_AREA.width; x++) {
        const srcIdx =
          ((CAPTION_SEARCH_AREA.y + y) * fullWidth +
            (CAPTION_SEARCH_AREA.x + x)) *
          4;
        const dstIdx = (y * CAPTION_SEARCH_AREA.width + x) * 4;

        croppedImg.data[dstIdx] = fullImg.data[srcIdx]; // R
        croppedImg.data[dstIdx + 1] = fullImg.data[srcIdx + 1]; // G
        croppedImg.data[dstIdx + 2] = fullImg.data[srcIdx + 2]; // B
        croppedImg.data[dstIdx + 3] = fullImg.data[srcIdx + 3]; // A
      }
    }

    // Save debug screenshot of the cropped area (optional - comment out for speed)
    const croppedBuffer = PNG.sync.write(croppedImg);
    fs.writeFileSync(path.join(__dirname, "debug_cropped.png"), croppedBuffer);

    const { width: bw, height: bh } = croppedImg;

    let bestScore = Infinity;
    let bestX = 0;
    let bestY = 0;

    // OPTIMIZATION 1: Increase step size (was 2, now configurable)
    const STEP_SIZE = 5; // Adjust this - higher = faster but less accurate

    // OPTIMIZATION 2: Early exit threshold
    const EARLY_EXIT_THRESHOLD = 0.02; // If we find a match this good, stop searching

    // Slide template over cropped area
    for (let y = 0; y <= bh - templateHeight; y += STEP_SIZE) {
      for (let x = 0; x <= bw - templateWidth; x += STEP_SIZE) {
        // OPTIMIZATION 3: Quick rejection - sample-based comparison
        // Check a few key pixels first before doing full comparison
        let quickCheckFailed = false;
        const samplePoints = [
          [0, 0],
          [Math.floor(templateWidth / 2), Math.floor(templateHeight / 2)],
          [templateWidth - 1, 0],
          [0, templateHeight - 1],
          [templateWidth - 1, templateHeight - 1],
        ];

        for (const [sx, sy] of samplePoints) {
          const srcIdx = ((y + sy) * bw + (x + sx)) * 4;
          const dstIdx = (sy * templateWidth + sx) * 4;

          // Compare RGB values (skip alpha)
          const rDiff = Math.abs(
            croppedImg.data[srcIdx] - templateImg.data[dstIdx],
          );
          const gDiff = Math.abs(
            croppedImg.data[srcIdx + 1] - templateImg.data[dstIdx + 1],
          );
          const bDiff = Math.abs(
            croppedImg.data[srcIdx + 2] - templateImg.data[dstIdx + 2],
          );

          // If any sample point differs too much, skip this position
          if (rDiff > 50 || gDiff > 50 || bDiff > 50) {
            quickCheckFailed = true;
            break;
          }
        }

        if (quickCheckFailed) continue;

        // OPTIMIZATION 4: Reuse buffer for patch instead of creating new PNG
        // Only do full comparison if quick check passed
        const patchData = Buffer.allocUnsafe(
          templateWidth * templateHeight * 4,
        );

        for (let i = 0; i < templateHeight; i++) {
          for (let j = 0; j < templateWidth; j++) {
            const srcIdx = ((y + i) * bw + (x + j)) * 4;
            const dstIdx = (i * templateWidth + j) * 4;

            patchData[dstIdx] = croppedImg.data[srcIdx];
            patchData[dstIdx + 1] = croppedImg.data[srcIdx + 1];
            patchData[dstIdx + 2] = croppedImg.data[srcIdx + 2];
            patchData[dstIdx + 3] = croppedImg.data[srcIdx + 3];
          }
        }

        // Compare patch with template
        const diff = pixelmatch(
          templateImg.data,
          patchData,
          null,
          templateWidth,
          templateHeight,
          { threshold: 0.1 },
        );

        if (diff < bestScore) {
          bestScore = diff;
          bestX = x;
          bestY = y;

          // OPTIMIZATION 5: Early exit if we found a great match
          const confidence = 1 - diff / (templateWidth * templateHeight);
          if (confidence >= 1 - EARLY_EXIT_THRESHOLD) {
            console.log(
              `Early exit: excellent match found (${(confidence * 100).toFixed(2)}%)`,
            );
            y = bh; // Break outer loop
            break;
          }
        }
      }
    }

    // OPTIMIZATION 6: Fine-tune around best match
    // Do a precise search in a small area around the best match
    const FINE_TUNE_RANGE = STEP_SIZE;
    const fineStartX = Math.max(0, bestX - FINE_TUNE_RANGE);
    const fineEndX = Math.min(bw - templateWidth, bestX + FINE_TUNE_RANGE);
    const fineStartY = Math.max(0, bestY - FINE_TUNE_RANGE);
    const fineEndY = Math.min(bh - templateHeight, bestY + FINE_TUNE_RANGE);

    for (let y = fineStartY; y <= fineEndY; y++) {
      for (let x = fineStartX; x <= fineEndX; x++) {
        const patchData = Buffer.allocUnsafe(
          templateWidth * templateHeight * 4,
        );

        for (let i = 0; i < templateHeight; i++) {
          for (let j = 0; j < templateWidth; j++) {
            const srcIdx = ((y + i) * bw + (x + j)) * 4;
            const dstIdx = (i * templateWidth + j) * 4;

            patchData[dstIdx] = croppedImg.data[srcIdx];
            patchData[dstIdx + 1] = croppedImg.data[srcIdx + 1];
            patchData[dstIdx + 2] = croppedImg.data[srcIdx + 2];
            patchData[dstIdx + 3] = croppedImg.data[srcIdx + 3];
          }
        }

        const diff = pixelmatch(
          templateImg.data,
          patchData,
          null,
          templateWidth,
          templateHeight,
          { threshold: 0.1 },
        );

        if (diff < bestScore) {
          bestScore = diff;
          bestX = x;
          bestY = y;
        }
      }
    }

    // Check confidence threshold
    const confidence = 1 - bestScore / (templateWidth * templateHeight);
    console.log(`Best match confidence: ${(confidence * 100).toFixed(2)}%`);
    console.log(`Best match at relative position: (${bestX}, ${bestY})`);

    if (bestScore / (templateWidth * templateHeight) > 0.1) {
      console.warn("Caption box not found (low confidence)");
      return null;
    }

    // Convert coordinates back to screen coordinates (center of match)
    const screenX =
      CAPTION_SEARCH_AREA.x + bestX + Math.floor(templateWidth / 2);
    const screenY =
      CAPTION_SEARCH_AREA.y + bestY + Math.floor(templateHeight / 2);

    console.log(
      `Caption box found at screen coordinates: (${screenX}, ${screenY})`,
    );

    console.timeEnd("findCaptionBox");

    return {
      x: screenX,
      y: screenY,
    };
  } catch (err) {
    console.error("Error finding caption box:", err);
    console.timeEnd("findCaptionBox");
    return null;
  }
};

module.exports = { findCaptionBox };
