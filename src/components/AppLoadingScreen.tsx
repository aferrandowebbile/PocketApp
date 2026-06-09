import React, { useEffect, useRef } from "react";
import { Animated, Easing, Image, StyleSheet, Text, View } from "react-native";

export function AppLoadingScreen() {
  const pulse = useRef(new Animated.Value(0)).current;
  const [dotsText, setDotsText] = React.useState("");

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true
        })
      ])
    );

    pulseLoop.start();
    const dotsTimer = setInterval(() => {
      setDotsText((current) => (current === "..." ? "" : `${current}.`));
    }, 350);

    return () => {
      pulseLoop.stop();
      clearInterval(dotsTimer);
    };
  }, [pulse]);

  const scale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.98, 1.04]
  });

  const opacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 1]
  });

  return (
    <View style={styles.screen}>
      <View style={styles.glow} />
      <Animated.View style={[styles.logoWrap, { transform: [{ scale }], opacity }]}>
        <Image source={require("../../assets/splash-icon.png")} style={styles.logo} resizeMode="contain" />
      </Animated.View>
      <Text style={styles.title}>Spotlio Control</Text>
      <View style={styles.row}>
        <Text style={styles.subtitle}>Loading</Text>
        <Text style={styles.subtitle}>{dotsText}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f3f4f6"
  },
  glow: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 999,
    backgroundColor: "#f8d3ea",
    opacity: 0.45
  },
  logoWrap: {
    width: 116,
    height: 116,
    borderRadius: 58,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#f4bde0",
    shadowColor: "#c02679",
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3
  },
  logo: {
    width: 78,
    height: 78
  },
  title: {
    marginTop: 18,
    color: "#3d0f35",
    fontSize: 24,
    fontWeight: "800"
  },
  row: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center"
  },
  subtitle: {
    color: "#7b869a",
    fontSize: 15,
    fontWeight: "600"
  }
});
