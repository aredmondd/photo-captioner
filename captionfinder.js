const path = require("path");
const fs = require("fs");
const robot = require("robotjs");
const screenshot = require("screenshot-desktop");
const PNG = require("pngjs").PNG;
const pixelmatchLib = require("pixelmatch");
const pixelmatch = pixelmatchLib.default || pixelmatchLib;

// Coordinates of the area where the caption box might appear
// these numbers are multiplied by two.
const CAPTION_SEARCH_AREA = {
  x: 760 * 2, // left
  y: 360 * 2, // top
  width: 150 * 2, // horizontal range
  height: 100 * 2, // vertical range
};

// Load template image (the caption box template)
const templatePath = path.join(__dirname, "captionTemplate.png");
if (!fs.existsSync(templatePath)) {
  throw new Error(`Template image not found at ${templatePath}`);
}

const templateBuffer = fs.readFileSync(templatePath);
const templateImg = PNG.sync.read(templateBuffer);
const templateWidth = templateImg.width;
const templateHeight = templateImg.height;

const findCaptionBox = async () => {
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

    // Save debug screenshot of the cropped area
    const croppedBuffer = PNG.sync.write(croppedImg);
    fs.writeFileSync(path.join(__dirname, "debug_cropped.png"), croppedBuffer);

    const { width: bw, height: bh } = croppedImg;

    let bestScore = Infinity;
    let bestX = 0;
    let bestY = 0;

    // Slide template over cropped area
    for (let y = 0; y <= bh - templateHeight; y += 2) {
      for (let x = 0; x <= bw - templateWidth; x += 2) {
        // Create a patch to compare
        const patch = new PNG({ width: templateWidth, height: templateHeight });

        // Copy the patch from cropped image
        for (let i = 0; i < templateHeight; i++) {
          for (let j = 0; j < templateWidth; j++) {
            const srcIdx = ((y + i) * bw + (x + j)) * 4;
            const dstIdx = (i * templateWidth + j) * 4;

            // Copy RGBA values
            patch.data[dstIdx] = croppedImg.data[srcIdx]; // R
            patch.data[dstIdx + 1] = croppedImg.data[srcIdx + 1]; // G
            patch.data[dstIdx + 2] = croppedImg.data[srcIdx + 2]; // B
            patch.data[dstIdx + 3] = croppedImg.data[srcIdx + 3]; // A
          }
        }

        // Compare patch with template
        const diff = pixelmatch(
          templateImg.data,
          patch.data,
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

    return {
      x: screenX,
      y: screenY,
    };
  } catch (err) {
    console.error("Error finding caption box:", err);
    return null;
  }
};

module.exports = { findCaptionBox };
