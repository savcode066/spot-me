# spot-me

Finds the exact moment you played against your favorite streamer, and hands you back the timestamp in their VOD to jump straight to it. One app, three games: **Valorant**, **Chess.com**, and **Dota 2**, each with its own themed search flow, all pulling clips from **Twitch, Kick, and YouTube**.

## How it works

From the landing hub you pick a game, which routes you into that game's own search flow:

- **Valorant** — matchup finder. Cross-references your Riot ID's match history against a streamer's, then maps every match you played together (teammates or opponents) onto the streamer's VOD.
- **Chess.com** — matchup finder. Cross-references your chess.com game history against a streamer's, then maps every game you played each other onto the streamer's VOD.
- **Dota 2** — matchup finder. Cross-references your Steam32 account's match history against a streamer's, then maps every match you played together (teammates or opponents) onto the streamer's VOD.

Both are fully on-demand — no pre-scanning or background jobs. A search fetches live data from the relevant platforms (chess.com, Valorant/OpenDota match data, Twitch/Kick/YouTube) at request time and returns matches directly.

## Matchup APIs

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Liveness check |
| POST | `/api/chess/search` | Chess.com matchups mapped to Twitch VOD timestamps |
| POST | `/api/chess/kick/search` | Chess.com matchups mapped to Kick VOD timestamps |
| POST | `/api/chess/youtube/search` | Chess.com matchups mapped to YouTube Live timestamps |
| POST | `/api/valorant/search` | Valorant matchups mapped to Twitch VOD timestamps |
| POST | `/api/valorant/kick/search` | Valorant matchups mapped to Kick VOD timestamps |
| POST | `/api/valorant/youtube/search` | Valorant matchups mapped to YouTube Live timestamps |
| POST | `/api/dota2/search` | Dota 2 matchups mapped to Twitch VOD timestamps |
| POST | `/api/dota2/kick/search` | Dota 2 matchups mapped to Kick VOD timestamps |
| POST | `/api/dota2/youtube/search` | Dota 2 matchups mapped to YouTube Live timestamps |
