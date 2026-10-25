# Doodle Pop

A drawing and shape-popping toy for little kids, built as a web app and hosted on GitHub Pages.

- **One finger:** draw. Tapping or dragging across a floating shape pops it and says its name ("blue star!").
- **Two fingers:** pinch to zoom and pan.
- **Color dots:** pick a color, or the rainbow dot to change color with every stroke.
- **Grown-up menu:** press and hold the lock in the top-right corner for 1.5 s. It has sound and voice toggles, Clear drawing and Reset zoom.

## Locking the phone to the app

Web pages and native apps can't stop a child from leaving. iOS **Guided Access** can:
Settings → Accessibility → Guided Access → On. Then open the app and triple-click the side button.
The app's start screen walks parents through this.

## Development

No build step. Run `python3 -m http.server` in this folder and open http://localhost:8000.

Pushing to `main` deploys to GitHub Pages. **Bump `CACHE` in `sw.js`** whenever you change a file;
otherwise phones that already installed the app keep the old cached copy.
