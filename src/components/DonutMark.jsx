import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  View,
} from "react-native";
import DonutRingSvg from "../../assets/icons/donut-ring-256.svg";
import DonutOverlaySvg from "../../assets/icons/donut-overlay.svg";
import { useTheme } from "../theme/tokens";

/**
 * MoneyMap Brand Donut Mark.
 * Canonical spec: 256x256 mark with gold coin (₱) and coral pin overlay.
 * Ring rotates 1.35s linear per turn when animating, eases upright in 700ms.
 * Reduced motion stays static.
 */
export function DonutMark({
  animating = false,
  size = 84,
  style,
  testID = "donut-mark",
  accessibilityLabel = "MoneyMap brand logo",
}) {
  const theme = useTheme();
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);
  const [motionReady, setMotionReady] = useState(false);
  const isAnimatingRef = useRef(animating);
  isAnimatingRef.current = animating;

  useEffect(() => {
    let mounted = true;
    if (typeof AccessibilityInfo?.isReduceMotionEnabled === "function") {
      AccessibilityInfo.isReduceMotionEnabled()
        .then((enabled) => {
          if (mounted) {
            setReduceMotion(Boolean(enabled));
            setMotionReady(true);
          }
        })
        .catch(() => {
          if (mounted) setMotionReady(true);
        });
    } else {
      setMotionReady(true);
    }
    const sub =
      typeof AccessibilityInfo?.addEventListener === "function"
        ? AccessibilityInfo.addEventListener("reduceMotionChanged", (enabled) => {
            if (mounted) setReduceMotion(Boolean(enabled));
          })
        : null;

    return () => {
      mounted = false;
      sub?.remove?.();
    };
  }, []);

  useEffect(() => {
    if (!motionReady) {
      return undefined;
    }

    if (reduceMotion || !animating) {
      const resetAnim = Animated.timing(rotateAnim, {
        toValue: 0,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== "web",
      });
      resetAnim.start();
      return () => {
        resetAnim.stop();
      };
    }

    let loopAnimation;
    const runLoop = () => {
      rotateAnim.setValue(0);
      loopAnimation = Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 1350,
        easing: Easing.linear,
        useNativeDriver: Platform.OS !== "web",
      });
      loopAnimation.start(({ finished }) => {
        if (finished && isAnimatingRef.current) {
          runLoop();
        }
      });
    };

    runLoop();

    return () => {
      loopAnimation?.stop();
    };
  }, [animating, motionReady, reduceMotion, rotateAnim]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="image"
      accessible={true}
      style={[
        {
          alignItems: "center",
          backgroundColor: theme.colors.tint,
          borderRadius: theme.radii.round,
          height: size,
          justifyContent: "center",
          overflow: "hidden",
          position: "relative",
          width: size,
        },
        style,
      ]}
      testID={testID}
    >
      <Animated.View
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        style={{
          height: size,
          position: "absolute",
          transform: [{ rotate: spin }],
          width: size,
        }}
      >
        <DonutRingSvg height={size} viewBox="0 0 256 256" width={size} />
      </Animated.View>
      <View
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        style={{
          height: size,
          position: "absolute",
          width: size,
        }}
      >
        <DonutOverlaySvg height={size} viewBox="0 0 256 256" width={size} />
      </View>
    </View>
  );
}
