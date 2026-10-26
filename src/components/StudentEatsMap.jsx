import { useEffect, useRef } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { AppText as Text } from "./AppText";
import { TIP_QC_CAMPUS } from "../domain/services/eatsRanking";

export function StudentEatsMap({
  origin,
  places = [],
  selectedPlaceId = null,
  onSelectPlace,
  theme,
}) {
  const mapRef = useRef(null);

  const initialRegion = {
    latitude: origin?.latitude ?? TIP_QC_CAMPUS.latitude,
    longitude: origin?.longitude ?? TIP_QC_CAMPUS.longitude,
    latitudeDelta: 0.015,
    longitudeDelta: 0.015,
  };

  useEffect(() => {
    if (selectedPlaceId && places.length > 0) {
      const place = places.find((p) => p.id === selectedPlaceId);
      if (place && mapRef.current?.animateToRegion) {
        mapRef.current.animateToRegion(
          {
            latitude: place.latitude,
            longitude: place.longitude,
            latitudeDelta: 0.008,
            longitudeDelta: 0.008,
          },
          400,
        );
      }
    }
  }, [selectedPlaceId, places]);

  const handleRecenter = () => {
    if (mapRef.current?.animateToRegion) {
      mapRef.current.animateToRegion(initialRegion, 400);
    }
  };

  return (
    <View
      accessibilityLabel="Interactive Google Map of nearby eateries"
      style={{
        borderRadius: theme.radii.card,
        borderWidth: theme.spacing.hairline,
        borderColor: theme.colors.outline,
        height: 280,
        overflow: "hidden",
        position: "relative",
        width: "100%",
      }}
      testID="student-eats-google-map-container"
    >
      <MapView
        initialRegion={initialRegion}
        provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        testID="student-eats-map-view"
      >
        {/* Origin Marker */}
        <Marker
          coordinate={{
            latitude: origin?.latitude ?? TIP_QC_CAMPUS.latitude,
            longitude: origin?.longitude ?? TIP_QC_CAMPUS.longitude,
          }}
          description={origin?.isFallback ? "Campus center search origin" : "Current location search origin"}
          identifier="origin-marker"
          testID="marker-origin"
          title={origin?.isFallback ? "TIP Quezon City Campus" : "Your Location"}
        >
          <View
            style={{
              alignItems: "center",
              backgroundColor: theme.colors.primary,
              borderColor: theme.colors.onPrimary,
              borderRadius: theme.radii.round,
              borderWidth: 2,
              height: 28,
              justifyContent: "center",
              width: 28,
            }}
          >
            <Text
              style={{
                color: theme.colors.onPrimary,
                fontFamily: theme.fonts.bold,
                fontSize: theme.typeScale.tiny,
              }}
            >
              {origin?.isFallback ? "🎓" : "📍"}
            </Text>
          </View>
        </Marker>

        {/* Nearby Restaurant Markers */}
        {places.map((place, index) => {
          const isSelected = selectedPlaceId === place.id;
          return (
            <Marker
              coordinate={{
                latitude: place.latitude,
                longitude: place.longitude,
              }}
              description={`★ ${place.rating} · ${place.address || "Nearby"}`}
              identifier={`place-${place.id}`}
              key={place.id}
              onPress={() => onSelectPlace?.(place.id)}
              testID={`marker-place-${place.id}`}
              title={place.name}
            >
              <View
                style={{
                  alignItems: "center",
                  backgroundColor: isSelected ? theme.colors.warning : theme.colors.surface,
                  borderColor: isSelected ? theme.colors.primary : theme.colors.outline,
                  borderRadius: theme.radii.round,
                  borderWidth: isSelected ? 2 : 1,
                  height: isSelected ? 32 : 26,
                  justifyContent: "center",
                  width: isSelected ? 32 : 26,
                }}
              >
                <Text
                  style={{
                    color: isSelected ? theme.colors.onAccent : theme.colors.primary,
                    fontFamily: theme.fonts.bold,
                    fontSize: theme.typeScale.tiny,
                  }}
                >
                  {index + 1}
                </Text>
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* Recenter button */}
      <Pressable
        accessibilityLabel="Recenter map to origin"
        accessibilityRole="button"
        onPress={handleRecenter}
        style={{
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.outline,
          borderRadius: theme.radii.round,
          borderWidth: theme.spacing.hairline,
          bottom: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.xs,
          position: "absolute",
          right: theme.spacing.sm,
          shadowColor: theme.colors.shadow,
          shadowOpacity: 0.1,
          shadowRadius: 2,
        }}
      >
        <Text
          style={{
            color: theme.colors.primary,
            fontFamily: theme.fonts.bold,
            fontSize: theme.typeScale.tiny,
          }}
        >
          Center {origin?.isFallback ? "Campus" : "Me"}
        </Text>
      </Pressable>
    </View>
  );
}
