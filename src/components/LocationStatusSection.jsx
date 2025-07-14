import React, { useState, useEffect, useRef } from "react";
import { Loader } from "@googlemaps/js-api-loader";
import {
  MapPin,
  Search,
  Navigation,
  CheckCircle,
  AlertCircle,
  Loader2,
  X,
} from "lucide-react";

const LocationStatusSection = ({
  currentLocation,
  setCurrentLocation,
  locationName,
  setLocationName,
  getLocationName,
  locationError,
  setLocationError,
  isLoadingLocation,
  setIsLoadingLocation,
  userProfile,
  updateUserLocation,
}) => {
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchRadius, setSearchRadius] = useState(
    userProfile?.searchRadius || 10
  );
  const mapRef = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [placesService, setPlacesService] = useState(null);
  const [geocoder, setGeocoder] = useState(null);
  const [isGoogleMapsReady, setIsGoogleMapsReady] = useState(false);
  const [googleMapsLoader, setGoogleMapsLoader] = useState(null);

  const defaultLocation = {
    lat: 40.7128,
    lng: -74.006,
    name: "New York City, NY, USA",
  };

  useEffect(() => {
    const loader = new Loader({
      apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
      version: "weekly",
      libraries: ["places"],
    });

    setGoogleMapsLoader(loader);
    loader
      .load()
      .then(() => {
        setIsGoogleMapsReady(true);
      })
      .catch((error) => {
        console.error("Error loading Google Maps:", error);
        setLocationError(
          "Failed to load Google Maps. Please refresh the page."
        );
      });
  }, []);

  useEffect(() => {
    if (isGoogleMapsReady && mapRef.current) {
      initializeMap();
    }
  }, [isGoogleMapsReady, currentLocation]);

  const initializeMap = () => {
    if (!window.google || !mapRef.current) return;

    const mapCenter = currentLocation || defaultLocation;

    const map = new window.google.maps.Map(mapRef.current, {
      zoom: 12,
      center: { lat: mapCenter.lat, lng: mapCenter.lng },
      styles: [
        {
          featureType: "poi",
          elementType: "labels",
          stylers: [{ visibility: "off" }],
        },
        {
          featureType: "transit",
          elementType: "labels",
          stylers: [{ visibility: "off" }],
        },
      ],
    });

    const marker = new window.google.maps.Marker({
      position: { lat: mapCenter.lat, lng: mapCenter.lng },
      map: map,
      title: locationName || defaultLocation.name,
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: "#ea580c",
        fillOpacity: 1,
        strokeWeight: 2,
        strokeColor: "#ffffff",
      },
    });

    setPlacesService(new window.google.maps.places.PlacesService(map));
    setGeocoder(new window.google.maps.Geocoder());
    setMapLoaded(true);
  };

  const getCurrentLocation = async () => {
    if (!isGoogleMapsReady) {
      setLocationError("Google Maps is still loading. Please wait a moment.");
      return;
    }

    setIsLoadingLocation(true);
    setLocationError(null);

    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000,
        });
      });

      const location = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
      };
      
      setCurrentLocation(location);
      
      // Get location name first, then update user location
      try {
        const resolvedLocationName = await getLocationName(location.lat, location.lng);
        setLocationName(resolvedLocationName);
        
        await updateUserLocation({
          location: { lat: location.lat, lng: location.lng },
          locationName: resolvedLocationName,
          searchRadius: searchRadius,
          updatedAt: new Date().toISOString(),
        });
      } catch (nameError) {
        console.error("Error getting location name:", nameError);
        // Update with coordinates as fallback
        const fallbackName = `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`;
        setLocationName(fallbackName);
        
        await updateUserLocation({
          location: { lat: location.lat, lng: location.lng },
          locationName: fallbackName,
          searchRadius: searchRadius,
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      setLocationError(
        "Unable to access location. Please enable location services."
      );
      console.error("Location error:", error);
    } finally {
      setIsLoadingLocation(false);
    }
  };

  const handleSearchRadiusChange = async (newRadius) => {
    setSearchRadius(newRadius);
    if (currentLocation) {
      try {
        const resolvedLocationName = locationName || await getLocationName(currentLocation.lat, currentLocation.lng);
        
        await updateUserLocation({
          location: { lat: currentLocation.lat, lng: currentLocation.lng },
          locationName: resolvedLocationName,
          searchRadius: newRadius,
          updatedAt: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Error updating search radius:", error);
        // Update with current location name as fallback
        await updateUserLocation({
          location: { lat: currentLocation.lat, lng: currentLocation.lng },
          locationName: locationName || `${currentLocation.lat.toFixed(4)}, ${currentLocation.lng.toFixed(4)}`,
          searchRadius: newRadius,
          updatedAt: new Date().toISOString(),
        });
      }
    }
  };

  const searchLocations = async (query) => {
    if (!query.trim() || !placesService || !isGoogleMapsReady) {
      setSuggestions([]);
      return;
    }

    setIsSearching(true);
    try {
      const autocompleteService =
        new window.google.maps.places.AutocompleteService();

      const request = {
        input: query,
        types: ["(cities)"],
      };

      const predictions = await new Promise((resolve, reject) => {
        autocompleteService.getPlacePredictions(
          request,
          (predictions, status) => {
            if (
              status === window.google.maps.places.PlacesServiceStatus.OK &&
              predictions
            ) {
              resolve(predictions);
            } else {
              resolve([]);
            }
          }
        );
      });

      const suggestions = await Promise.all(
        predictions.slice(0, 5).map(async (prediction) => {
          try {
            const placeDetails = await new Promise((resolve, reject) => {
              placesService.getDetails(
                { placeId: prediction.place_id },
                (place, status) => {
                  if (
                    status === window.google.maps.places.PlacesServiceStatus.OK
                  ) {
                    resolve(place);
                  } else {
                    reject(new Error("Place details failed"));
                  }
                }
              );
            });

            return {
              id: prediction.place_id,
              name: prediction.description,
              lat: placeDetails.geometry.location.lat(),
              lng: placeDetails.geometry.location.lng(),
              formatted_address: placeDetails.formatted_address,
            };
          } catch (error) {
            return {
              id: prediction.place_id,
              name: prediction.description,
              lat: null,
              lng: null,
              formatted_address: prediction.description,
            };
          }
        })
      );

      const validSuggestions = suggestions.filter(
        (s) => s.lat !== null && s.lng !== null
      );
      setSuggestions(validSuggestions);
    } catch (error) {
      console.error("Search error:", error);
      setSuggestions([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleLocationSelect = async (location) => {
    setCurrentLocation({ lat: location.lat, lng: location.lng });
    setLocationName(location.name);
    setSearchQuery("");
    setSuggestions([]);
    setShowSearch(false);
    
    try {
      await updateUserLocation({
        location: { lat: location.lat, lng: location.lng },
        locationName: location.name,
        searchRadius: searchRadius,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error updating user location:", error);
    }
  };

  const displayLocation = currentLocation || defaultLocation;
  const displayName = locationName || defaultLocation.name;

  return (
    <div className="bg-white overflow-hidden shadow-xl">
      <div className="bg-orange-50 p-4 sm:p-6 border-b border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div className="flex-1 min-w-0">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
              Location Preferences
            </h2>
            <p className="text-gray-600 text-sm sm:text-base">
              Set your preferred location for finding roommates
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-3">
            <button
              onClick={() => setShowSearch(!showSearch)}
              disabled={!isGoogleMapsReady}
              className="bg-white text-gray-700 px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors flex items-center justify-center space-x-2 shadow-sm disabled:opacity-50 min-w-0"
            >
              <Search className="w-4 h-4 flex-shrink-0" />
              <span className="font-medium truncate">Search Location</span>
            </button>
            <button
              onClick={getCurrentLocation}
              disabled={isLoadingLocation || !isGoogleMapsReady}
              className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors flex items-center justify-center space-x-2 disabled:opacity-50 shadow-sm min-w-0"
            >
              {isLoadingLocation ? (
                <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
              ) : (
                <Navigation className="w-4 h-4 flex-shrink-0" />
              )}
              <span className="font-medium truncate">Live Location</span>
            </button>
          </div>
        </div>
      </div>

      {showSearch && (
        <div className="p-4 sm:p-6 border-b border-gray-100 bg-gray-50">
          <div className="relative">
            <div className="flex items-center space-x-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    searchLocations(e.target.value);
                  }}
                  placeholder="Search for a city, neighborhood, or address..."
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-colors text-sm sm:text-base"
                />
              </div>
              <button
                onClick={() => {
                  setShowSearch(false);
                  setSearchQuery("");
                  setSuggestions([]);
                }}
                className="p-3 text-gray-500 hover:text-gray-700 transition-colors flex-shrink-0"
                aria-label="Close search"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion.id}
                    onClick={() => handleLocationSelect(suggestion)}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center space-x-3 border-b border-gray-100 last:border-b-0"
                  >
                    <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-gray-700 block truncate">
                        {suggestion.name}
                      </span>
                      {suggestion.formatted_address &&
                        suggestion.formatted_address !== suggestion.name && (
                          <span className="text-gray-500 text-sm block truncate">
                            {suggestion.formatted_address}
                          </span>
                        )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {isSearching && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-50">
                <div className="flex items-center space-x-3">
                  <Loader2 className="w-5 h-5 animate-spin text-orange-600" />
                  <span className="text-gray-600">Searching locations...</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="p-4 sm:p-6">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 lg:gap-8">
          <div className="space-y-6">
            <div className="space-y-4">
              {displayLocation && !locationError ? (
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 mb-1">
                      Location Set
                    </h3>
                    <p className="text-gray-600 text-sm">
                      Your location preferences have been configured
                    </p>
                  </div>
                </div>
              ) : locationError ? (
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 mb-1">
                      Location Error
                    </h3>
                    <p className="text-red-600 text-sm">{locationError}</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                    <Loader2 className="w-5 h-5 text-yellow-600 animate-spin" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 mb-1">
                      {!isGoogleMapsReady
                        ? "Loading Google Maps..."
                        : "Determining Location"}
                    </h3>
                    <p className="text-gray-600 text-sm">
                      {!isGoogleMapsReady
                        ? "Please wait..."
                        : "Please wait while we locate you..."}
                    </p>
                  </div>
                </div>
              )}
            </div>
            <div className="bg-gray-50 p-4 sm:p-6 space-y-4">
              <div className="flex items-center space-x-3">
                <MapPin className="w-5 h-5 text-orange-600" />
                <h3 className="font-semibold text-gray-900">
                  Current Location
                </h3>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Location Name</p>
                  <p className="font-medium text-gray-900 break-words">
                    {displayName}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Latitude</p>
                    <p className="font-mono text-sm text-gray-700 break-all">
                      {displayLocation.lat.toFixed(6)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Longitude</p>
                    <p className="font-mono text-sm text-gray-700 break-all">
                      {displayLocation.lng.toFixed(6)}
                    </p>
                  </div>
                </div>

                {currentLocation?.accuracy && (
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Accuracy</p>
                    <p className="text-sm text-gray-700">
                      {Math.round(currentLocation.accuracy)} meters
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-blue-50 p-4 sm:p-6 border border-blue-200">
              <div className="flex items-center space-x-3 mb-3">
                <Navigation className="w-5 h-5 text-blue-700" />
                <h3 className="font-semibold text-gray-900">Search Radius</h3>
              </div>
              <p className="text-sm text-gray-700 mb-4">
                We&apos;ll show you roommates and listings within this distance
                from your location
              </p>
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <input
                    type="range"
                    min="1"
                    max="50"
                    value={searchRadius}
                    onChange={(e) =>
                      handleSearchRadiusChange(parseInt(e.target.value))
                    }
                    className="flex-1 h-2 bg-gray-200 rounded-lg cursor-pointer"
                    aria-label={`Search radius: ${searchRadius} KM`}
                  />
                  <span className="text-sm font-medium text-gray-900 bg-white px-3 py-1 rounded-lg border border-gray-200 min-w-0 flex-shrink-0">
                    {searchRadius} KM
                  </span>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>1 KM</span>
                  <span>50 KM</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-orange-500 rounded-full flex-shrink-0"></div>
              <h3 className="font-semibold text-gray-900">Location on Map</h3>
            </div>

            <div className="bg-gray-100 rounded-xl overflow-hidden h-64 sm:h-80 relative">
              <div ref={mapRef} className="w-full h-full" />
              {(!mapLoaded || !isGoogleMapsReady) && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                  <div className="text-center p-4">
                    <Loader2 className="w-8 h-8 animate-spin text-orange-600 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">
                      {!isGoogleMapsReady
                        ? "Loading Google Maps..."
                        : "Initializing map..."}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0 text-sm text-gray-500">
              <span>Drag to explore nearby areas</span>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-orange-500 rounded-full flex-shrink-0"></div>
                <span>Your location</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LocationStatusSection;