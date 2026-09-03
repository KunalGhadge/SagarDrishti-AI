"use client";

import { useEffect, useState, useCallback } from "react";

export interface UserGeoLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: number;
  speed?: number | null;
  heading?: number | null;
}

const STORAGE_KEY = "sagardrishti_device_gps";

export function useUserLocation() {
  const [location, setLocation] = useState<UserGeoLocation | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.latitude && parsed.longitude) {
          return parsed;
        }
      }
    } catch {
      // Ignore
    }
    return null;
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isWatching, setIsWatching] = useState(false);
  const [permissionState, setPermissionState] = useState<PermissionState | "unsupported">("prompt");
  const [error, setError] = useState<string | null>(null);

  const updateLocation = useCallback((coords: UserGeoLocation) => {
    setLocation(coords);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(coords));
    } catch {
      // Ignore
    }
  }, []);

  const requestLocation = useCallback(() => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setPermissionState("unsupported");
      setError("Geolocation is not supported by your browser");
      return;
    }

    setIsLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const speedKts =
          position.coords.speed != null && position.coords.speed >= 0
            ? Number((position.coords.speed * 1.94384).toFixed(1))
            : null;

        const coords: UserGeoLocation = {
          latitude: Number(position.coords.latitude.toFixed(4)),
          longitude: Number(position.coords.longitude.toFixed(4)),
          accuracy: Math.round(position.coords.accuracy),
          timestamp: position.timestamp,
          speed: speedKts,
          heading: position.coords.heading != null && !isNaN(position.coords.heading) ? Math.round(position.coords.heading) : null,
        };
        updateLocation(coords);
        setIsLoading(false);
        setPermissionState("granted");
      },
      (err) => {
        setIsLoading(false);
        setError(err.message);
        if (err.code === err.PERMISSION_DENIED) {
          setPermissionState("denied");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  }, [updateLocation]);

  // Continuous GPS watch loop
  useEffect(() => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setPermissionState("unsupported");
      return;
    }

    let watchId: number | null = null;

    const startWatch = () => {
      try {
        watchId = navigator.geolocation.watchPosition(
          (position) => {
            const speedKts =
              position.coords.speed != null && position.coords.speed >= 0
                ? Number((position.coords.speed * 1.94384).toFixed(1))
                : null;

            const coords: UserGeoLocation = {
              latitude: Number(position.coords.latitude.toFixed(4)),
              longitude: Number(position.coords.longitude.toFixed(4)),
              accuracy: Math.round(position.coords.accuracy),
              timestamp: position.timestamp,
              speed: speedKts,
              heading: position.coords.heading != null && !isNaN(position.coords.heading) ? Math.round(position.coords.heading) : null,
            };
            updateLocation(coords);
            setIsWatching(true);
            setPermissionState("granted");
            setError(null);
          },
          (err) => {
            if (err.code === err.PERMISSION_DENIED) {
              setPermissionState("denied");
            }
            setIsWatching(false);
          },
          {
            enableHighAccuracy: true,
            maximumAge: 5000,
            timeout: 15000,
          }
        );
      } catch {
        // Fallback gracefully
      }
    };

    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions
        .query({ name: "geolocation" })
        .then((result) => {
          setPermissionState(result.state);
          if (result.state === "granted") {
            startWatch();
          }
          result.onchange = () => {
            setPermissionState(result.state);
            if (result.state === "granted") {
              startWatch();
            }
          };
        })
        .catch(() => {
          startWatch();
        });
    } else {
      startWatch();
    }

    return () => {
      if (watchId !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [updateLocation]);

  return {
    location,
    isLoading,
    isWatching,
    permissionState,
    error,
    requestLocation,
  };
}
