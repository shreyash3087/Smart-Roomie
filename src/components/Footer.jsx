"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Home,
  Search,
  Heart,
  MessageCircle,
  Plus,
  User,
  MapPin,
  Shield,
  LogOut,
  Clock,
  Target,
  Users,
} from "lucide-react";
import { logout } from "../../utils/firebase";
import { useUser } from "../../utils/context";

const Footer = ({ 
  handleListRoom, 
  getCurrentLocation 
}) => {
  const router = useRouter();
  const { activeTab, handleTabChange } = useUser();
  const [currentDate, setCurrentDate] = useState('');

  // Fix hydration error by only setting date on client side
  useEffect(() => {
    setCurrentDate(new Date().toLocaleDateString());
  }, []);

  const handleSignOut = async () => {
    try {
      await logout();
      router.push("/");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <footer className="bg-white border-t border-gray-200 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-orange-600 rounded-full flex items-center justify-center">
                <Home className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-bold text-gray-900">
                Smart Roomie
              </span>
            </div>
            <p className="text-gray-600 text-sm leading-relaxed">
              Find your perfect roommate match with intelligent compatibility
              scoring and secure connections.
            </p>
            <div className="flex space-x-4">
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center hover:bg-orange-100 transition-colors cursor-pointer group">
                <Heart className="w-5 h-5 text-gray-600 group-hover:text-orange-600" />
              </div>
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center hover:bg-orange-100 transition-colors cursor-pointer group">
                <MessageCircle className="w-5 h-5 text-gray-600 group-hover:text-orange-600" />
              </div>
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center hover:bg-orange-100 transition-colors cursor-pointer group">
                <Users className="w-5 h-5 text-gray-600 group-hover:text-orange-600" />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
              Platform
            </h3>
            <ul className="space-y-3">
              <li>
                <button
                  onClick={() => handleTabChange("explore")}
                  className="text-gray-600 hover:text-orange-600 transition-colors text-sm flex items-center space-x-2"
                >
                  <Search className="w-4 h-4" />
                  <span>Explore Rooms</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleTabChange("matches")}
                  className="text-gray-600 hover:text-orange-600 transition-colors text-sm flex items-center space-x-2"
                >
                  <Heart className="w-4 h-4" />
                  <span>Find Matches</span>
                </button>
              </li>
              <li>
                <button
                  onClick={handleListRoom}
                  className="text-gray-600 hover:text-orange-600 transition-colors text-sm flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>List Your Room</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleTabChange("messages")}
                  className="text-gray-600 hover:text-orange-600 transition-colors text-sm flex items-center space-x-2"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Messages</span>
                </button>
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
              Account
            </h3>
            <ul className="space-y-3">
              <li>
                <button
                  onClick={() => handleTabChange("profile")}
                  className="text-gray-600 hover:text-orange-600 transition-colors text-sm flex items-center space-x-2"
                >
                  <User className="w-4 h-4" />
                  <span>Your Profile</span>
                </button>
              </li>
              <li>
                <button
                  onClick={getCurrentLocation}
                  className="text-gray-600 hover:text-orange-600 transition-colors text-sm flex items-center space-x-2"
                >
                  <MapPin className="w-4 h-4" />
                  <span>Location Settings</span>
                </button>
              </li>
              <li>
                <div className="text-gray-600 text-sm flex items-center space-x-2">
                  <Shield className="w-4 h-4" />
                  <span>Privacy & Safety</span>
                </div>
              </li>
              <li>
                <button
                  onClick={handleSignOut}
                  className="text-gray-600 hover:text-red-600 transition-colors text-sm flex items-center space-x-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
              Smart Features
            </h3>
            <ul className="space-y-3">
              <li className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-gray-600 text-sm">
                  AI Compatibility Matching
                </span>
              </li>
              <li className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                <span className="text-gray-600 text-sm">
                  Real-time Location Services
                </span>
              </li>
              <li className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
                <span className="text-gray-600 text-sm">
                  Secure Messaging
                </span>
              </li>
              <li className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                <span className="text-gray-600 text-sm">
                  Verified Profiles
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-200">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="flex items-center space-x-6">
              <p className="text-sm text-gray-500">
                © 2024 Smart Roomie. All rights reserved.
              </p>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-gray-500">
                  All systems operational
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <Clock className="w-4 h-4" />
                <span>
                  Last updated: {currentDate || 'Loading...'}
                </span>
              </div>
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <Target className="w-4 h-4" />
                <span>Version 1.0.0</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;