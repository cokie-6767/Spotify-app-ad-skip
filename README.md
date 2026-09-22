# Spotify-app-ad-skip
# Ad Skip for Spotify

A small **Windows desktop** extension powered by [Spicetify](https://spicetify.app/).

When enabled, it pauses a track **two seconds before the end** and attempts to play the next track in a playlist, album, or Liked Songs. One switch turns the feature on or off.

> Experimental: this is a playback automation tool, not a guaranteed ad blocker. Spotify may still show ads. Live playback compatibility is not fully verified.

## Install

You need 64-bit Windows and the Spotify desktop app, installed and opened at least once.

1. Download this repository using **Code → Download ZIP**, then extract it.
2. Double-click **Install.cmd**. No administrator access or Node.js is required.
3. Wait for **Installed Ad Skip for Spotify**, then open **Ad Skip for Spotify** from the Windows Start menu (or run **Start-Spotify.cmd**).

The installer downloads Spicetify 2.45.1 from its official GitHub release if needed, verifies its SHA-256 checksum, backs up Spotify, and installs the extension. An existing Spicetify command is reused. Internet access is required for first-time setup.

## Use

- Click **⚙** and toggle **Enable Ad Skip**.
- Timing is fixed at **two seconds**. There is no timing adjustment.
- Close settings with **×**. Drag the gear or panel heading to move it.
- The toggle and panel position are saved locally.

### Background playback

Always launch Spotify with **Ad Skip for Spotify** from the Start menu. The shortcut opens Spotify directly with Chromium background timer/renderer throttling disabled, without opening a terminal. Fully exit any Spotify instance started normally before using this shortcut for the first time. The normal Spotify shortcut or automatic startup may omit these flags.

Alternatively, use **Start-Spotify.cmd**. This helper restarts Spotify if it is already running without the flags; your current playback is interrupted.

The extension also reacts to play/pause and song-change events, so a confirmed pause can advance without waiting for the next polling timer. These changes reduce background scheduling delays; they cannot guarantee ad avoidance or operation during sleep/suspension. Disabling timer throttling can increase background CPU and battery use.

Standalone tracks pause without advancing. For playlists, albums, and Liked Songs, Spotify's queue determines the next track. The extension selects the next track by URI (and entry UID when available) inside the original list, rather than calling the Next button. If the queue is unavailable, it pauses without guessing a track. Disabling the extension stops further automated actions; it does not resume a track that is already paused.

## Uninstall or update

Run **Uninstall.cmd**, then restart Spotify using its normal shortcut. This disables only this extension; Spicetify, backups, and other extensions remain. The Ad Skip launcher shortcut remains available but is no longer needed.

To update or reapply after a Spotify update, run **Install.cmd** again. If setup fails, retain its error message; your Spotify version may require a newer Spicetify version.
<img width="3085" height="1858" alt="image" src="https://github.com/user-attachments/assets/db266c29-a085-4395-ae2d-8a184cc34850" />


