Integrate chess.com into spotme.

inputs: user's chess.com username, streamer's chess.com username, and streamer's twitch username.

steps:

1. use the chess.com pub api to get the games of the player

2. try to see when they played against the streamer

3. figure out all the times when they played against them

4. use those times to find twitch videos and the timestamps within them when they played each other. 

output: same thing with valorant just the clips of the user playing against the streamer

---

future idea, not built yet: proactive VOD archival

kick VODs expire after ~30 days. if a streamer re-uploads the full unedited stream to youtube afterwards as a plain upload (not youtube live), we currently can't match it - youtube only gives us real broadcast start/end times (liveStreamingDetails) for videos that went out over youtube live. a plain upload only has the upload date, not the stream date, so there's no reliable timestamp to window-match against.

fix: persist every twitch/kick VOD's start time + duration to firestore as soon as we see it (before it can expire). later, when a youtube re-upload shows up for that streamer, match it by duration against the archived record instead of trusting youtube's own (wrong, for this case) timestamp.

not doing this now - it means a background job + firestore storage, breaks from the current fully on-demand/no-prescanning design. revisit if expired-VOD reuploads turn out to matter.

---

future idea, not built yet: redis-backed VOD cache

right now the VOD-list cache (fetch_all_vods results per streamer, across twitch/kick/youtube) lives in an in-process dict with a TTL. it only exists as long as the api server process stays running - a restart, redeploy, or code reload wipes it, and it wouldn't be shared if we ever ran more than one server instance.

redis would fix both: cache survives restarts, and is shared across instances if this ever gets horizontally scaled.

not doing this now - it means standing up new infrastructure (a redis instance to run/host, a new dependency, a new failure mode) that isn't justified for a single-process api at this stage. revisit if this ever runs as more than one process, or if losing the cache on every restart actually starts to hurt.