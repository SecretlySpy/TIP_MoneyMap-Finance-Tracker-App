import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

const MINT = "#E7F6F1";
const NAVY = "#1E4EAE";
const GREEN = "#1C9A56";
const GOLD = "#D4A017";
const PIN = "#F25C4C";

function ringPath(startDeg, endDeg, outer, inner) {
  const toRad = (deg) => ((deg - 90) * Math.PI) / 180;
  const arc = (radius, start, end) => {
    const a0 = toRad(start);
    const a1 = toRad(end);
    const large = end - start > 180 ? 1 : 0;
    return `A ${radius} ${radius} 0 ${large} 1 ${Math.cos(a1) * radius} ${Math.sin(a1) * radius}`;
  };
  const a0 = toRad(startDeg);
  const sx = Math.cos(a0) * outer;
  const sy = Math.sin(a0) * outer;
  const ix = Math.cos(a0) * inner;
  const iy = Math.sin(a0) * inner;
  return [
    `M ${sx} ${sy}`,
    arc(outer, startDeg, endDeg),
    `L ${Math.cos(toRad(endDeg)) * inner} ${Math.sin(toRad(endDeg)) * inner}`,
    arc(inner, endDeg, startDeg).replace(" 1 ", " 0 "),
    `L ${ix} ${iy}`,
    "Z",
  ].join(" ");
}

/**
 * Splash and app-lock mark. Only the ring rotates while loading.
 */
export function BrandMark({ size = 112, loading = false }) {
  const spin = useRef(new Animated.Value(0)).current;
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduced(Boolean(enabled));
    });
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (reduced) {
      spin.setValue(0);
      return undefined;
    }
    if (loading) {
      spin.setValue(0);
      const loop = Animated.loop(
        Animated.timing(spin, {
          toValue: 1,
          duration: 1350,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );
      loop.start();
      return () => loop.stop();
    }
    Animated.timing(spin, {
      toValue: 1,
      duration: 700,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: true,
    }).start();
    return undefined;
  }, [loading, reduced, spin]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });
  const center = size / 2;
  const outer = size * 0.328;
  const inner = outer * 0.58;

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="MoneyMap"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.226,
        backgroundColor: MINT,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <Animated.View style={{ transform: [{ rotate }] }}>
        <Svg width={size} height={size} viewBox={`${-center} ${-center} ${size} ${size}`}>
          <Path d={ringPath(-70, 150, outer, inner)} fill={NAVY} />
          <Path d={ringPath(158, 275, outer, inner)} fill={GREEN} />
        </Svg>
      </Animated.View>
      <Svg width={size} height={size} viewBox={`${-center} ${-center} ${size} ${size}`} style={{ position: "absolute" }}>
        <Circle cx={0} cy={0} r={size * 0.082} fill={GOLD} stroke="#FFF8E6" strokeWidth={Math.max(1, size * 0.012)} />
        <Circle cx={size * 0.18} cy={size * 0.015} r={size * 0.09} fill={PIN} />
        <Path
          d={`M ${size * 0.13} ${size * 0.07} L ${size * 0.23} ${size * 0.07} L ${size * 0.18} ${size * 0.16} Z`}
          fill={PIN}
        />
        <Circle cx={size * 0.18} cy={size * 0.015} r={size * 0.03} fill="#FFFFFF" />
      </Svg>
    </View>
  );
}
