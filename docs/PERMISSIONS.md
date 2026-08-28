# Plugin Permission Reference

| Permission | Description |
|---|---|
| `browser.page` | Access page DOM, selectors, and evaluation |
| `browser.navigation` | Direct page navigation (`browser.goto`) |
| `browser.screenshot` | Capture page screenshots |
| `downloads.write` | Save downloaded files to workspace downloads folder |
| `filesystem.selectedFile` | Read user-selected files explicitly provided in inputs |
| `network` | Make external HTTP/API requests |

## Security Rules
- Plugins **never** get access to raw operating system credentials.
- Plugins **never** get direct access to other browser profile user data.
- Plugins run inside an isolated sandbox with memory bounds and timeout protection.
