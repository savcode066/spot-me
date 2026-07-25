# spot-me

Finds the exact moment you played against your favorite streamer, and hands you back the timestamp in their VOD to jump straight to it. One app, two games: **Valorant** and **Chess.com**, each with its own themed search flow, both pulling clips from **Twitch, Kick, and YouTube**.

## How it works

From the landing hub you pick a game, which routes you into that game's own search flow:

- **Valorant** — OCR-based clip finder. Scans a streamer's VOD library for your in-game name showing up in the kill-feed/scoreboard.
- **Chess.com** — matchup finder. Cross-references your chess.com game history against a streamer's, then maps every game you played each other onto the streamer's VOD.

Both are fully on-demand — no pre-scanning or background jobs. A search fetches live data from the relevant platforms (chess.com, Twitch/Kick/YouTube) at request time and returns matches directly.

## Chess.com Matchup API

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Liveness check |
| POST | `/api/chess/search` | Chess.com matchups mapped to Twitch VOD timestamps |
| POST | `/api/chess/kick/search` | Chess.com matchups mapped to Kick VOD timestamps |
| POST | `/api/chess/youtube/search` | Chess.com matchups mapped to YouTube Live timestamps 
