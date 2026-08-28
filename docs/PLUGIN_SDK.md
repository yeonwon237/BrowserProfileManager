# Automation Plugin SDK Guide (v1.0)

## Overview
YNlogin plugins allow developers to write automated browser workflows without importing Electron internals or managing raw browser binaries.

## Manifest Format (`manifest.json`)
```json
{
  "id": "my-sample-scraper",
  "name": "Sample Web Scraper",
  "description": "Navigates to URL and takes a screenshot.",
  "version": "1.0.0",
  "apiVersion": 1,
  "permissions": [
    "browser.page",
    "browser.navigation",
    "browser.screenshot"
  ],
  "inputs": {
    "target_url": {
      "type": "string",
      "label": "Target URL",
      "default": "https://example.com"
    }
  }
}
```

## Plugin Entrypoint (`index.js`)
```javascript
module.exports = async function run(context) {
  const { browser, inputs, log } = context;

  log.info(`Navigating to ${inputs.target_url}...`);
  await browser.goto(inputs.target_url);

  const title = await browser.title();
  log.info(`Page title: ${title}`);

  const screenshot = await browser.screenshot();
  return { title, screenshotCaptured: true };
};
```
