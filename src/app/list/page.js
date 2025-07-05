"use client";
import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  MapPin,
  Home,
  DollarSign,
  Ruler,
  Volume2,
  Sun,
  Camera,
  Compass,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  User,
  Play,
  Pause,
  RotateCcw,
  Navigation,
  Move,
  Mic,
  Eye,
  Save,
} from "lucide-react";
import { useUser } from "../../../utils/context";
import {
  db,
  updateUserProfile,
  uploadImage,
  storage,
} from "../../../utils/firebase";
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  arrayUnion,
} from "firebase/firestore";
import RoomMeasurement from "../../components/RoomMeasurement";

const ListingPage = () => {
  const { user, userProfile, setUserProfile } = useUser();
  const router = useRouter();
  const [profileComplete, setProfileComplete] = useState(false);
  const [missingFields, setMissingFields] = useState([]);
  const [noiseInterval, setNoiseInterval] = useState(null);
  const [lightInterval, setLightInterval] = useState(null);
  const [profileForm, setProfileForm] = useState({
    name: "",
    age: "",
    email: "",
  });
  const [locationSearch, setLocationSearch] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showLocationSearch, setShowLocationSearch] = useState(false);
  const [placesService, setPlacesService] = useState(null);
  const [isGoogleMapsReady, setIsGoogleMapsReady] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const fileInputRef = useRef(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [listingData, setListingData] = useState({
    title: "",
    description: "",
    rent: "",
    roomType: "",
    amenities: [],
    images: [],
    location: null,
    locationName: "",
    roomSize: { length: 0, width: 0, area: 0 },
    noiseLevel: 0,
    lightLevel: 0,
  });
  const [noiseRecording, setNoiseRecording] = useState(false);
  const [lightSensing, setLightSensing] = useState(false);

  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const microphoneRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const steps = [
    { id: 0, title: "Profile Verification", icon: User },
    { id: 1, title: "Basic Details", icon: Home },
    { id: 2, title: "Location & Rent", icon: MapPin },
    { id: 3, title: "Room Measurement", icon: Ruler },
    { id: 4, title: "Environment Check", icon: Sun },
    { id: 5, title: "Review & Submit", icon: CheckCircle },
    { id: 6, title: "Upload Photos", icon: Camera },
  ];
  useEffect(() => {
    // Initialize Google Maps
    if (window.google && window.google.maps) {
      setIsGoogleMapsReady(true);
      const service = new window.google.maps.places.PlacesService(
        document.createElement("div")
      );
      setPlacesService(service);
    }
  }, []);
  useEffect(() => {
    if (userProfile) {
      const required = ["name", "age", "email"];
      const missing = required.filter((field) => !userProfile[field]);

      if (missing.length === 0) {
        setProfileComplete(true);
        setCurrentStep(1);
      } else {
        setMissingFields(missing);
        setProfileForm({
          name: userProfile.name || "",
          age: userProfile.age || "",
          email: userProfile.email || "",
        });
      }
      setLoading(false);
    }
  }, [userProfile]);

  useEffect(() => {
    if (profileComplete) {
      getCurrentLocation();
    }
  }, [profileComplete]);

  const getCurrentLocation = async () => {
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

      const locationName = await getLocationName(location.lat, location.lng);

      setListingData((prev) => ({
        ...prev,
        location,
        locationName,
      }));
    } catch (error) {
      console.error("Error getting location:", error);
    }
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

  const handleLocationSelect = (suggestion) => {
    setListingData((prev) => ({
      ...prev,
      location: {
        lat: suggestion.lat,
        lng: suggestion.lng,
        accuracy: 0,
      },
      locationName: suggestion.formatted_address,
    }));
    setShowLocationSearch(false);
    setLocationSearch("");
    setSuggestions([]);
  };

  const handleImageUpload = async (files) => {
    if (!files || files.length === 0) return;

    setUploadingImages(true);
    try {
      const uploadPromises = Array.from(files).map(async (file, index) => {
        const imagePath = `listings/${user.uid}/${Date.now()}_${index}_${
          file.name
        }`;
        const imageUrl = await uploadImage(file, imagePath);
        return imageUrl;
      });

      const imageUrls = await Promise.all(uploadPromises);
      setListingData((prev) => ({
        ...prev,
        images: [...prev.images, ...imageUrls],
      }));
    } catch (error) {
      console.error("Error uploading images:", error);
      alert("Error uploading images. Please try again.");
    } finally {
      setUploadingImages(false);
    }
  };

  const removeImage = (index) => {
    setListingData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };
  const startNoiseRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContextRef.current = new (window.AudioContext ||
        window.webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      microphoneRef.current =
        audioContextRef.current.createMediaStreamSource(stream);

      microphoneRef.current.connect(analyserRef.current);
      analyserRef.current.fftSize = 256;
      analyserRef.current.smoothingTimeConstant = 0.8;

      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      setNoiseRecording(true);

      const measureNoise = () => {
        analyserRef.current.getByteFrequencyData(dataArray);
        const average =
          dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;

        const decibelLevel = Math.round((average / 255) * 100);

        setListingData((prev) => ({
          ...prev,
          noiseLevel: decibelLevel,
        }));
      };

      const interval = setInterval(measureNoise, 200);
      setNoiseInterval(interval);

      microphoneRef.current.stream = stream;
    } catch (error) {
      console.error("Error accessing microphone:", error);
      alert("Could not access microphone. Please check permissions.");
    }
  };

  const stopMicrophone = () => {
    setNoiseRecording(false);

    if (noiseInterval) {
      clearInterval(noiseInterval);
      setNoiseInterval(null);
    }

    if (microphoneRef.current?.stream) {
      microphoneRef.current.stream.getTracks().forEach((track) => track.stop());
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    analyserRef.current = null;
    microphoneRef.current = null;
  };
  const startLightSensing = async () => {
    try {
      setLightSensing(true);

      // Get camera stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });

      // Create video element temporarily
      const video = document.createElement("video");
      video.srcObject = stream;
      video.play();

      // Wait for video to be ready
      await new Promise((resolve) => {
        video.onloadedmetadata = () => {
          resolve();
        };
      });

      // Create canvas and capture image
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;

      // Draw the current frame
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Analyze the image brightness
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      let totalBrightness = 0;
      let pixelCount = 0;

      // Sample pixels (every 4th pixel for performance)
      for (let i = 0; i < data.length; i += 16) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // Calculate luminance using standard formula
        const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
        totalBrightness += luminance;
        pixelCount++;
      }

      // Calculate average brightness percentage
      const averageBrightness = totalBrightness / pixelCount;
      const lightPercentage = Math.round((averageBrightness / 255) * 100);

      // Update state
      setListingData((prev) => ({
        ...prev,
        lightLevel: lightPercentage,
      }));

      // Stop camera stream
      stream.getTracks().forEach((track) => track.stop());
      setLightSensing(false);

      // Show success message
      alert(`Light level captured: ${lightPercentage}%`);
    } catch (error) {
      console.error("Error accessing camera:", error);
      alert("Could not access camera. Please check permissions.");
      setLightSensing(false);
    }
  };

  const stopCamera = () => {
    setLightSensing(false);
  };
  useEffect(() => {
    return () => {
      stopMicrophone();
      stopCamera();
    };
  }, []);
  const submitListing = async () => {
    try {
      setSubmitting(true);

      const listingPayload = {
        ...listingData,
        userId: user.uid,
        userEmail: user.email,
        userName: userProfile.name,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: "active",
        views: 0,
        likes: 0,
      };

      const listingRef = await addDoc(
        collection(db, "listings"),
        listingPayload
      );

      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        listings: arrayUnion(listingRef.id),
      });

      router.push("/dashboard");
    } catch (error) {
      console.error("Error submitting listing:", error);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-orange-600" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push("/dashboard")}
            className="flex items-center space-x-2 text-orange-600 hover:text-orange-700 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Dashboard</span>
          </button>

          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            List Your Room
          </h1>
          <p className="text-lg text-gray-600">
            Create a detailed listing to find the perfect roommate
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={`flex items-center space-x-2 ${
                  index <= currentStep ? "text-orange-600" : "text-gray-400"
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    index <= currentStep
                      ? "bg-orange-600 text-white"
                      : "bg-gray-200 text-gray-400"
                  }`}
                >
                  <step.icon className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium hidden md:block">
                  {step.title}
                </span>
              </div>
            ))}
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-orange-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
          {/* Step 0: Profile Verification */}
          {currentStep === 0 && (
            <div className="space-y-6">
              <div className="text-center">
                <User className="w-16 h-16 text-orange-600 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  {profileComplete
                    ? "Profile Complete"
                    : "Complete Your Profile"}
                </h2>
                <p className="text-gray-600">
                  {profileComplete
                    ? "Your profile is complete! You can now proceed to create your listing."
                    : "Before listing your profile must be complete."}
                </p>
                {profileComplete && (
                  <button
                    onClick={() => {
                      setCurrentStep(1);
                    }}
                    className="bg-orange-600 mx-auto mt-6 cursor-pointer text-white px-6 py-3 rounded-lg font-medium hover:bg-orange-700 flex items-center space-x-2"
                  >
                    Next
                  </button>
                )}
              </div>
              {!profileComplete && (
                <>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        value={profileForm.name}
                        onChange={(e) =>
                          setProfileForm((prev) => ({
                            ...prev,
                            name: e.target.value,
                          }))
                        }
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        placeholder="Enter your full name"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Age *
                      </label>
                      <input
                        type="number"
                        value={profileForm.age}
                        onChange={(e) =>
                          setProfileForm((prev) => ({
                            ...prev,
                            age: Number(e.target.value),
                          }))
                        }
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        placeholder="Enter your age"
                        min="18"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email *
                      </label>
                      <input
                        type="email"
                        value={profileForm.email}
                        onChange={(e) =>
                          setProfileForm((prev) => ({
                            ...prev,
                            email: e.target.value,
                          }))
                        }
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        placeholder="Enter your email address"
                        disabled={userProfile?.email ? true : false}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={updateProfile}
                      disabled={
                        submitting ||
                        !profileForm.name ||
                        !profileForm.age ||
                        !profileForm.email
                      }
                      className="bg-orange-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                    >
                      {submitting ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <CheckCircle className="w-5 h-5" />
                      )}
                      <span>{submitting ? "Updating..." : "Continue"}</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="text-center">
                <Home className="w-16 h-16 text-orange-600 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Basic Details
                </h2>
                <p className="text-gray-600">
                  Tell us about your room and what you&apos;re looking for
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Listing Title *
                  </label>
                  <input
                    type="text"
                    value={listingData.title}
                    onChange={(e) =>
                      setListingData((prev) => ({
                        ...prev,
                        title: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="e.g., Cozy room in downtown apartment"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description *
                  </label>
                  <textarea
                    value={listingData.description}
                    onChange={(e) =>
                      setListingData((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="Describe your room, apartment, and what you're looking for in a roommate..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Room Type *
                  </label>
                  <select
                    value={listingData.roomType}
                    onChange={(e) =>
                      setListingData((prev) => ({
                        ...prev,
                        roomType: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  >
                    <option value="">Select room type</option>
                    <option value="private">Private Room</option>
                    <option value="shared">Shared Room</option>
                    <option value="master">Master Bedroom</option>
                    <option value="studio">Studio</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Amenities
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      "Wi-Fi",
                      "AC",
                      "Parking",
                      "Laundry",
                      "Kitchen",
                      "Balcony",
                      "Gym",
                      "Pool",
                      "Security",
                      "Furnished",
                      "Pet-friendly",
                      "Utilities",
                    ].map((amenity) => (
                      <label
                        key={amenity}
                        className="flex items-center space-x-2"
                      >
                        <input
                          type="checkbox"
                          checked={listingData.amenities.includes(amenity)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setListingData((prev) => ({
                                ...prev,
                                amenities: [...prev.amenities, amenity],
                              }));
                            } else {
                              setListingData((prev) => ({
                                ...prev,
                                amenities: prev.amenities.filter(
                                  (a) => a !== amenity
                                ),
                              }));
                            }
                          }}
                          className="rounded text-orange-600 focus:ring-orange-500"
                        />
                        <span className="text-sm text-gray-700">{amenity}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-between">
                <button
                  onClick={() => setCurrentStep(0)}
                  className="bg-gray-100 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-200 flex items-center space-x-2"
                >
                  <ArrowLeft className="w-5 h-5" />
                  <span>Back</span>
                </button>
                <button
                  onClick={() => setCurrentStep(2)}
                  disabled={
                    !listingData.title ||
                    !listingData.description ||
                    !listingData.roomType
                  }
                  className="bg-orange-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  <span>Next</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="text-center">
                <MapPin className="w-16 h-16 text-orange-600 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Location & Rent
                </h2>
                <p className="text-gray-600">
                  Set your rent and confirm your location
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Monthly Rent *
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                    <input
                      type="number"
                      value={listingData.rent}
                      onChange={(e) =>
                        setListingData((prev) => ({
                          ...prev,
                          rent: e.target.value,
                        }))
                      }
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      placeholder="Enter monthly rent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Location
                  </label>
                  <div className="space-y-3">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <MapPin className="w-5 h-5 text-green-600" />
                          <div>
                            <p className="font-medium text-gray-900">
                              {listingData.locationName ||
                                "Getting location..."}
                            </p>
                            {listingData.location && (
                              <p className="text-sm text-gray-600">
                                {listingData.location.lat.toFixed(4)},{" "}
                                {listingData.location.lng.toFixed(4)}
                              </p>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => setShowLocationSearch(true)}
                          className="text-orange-600 hover:text-orange-700 text-sm font-medium"
                        >
                          Change Location
                        </button>
                      </div>
                    </div>

                    {showLocationSearch && (
                      <div className="border border-gray-200 rounded-lg p-4">
                        <div className="relative">
                          <input
                            type="text"
                            value={locationSearch}
                            onChange={(e) => {
                              setLocationSearch(e.target.value);
                              searchLocations(e.target.value);
                            }}
                            placeholder="Search for a location..."
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                          />
                          {isSearching && (
                            <div className="absolute right-3 top-3">
                              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                            </div>
                          )}
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
                                    suggestion.formatted_address !==
                                      suggestion.name && (
                                      <span className="text-gray-500 text-sm block truncate">
                                        {suggestion.formatted_address}
                                      </span>
                                    )}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}

                        <div className="mt-3 flex justify-end space-x-2">
                          <button
                            onClick={() => {
                              setShowLocationSearch(false);
                              setLocationSearch("");
                              setSuggestions([]);
                            }}
                            className="px-3 py-1 text-sm text-gray-600 hover:text-gray-700"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-between">
                <button
                  onClick={() => setCurrentStep(1)}
                  className="bg-gray-100 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-200 flex items-center space-x-2"
                >
                  <ArrowLeft className="w-5 h-5" />
                  <span>Back</span>
                </button>
                <button
                  onClick={() => setCurrentStep(3)}
                  disabled={!listingData.rent || !listingData.location}
                  className="bg-orange-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  <span>Next</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Room Measurement */}
          {currentStep === 3 && (
            <RoomMeasurement
              listingData={listingData}
              setListingData={setListingData}
              onNext={() => setCurrentStep(4)}
              onBack={() => setCurrentStep(2)}
            />
          )}

          {/* Step 4: Environment Check */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div className="text-center">
                <Sun className="w-16 h-16 text-orange-600 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Environment Check
                </h2>
                <p className="text-gray-600">
                  Let&apos;s measure the noise and light levels in your room
                </p>
              </div>

              {/* Noise Level */}
              <div className="border border-gray-200 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <Mic className="w-6 h-6 text-purple-600" />
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        Noise Level
                      </h3>
                      <p className="text-sm text-gray-600">
                        Measure ambient noise in your room
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-gray-900">
                      {listingData.noiseLevel}%
                    </p>
                  </div>
                </div>

                <div className="flex space-x-3">
                  {!noiseRecording ? (
                    <button
                      onClick={startNoiseRecording}
                      className="bg-purple-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-purple-700"
                    >
                      <Volume2 className="w-4 h-4" />
                      <span>Start Recording</span>
                    </button>
                  ) : (
                    <button
                      onClick={stopMicrophone}
                      className="bg-red-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-red-700"
                    >
                      <Pause className="w-4 h-4" />
                      <span>Stop Recording</span>
                    </button>
                  )}
                </div>

                {noiseRecording && (
                  <div className="mt-4 p-4 bg-purple-50 rounded-lg">
                    <div className="flex items-center space-x-2 text-purple-700">
                      <Mic className="w-5 h-5 animate-pulse" />
                      <span className="font-medium">
                        Recording ambient noise...
                      </span>
                    </div>
                    <div className="mt-2">
                      <div className="w-full bg-purple-200 rounded-full h-2">
                        <div
                          className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.min(listingData.noiseLevel, 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Light Level */}
              <div className="border border-gray-200 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex  space-x-3">
                    <Eye className="w-6 h-6 text-yellow-600" />
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        Light Level
                      </h3>
                      <div class="max-w-96">
                        <p class="text-sm text-gray-600 mb-2">
                          <strong>Measuring Natural Light in Your Room</strong>
                        </p>
                        <p class="text-sm text-gray-600">
                          To check ambient light levels, use your device&apos;s light
                          sensor (available on most smartphones). For a quick
                          test, cover the camera with your fingers—if the
                          display dims, the sensor is active.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-gray-900">
                      {listingData.lightLevel}%
                    </p>
                  </div>
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={startLightSensing}
                    disabled={lightSensing}
                    className="bg-yellow-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Camera className="w-4 h-4" />
                    <span>
                      {lightSensing ? "Capturing..." : "Capture Light Level"}
                    </span>
                  </button>
                </div>

                {lightSensing && (
                  <div className="mt-4 p-4 bg-yellow-50 rounded-lg">
                    <div className="flex items-center space-x-2 text-yellow-700">
                      <Sun className="w-5 h-5 animate-pulse" />
                      <span className="font-medium">
                        Capturing light level...
                      </span>
                    </div>
                    <p className="text-sm text-yellow-600 mt-1">
                      Make sure your camera is pointing toward the room
                    </p>
                  </div>
                )}
              </div>

              {/* Environment Summary */}
              {(listingData.noiseLevel > 0 || listingData.lightLevel > 0) && (
                <div className="bg-orange-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-900 mb-2">
                    Environment Summary
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Noise Level</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {listingData.noiseLevel} %
                      </p>
                      <p className="text-xs text-gray-500">
                        {listingData.noiseLevel < 20
                          ? "Very Quiet"
                          : listingData.noiseLevel < 40
                          ? "Quiet"
                          : listingData.noiseLevel < 60
                          ? "Moderate"
                          : listingData.noiseLevel < 80
                          ? "Noisy"
                          : "Very Noisy"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Light Level</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {listingData.lightLevel}%
                      </p>
                      <p className="text-xs text-gray-500">
                        {listingData.lightLevel < 30
                          ? "Dim"
                          : listingData.lightLevel < 70
                          ? "Moderate"
                          : "Bright"}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-between">
                <button
                  onClick={() => setCurrentStep(3)}
                  className="bg-gray-100 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-200 flex items-center space-x-2"
                >
                  <ArrowLeft className="w-5 h-5" />
                  <span>Back</span>
                </button>
                <button
                  onClick={() => setCurrentStep(5)}
                  disabled={
                    listingData.noiseLevel === 0 && listingData.lightLevel === 0
                  }
                  className="bg-orange-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  <span>Next</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* Step 5: Review & Submit */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <div className="text-center">
                <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Review & Submit
                </h2>
                <p className="text-gray-600">
                  Review your listing details before publishing
                </p>
              </div>

              <div className="space-y-6">
                {/* Basic Details */}
                <div className="border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Basic Details
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Title</p>
                      <p className="font-medium text-gray-900">
                        {listingData.title}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Room Type</p>
                      <p className="font-medium text-gray-900">
                        {listingData.roomType}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Monthly Rent</p>
                      <p className="font-medium text-gray-900">
                        ${listingData.rent}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Location</p>
                      <p className="font-medium text-gray-900">
                        {listingData.locationName}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <p className="text-sm text-gray-600">Description</p>
                    <p className="font-medium text-gray-900">
                      {listingData.description}
                    </p>
                  </div>
                  {listingData.amenities.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm text-gray-600">Amenities</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {listingData.amenities.map((amenity, index) => (
                          <span
                            key={index}
                            className="bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-sm"
                          >
                            {amenity}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Room Measurements */}
                <div className="border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Room Measurements
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Length</p>
                      <p className="font-medium text-gray-900">
                        {listingData.roomSize.length} ft
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Width</p>
                      <p className="font-medium text-gray-900">
                        {listingData.roomSize.width} ft
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Total Carpet Area</p>
                      <p className="font-medium text-gray-900">
                        {listingData.roomSize.area}
                        sq ft
                      </p>
                    </div>
                  </div>
                </div>

                {/* Environment */}
                <div className="border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Environment
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Noise Level</p>
                      <p className="font-medium text-gray-900">
                        {listingData.noiseLevel} dB
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Light Level</p>
                      <p className="font-medium text-gray-900">
                        {listingData.lightLevel}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-between">
                <button
                  onClick={() => setCurrentStep(4)}
                  className="bg-gray-100 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-200 flex items-center space-x-2"
                >
                  <ArrowLeft className="w-5 h-5" />
                  <span>Back</span>
                </button>
                <button
                  onClick={() => setCurrentStep(6)}
                  className="bg-orange-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-orange-700 flex items-center space-x-2"
                >
                  <span>Next</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
          {/* Step 6: Photos */}
          {currentStep === 6 && (
            <div className="space-y-6">
              <div className="text-center">
                <Camera className="w-16 h-16 text-orange-600 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Upload Photos
                </h2>
                <p className="text-gray-600">
                  Add photos to make your listing more attractive
                </p>
              </div>

              <div className="space-y-4">
                {/* Upload Button */}
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e.target.files)}
                    className="hidden"
                  />
                  <Camera className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-lg font-medium text-gray-900 mb-2">
                    Upload Room Photos
                  </p>
                  <p className="text-sm text-gray-600 mb-4">
                    Add multiple photos to showcase your room
                  </p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImages}
                    className="bg-orange-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 mx-auto"
                  >
                    {uploadingImages ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Camera className="w-5 h-5" />
                    )}
                    <span>
                      {uploadingImages ? "Uploading..." : "Choose Photos"}
                    </span>
                  </button>
                </div>

                {/* Image Preview */}
                {listingData.images.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Uploaded Photos ({listingData.images.length})
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {listingData.images.map((image, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={image}
                            alt={`Room photo ${index + 1}`}
                            className="w-full h-32 object-cover rounded-lg"
                          />
                          <button
                            onClick={() => removeImage(index)}
                            className="absolute top-2 right-2 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-between">
                <button
                  onClick={() => setCurrentStep(5)}
                  className="bg-gray-100 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-200 flex items-center space-x-2"
                >
                  <ArrowLeft className="w-5 h-5" />
                  <span>Back</span>
                </button>
                <button
                  onClick={submitListing}
                  disabled={submitting}
                  className="bg-green-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {submitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Save className="w-5 h-5" />
                  )}
                  <span>
                    {submitting ? "Publishing..." : "Publish Listing"}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ListingPage;
