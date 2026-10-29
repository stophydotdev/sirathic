import { type FC, useId } from "react";
import Svg, { Circle, ClipPath, Defs, G } from "react-native-svg";
import { withUniwind } from "uniwind";

const PETALS = [0, 45, 90, 135, 180, 225, 270, 315];

const ThemedSvg = withUniwind(Svg);

export const Mark: FC<{ size: number; colorClassName?: string }> = ({
  size,
  colorClassName = "accent-foreground",
}) => {
  const clip = useId().replace(/\W/g, "");
  return (
    <ThemedSvg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      colorClassName={colorClassName}
      accessibilityLabel="Sirathic"
    >
      <Defs>
        <ClipPath id={clip}>
          <Circle cx="12" cy="12" r="11.5" />
        </ClipPath>
      </Defs>
      <G clipPath={`url(#${clip})`} fill="none" stroke="currentColor">
        {PETALS.map((angle) => (
          <Circle key={angle} cx="18" cy="12" r="6" rotation={angle} origin="12, 12" />
        ))}
        <Circle cx="12" cy="12" r="10.9" />
      </G>
    </ThemedSvg>
  );
};
