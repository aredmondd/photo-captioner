/**
 * Coordinate Calibration Script
 *
 * Hover your mouse over each UI element and press Enter
 * The script will record your cursor position and output
 * a ready-to-paste POSITIONS object.
 */

const robot = require("robotjs");
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const targets = [
  { key: "photosWindow", label: "Photos window (any safe area)" },
  { key: "terminal", label: "Terminal window" },
  { key: "infoPanel", label: "Info panel background" },
  { key: "infoIcon", label: "Info (ⓘ) icon" },
  { key: "addTitle", label: "Add Title / Caption field" },
];

const positions = {};

const waitForEnter = (message) =>
  new Promise((resolve) => rl.question(message, resolve));

const runCalibration = async () => {
  console.log("\n=== Coordinate Calibration ===\n");
  console.log("Hover your mouse over the requested UI element");
  console.log("Then press Enter to capture the coordinates\n");

  for (const target of targets) {
    await waitForEnter(`▶ Hover over ${target.label} and press Enter `);
    const mouse = robot.getMousePos();
    positions[target.key] = {
      x: mouse.x,
      y: mouse.y,
    };
    console.log(`  ✓ Captured ${target.key}: (${mouse.x}, ${mouse.y})\n`);
  }

  console.log("\n=== Calibration Complete ===\n");
  console.log("Paste the following into consts.js:\n");

  console.log("export const POSITIONS = {");
  for (const [key, value] of Object.entries(positions)) {
    console.log(`\t${key}: { x: ${value.x}, y: ${value.y} },`);
  }
  console.log("};\n");

  console.log("export const WAIT_TIME = 2;");
  console.log("export const POST_COPY_WAIT_TIME = 100;\n");

  rl.close();
  process.exit(0);
};

runCalibration();
