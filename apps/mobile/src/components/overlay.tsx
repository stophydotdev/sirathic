import { type FC, type ReactNode, useEffect } from "react";
import { View } from "react-native";
import { create } from "zustand";

const useOverlay = create<{ content?: ReactNode }>()(() => ({}));

export const OverlayHost: FC = () => {
  const content = useOverlay((s) => s.content);
  return content ? (
    <View pointerEvents="box-none" className="absolute inset-0">
      {content}
    </View>
  ) : null;
};

export const Overlay: FC<{ children: ReactNode }> = ({ children }) => {
  useEffect(() => {
    useOverlay.setState({ content: children });
  });
  useEffect(() => () => useOverlay.setState({ content: undefined }), []);
  return null;
};
