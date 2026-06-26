const LANDSCAPE_WIDTH = 1280;
const LANDSCAPE_HEIGHT = 720;
const ASPECT_16_9 = 16 / 9;

function resolveFrameRate(model) {
  if (typeof model?.fps === "number") return model.fps;
  if (typeof model?.fps?.ideal === "number") return model.fps.ideal;
  return 24;
}

export async function openWebcamForRealtimeModel(model, options = {}) {
  const video = {
    frameRate: { ideal: resolveFrameRate(model) },
    width: { ideal: model?.width || LANDSCAPE_WIDTH },
    height: { ideal: model?.height || LANDSCAPE_HEIGHT },
    aspectRatio: { ideal: ASPECT_16_9 },
  };

  if (options.deviceId) {
    video.deviceId = { exact: options.deviceId };
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video,
  });

  stream.getAudioTracks().forEach((track) => track.stop());
  return stream;
}

export function stopMediaStream(stream) {
  stream?.getTracks?.().forEach((track) => track.stop());
}
