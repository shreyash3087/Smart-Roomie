"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  MapPin,
  Search,
  Plus,
  User,
  Settings,
  Heart,
  MessageCircle,
  Calendar,
  Shield,
  Users,
  Building,
  ChevronRight,
  Loader2,
  ArrowRight,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  X,
} from "lucide-react";
import {
  db,
  getUserProfile,
  updateUserLocation,
} from "../../../utils/firebase";
import {
  collection,
  getDocs,
  query,
  limit,
  orderBy,
  where,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import Messages from "@/components/Messages";
import Spline from "@splinetool/react-spline";
import LocationStatusSection from "@/components/LocationStatusSection";
import { useUser } from "../../../utils/context";
import { GoogleGenerativeAI } from "@google/generative-ai";

const normalizeLocation = (location) => {
  if (!location) return null;
  if (
    location &&
    typeof location === "object" &&
    typeof location.lat === "number" &&
    typeof location.lng === "number"
  ) {
    return location;
  }

  if (
    location &&
    typeof location === "object" &&
    typeof location.latitude === "number" &&
    typeof location.longitude === "number"
  ) {
    return { lat: location.latitude, lng: location.longitude };
  }

  if (typeof location === "string") {
    try {
      const parsed = JSON.parse(location);
      return normalizeLocation(parsed);
    } catch (e) {
      console.warn("Could not parse location string:", location);
      return null;
    }
  }

  console.warn("Unknown location format:", location);
  return null;
};

const SmartRoomieDashboard = () => {
  const {
    user,
    userProfile,
    setUserProfile,
    activeTab,
    loading,
    error,
    handleTabChange,
  } = useUser();
  const [showAllListings, setShowAllListings] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [locationName, setLocationName] = useState("");
  const [locationError, setLocationError] = useState(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [listings, setListings] = useState([]);
  const [isLoadingListings, setIsLoadingListings] = useState(true);
  const router = useRouter();
  const [listingMatches, setListingMatches] = useState({});
  const [isLoadingMatches, setIsLoadingMatches] = useState(false);
  const [userSearchRadius, setUserSearchRadius] = useState(10);

  const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

  useEffect(() => {
    const getUserSearchRadius = async () => {
      if (userProfile?.location?.searchRadius) {
        setUserSearchRadius(userProfile.location.searchRadius);
      }
    };

    if (userProfile) {
      getUserSearchRadius();
    }
  }, [userProfile]);
  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
    }
  }, [user, loading, router]);
  useEffect(() => {
    const loadUserProfile = async () => {
      if (user) {
        try {
          const profile = await getUserProfile(user.uid);
          setUserProfile(profile);
        } catch (error) {
          console.error("Error loading user profile:", error);
          router.push("/");
        }
      }
    };

    loadUserProfile();
  }, [user]);

  useEffect(() => {
    const loadListings = async () => {
      try {
        const listingsRef = collection(db, "listings");
        const q = query(listingsRef, orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);

        const listingsData = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.userId !== user?.uid) {
            listingsData.push({
              id: doc.id,
              ...data,
            });
          }
        });

        setListings(listingsData);
      } catch (error) {
        console.error("Error loading listings:", error);
      } finally {
        setIsLoadingListings(false);
      }
    };

    if (user) {
      loadListings();
    }
  }, [user]);

  useEffect(() => {
    if (listings.length > 0 && userProfile?.preferences) {
      fetchListingCompatibility(listings);
    }
  }, [listings, userProfile?.preferences, currentLocation, userSearchRadius]);

  const extractUserTags = (preferences) => {
    if (!preferences) return [];

    if (preferences.type === "structured") {
      const tags = [];
      Object.entries(preferences).forEach(([key, value]) => {
        if (key !== "type" && value) {
          tags.push(`${key}: ${value}`);
        }
      });
      return tags;
    } else if (preferences.type === "conversational") {
      return preferences.semanticTags || [];
    }
    return [];
  };

  const calculateCompatibilityWithGemini = async (
    userPreferences,
    listerPreferences
  ) => {
    try {
      const userTags = extractUserTags(userPreferences);
      const listerTags = extractUserTags(listerPreferences);

      const prompt = `
    Compare these two roommate preference profiles and provide a compatibility percentage (0-100):

    User Preferences: ${JSON.stringify(userTags)}
    Lister Preferences: ${JSON.stringify(listerTags)}

    Consider compatibility factors like:
    - Cleanliness levels
    - Social preferences
    - Sleep schedules
    - Pet preferences
    - Noise tolerance
    - Guest policies

    Respond with ONLY a number between 0-100 representing the compatibility percentage.
    `;

      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      const percentage = parseInt(text.match(/\d+/)?.[0]) || 0;
      return Math.min(Math.max(percentage, 0), 100);
    } catch (error) {
      console.error("Error calculating compatibility:", error);
      return 0;
    }
  };
  const fetchListingCompatibility = async (listings) => {
    if (!userProfile?.preferences || listings.length === 0) return;

    setIsLoadingMatches(true);
    const matches = {};

    try {
      const userIds = [...new Set(listings.map((listing) => listing.userId))];

      const userProfiles = {};
      await Promise.all(
        userIds.map(async (userId) => {
          try {
            const profile = await getUserProfile(userId);
            userProfiles[userId] = profile;
          } catch (error) {
            console.error(`Error fetching profile for user ${userId}:`, error);
          }
        })
      );

      const userLocation = normalizeLocation(
        currentLocation ||
          userProfile?.location?.location ||
          userProfile?.preferredLocation
      );

      console.log("User location for distance calculation:", userLocation);

      await Promise.all(
        listings.map(async (listing) => {
          const listerProfile = userProfiles[listing.userId];

          let compatibilityScore = 0;
          if (listerProfile?.preferences) {
            compatibilityScore = await calculateCompatibilityWithGemini(
              userProfile.preferences,
              listerProfile.preferences
            );
          }

          let distanceScore = 0;
          let distanceInKm = 999999;

          if (userLocation && listing.location) {
            const normalizedListingLocation = normalizeLocation(
              listing.location
            );
            if (normalizedListingLocation) {
              console.log(`Calculating distance for listing ${listing.id}:`, {
                from: userLocation,
                to: normalizedListingLocation,
              });

              distanceInKm = await calculateDistance(
                userLocation,
                normalizedListingLocation
              );

              console.log(`Distance calculated: ${distanceInKm}km`);

              distanceScore = Math.max(0, ((50 - distanceInKm) / 50) * 100);
            }
          }
          const combinedScore = Math.round(
            compatibilityScore * 0.7 + distanceScore * 0.3
          );

          matches[listing.id] = {
            compatibility: compatibilityScore,
            distance: distanceInKm,
            combinedScore: combinedScore,
            withinRadius: distanceInKm <= userSearchRadius,
          };
        })
      );

      console.log("All matches calculated:", matches);
      setListingMatches(matches);
    } catch (error) {
      console.error("Error fetching compatibility:", error);
    } finally {
      setIsLoadingMatches(false);
    }
  };

  const getFilteredListings = () => {
    if (showAllListings) {
      return listings.sort((a, b) => {
        const aMatch = listingMatches[a.id] || { combinedScore: 0 };
        const bMatch = listingMatches[b.id] || { combinedScore: 0 };
        return bMatch.combinedScore - aMatch.combinedScore;
      });
    }
    const userLocation = normalizeLocation(
      currentLocation ||
        userProfile?.location?.location ||
        userProfile?.preferredLocation
    );

    let filteredListings = listings;

    if (userLocation) {
      filteredListings = listings.filter((listing) => {
        const match = listingMatches[listing.id];
        if (!match) return false;

        return match.withinRadius && match.combinedScore >= 40;
      });
    } else {
      filteredListings = listings.filter((listing) => {
        const match = listingMatches[listing.id];
        return match && match.combinedScore >= 40;
      });
    }

    return filteredListings.sort((a, b) => {
      const aMatch = listingMatches[a.id] || { combinedScore: 0 };
      const bMatch = listingMatches[b.id] || { combinedScore: 0 };
      return bMatch.combinedScore - aMatch.combinedScore;
    });
  };
  useEffect(() => {
    if (listings.length > 0 && userProfile?.preferences) {
      fetchListingCompatibility(listings);
    }
  }, [listings, userProfile?.preferences, currentLocation, userSearchRadius]);

  const updateSearchRadius = async (newRadius) => {
    if (user && userProfile) {
      try {
        await updateUserLocation(user.uid, {
          ...userProfile.location,
          searchRadius: newRadius,
        });

        setUserSearchRadius(newRadius);
        setUserProfile((prev) => ({
          ...prev,
          location: {
            ...prev.location,
            searchRadius: newRadius,
          },
        }));
      } catch (error) {
        console.error("Error updating search radius:", error);
      }
    }
  };

  const calculateDistance = async (userLocation, listingLocation) => {
    try {
      const normalizedUserLocation = normalizeLocation(userLocation);
      const normalizedListingLocation = normalizeLocation(listingLocation);

      if (!normalizedUserLocation || !normalizedListingLocation) {
        console.warn("Invalid locations for distance calculation:", {
          user: normalizedUserLocation,
          listing: normalizedListingLocation,
        });
        return 999999;
      }

      // Check if Google Maps is available
      if (typeof google === "undefined" || !google.maps) {
        console.warn(
          "Google Maps not available, using fallback distance calculation"
        );
        return calculateHaversineDistance(
          normalizedUserLocation,
          normalizedListingLocation
        );
      }

      const service = new google.maps.DistanceMatrixService();

      return new Promise((resolve, reject) => {
        service.getDistanceMatrix(
          {
            origins: [normalizedUserLocation],
            destinations: [normalizedListingLocation],
            travelMode: google.maps.TravelMode.DRIVING,
            unitSystem: google.maps.UnitSystem.METRIC,
            avoidHighways: false,
            avoidTolls: false,
          },
          (response, status) => {
            if (status === google.maps.DistanceMatrixStatus.OK) {
              const element = response.rows[0].elements[0];
              if (element.status === "OK") {
                const distance = element.distance?.value || 999999;
                resolve(distance / 1000); // Convert to kilometers
              } else {
                console.warn("Distance calculation failed:", element.status);
                // Fallback to Haversine distance
                resolve(
                  calculateHaversineDistance(
                    normalizedUserLocation,
                    normalizedListingLocation
                  )
                );
              }
            } else {
              console.warn("Distance Matrix API failed:", status);
              // Fallback to Haversine distance
              resolve(
                calculateHaversineDistance(
                  normalizedUserLocation,
                  normalizedListingLocation
                )
              );
            }
          }
        );
      });
    } catch (error) {
      console.error("Error calculating distance:", error);
      return 999999;
    }
  };
  const calculateHaversineDistance = (pos1, pos2) => {
    const R = 6371;
    const dLat = ((pos2.lat - pos1.lat) * Math.PI) / 180;
    const dLon = ((pos2.lng - pos1.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((pos1.lat * Math.PI) / 180) *
        Math.cos((pos2.lat * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const getLocationName = async (lat, lng) => {
    try {
      const response = await fetch(
        `https://api.opencagedata.com/geocode/v1/json?q=${lat}+${lng}&key=${process.env.NEXT_PUBLIC_OPENCAGE_API_KEY}&limit=1`
      );
      const data = await response.json();

      if (data.results && data.results.length > 0) {
        const result = data.results[0];
        const city =
          result.components.city ||
          result.components.town ||
          result.components.village;
        const state = result.components.state;
        const country = result.components.country;

        return `${city}, ${state}, ${country}`;
      }
      return "Unknown location";
    } catch (error) {
      console.error("Error getting location name:", error);
      return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
  };
  const getCurrentLocation = async () => {
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

      try {
        const name = await getLocationName(location.lat, location.lng);
        setLocationName(name);

        if (user) {
          await updateUserLocation(user.uid, {
            location: { lat: location.lat, lng: location.lng },
            locationName: name,
            updatedAt: new Date(),
          });

          setUserProfile((prev) => ({
            ...prev,
            location: {
              ...prev.location,
              location: { lat: location.lat, lng: location.lng },
              locationName: name,
            },
          }));
        }
      } catch (nameError) {
        console.error("Error getting location name:", nameError);
        setLocationName(
          `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`
        );
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

  useEffect(() => {
    const initializeLocation = async () => {
      if (userProfile?.location?.location) {
        const normalizedLocation = normalizeLocation(
          userProfile.location.location
        );
        setCurrentLocation(normalizedLocation);

        // Set search radius from user profile
        if (userProfile.location.searchRadius) {
          setUserSearchRadius(userProfile.location.searchRadius);
        }

        if (userProfile.location.locationName) {
          setLocationName(userProfile.location.locationName);
        } else if (normalizedLocation) {
          try {
            const name = await getLocationName(
              normalizedLocation.lat,
              normalizedLocation.lng
            );
            setLocationName(name);
          } catch (error) {
            console.error("Error getting location name:", error);
          }
        }
      } else {
        getCurrentLocation();
      }
    };

    if (userProfile !== null) {
      initializeLocation();
    }
  }, [userProfile]);

  const handleListRoom = () => {
    router.push("/list");
  };

  const StatCard = ({ icon: Icon, title, value, change, color = "orange" }) => (
    <div className="bg-white p-6 shadow-sm border border-gray-200 hover:shadow-md transition-all duration-300 group">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div
            className={`p-3 bg-${color}-50 group-hover:bg-${color}-100 transition-colors duration-300`}
          >
            <Icon className={`w-6 h-6 text-${color}-600`} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">
              {title}
            </p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
          </div>
        </div>
        {change && (
          <div className="flex items-center space-x-1 text-green-600">
            <TrendingUp className="w-4 h-4" />
            <span className="text-sm font-medium">{change}</span>
          </div>
        )}
      </div>
    </div>
  );
  const ListingCard = ({ listing }) => {
    const [showDetails, setShowDetails] = useState(false);
    const match = listingMatches[listing.id] || {
      compatibility: 0,
      distance: 999999,
      combinedScore: 0,
    };

    const renderLocation = (location) => {
      if (typeof location === "string") {
        return location;
      } else if (location && typeof location === "object") {
        if (location.lat && location.lng) {
          return `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`;
        }
        return (
          location.address ||
          location.city ||
          location.name ||
          "Location not specified"
        );
      }
      return "Location not specified";
    };

    const getCompatibilityColor = (percentage) => {
      if (percentage >= 80) return "text-green-600 bg-green-50";
      if (percentage >= 60) return "text-yellow-600 bg-yellow-50";
      if (percentage >= 40) return "text-orange-600 bg-orange-50";
      return "text-red-600 bg-red-50";
    };
    const handleConnect = async () => {
      try {
        const conversationsRef = collection(db, "conversations");
        const q = query(
          conversationsRef,
          where("participants", "array-contains", user.uid)
        );
        const querySnapshot = await getDocs(q);

        let existingConversation = null;
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.participants.includes(listing.userId)) {
            existingConversation = { id: doc.id, ...data };
          }
        });

        if (existingConversation) {
          handleTabChange("messages");
          return;
        }
        const newConversation = {
          participants: [user.uid, listing.userId],
          participantNames: {
            [user.uid]: userProfile?.name || user.displayName || "Anonymous",
            [listing.userId]: listing.userName || "Anonymous",
          },
          listingTitle: listing.title || "Property Inquiry",
          listingId: listing.id,
          matchData: {
            compatibility: match.compatibility || 0,
            distance: match.distance || 999999,
            combinedScore: match.combinedScore || 0,
            withinRadius: match.withinRadius || false,
          },
          createdAt: serverTimestamp(),
          lastMessage: "",
          lastMessageAt: serverTimestamp(),
          lastMessageSenderId: user.uid,
        };

        const docRef = await addDoc(conversationsRef, newConversation);
        const messagesRef = collection(
          db,
          "conversations",
          docRef.id,
          "messages"
        );
        await addDoc(messagesRef, {
          text: `Hi! I'm interested in your listing: ${listing.title}`,
          senderId: user.uid,
          senderName: userProfile?.name || user.displayName || "Anonymous",
          createdAt: serverTimestamp(),
          read: false,
        });

        handleTabChange("messages");
      } catch (error) {
        console.error("Error connecting with lister:", error);
      }
    };

    const formatDistance = (distance) => {
      if (distance >= 999999) return "Distance not available";
      if (distance < 1) return `${(distance * 1000).toFixed(0)}m away`;
      return `${distance.toFixed(1)}km away`;
    };

    return (
      <>
        <div className="bg-white shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-all duration-300 group">
          <div className="relative">
            <div className="w-full h-48 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center overflow-hidden">
              {listing?.images ? (
                <img
                  src={
                    listing.images[0] ||
                    "https://assets.simplotel.com/simplotel/image/upload/x_0,y_0,w_1366,h_769,r_0,c_crop,q_80,fl_progressive/w_500,f_auto,c_fit/jehan-numa-palace/hs_k20vrp"
                  }
                  alt="Listing"
                  className="w-full h-full object-cover"
                />
              ) : (
                <Building className="w-16 h-16 text-gray-400" />
              )}
            </div>
            <div className="absolute top-3 right-3 bg-white p-2 shadow-sm border border-gray-200">
              <Heart className="w-4 h-4 text-orange-600 hover:text-red-500 transition-colors cursor-pointer" />
            </div>
            {match.combinedScore > 0 && (
              <div className="absolute top-3 left-3 space-y-1">
                <div
                  className={`px-2 py-1 text-xs font-medium rounded ${getCompatibilityColor(
                    match.combinedScore
                  )}`}
                >
                  {match.combinedScore}% Overall Match
                </div>
                {match.distance < 999999 && (
                  <div className="bg-blue-50 text-blue-600 px-2 py-1 text-xs font-medium rounded">
                    {formatDistance(match.distance)}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">
                {listing.title || "Professional Room Available"}
              </h3>
              <div className="flex items-center space-x-1 text-green-600">
                <Shield className="w-4 h-4" />
                <span className="text-xs font-medium uppercase tracking-wide">
                  Verified
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-4 text-sm text-gray-500 mb-4">
              <div className="flex items-center space-x-1">
                <MapPin className="w-4 h-4" />
                <span>
                  {listing.locationName || renderLocation(listing.location)}
                </span>
              </div>
              <div className="flex items-center space-x-1">
                <Calendar className="w-4 h-4" />
                <span>
                  {listing.createdAt
                    ? new Date(
                        listing.createdAt.toDate
                          ? listing.createdAt.toDate()
                          : listing.createdAt
                      ).toLocaleDateString()
                    : "Date not available"}
                </span>
              </div>
            </div>

            {/* Match details */}
            {match.combinedScore > 0 && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Compatibility:</span>
                  <span className="font-medium">{match.compatibility}%</span>
                </div>
                {match.distance < 999999 && (
                  <div className="flex justify-between items-center text-sm mt-1">
                    <span className="text-gray-600">Distance:</span>
                    <span className="font-medium">
                      {formatDistance(match.distance)}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="mb-4">
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <span>Room: {listing.roomType || "Standard"}</span>
                {listing.roomSize?.area && (
                  <span>• {listing.roomSize.area} sq ft</span>
                )}
              </div>
              {listing.amenities && listing.amenities.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {listing.amenities.slice(0, 3).map((amenity, index) => (
                    <span
                      key={index}
                      className="bg-gray-100 text-gray-700 px-2 py-1 text-xs rounded"
                    >
                      {amenity}
                    </span>
                  ))}
                  {listing.amenities.length > 3 && (
                    <span className="text-gray-500 text-xs">
                      +{listing.amenities.length - 3} more
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between space-x-3">
              <div className="text-2xl font-bold text-gray-900">
                ${listing.rent || "N/A"}
                <span className="text-sm font-normal text-gray-500">
                  /month
                </span>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={handleConnect}
                  className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors flex items-center space-x-1"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span className="text-sm">Connect</span>
                </button>
                <button
                  onClick={() => setShowDetails(true)}
                  className="bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700 transition-colors flex items-center space-x-1"
                >
                  <span className="text-sm">Details</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {showDetails && (
          <div className="fixed inset-0 bg-[#0000005c] flex items-center justify-center z-50 p-4">
            <div className="bg-white max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold text-gray-900">
                    {listing.title}
                  </h2>
                  <button
                    onClick={() => setShowDetails(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-3xl font-bold text-gray-900">
                      ${listing.rent}/month
                    </span>
                    {match.compatibility > 0 && (
                      <div
                        className={`px-3 py-1 rounded-full text-sm font-medium ${getCompatibilityColor(
                          match.compatibility
                        )}`}
                      >
                        {match.compatibility}% Compatibility Match
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">
                        Room Details
                      </h4>
                      <div className="space-y-1 text-sm text-gray-600">
                        <div>Type: {listing.roomType || "Standard"}</div>
                        {listing.roomSize?.area && (
                          <div>Area: {listing.roomSize.area} sq ft</div>
                        )}
                        {listing.lightLevel && (
                          <div>Light Level: {listing.lightLevel}%</div>
                        )}
                        {listing.noiseLevel && (
                          <div>Noise Level: {listing.noiseLevel}/10</div>
                        )}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">
                        Location
                      </h4>
                      <div className="flex items-center space-x-1 text-sm text-gray-600">
                        <MapPin className="w-4 h-4" />
                        <span>
                          {listing.locationName || "Location not specified"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {listing.description && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">
                        Description
                      </h4>
                      <p className="text-gray-600">{listing.description}</p>
                    </div>
                  )}

                  {listing.amenities && listing.amenities.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">
                        Amenities
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {listing.amenities.map((amenity, index) => (
                          <span
                            key={index}
                            className="bg-gray-100 text-gray-700 px-3 py-1 text-sm rounded"
                          >
                            {amenity}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-4 border-t">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                          <User className="w-4 h-4 text-orange-600" />
                        </div>
                        <span className="text-sm font-medium text-gray-900">
                          {listing.userName || "Anonymous"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    );
  };
  const SplineRoom = () => (
    <div className="hidden lg:block w-[500px] h-[400px]">
      <Spline scene="/scene2.splinecode" />
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-orange-600" />
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 mx-auto mb-4 text-red-500" />
          <p className="text-red-600">
            Error loading dashboard. Please try again.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === "explore" && (
          <div className="space-y-6 sm:space-y-8">
            {/* Hero Section */}
            <div className="bg-gradient-to-r from-orange-600 to-amber-500 px-4 sm:px-8 lg:px-16 py-6 sm:py-8 text-white shadow-2xl">
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 lg:gap-0">
                <div className="flex-1 w-full lg:w-auto">
                  <h1 className="text-2xl sm:text-3xl font-bold mb-2">
                    Welcome back,{" "}
                    {userProfile?.name?.split(" ")[0] ||
                      user.displayName?.split(" ")[0] ||
                      "User"}
                  </h1>
                  <p className="text-base sm:text-lg text-gray-100 mb-4 sm:mb-6">
                    Find compatible roommates and quality accommodations
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                    <button
                      onClick={() => {
                        activeTab === "matches";
                      }}
                      className="bg-white text-orange-600 px-4 sm:px-6 py-3 rounded-lg font-medium hover:bg-orange-50 transition-all duration-200 flex items-center justify-center space-x-2 hover:scale-105 shadow-lg cursor-pointer w-full sm:w-auto"
                    >
                      <Search className="w-5 h-5" />
                      <span>Find Accommodation</span>
                    </button>
                    <button
                      onClick={handleListRoom}
                      className="bg-orange-700 text-white px-4 sm:px-6 py-3 rounded-lg font-medium hover:bg-orange-800 transition-all duration-200 flex items-center justify-center space-x-2 hover:scale-105 shadow-lg cursor-pointer w-full sm:w-auto"
                    >
                      <Plus className="w-5 h-5" />
                      <span>List Property</span>
                    </button>
                  </div>
                </div>
                <div className="hidden lg:block">
                  <SplineRoom />
                </div>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
              <StatCard
                icon={Heart}
                title="Saved Listings"
                value={userProfile?.savedListings?.length || 0}
                color="red"
              />
              <StatCard
                icon={MessageCircle}
                title="Messages"
                value="0"
                color="blue"
              />
              <StatCard
                icon={Calendar}
                title="Viewings"
                value="0"
                color="purple"
              />
              <StatCard
                icon={Users}
                title="Active Listings"
                value={listings.length}
                color="green"
              />
            </div>

            {/* Location Section */}
            <LocationStatusSection
              currentLocation={currentLocation}
              setCurrentLocation={setCurrentLocation}
              locationName={locationName}
              setLocationName={setLocationName}
              getLocationName={getLocationName}
              locationError={locationError}
              setLocationError={setLocationError}
              isLoadingLocation={isLoadingLocation}
              setIsLoadingLocation={setIsLoadingLocation}
              userProfile={userProfile}
              updateUserLocation={(locationData) =>
                updateUserLocation(user.uid, locationData)
              }
            />

            {/* Listings Section */}
            <div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0 mb-4">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                  {showAllListings ? "All Listings" : "Matched Listings"}
                </h2>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  {/* Toggle Button */}
                  <button
                    onClick={() => setShowAllListings(!showAllListings)}
                    className="text-orange-600 hover:text-orange-700 font-medium flex items-center space-x-2 transition-colors"
                  >
                    <span>
                      {showAllListings
                        ? "Show Matched Only"
                        : "Show All Listings"}
                    </span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Filter Summary */}
              {!showAllListings && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <div className="flex items-center space-x-2 text-blue-800">
                    <Shield className="w-5 h-5" />
                    <span className="font-medium">
                      Showing {getFilteredListings().length} listings within{" "}
                      {userSearchRadius}km with {">40%"} compatibility
                    </span>
                  </div>
                </div>
              )}

              {isLoadingListings ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="bg-white rounded-xl p-4 sm:p-6 shadow-lg border border-gray-100"
                    >
                      <div className="animate-pulse">
                        <div className="bg-gray-300 h-32 sm:h-48 rounded-lg mb-4"></div>
                        <div className="space-y-3">
                          <div className="bg-gray-300 h-4 rounded w-3/4"></div>
                          <div className="bg-gray-300 h-4 rounded w-1/2"></div>
                          <div className="bg-gray-300 h-4 rounded w-5/6"></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : getFilteredListings().length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {getFilteredListings().map((listing) => (
                    <ListingCard key={listing.id} listing={listing} />
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-xl p-6 sm:p-12 shadow-lg border border-gray-100 text-center">
                  <Building className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">
                    {showAllListings
                      ? "No listings available"
                      : "No matches found"}
                  </h3>
                  <p className="text-sm sm:text-base text-gray-600 mb-6">
                    {showAllListings
                      ? "Be the first one to list your room and find great roommates!"
                      : `No listings found within ${userSearchRadius}km with good compatibility. Try increasing your search radius or view all listings.`}
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    {!showAllListings && (
                      <button
                        onClick={() => setShowAllListings(true)}
                        className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center space-x-2 mx-auto"
                      >
                        <Search className="w-5 h-5" />
                        <span>Show All Listings</span>
                      </button>
                    )}
                    <button
                      onClick={handleListRoom}
                      className="bg-orange-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-orange-700 transition-colors flex items-center space-x-2 mx-auto"
                    >
                      <Plus className="w-5 h-5" />
                      <span>List Your Room</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "matches" && (
          <div className="space-y-8">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-gray-900 mb-4">
                Your Matches
              </h1>
              <p className="text-lg text-gray-600">
                Based on your preferences, lifestyle compatibility, and location
              </p>
            </div>

            {isLoadingMatches ? (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-orange-600" />
                <p className="text-gray-600">Finding your perfect matches...</p>
              </div>
            ) : (
              <>
                {getFilteredListings().length > 0 ? (
                  <>
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-xl font-semibold text-gray-900">
                        Top Matches ({getFilteredListings().length})
                      </h2>
                      {!showAllListings &&
                        getFilteredListings().length < listings.length && (
                          <button
                            onClick={() => setShowAllListings(true)}
                            className="text-orange-600 hover:text-orange-700 font-medium flex items-center space-x-2 transition-colors"
                          >
                            <span>Show All Listings</span>
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {getFilteredListings()
                        .sort((a, b) => {
                          const aMatch = listingMatches[a.id] || {
                            combinedScore: 0,
                          };
                          const bMatch = listingMatches[b.id] || {
                            combinedScore: 0,
                          };
                          return bMatch.combinedScore - aMatch.combinedScore;
                        })
                        .map((listing) => (
                          <ListingCard key={listing.id} listing={listing} />
                        ))}
                    </div>
                  </>
                ) : (
                  <div className="bg-white rounded-xl p-12 shadow-lg border border-gray-100 text-center">
                    <Heart className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      No good matches found
                    </h3>
                    <p className="text-gray-600 mb-6">
                      We couldn&apos;t find listings that match your preferences
                      and location. Would you like to see all available
                      listings?
                    </p>
                    <button
                      onClick={() => setShowAllListings(true)}
                      className="bg-orange-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-orange-700 transition-colors flex items-center space-x-2 mx-auto"
                    >
                      <Search className="w-5 h-5" />
                      <span>Show All Listings</span>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === "messages" && (
          <div className="space-y-8">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-gray-900 mb-4">
                Messages
              </h1>
              <p className="text-lg text-gray-600">
                Chat with potential roommates and property listers
              </p>
            </div>

            <Messages user={user} userProfile={userProfile} />
          </div>
        )}

        {activeTab === "profile" && (
          <div className="space-y-8">
            <div className="bg-white p-8 shadow-sm border border-gray-200">
              <div className="flex items-center space-x-6 mb-8">
                <img
                  src={
                    userProfile?.profileImage ||
                    user.photoURL ||
                    "https://img.freepik.com/premium-vector/vector-flat-illustration-grayscale-avatar-user-profile-person-icon-profile-picture-business-profile-woman-suitable-social-media-profiles-icons-screensavers-as-templatex9_719432-1351.jpg?semt=ais_hybrid&w=740"
                  }
                  alt={userProfile?.name || user.displayName || "User"}
                  className="w-24 h-24 object-cover border-2 border-gray-200"
                />
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">
                    {userProfile?.name || user.displayName || "User"}
                  </h1>
                  <p className="text-lg text-gray-600">
                    {userProfile?.email || user.email}
                  </p>
                  {userProfile?.age && (
                    <p className="text-gray-600 mt-1">Age: {userProfile.age}</p>
                  )}
                  {locationName && (
                    <div className="flex items-center space-x-2 mt-2">
                      <MapPin className="w-4 h-4 text-gray-500" />
                      <span className="text-gray-600">{locationName}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">
                    Lifestyle Preferences
                  </h2>
                  <div className="space-y-3">
                    {userProfile?.preferences ? (
                      <>
                        {userProfile.preferences.type === "structured" ? (
                          Object.entries(userProfile.preferences)
                            .filter(([key]) => key !== "type")
                            .map(([key, value]) => (
                              <div
                                key={key}
                                className="flex items-center justify-between py-2 border-b border-gray-100"
                              >
                                <span className="text-gray-600 capitalize font-medium">
                                  {key.replace(/([A-Z])/g, " $1").trim()}
                                </span>
                                <span className="text-gray-900">{value}</span>
                              </div>
                            ))
                        ) : (
                          <div className="space-y-4">
                            <div>
                              <h3 className="font-medium text-gray-900 mb-2">
                                Preferences Summary
                              </h3>
                              <p className="text-gray-600 leading-relaxed">
                                {userProfile.preferences.conversationSummary}
                              </p>
                            </div>
                            {userProfile.preferences.semanticTags && (
                              <div>
                                <h3 className="font-medium text-gray-900 mb-2">
                                  Key Characteristics
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                  {userProfile.preferences.semanticTags.map(
                                    (tag, index) => (
                                      <span
                                        key={index}
                                        className="bg-gray-100 text-gray-700 px-3 py-1 text-sm border border-gray-200"
                                      >
                                        {tag}
                                      </span>
                                    )
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-gray-500 italic">
                        No preferences configured
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">
                    Account Information
                  </h2>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between py-2 border-b border-gray-100">
                      <span className="text-gray-600 font-medium">
                        Member Since
                      </span>
                      <span className="text-gray-900">
                        {userProfile?.createdAt
                          ? new Date(userProfile.createdAt).toLocaleDateString()
                          : new Date(
                              user.metadata.creationTime
                            ).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-gray-100">
                      <span className="text-gray-600 font-medium">
                        Profile Updated
                      </span>
                      <span className="text-gray-900">
                        {userProfile?.updatedAt
                          ? new Date(userProfile.updatedAt).toLocaleDateString()
                          : "Never"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-gray-100">
                      <span className="text-gray-600 font-medium">
                        Account Status
                      </span>
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-green-600 font-medium">
                          Active
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-8 border-t border-gray-200">
                <div className="flex space-x-4">
                  <button className="bg-gray-900 text-white px-6 py-3 font-medium hover:bg-gray-800 transition-colors flex items-center space-x-2">
                    <Settings className="w-5 h-5" />
                    <span>Edit Profile</span>
                  </button>
                  <button className="bg-gray-100 text-gray-700 px-6 py-3 font-medium hover:bg-gray-200 transition-colors flex items-center space-x-2">
                    <Shield className="w-5 h-5" />
                    <span>Privacy Settings</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default SmartRoomieDashboard;
