import { Composition } from "remotion";
import { LezichramDemo } from "./LezichramDemo";

export const RemotionRoot = () => (
  <Composition
    id="LezichramDemo"
    component={LezichramDemo}
    durationInFrames={450}
    fps={30}
    width={1080}
    height={1920}
  />
);
