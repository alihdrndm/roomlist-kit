# Media to record

## `demo.gif` (about 20 seconds)

Save the recording as `docs/media/demo.gif`. Record the home page at http://localhost:3010 (start it with `pnpm dev`).

Steps to show:

1. Open `/` and click **Load sample**.
2. Click **Validate**. Pause a moment on the summary tiles (Room nights shows 9).
3. Choose **Maestro PMS (CSV)** as the target and type `MAIN` as the building code.
4. Click **Download**.

Recording tips:

- Use a browser window of about 1280 x 800 pixels.
- Close other tabs and notifications. The sample data is synthetic, so nothing in the list is private, but keep anything personal out of the frame (bookmarks, other tabs, the desktop).
- Keep the GIF small (under about 5 MB): 10 to 15 frames per second is enough.

## Adding it to the README

When the file exists, add this line to `README.md`, right after the pitch (or at the start of "How it works"):

```md
![Demo: load the sample list, validate it, convert it to Maestro CSV](docs/media/demo.gif)
```
