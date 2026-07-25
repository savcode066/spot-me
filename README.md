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
| POST | `/api/chess/youtube/search` | Chess.com matchups mapped to YouTube Live timestamps |

Given a viewer's chess.com username, a streamer's chess.com username, and the streamer's channel on Twitch/Kick/YouTube, these endpoints find every game the two played against each other and map each game's end time onto the streamer's VOD + in-VOD timestamp. All three share the same request shape:

```json
{
  "user_chess_username": "...",
  "streamer_chess_username": "...",
  "streamer_twitch_username": "..."   // or streamer_kick_username / streamer_youtube_channel
}
```

...and the same response shape:

```json
{
  "user_chess_username": "...",
  "streamer_chess_username": "...",
  "streamer_twitch_username": "...",
  "results": [
    {
      "video_id": "...",
      "video_name": "...",
      "timestamp": 1234,        // seconds into the VOD
      "opponent": "...",
      "result": "win",          // chess.com's raw per-player result string
      "time_class": "blitz",
      "rated": true,
      "game_url": "https://www.chess.com/game/...",
      "played_at": 1732000000   // unix epoch
    }
  ],
  "total": 1,
  "vods_scanned": 14
}
```

Platform differences worth knowing:

- **Twitch** — official `/helix/videos` API, unlimited VOD retention for partners.
- **Kick** — Kick's official Developer API has no VOD-listing endpoint at all, so this hits the same undocumented endpoint kick.com's own frontend uses (`v2/channels/{slug}/videos`), via browser-TLS impersonation (`curl_cffi`) to get past Cloudflare. No credentials needed. Kick auto-deletes VODs after ~30 days (verified streamers) / ~7 days (unverified), so this only ever finds recent matchups.
- **YouTube** — official, documented Data API v3 (`YOUTUBE_API_KEY` required, free 10,000 units/day). Only videos that actually aired via YouTube Live are usable (`liveStreamingDetails.actualStartTime/actualEndTime`); a channel that only posts plain uploads returns zero matches rather than a guess. A daily quota tracker fails closed with `429` before exceeding the configured budget.

Each platform's VOD list is cached in-process for `VOD_CACHE_TTL_SECONDS` (default 30 min) so repeated searches against the same streamer don't re-spend YouTube quota or re-hit Kick's endpoint every time. See `architecture_future_ideas.md` (gitignored, local notes) for deferred ideas — proactive VOD archival and a Redis-backed cache — that were considered but not built.
