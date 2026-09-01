"use client";

import { useEffect, useState, useCallback } from "react";

export interface UserGeoLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: number;
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
  const [permissionState, setPermissionState] = useState<PermissionState | "unsupported">("prompt");
  const [error, setError] = useState<string | null>(null);

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
        const coords: UserGeoLocation = {
          latitude: Number(position.coords.latitude.toFixed(4)),
          longitude: Number(position.coords.longitude.toFixed(4)),
          accuracy: Math.round(position.coords.accuracy),
          timestamp: position.timestamp,
        };
        setLocation(coords);
        setIsLoading(false);
        setPermissionState("granted");
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(coords));
        } catch {
          // Ignore
        }
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
  }, []);

  // Check permissions & auto-request on mount
  useEffect(() => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setPermissionState("unsupported");
      return;
    }

    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions
        .query({ name: "geolocation" })
        .then((result) => {
          setPermissionState(result.state);
          if (result.state === "granted") {
            requestLocation();
          }
          result.onchange = () => {
            setPermissionState(result.state);
            if (result.state === "granted") {
              requestLocation();
            }
          };
        })
        .catch(() => {
          requestLocation();
        });
    } else {
      requestLocation();
    }
  }, [requestLocation]);

  return {
    location,
    isLoading,
    permissionState,
    error,
    requestLocation,
  };
}
