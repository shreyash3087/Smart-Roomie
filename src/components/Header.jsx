"use client";
import React from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Home,
  Search,
  Bell,
  User,
  Heart,
  MessageCircle,
  Menu,
  LogOut,
  X,
} from "lucide-react";
import { logout } from "../../utils/firebase";
import { useUser } from "../../utils/context";

const Header = () => {
  const router = useRouter();
  const {
    user,
    userProfile,
    activeTab,
    handleTabChange,
    showMobileMenu,
    setShowMobileMenu,
  } = useUser();
  const pathname = usePathname();
  if (pathname === "/") {
    return null;
  }
  const handleSignOut = async () => {
    try {
      await logout();
      router.push("/");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <>
      <header className="bg-white shadow-lg border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div
              className="flex items-center space-x-3 group cursor-pointer"
              onClick={() => router.push("/dashboard")}
            >
              <div className="w-10 h-10 bg-orange-600 rounded-full flex items-center justify-center group-hover:bg-orange-700 transition-colors">
                <Home className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900 group-hover:text-orange-600 transition-colors">
                Smart Roomie
              </span>
            </div>
            <nav className="hidden md:flex space-x-8">
              {[
                { id: "explore", label: "Explore", icon: Search },
                { id: "matches", label: "Matches", icon: Heart },
                { id: "messages", label: "Messages", icon: MessageCircle },
                { id: "profile", label: "Profile", icon: User },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleTabChange(item.id)}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 flex items-center space-x-2 ${
                    activeTab === item.id
                      ? "bg-orange-100 text-orange-600 shadow-sm"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Bell className="w-6 h-6 text-gray-600 hover:text-gray-900 cursor-pointer transition-colors" />
              </div>
              <div className="flex items-center space-x-3">
                <img
                  src={
                    userProfile?.profileImage ||
                    user?.photoURL ||
                    "/api/placeholder/40/40"
                  }
                  alt={userProfile?.name || "User"}
                  className="w-8 h-8 rounded-full object-cover cursor-pointer border-2 border-orange-200 hover:border-orange-400 transition-colors"
                />
                <button
                  onClick={handleSignOut}
                  className="hidden md:flex items-center space-x-2 text-gray-600 hover:text-red-600 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="text-sm">Sign Out</span>
                </button>
              </div>
              <button
                className="md:hidden"
                onClick={() => setShowMobileMenu(!showMobileMenu)}
              >
                {showMobileMenu ? (
                  <X className="w-6 h-6 text-gray-600" />
                ) : (
                  <Menu className="w-6 h-6 text-gray-600" />
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {showMobileMenu && (
        <div className="md:hidden bg-white border-b border-gray-200 shadow-lg">
          <nav className="px-4 py-2 space-y-1">
            {[
              { id: "explore", label: "Explore", icon: Search },
              { id: "matches", label: "Matches", icon: Heart },
              { id: "messages", label: "Messages", icon: MessageCircle },
              { id: "profile", label: "Profile", icon: User },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => handleTabChange(item.id)}
                className={`flex items-center space-x-3 w-full px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === item.id
                    ? "bg-orange-100 text-orange-600"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            ))}
            <button
              onClick={handleSignOut}
              className="flex items-center space-x-3 w-full px-3 py-2 rounded-md text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </nav>
        </div>
      )}
    </>
  );
};

export default Header;
