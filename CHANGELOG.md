# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- "Char by char" keyboard mode (on by default on mobile, toggled in Settings).
  Android soft keyboards compose and autocorrect a whole word before handing it
  over; this mode forwards each composition delta as it arrives and keeps the
  helper textarea empty, so the shell receives characters one at a time like a
  terminal instead of only on a word boundary. Autocorrect rewrites are replayed
  as backspaces plus the corrected text.
- A second, independently togglable mobile key row for control keys: Ctrl+C,
  Ctrl+D, Ctrl+Z, Ctrl+L, Ctrl+A, Ctrl+E, Ctrl+U, Ctrl+W and Ctrl+R. It starts
  collapsed and is expanded from a "more" button in the editing row. The
  choice is remembered across sessions.
- Touch scrolling in the terminal. xterm scrolls only on wheel events and the
  scrollable element sits under the canvas, so dragging on a phone did nothing.
  A vertical swipe is now translated to `scrollLines()` and `touch-action` stops
  the browser from panning the page instead.
- A Shift+Tab key on the mobile key toolbar, left of Tab. It sends the backtab
  sequence (CSI Z), which shells and editors use to step backwards through
  menus, completions, and indented blocks.

### Changed

- The mobile key toolbar is a fixed, Termux-style grid instead of a sideways
  scrolling row: every key stays on screen, Shift+Tab, Tab and the arrows lead,
  and the editing keys (Esc, Ctrl, Alt, Ctrl+C, Backspace, Enter) sit under
  them. Ctrl and Alt arm for one key and lock when held; the arrows and
  Backspace repeat while held; swiping up on an arrow or Backspace sends
  Home/End/PgUp/PgDn/Delete.
- The portal has been restyled in a flat cyan HUD: single-hue cyan chrome on
  space-blue neutrals, flat panels (no gradients, glow, or drop shadows), and
  a terminal palette that matches the UI. The light theme keeps working with
  the same structure, and the native clients' connect screen follows the same
  look. Text contrast was verified against WCAG AA in both themes.

### Fixed

- Android soft-keyboard input no longer loses a committed word when it is
  followed by a space tap. The IME patch now flushes the pending composition
  text before forwarding the input event instead of cancelling it, so the word
  and the space both reach the terminal exactly once.
- Embedded assets (including `/vendor/xterm.js`) are served with `no-cache`
  instead of a 24-hour `max-age`, and the vendored URLs carry a cache-busting
  query. Previously a rebuilt server could keep serving a stale vendored bundle
  to clients that had already cached it.
- The terminal's hidden textarea now sets `autocomplete="off"`, which xterm
  6.0.0 omits, so the platform stops offering suggestions on the terminal.
- The systemd unit no longer sets `NoNewPrivileges`: tmux forks every pane in
  every session from the server this unit starts, so the flag propagated into
  all of the user's shells and made `sudo` fail with the "no new privileges"
  error. A tmux server started before this change keeps the flag until it is
  restarted.

## [0.0.4]

### Added

- Change the portal PIN from the Settings dialog. The server requires the
  current PIN, persists the new one to `~/.config/dominion/pin` (0600) so it
  survives a restart, and signs out every other session. The pin file outranks
  `-pin`/`DOMINION_PIN`; delete it to fall back. New `-pin-file` flag and
  `POST /api/pin` endpoint.

## [0.0.3]

### Fixed

- Killing a session no longer returns `500` when the tmux server is shutting
  down after its last session. A failed `kill-session` (including the silent,
  empty-output case) is now confirmed against `has-session`, so the API still
  reports `404 Not Found`.

## [0.0.2]

### Added

- `dominion-client-tui`: a terminal client for a portal. It logs in with the
  PIN, lists sessions, creates and kills them, and attaches to one over the
  portal's WebSocket PTY bridge (Ctrl-] detaches). Shares the saved-server
  address book at `~/.config/dominion/client.json`.
- `-version` on the server and the TUI, populated from the release tag.
- A tag-driven release pipeline (`.github/workflows/release.yml`) that builds and
  publishes the server, TUI, Android APK, Linux AppImage, and the bundled
  `ca.pem` in one GitHub release.
- `release.sh` gains `--no-publish` and bundles `DOMINION_CA` for the APK.
- `get.sh` gains `DOMINION_TUI=1` to install the terminal client.
- Shell clients advertise a capability version (`dominion-shell/1.1`); the
  portal gates saved-server management on it so an older client hides the
  control instead of showing a dead button.
- Desktop AppImage window identity and icon support (X11 `_NET_WM_ICON`, Wayland
  `app_id`).

### Fixed

- Vendored xterm.js carries local Android soft-keyboard/IME input fixes, and a
  test guards the bundle against drift.

[Unreleased]: https://github.com/brewingshell/dominion/compare/v0.0.4...HEAD
[0.0.4]: https://github.com/brewingshell/dominion/compare/v0.0.3...v0.0.4
[0.0.3]: https://github.com/brewingshell/dominion/compare/v0.0.2...v0.0.3
[0.0.2]: https://github.com/brewingshell/dominion/releases/tag/v0.0.2
