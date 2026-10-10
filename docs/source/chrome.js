// Finds a Chrome or Edge to print the documentation with. Set CHROME_PATH to use another one.
const fs = require('fs');

const CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
];

const findChrome = () => {
  const found = process.env.CHROME_PATH || CANDIDATES.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error('Chrome or Edge not found. Set CHROME_PATH to its executable.');
  return found;
};

module.exports = { findChrome };
