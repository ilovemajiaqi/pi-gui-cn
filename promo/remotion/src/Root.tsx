import React from "react";
import { Composition } from "remotion";
import { Promo, type PromoProps } from "./promo";
import { TOTAL_FRAMES } from "./SHOTS";
import { VIDEO } from "./theme";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="PiGuiZhPromo"
      component={Promo}
      durationInFrames={TOTAL_FRAMES}
      fps={VIDEO.fps}
      width={VIDEO.width}
      height={VIDEO.height}
      defaultProps={{ bgm: true } satisfies PromoProps}
    />
  );
};
