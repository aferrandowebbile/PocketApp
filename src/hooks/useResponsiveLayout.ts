import { useMemo } from "react";
import { useWindowDimensions } from "react-native";

export function useResponsiveLayout() {
  const { width, height } = useWindowDimensions();

  return useMemo(() => {
    const shortestSide = Math.min(width, height);
    const isTablet = shortestSide >= 768;
    const isLargeTablet = isTablet && width >= 1100;
    const screenPadding = isLargeTablet ? 32 : isTablet ? 24 : 16;
    const contentMaxWidth = isLargeTablet ? 1280 : isTablet ? 980 : 680;
    const modalMaxWidth = isLargeTablet ? 760 : isTablet ? 680 : 440;
    const cardColumns = isLargeTablet ? 3 : isTablet ? 2 : 1;

    return {
      width,
      height,
      isTablet,
      isLargeTablet,
      screenPadding,
      contentMaxWidth,
      modalMaxWidth,
      cardColumns
    };
  }, [height, width]);
}
