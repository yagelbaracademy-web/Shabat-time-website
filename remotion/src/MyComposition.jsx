import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

export const MyComposition = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const second = Math.floor(frame / fps);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#1a1a2e",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <h1 style={{ color: "white", fontSize: 60, fontFamily: "sans-serif" }}>
        Frame {frame} — Second {second}
      </h1>
    </AbsoluteFill>
  );
};
