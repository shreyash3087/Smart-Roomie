import Spline from "@splinetool/react-spline";
import { useState, useEffect } from "react";

const AnimatedFeatures = () => {
  const [currentFeature, setCurrentFeature] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const features = [
    {
      title: "AI-Powered Matching",
      description:
        "Our smart algorithm analyzes your lifestyle preferences to find the perfect roommate match",
    },
    {
      title: "AR Room Scanner",
      description:
        "Use your phone's camera to scan and create detailed 3D floor plans of available rooms",
    },
    {
      title: "Verified Profiles",
      description:
        "Biometric authentication ensures all users are verified for your safety and security",
    },
    {
      title: "Smart Chat Assistant",
      description:
        "AI-powered chat helps mediate conversations and suggests compatibility insights",
    },
    {
      title: "Safe Meet-ups",
      description:
        "Location sharing and proximity detection ensure secure in-person meetings",
    },
    {
      title: "Smart Living Hub",
      description:
        "Manage rent, chores, and bills with intelligent automation and gentle reminders",
    },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentFeature((prev) => (prev + 1) % features.length);
        setIsAnimating(false);
      }, 200);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const feature = features[currentFeature];

  return (
    <div className="text-center p-8 z-40 max-w-md mx-auto">
      <div className="max-lg:hidden w-[400px] h-[400px] rounded-3xl flex items-center justify-center mb-6">
        <Spline scene="/scene.splinecode" />
      </div>
      <div
        className={`transform transition-all duration-500 ${
          isAnimating ? "translate-y-4 opacity-0" : "translate-y-0 opacity-100"
        }`}
      >
        <h3 className="text-2xl font-bold text-white mb-3">{feature.title}</h3>
        <p className="text-white leading-relaxed">{feature.description}</p>
      </div>
      <div className="flex justify-center space-x-2 mt-8">
        {features.map((_, index) => (
          <div
            key={index}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              index === currentFeature
                ? "bg-orange-300 w-6"
                : "bg-gray-100 hover:bg-gray-200"
            }`}
          />
        ))}
      </div>
    </div>
  );
};


export default AnimatedFeatures;