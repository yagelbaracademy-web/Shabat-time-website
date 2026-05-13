import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  Sequence,
  spring,
  useVideoConfig,
} from "remotion";

// ─── Tokens ────────────────────────────────────────────────────────────────────
const ORANGE = "#e8a020";
const W = "#ffffff";
const APP_BG = "linear-gradient(170deg, #152d5e 0%, #1e4d96 50%, #2762b8 100%)";

// Video: 1080×1920 — floating screen is 960px wide, scaled
const VW = 1080;
const VH = 1920;
const SW = 960;                    // screen display width
const SC = SW / VW;                // scale 0.8889
const SH = Math.round(VH * SC);   // 1707
const SX = (VW - SW) / 2;         // 60

const txt = (size, bold = false, color = W) => ({
  fontFamily: "Arial, 'Helvetica Neue', sans-serif",
  fontSize: size,
  fontWeight: bold ? "700" : "400",
  color,
  direction: "rtl",
});

// ─── Animation helpers ─────────────────────────────────────────────────────────
const useSpring = (frame, fps, delay = 0, damping = 14, stiffness = 130) =>
  spring({ frame: Math.max(0, frame - delay), fps, config: { damping, stiffness, mass: 0.6 } });

const fi = (f, from = 0, dur = 20) =>
  interpolate(f, [from, from + dur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

const fo = (f, from = 0, dur = 16) =>
  interpolate(f, [from, from + dur], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

const slide = (progress, dist = 60) =>
  interpolate(progress, [0, 1], [dist, 0]);

// ─── Shared ────────────────────────────────────────────────────────────────────
const AppBg = () => <AbsoluteFill style={{ background: APP_BG }} />;

const Nav = ({ progress = 1 }) => (
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "44px 64px 14px",
      direction: "rtl",
      opacity: progress,
      transform: `translateY(${slide(progress, -28)}px)`,
    }}
  >
    {[
      { label: "המיזם", active: false },
      { label: "חיפוש חלל", active: true },
      { label: "דברו איתנו", active: false },
      { label: "גלריה", active: false },
    ].map(({ label, active }) => (
      <span key={label} style={{ ...txt(32, active), color: active ? ORANGE : W }}>
        {label}
      </span>
    ))}
  </div>
);

const Logo = ({ scale = 1, opacity = 1 }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 18,
      direction: "rtl",
      opacity,
      transform: `scale(${scale})`,
    }}
  >
    <span style={{ fontSize: 88 }}>🕯️</span>
    <span style={{ fontSize: 96, fontWeight: "900", color: ORANGE, fontFamily: "Arial, sans-serif" }}>
      לזכרם
    </span>
  </div>
);

// ─── Scene 1 · Splash (0–75) ───────────────────────────────────────────────────
const SceneIntro = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logoP = useSpring(f, fps, 4, 12, 120);
  const tagP = useSpring(f, fps, 22, 16, 110);
  const exitOp = fo(f, 60, 15);

  return (
    <AbsoluteFill style={{ opacity: exitOp }}>
      <AppBg />
      <AbsoluteFill
        style={{ justifyContent: "center", alignItems: "center", flexDirection: "column", gap: 32 }}
      >
        <div
          style={{
            opacity: logoP,
            transform: `scale(${interpolate(logoP, [0, 1], [0.7, 1])}) translateY(${slide(logoP, 50)}px)`,
          }}
        >
          <Logo />
        </div>
        <div
          style={{
            opacity: tagP,
            transform: `translateY(${slide(tagP, 30)}px)`,
            ...txt(42),
            textAlign: "center",
            padding: "0 80px",
            lineHeight: 1.65,
          }}
        >
          כל עוד מישהו זוכר אותי, אני חי.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─── Scene 2 · Website (75–165) ───────────────────────────────────────────────
const SceneWebsite = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const navP  = useSpring(f, fps, 2, 15, 120);
  const logoP = useSpring(f, fps, 10, 13, 115);
  const tagP  = useSpring(f, fps, 18, 14, 110);
  const btnP  = useSpring(f, fps, 26, 14, 110);
  const srchP = useSpring(f, fps, 34, 14, 110);
  const exitOp = fo(f, 75, 15);

  return (
    <AbsoluteFill style={{ opacity: exitOp }}>
      <AppBg />
      <Nav progress={navP} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "0 64px", gap: 28 }}>
        <div style={{ opacity: logoP, transform: `translateY(${slide(logoP, 40)}px) scale(${interpolate(logoP,[0,1],[0.85,1])})` }}>
          <Logo />
        </div>
        <div style={{ opacity: tagP, transform: `translateY(${slide(tagP, 30)}px)`, ...txt(42), textAlign: "center", lineHeight: 1.55 }}>
          דרך חדשה לזכור את
          <br />
          הנופלים בחיי היומיום
        </div>
        <div
          style={{
            opacity: btnP,
            transform: `translateY(${slide(btnP, 24)}px) scale(${interpolate(btnP,[0,1],[0.9,1])})`,
            background: ORANGE, borderRadius: 60, padding: "20px 68px",
            ...txt(36, true),
          }}
        >
          ← הכירו את המיזם
        </div>
        <div style={{ width: "100%", opacity: srchP, transform: `translateY(${slide(srchP, 24)}px)` }}>
          <div style={{ ...txt(44, true), textAlign: "center", marginBottom: 20 }}>
            מחפשים פוסט באינסטגרם?
          </div>
          <div
            style={{
              width: "100%", background: "rgba(255,255,255,0.14)",
              border: "2px solid rgba(255,255,255,0.32)",
              borderRadius: 60, padding: "22px 46px",
              display: "flex", justifyContent: "flex-end", boxSizing: "border-box",
            }}
          >
            <span style={{ ...txt(38), color: "rgba(255,255,255,0.42)" }}>חפשו לפי שם</span>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene 3 · Typing (165–285) ───────────────────────────────────────────────
const SceneTyping = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const name = "נוי אביב";

  const charsShown = Math.floor(
    interpolate(f, [18, 18 + name.length * 9], [0, name.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
  );
  const typed = name.slice(0, charsShown);
  const cursor = Math.floor(f / 13) % 2 === 0;

  const entryP = useSpring(f, fps, 2, 16, 120);
  const boxGlow = fi(f, 12, 16);

  return (
    <AbsoluteFill>
      <AppBg />
      <Nav progress={1} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 64px", gap: 28 }}>
        <div style={{ opacity: entryP, transform: `translateY(${slide(entryP, 30)}px)` }}>
          <div style={{ ...txt(44, true), textAlign: "center", marginBottom: 28 }}>
            מחפשים פוסט באינסטגרם?
          </div>
          <div
            style={{
              width: "100%",
              background: `rgba(255,255,255,${interpolate(boxGlow,[0,1],[0.14,0.22])})`,
              border: `2.5px solid ${interpolate(boxGlow,[0,1],[0.3,1]) > 0.5 ? ORANGE : "rgba(255,255,255,0.32)"}`,
              boxShadow: `0 0 ${interpolate(boxGlow,[0,1],[0,40])}px rgba(232,160,32,${interpolate(boxGlow,[0,1],[0,0.25])})`,
              borderRadius: 60, padding: "24px 46px",
              display: "flex", alignItems: "center", justifyContent: "flex-end",
              boxSizing: "border-box",
            }}
          >
            <span style={{ ...txt(42, true) }}>
              {typed}
              <span style={{ opacity: cursor ? 1 : 0, fontWeight: "300" }}>|</span>
            </span>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene 4 · Post result (285–390) ─────────────────────────────────────────
const ScenePost = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const headerP = useSpring(f, fps, 2, 16, 120);
  const cardP   = useSpring(f, fps, 12, 11, 100); // springy card pop
  const tapScale = interpolate(f, [88, 96, 105], [1, 0.94, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <AppBg />
      <Nav progress={1} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "8px 64px", gap: 18 }}>

        <div style={{ opacity: headerP, transform: `translateY(${slide(headerP, 24)}px)`, width: "100%" }}>
          <div style={{ ...txt(44, true), textAlign: "center", marginBottom: 18 }}>
            מחפשים פוסט באינסטגרם?
          </div>
          <div
            style={{
              width: "100%", background: "rgba(255,255,255,0.2)",
              border: `2.5px solid ${ORANGE}`,
              boxShadow: "0 0 30px rgba(232,160,32,0.2)",
              borderRadius: 60, padding: "22px 46px",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              boxSizing: "border-box",
            }}
          >
            <span style={{ ...txt(28), color: "rgba(255,255,255,0.55)" }}>✕</span>
            <span style={{ ...txt(40, true) }}>נוי אביב</span>
          </div>
        </div>

        {/* Instagram embed card */}
        <div
          style={{
            opacity: cardP,
            transform: `translateY(${slide(cardP, 120)}px) scale(${tapScale})`,
            width: "100%", background: W, borderRadius: 20, overflow: "hidden",
            boxShadow: "0 16px 64px rgba(0,0,0,0.32)",
          }}
        >
          {/* header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", direction: "ltr" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 50, height: 50, borderRadius: 25,
                  background: "linear-gradient(135deg,#e8a020,#1a3670)",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24,
                }}
              >🕯️</div>
              <div>
                <div style={{ fontSize: 24, fontWeight: "700", fontFamily: "Arial", color: "#000" }}>lezichram_</div>
                <div style={{ fontSize: 18, color: "#888", fontFamily: "Arial" }}>14.8K followers</div>
              </div>
            </div>
            <div style={{ background: "#2563eb", color: W, borderRadius: 8, padding: "8px 18px", fontSize: 20, fontWeight: "700", fontFamily: "Arial" }}>
              View profile
            </div>
          </div>

          {/* post body */}
          <div style={{ background: APP_BG, padding: "28px 26px 22px", direction: "rtl" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                <div style={{ ...txt(38, true) }}>נוי אביב ז"ל</div>
                <div style={{ ...txt(26), marginTop: 5, opacity: 0.9 }}>בת נורית ומתי</div>
                <div style={{ ...txt(19), marginTop: 11, lineHeight: 1.78, opacity: 0.85 }}>
                  בת 29 במותה<br />
                  יום כ"ב בתשרי תשפ"ד (07.10.2023)<br />
                  ברעים, פסטיבל "נובה" סמוך לקיבוץ<br />
                  התגוררה באילת
                </div>
              </div>
              <div
                style={{
                  width: 134, height: 134, borderRadius: 10, flexShrink: 0,
                  background: "rgba(255,255,255,0.16)",
                  border: "1.5px solid rgba(255,255,255,0.28)",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 50,
                }}
              >👤</div>
            </div>
            <div style={{ ...txt(22), textAlign: "center", fontStyle: "italic", opacity: 0.9, margin: "10px 0 14px" }}>
              "כל עוד מישהו זוכר אותי, אני חיה."
            </div>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <div style={{ background: ORANGE, color: W, borderRadius: 10, padding: "13px 50px", fontSize: 28, fontWeight: "700", fontFamily: "Arial" }}>
                שתפו אותי
              </div>
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene 5 · Instagram (390–420) ────────────────────────────────────────────
const SceneInstagram = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = useSpring(f, fps, 2, 16, 120);

  return (
    <AbsoluteFill style={{ background: "#fafafa", opacity: p }}>
      <div
        style={{
          background: W, borderBottom: "1px solid #dbdbdb",
          padding: "44px 22px 12px",
          display: "flex", alignItems: "center", direction: "ltr",
          transform: `translateY(${slide(p, 30)}px)`,
        }}
      >
        <span style={{ fontSize: 28, marginRight: 12, color: "#000" }}>←</span>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 42, height: 42, borderRadius: 21, background: "linear-gradient(135deg,#e8a020,#1a3670)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🕯️</div>
          <span style={{ fontSize: 24, fontWeight: "700", fontFamily: "Arial", color: "#000" }}>lezichram_</span>
        </div>
        <span style={{ marginLeft: "auto", fontSize: 20, color: "#555" }}>•••</span>
      </div>

      <div style={{ transform: `translateY(${slide(p, 30)}px)`, background: APP_BG, padding: "32px 28px 24px", direction: "rtl" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ ...txt(44, true) }}>נוי אביב ז"ל</div>
            <div style={{ ...txt(26), marginTop: 6, opacity: 0.9 }}>בת נורית ומתי</div>
            <div style={{ ...txt(19), marginTop: 12, lineHeight: 1.8, opacity: 0.85 }}>
              בת 29 במותה<br />יום כ"ב בתשרי תשפ"ד (07.10.2023)<br />ברעים, פסטיבל "נובה"<br />התגוררה באילת
            </div>
          </div>
          <div style={{ width: 155, height: 155, borderRadius: 10, background: "rgba(255,255,255,0.16)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", border: "1.5px solid rgba(255,255,255,0.28)", fontSize: 58 }}>👤</div>
        </div>
        <div style={{ ...txt(24), textAlign: "center", fontStyle: "italic", margin: "18px 0 14px", opacity: 0.9 }}>
          "כל עוד מישהו זוכר אותי, אני חיה."
        </div>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
          <div style={{ background: ORANGE, color: W, borderRadius: 12, padding: "14px 58px", fontSize: 30, fontWeight: "700", fontFamily: "Arial" }}>שתפו אותי</div>
        </div>
        <div style={{ textAlign: "center", fontSize: 66 }}>🕯️</div>
        <div style={{ textAlign: "left", fontSize: 18, color: "rgba(255,255,255,0.4)", fontFamily: "Arial", direction: "ltr" }}>@lezichram</div>
      </div>

      <div style={{ background: W, padding: "12px 20px", transform: `translateY(${slide(p, 30)}px)`, direction: "ltr" }}>
        <div style={{ display: "flex", gap: 18, alignItems: "center", marginBottom: 6 }}>
          <span style={{ fontSize: 34 }}>🤍</span>
          <span style={{ fontSize: 34 }}>💬</span>
          <span style={{ fontSize: 34 }}>↗️</span>
          <span style={{ marginLeft: "auto", fontSize: 34 }}>🔖</span>
        </div>
        <div style={{ fontSize: 22, color: "#666", fontFamily: "Arial" }}>47 comments · 8 reposts</div>
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene 6 · End (420–450) ──────────────────────────────────────────────────
const SceneEnd = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = useSpring(f, fps, 3, 14, 120);

  return (
    <AbsoluteFill style={{ opacity: p }}>
      <AppBg />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column", gap: 26 }}>
        <div style={{ opacity: p, transform: `scale(${interpolate(p,[0,1],[0.8,1])})` }}>
          <span style={{ fontSize: 96 }}>🕯️</span>
        </div>
        <span style={{ fontSize: 88, fontWeight: "900", color: ORANGE, fontFamily: "Arial, sans-serif", opacity: p }}>
          לזכרם
        </span>
        <div style={{ ...txt(32), textAlign: "center", padding: "0 80px", lineHeight: 1.7, opacity: interpolate(p,[0,1],[0,0.9]) }}>
          שתפו, הגיבו, עשו לייק
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─── Captions (Apple demo style — below screen) ────────────────────────────────
const CAPTIONS = [
  { from: 15, to: 70,  title: "לזכרם",                        sub: "כל עוד מישהו זוכר אותי, אני חי." },
  { from: 82, to: 160, title: "חפשו פוסט של הנופל",           sub: "ישירות באינסטגרם של לזכרם" },
  { from: 172, to: 280,title: "הקלידו שם מלא",                sub: "הפוסט מופיע מיד — ללא טעינה" },
  { from: 292, to: 385,title: "לחצו על הפוסט",                sub: "ועברו לאינסטגרם של לזכרם" },
  { from: 396, to: 446,title: "שתפו, הגיבו, עשו לייק",        sub: "כי כל עוד מישהו מכיר אותם הם חיים" },
];

const Caption = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {CAPTIONS.map(({ from, to, title, sub }, i) => {
        const op = interpolate(f, [from, from + 12, to - 10, to], [0, 1, 1, 0], {
          extrapolateLeft: "clamp", extrapolateRight: "clamp",
        });
        const y = interpolate(f, [from, from + 12], [12, 0], {
          extrapolateLeft: "clamp", extrapolateRight: "clamp",
        });
        return (
          <div key={i} style={{ position: "absolute", bottom: 38, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, opacity: op, transform: `translateY(${y}px)`, padding: "0 60px" }}>
            <div style={{ fontSize: 46, fontWeight: "700", color: "#1c1c1e", fontFamily: "Arial, sans-serif", direction: "rtl", textAlign: "center" }}>
              {title}
            </div>
            <div style={{ fontSize: 30, color: "#6e6e73", fontFamily: "Arial, sans-serif", direction: "rtl", textAlign: "center", lineHeight: 1.45 }}>
              {sub}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ─── Floating screen wrapper ───────────────────────────────────────────────────
// No phone frame — just a rounded screen floating on a dark Apple background
const SCREEN_Y = 28;

export const LezichramDemo = () => {
  const f = useCurrentFrame();
  // subtle continuous float (sine wave)
  const floatY = Math.sin((f / 60) * Math.PI) * 6;

  return (
    <AbsoluteFill>
      {/* Apple dark background */}
      <AbsoluteFill style={{ background: "linear-gradient(160deg, #0c1220 0%, #18243e 100%)" }} />

      {/* Captions */}
      <Caption />

      {/* Floating screen */}
      <div
        style={{
          position: "absolute",
          left: SX,
          top: SCREEN_Y + floatY,
          width: SW,
          height: SH,
          borderRadius: 44,
          overflow: "hidden",
          boxShadow: [
            "0 0 90px rgba(40,100,220,0.4)",
            "0 50px 160px rgba(0,0,0,0.7)",
            "0 0 0 0.5px rgba(255,255,255,0.1)",
          ].join(","),
        }}
      >
        {/* Scale 1080×1920 → 960×1707 */}
        <div
          style={{
            width: VW,
            height: VH,
            transformOrigin: "top left",
            transform: `scale(${SC})`,
          }}
        >
          <Sequence from={0}   durationInFrames={75}>  <SceneIntro />     </Sequence>
          <Sequence from={75}  durationInFrames={90}>  <SceneWebsite />   </Sequence>
          <Sequence from={165} durationInFrames={120}> <SceneTyping />    </Sequence>
          <Sequence from={285} durationInFrames={105}> <ScenePost />      </Sequence>
          <Sequence from={390} durationInFrames={30}>  <SceneInstagram /> </Sequence>
          <Sequence from={420} durationInFrames={30}>  <SceneEnd />       </Sequence>
        </div>
      </div>
    </AbsoluteFill>
  );
};
