import { createDecartClient, models } from "@decartai/sdk";

export const lucyRealtimeModel = models.realtime("lucy-2.1");

function attachOutputStream(outputVideo, stream) {
  if (!outputVideo) return;

  const videoOnlyStream = new MediaStream(stream.getVideoTracks());
  outputVideo.srcObject = videoOnlyStream;
  outputVideo.autoplay = true;
  outputVideo.playsInline = true;
  outputVideo.muted = true;
  outputVideo.play().catch(() => {});
}

export async function connectLucyRealtime({
  inputStream,
  outputVideo,
  token,
  prompt,
  onStatus,
  onConnectionChange,
  onQueuePosition,
  onOutputStream,
}) {
  if (!token) {
    throw new Error("Missing Decart client token.");
  }

  onStatus?.("Connecting to Decart realtime...");

  const client = createDecartClient({ apiKey: token });
  const realtimeClient = await client.realtime.connect(inputStream, {
    model: lucyRealtimeModel,
    resolution: "720p",
    initialState: {
      prompt: {
        text: prompt,
        enhance: true,
      },
    },
    onRemoteStream: (remoteStream) => {
      attachOutputStream(outputVideo, remoteStream);
      onOutputStream?.(remoteStream);
      onStatus?.("Realtime stream ready.");
    },
    onConnectionChange,
    onQueuePosition,
  });

  const onError = (error) => {
    console.warn("[Decart realtime]", error);
    onStatus?.("Realtime stream reported an error.");
  };

  realtimeClient.on("error", onError);

  return {
    client: realtimeClient,
    async updatePrompt(nextPrompt) {
      await realtimeClient.setPrompt(nextPrompt, { enhance: true });
    },
    dispose() {
      realtimeClient.off("error", onError);
      realtimeClient.disconnect();
    },
  };
}
