export const POSITIONS = {
  photosWindow: { x: 1217, y: 475 },
  terminal: { x: 220, y: 866 },
  infoPanel: { x: 905, y: 205 },
  infoIcon: { x: 1281, y: 57 },
  addTitle: { x: 804, y: 224 },
};

export const SPEED_MODE = false; // very experimental, and will probably break a little bit if you set it to true. Removes all sleep(s) from the script.
export const WAIT_TIME = 15; // time in ms to wait after every action. For safety, I reccomend keeping it above 5ms.

export const DOUBLE_CHECK_CAPTION = true; // will copy and paste the caption back to you confirming it was actually typed in the UI. Setting this to false cuts out about 100 ms of time
export const POST_COPY_WAIT_TIME = 100; // time in ms to wait after copying to clipboard (averages 50-75ms typically)

export const TIME_EACH_PHOTO = true; // flag to see how long each photo takes to process. Purely for fun.

export const AUTOSAVE_INTERVAL = 10; // the interval your progress is saved to .photo-progress.json
