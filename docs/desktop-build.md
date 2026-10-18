# Windows distribution

Requested result: a Windows x64 game launched by double-clicking an executable, with no Node.js, terminal or development server required by the player.

Implementation: bundle the existing Vite production output inside Electron. Its isolated renderer has no Node.js access; the main process loads only the bundled index file. Relative asset paths and view links work from disk. A desktop presentation fills the window with the arena and Phaser HUD, while the browser presentation remains available for development. F11 toggles fullscreen.

The asset forge is a developer view available in the browser, not a gameplay control in the executable. Its local route is checked for compatibility without adding a developer inspector to the game's HUD.

Deliverables: one portable executable and one per-user NSIS installer, built with electron-builder. Windows CI exercises the unpacked application before publishing GitHub Release assets. Graphics still come from BootScene; desktop packaging does not introduce image downloads.

Verification: browser regression suite and strict builds; desktop startup, local view navigation, actual Q/I/Escape/R controls and renderer preferences; Windows PE headers and packaged content; native Windows smoke tests in CI before release. All release downloads must be verified after publication.

Local validation: all 51 browser regressions passed; desktop startup/controls/navigation passed 3/3. A package-content check first detected 136 MB of redundant Phaser source/dependencies; exclusion reduced app.asar to 1.3 MB, retaining Phaser's license separately. The x64 PE and all eight packaged entries validate. Linux can generate the portable target; the NSIS installer's uninstaller stage requires Wine or native Windows, so the release workflow builds both targets on Windows. A failed Linux installer stub is not a release artifact.
