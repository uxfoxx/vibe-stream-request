import { createServerFn } from "@tanstack/react-start";

export const searchYouTube = createServerFn({ method: "POST" })
  .inputValidator((input: { query: string }) => {
    if (!input?.query || typeof input.query !== "string" || input.query.length > 200) {
      throw new Error("Invalid query");
    }
    return { query: input.query.trim() };
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) throw new Error("YOUTUBE_API_KEY not configured");

    const url = new URL("https://www.googleapis.com/youtube/v3/search");
    url.searchParams.set("part", "snippet");
    url.searchParams.set("type", "video");
    url.searchParams.set("videoCategoryId", "10"); // Music
    url.searchParams.set("maxResults", "8");
    url.searchParams.set("q", data.query);
    url.searchParams.set("key", apiKey);

    const res = await fetch(url.toString());
    if (!res.ok) {
      const text = await res.text();
      console.error("YouTube search failed:", res.status, text);
      return { results: [], error: `YouTube search failed (${res.status})` };
    }
    const json = await res.json();
    const results = (json.items || []).map((it: any) => ({
      videoId: it.id.videoId,
      title: it.snippet.title,
      channel: it.snippet.channelTitle,
      thumbnail: it.snippet.thumbnails?.medium?.url || it.snippet.thumbnails?.default?.url,
    }));
    return { results, error: null };
  });
