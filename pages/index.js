import { useEffect, useRef, useState } from "react";

const statusLabels = {
  "checking-session": "Checking secure session",
  locked: "Locked",
  "signing-in": "Signing in",
  "camera-starting": "Starting camera",
  "camera-ready": "Camera ready",
  "camera-denied": "Camera access denied",
  "token-requesting": "Requesting realtime token",
  "realtime-connecting": "Connecting realtime stream",
  streaming: "Streaming",
  stopping: "Stopping stream",
  done: "Stream stopped",
  error: "Request failed",
};

function stopVideoElementStream(videoElement) {
  const stream = videoElement?.srcObject;
  stream?.getTracks?.().forEach((track) => track.stop());

  if (videoElement) {
    videoElement.srcObject = null;
  }
}

function clearVideoElement(videoElement) {
  if (videoElement) {
    videoElement.srcObject = null;
  }
}

async function readJson(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Unexpected response from the server.");
  }

  return payload;
}

export default function Home() {
  const inputVideoRef = useRef(null);
  const outputVideoRef = useRef(null);
  const inputStreamRef = useRef(null);
  const realtimeSessionRef = useRef(null);

  const [status, setStatus] = useState("checking-session");
  const [prompt, setPrompt] = useState("Substitute the character with an anime hero with glowing eyes.");
  const [statusDetail, setStatusDetail] = useState("");
  const [sessionInfo, setSessionInfo] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    let ignore = false;

    async function checkSession() {
      try {
        const session = await readJson(await fetch("/api/auth/session"));
        if (ignore) return;

        if (session.authenticated) {
          setIsAuthenticated(true);
          setStatus("camera-starting");
        } else {
          setStatus("locked");
        }
      } catch (error) {
        if (ignore) return;
        setErrorMessage(error.message);
        setStatus("error");
      }
    }

    checkSession();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return undefined;

    let ignore = false;

    async function startCamera() {
      setErrorMessage("");
      setStatusDetail("");
      setStatus("camera-starting");

      try {
        const { lucyRealtimeModel } = await import("../lib/client-decart-realtime.js");
        const { openWebcamForRealtimeModel } = await import("../lib/client-camera.js");
        const stream = await openWebcamForRealtimeModel(lucyRealtimeModel);

        if (ignore) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        inputStreamRef.current = stream;
        if (inputVideoRef.current) {
          inputVideoRef.current.srcObject = stream;
        }

        setStatus("camera-ready");
      } catch (error) {
        if (ignore) return;
        setErrorMessage("Camera access is required before Lucy realtime can start.");
        setStatus("camera-denied");
        console.error(error);
      }
    }

    startCamera();

    return () => {
      ignore = true;
      stopRealtimeSession();
      stopVideoElementStream(inputVideoRef.current);
      clearVideoElement(outputVideoRef.current);
      inputStreamRef.current = null;
    };
  }, [isAuthenticated]);

  function stopRealtimeSession() {
    realtimeSessionRef.current?.dispose?.();
    realtimeSessionRef.current = null;
    clearVideoElement(outputVideoRef.current);
  }

  async function handleLogin(event) {
    event.preventDefault();
    setErrorMessage("");
    setStatus("signing-in");

    try {
      await readJson(
        await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: accessCode }),
        })
      );

      setAccessCode("");
      setIsAuthenticated(true);
    } catch (error) {
      setErrorMessage(error.message);
      setStatus("locked");
    }
  }

  async function handleLogout() {
    setErrorMessage("");
    setStatus("stopping");

    try {
      await readJson(
        await fetch("/api/auth/logout", {
          method: "POST",
        })
      );
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      stopRealtimeSession();
      stopVideoElementStream(inputVideoRef.current);
      inputStreamRef.current = null;
      setSessionInfo(null);
      setIsAuthenticated(false);
      setStatus("locked");
    }
  }

  async function startRealtime() {
    const inputStream = inputStreamRef.current;
    if (!inputStream) {
      setErrorMessage("Camera is not ready yet.");
      return;
    }

    setErrorMessage("");
    setStatusDetail("");
    setStatus("token-requesting");
    stopRealtimeSession();

    try {
      const token = await readJson(
        await fetch("/api/decart-token", {
          method: "POST",
        })
      );

      setStatus("realtime-connecting");

      const { connectLucyRealtime } = await import("../lib/client-decart-realtime.js");
      const session = await connectLucyRealtime({
        inputStream,
        outputVideo: outputVideoRef.current,
        token: token.apiKey,
        prompt,
        onStatus: setStatusDetail,
        onConnectionChange: (connectionState) => {
          setStatusDetail(`Connection: ${connectionState}`);
          if (connectionState === "connected") {
            setStatus("streaming");
          }
        },
        onQueuePosition: (queuePosition) => {
          if (queuePosition?.position) {
            setStatusDetail(`Queue position: ${queuePosition.position}`);
          }
        },
      });

      realtimeSessionRef.current = session;
      setSessionInfo({
        model: token.model,
        expiresAt: token.expiresAt,
      });
      setStatus("streaming");
    } catch (error) {
      stopRealtimeSession();
      setSessionInfo(null);
      setErrorMessage(error.message);
      setStatus("error");
    }
  }

  async function stopRealtime() {
    setErrorMessage("");
    setStatus("stopping");
    stopRealtimeSession();
    setSessionInfo(null);
    setStatus("done");
  }

  async function updatePrompt() {
    if (!realtimeSessionRef.current) return;

    setErrorMessage("");
    setStatusDetail("Updating prompt...");

    try {
      await realtimeSessionRef.current.updatePrompt(prompt);
      setStatusDetail("Prompt updated.");
    } catch (error) {
      setErrorMessage(error.message);
      setStatus("error");
    }
  }

  const statusLabel = statusLabels[status] || status;
  const canStart = isAuthenticated && inputStreamRef.current && !realtimeSessionRef.current && !["token-requesting", "realtime-connecting"].includes(status);
  const canStop = Boolean(realtimeSessionRef.current);
  const canUpdatePrompt = Boolean(realtimeSessionRef.current && prompt.trim());

  return (
    <main
      style={{
        background: "linear-gradient(180deg, #f7f7f5 0%, #ece8df 100%)",
        color: "#1f2937",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        minHeight: "100vh",
        padding: "32px 20px 48px",
      }}
    >
      <section
        style={{
          background: "rgba(255,255,255,0.9)",
          border: "1px solid rgba(31,41,55,0.08)",
          borderRadius: 20,
          boxShadow: "0 24px 60px rgba(15,23,42,0.08)",
          margin: "0 auto",
          maxWidth: 1180,
          padding: 24,
        }}
      >
        <div style={{ alignItems: "center", display: "flex", gap: 12, justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <p style={{ color: "#2563eb", fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", margin: 0, textTransform: "uppercase" }}>
              Lucy Realtime
            </p>
            <h1 style={{ fontSize: 34, lineHeight: 1.1, margin: "6px 0 8px" }}>Secure Realtime Stream Console</h1>
            <p style={{ color: "#4b5563", margin: 0, maxWidth: 680 }}>
              Sign in, start the camera, and stream through a short-lived Decart token without exposing the server API key.
            </p>
          </div>
          {isAuthenticated ? (
            <button
              onClick={handleLogout}
              style={{
                background: "#111827",
                border: "none",
                borderRadius: 999,
                color: "#fff",
                cursor: "pointer",
                padding: "10px 16px",
              }}
            >
              Sign out
            </button>
          ) : null}
        </div>

        <div
          style={{
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderRadius: 14,
            display: "flex",
            gap: 12,
            justifyContent: "space-between",
            marginBottom: 20,
            padding: "14px 16px",
          }}
        >
          <div>
            <strong style={{ display: "block", marginBottom: 4 }}>System status</strong>
            <span>{statusLabel}</span>
            {statusDetail ? <span style={{ color: "#1d4ed8", display: "block", fontSize: 13, marginTop: 4 }}>{statusDetail}</span> : null}
          </div>
          <div style={{ color: "#1e3a8a", fontSize: 14, maxWidth: 470, textAlign: "right" }}>
            {isAuthenticated
              ? "Realtime uses a short-lived client token minted server-side after your session is verified."
              : "Sign in with the server-side access code before the webcam or Decart realtime token route becomes available."}
          </div>
        </div>

        {errorMessage ? (
          <div
            style={{
              background: "#fef2f2",
              border: "1px solid #fca5a5",
              borderRadius: 14,
              color: "#991b1b",
              marginBottom: 20,
              padding: "14px 16px",
            }}
          >
            {errorMessage}
          </div>
        ) : null}

        {!isAuthenticated ? (
          <form
            onSubmit={handleLogin}
            style={{
              background: "#111827",
              borderRadius: 18,
              color: "#fff",
              display: "grid",
              gap: 14,
              marginBottom: 20,
              maxWidth: 540,
              padding: 20,
            }}
          >
            <div>
              <h2 style={{ margin: "0 0 6px" }}>Secure sign-in</h2>
              <p style={{ color: "#d1d5db", margin: 0 }}>
                Access is checked server-side before camera streaming or Decart token minting can begin.
              </p>
            </div>
            <label htmlFor="access-code" style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 14 }}>Access code</span>
              <input
                id="access-code"
                type="password"
                value={accessCode}
                onChange={(event) => setAccessCode(event.target.value)}
                placeholder="Enter APP_ACCESS_PASSWORD"
                style={{
                  border: "1px solid rgba(255,255,255,0.18)",
                  borderRadius: 12,
                  padding: "12px 14px",
                }}
              />
            </label>
            <button
              type="submit"
              style={{
                background: "#60a5fa",
                border: "none",
                borderRadius: 12,
                color: "#111827",
                cursor: "pointer",
                fontWeight: 700,
                padding: "12px 14px",
              }}
            >
              Unlock realtime console
            </button>
          </form>
        ) : null}

        <div style={{ display: "grid", gap: 20, gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
          <section style={{ background: "#f9fafb", borderRadius: 18, padding: 18 }}>
            <h2 style={{ marginTop: 0 }}>Input Camera</h2>
            <video
              ref={inputVideoRef}
              autoPlay
              muted
              playsInline
              style={{
                background: "#111827",
                borderRadius: 16,
                display: "block",
                minHeight: 230,
                objectFit: "cover",
                width: "100%",
              }}
            />
          </section>

          <section style={{ background: "#f9fafb", borderRadius: 18, padding: 18 }}>
            <h2 style={{ marginTop: 0 }}>Lucy Output</h2>
            <video
              ref={outputVideoRef}
              autoPlay
              muted
              playsInline
              style={{
                background: "#020617",
                borderRadius: 16,
                display: "block",
                minHeight: 230,
                objectFit: "cover",
                width: "100%",
              }}
            />
          </section>
        </div>

        <section style={{ background: "#f9fafb", borderRadius: 18, marginTop: 20, padding: 18 }}>
          <h2 style={{ marginTop: 0 }}>Prompt</h2>
          <textarea
            id="prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            rows={4}
            style={{
              border: "1px solid #d1d5db",
              borderRadius: 12,
              padding: 12,
              resize: "vertical",
              width: "100%",
            }}
          />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 14 }}>
            <button
              onClick={startRealtime}
              disabled={!canStart}
              style={{
                background: canStart ? "#111827" : "#9ca3af",
                border: "none",
                borderRadius: 12,
                color: "#fff",
                cursor: canStart ? "pointer" : "not-allowed",
                padding: "12px 16px",
              }}
            >
              Start realtime
            </button>
            <button
              onClick={stopRealtime}
              disabled={!canStop}
              style={{
                background: canStop ? "#dc2626" : "#d1d5db",
                border: "none",
                borderRadius: 12,
                color: canStop ? "#fff" : "#6b7280",
                cursor: canStop ? "pointer" : "not-allowed",
                padding: "12px 16px",
              }}
            >
              Stop
            </button>
            <button
              onClick={updatePrompt}
              disabled={!canUpdatePrompt}
              style={{
                background: canUpdatePrompt ? "#2563eb" : "#d1d5db",
                border: "none",
                borderRadius: 12,
                color: canUpdatePrompt ? "#fff" : "#6b7280",
                cursor: canUpdatePrompt ? "pointer" : "not-allowed",
                padding: "12px 16px",
              }}
            >
              Update prompt
            </button>
          </div>
        </section>

        <section style={{ background: "#111827", borderRadius: 18, color: "#e5e7eb", marginTop: 20, padding: 18 }}>
          <h2 style={{ marginTop: 0 }}>Session</h2>
          <pre
            style={{
              background: "rgba(15,23,42,0.8)",
              borderRadius: 14,
              overflowX: "auto",
              padding: 14,
              whiteSpace: "pre-wrap",
            }}
          >
            {JSON.stringify(sessionInfo, null, 2)}
          </pre>
        </section>
      </section>
    </main>
  );
}
