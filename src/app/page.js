"use client";
import React, { useState, useEffect } from "react";
import {
  ArrowRight,
  Home,
  Users,
  Clock,
  Heart,
  Volume2,
  UserPlus,
  Loader2,
  Rocket,
  Shield,
  Star,
  Coffee,
  Gamepad2,
  Book,
  Music,
  Palette,
  Check,
  Eye,
  EyeOff,
} from "lucide-react";
import { useRef } from "react";
import AnimatedFeatures from "@/components/AnimatedFeatures";
import { useRouter } from "next/navigation";
import {
  auth,
  signInWithGoogle,
  signUpWithEmail,
  getUserProfile,
  createUserProfile,
  checkUserExists,
  signInWithEmail,
} from "../../utils/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { onAuthStateChanged } from "firebase/auth";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Spline from "@splinetool/react-spline";
const questions = [
  {
    question: "How would you describe your cleanliness level?",
    type: "select",
    key: "cleanlinessLevel",
    options: [
      {
        value: "Very Clean",
        desc: "Everything has its place, spotless spaces",
        icon: <Star className="w-5 h-5" />,
      },
      {
        value: "Clean",
        desc: "Tidy and organized, regular cleaning",
        icon: <Home className="w-5 h-5" />,
      },
      {
        value: "Moderate",
        desc: "Clean but lived-in, weekly tidying",
        icon: <Coffee className="w-5 h-5" />,
      },
      {
        value: "Relaxed",
        desc: "Comfortable with some mess",
        icon: <Book className="w-5 h-5" />,
      },
    ],
  },
  {
    question: "What's your social style?",
    type: "select",
    key: "socialStyle",
    options: [
      {
        value: "Very Social",
        desc: "Love meeting new people, frequent gatherings",
        icon: <Users className="w-5 h-5" />,
      },
      {
        value: "Moderately Social",
        desc: "Enjoy company but also need alone time",
        icon: <Coffee className="w-5 h-5" />,
      },
      {
        value: "Prefer Privacy",
        desc: "Quiet interactions, value personal space",
        icon: <Book className="w-5 h-5" />,
      },
      {
        value: "Rarely Home",
        desc: "Busy lifestyle, often out and about",
        icon: <Rocket className="w-5 h-5" />,
      },
    ],
  },
  {
    question: "What's your typical sleep schedule?",
    type: "select",
    key: "sleepSchedule",
    options: [
      {
        value: "Early Bird (9pm-6am)",
        desc: "Early to bed, early to rise",
        icon: <Clock className="w-5 h-5" />,
      },
      {
        value: "Normal (11pm-7am)",
        desc: "Standard sleep hours",
        icon: <Home className="w-5 h-5" />,
      },
      {
        value: "Night Owl (1am-9am)",
        desc: "Late nights, sleep in mornings",
        icon: <Music className="w-5 h-5" />,
      },
      {
        value: "Irregular",
        desc: "Varies based on schedule",
        icon: <Palette className="w-5 h-5" />,
      },
    ],
  },
  {
    question: "What's your preference regarding pets?",
    type: "select",
    key: "petPreference",
    options: [
      {
        value: "Love Pets",
        desc: "The more furry friends, the better",
        icon: <Heart className="w-5 h-5" />,
      },
      {
        value: "Cat Friendly",
        desc: "Cats are great companions",
        icon: <Coffee className="w-5 h-5" />,
      },
      {
        value: "Dog Friendly",
        desc: "Dogs bring joy and energy",
        icon: <Gamepad2 className="w-5 h-5" />,
      },
      {
        value: "No Pets",
        desc: "Prefer a pet-free environment",
        icon: <Home className="w-5 h-5" />,
      },
      {
        value: "Allergic",
        desc: "Have allergies to pets",
        icon: <Shield className="w-5 h-5" />,
      },
    ],
  },
  {
    question: "How do you handle noise levels?",
    type: "select",
    key: "noiseLevel",
    options: [
      {
        value: "Need Quiet",
        desc: "Silence is golden, peaceful environment",
        icon: <Book className="w-5 h-5" />,
      },
      {
        value: "Moderate Noise OK",
        desc: "Normal household sounds are fine",
        icon: <Volume2 className="w-5 h-5" />,
      },
      {
        value: "Don't Mind Noise",
        desc: "Adaptable to various sound levels",
        icon: <Music className="w-5 h-5" />,
      },
      {
        value: "Love Lively Environment",
        desc: "Enjoy an active, bustling home",
        icon: <Gamepad2 className="w-5 h-5" />,
      },
    ],
  },
  {
    question: "How often do you have guests over?",
    type: "select",
    key: "guests",
    options: [
      {
        value: "Rarely",
        desc: "Home is my private sanctuary",
        icon: <Home className="w-5 h-5" />,
      },
      {
        value: "Occasionally",
        desc: "Friends over once or twice a month",
        icon: <Coffee className="w-5 h-5" />,
      },
      {
        value: "Frequently",
        desc: "Regular social gatherings",
        icon: <Users className="w-5 h-5" />,
      },
      {
        value: "Almost Daily",
        desc: "Always have people around",
        icon: <UserPlus className="w-5 h-5" />,
      },
    ],
  },
];

const OnboardingApp = () => {
  const [currentStep, setCurrentStep] = useState("loading");
  const [user, loading, error] = useAuthState(auth);
  const [authLoading, setAuthLoading] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    age: "",
    signupPassword: "",
    profileImage: "",
    cleanlinessLevel: "",
    socialStyle: "",
    sleepSchedule: "",
    petPreference: "",
    noiseLevel: "",
    guests: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const Router = useRouter();
  const [onboardingType, setOnboardingType] = useState("");
  const [conversationHistory, setConversationHistory] = useState([]);
  const [currentLLMResponse, setCurrentLLMResponse] = useState("");
  const [isLLMLoading, setIsLLMLoading] = useState(false);
  const [llmPreferences, setLlmPreferences] = useState([]);

  const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const userExists = await checkUserExists(currentUser.uid);
          if (!userExists) {
            setIsNewUser(true);
            setFormData((prev) => ({
              ...prev,
              name: currentUser.displayName || "",
              email: currentUser.email || "",
              profileImage: currentUser.photoURL || "",
            }));
          } else {
            Router.push("/dashboard");
          }
        } catch (error) {
          console.error("Error checking user:", error);
        }
      }
    });

    return () => unsubscribe();
  }, []);
  const callGemini = async (messages) => {
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
      const prompt = messages
        .map((msg) => {
          if (msg.role === "system") return msg.content;
          if (msg.role === "user") return `User: ${msg.content}`;
          if (msg.role === "assistant") return `Assistant: ${msg.content}`;
          return msg.content;
        })
        .join("\n\n");

      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error("Gemini API Error:", error);
      return "I'm having trouble connecting right now. Let's try a different approach.";
    }
  };

  const generatePreferencesFromConversation = async (conversationText) => {
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

      const prompt = `You are a roommate matching assistant. Based on the conversation, extract key lifestyle preferences and return them as comma-separated values. Focus on: cleanliness level, social style, sleep schedule, pet preference, noise tolerance, guest frequency, and any other relevant lifestyle factors. Return only the comma-separated values without explanations.

Based on this conversation about roommate preferences, extract the key lifestyle traits: ${conversationText}`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response
        .text()
        .split(",")
        .map((item) => item.trim());
    } catch (error) {
      console.error("Preferences generation error:", error);
      return ["moderate_cleanliness", "balanced_social", "normal_schedule"];
    }
  };

  const handleLLMConversation = async (userMessage) => {
    setIsLLMLoading(true);

    const newHistory = [
      ...conversationHistory,
      { role: "user", content: userMessage },
    ];

    const systemPrompt = {
      role: "system",
      content: `You are a friendly roommate matching assistant helping someone find their perfect roommate. Ask engaging questions about their lifestyle, preferences, and living habits. Keep responses conversational, warm, and under 100 words. Focus on: cleanliness habits, social preferences, sleep schedule, pets, noise tolerance, guests, and daily routines. After 4-5 exchanges, wrap up naturally.`,
    };

    try {
      const response = await callGemini([systemPrompt, ...newHistory]);

      const updatedHistory = [
        ...newHistory,
        { role: "assistant", content: response },
      ];

      setConversationHistory(updatedHistory);
      setCurrentLLMResponse(response);
      if (updatedHistory.filter((msg) => msg.role === "user").length >= 4) {
        const conversationText = updatedHistory
          .filter((msg) => msg.role === "user")
          .map((msg) => msg.content)
          .join(" ");

        const preferences = await generatePreferencesFromConversation(
          conversationText
        );
        setLlmPreferences(preferences);
      }
    } catch (error) {
      console.error("LLM Conversation Error:", error);
      setCurrentLLMResponse(
        "I'd love to learn more about your preferences! Could you tell me about your ideal living situation?"
      );
    } finally {
      setIsLLMLoading(false);
    }
  };
  const handleGoogleSignIn = async () => {
    setAuthLoading(true);
    try {
      const user = await signInWithGoogle();
      const userProfile = await getUserProfile(user.uid);
      if (!userProfile || !userProfile.preferences) {
        setIsNewUser(true);
        setFormData((prev) => ({
          ...prev,
          name: user.displayName || "",
          email: user.email || "",
          profileImage: user.photoURL || "",
        }));
        setCurrentStep("onboarding-type");
      } else {
        Router.push("/dashboard");
      }
    } catch (error) {
      console.error("Google sign in failed:", error);
      setErrors((prev) => ({
        ...prev,
        general: "Google sign in failed. Please try again.",
      }));
    } finally {
      setAuthLoading(false);
    }
  };
  const handleEmailSignIn = async () => {
    setAuthLoading(true);
    try {
      const user = await signInWithEmail(
        formData.loginEmail,
        formData.password
      );

      const userProfile = await getUserProfile(user.uid);
      if (!userProfile || !userProfile.preferences) {
        setIsNewUser(true);
        setFormData((prev) => ({
          ...prev,
          name: user.displayName || "",
          email: user.email || "",
          profileImage: user.photoURL || "",
        }));
        setCurrentStep("onboarding-type");
      } else {
        Router.push("/dashboard");
      }
    } catch (error) {
      console.error("Email sign in failed:", error);
      let errorMessage = "Sign in failed. Please try again.";
      if (error.code === "auth/user-not-found") {
        errorMessage =
          "No account found with this email. Please sign up first.";
      } else if (error.code === "auth/wrong-password") {
        errorMessage = "Incorrect password. Please try again.";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Please enter a valid email address.";
      }

      setErrors((prev) => ({
        ...prev,
        general: errorMessage,
      }));
    } finally {
      setAuthLoading(false);
    }
  };
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password) => {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    return {
      minLength: password.length >= minLength,
      hasUpperCase,
      hasLowerCase,
      hasNumbers,
      hasSpecialChar,
      isValid:
        password.length >= minLength &&
        hasUpperCase &&
        hasLowerCase &&
        hasNumbers &&
        hasSpecialChar,
    };
  };

  const validateAge = (age) => {
    const numAge = parseInt(age);
    return numAge >= 0 && numAge <= 120;
  };
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentStep("intro");
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  const handleNext = async () => {
    setIsAnimating(true);

    setTimeout(async () => {
      if (currentStep === "intro") {
        setCurrentStep("login");
      } else if (currentStep === "login") {
        setCurrentStep("personal");
      } else if (currentStep === "personal") {
        setCurrentStep("personal-pass");
      } else if (currentStep === "personal-pass") {
        setAuthLoading(true);
        try {
          const user = await signUpWithEmail(
            formData.email,
            formData.signupPassword
          );
          setCurrentStep("onboarding-type");
        } catch (error) {
          console.error("Email sign up failed:", error);

          let errorMessage = "Sign up failed. Please try again.";
          if (error.code === "auth/email-already-in-use") {
            errorMessage =
              "An account with this email already exists. Please login instead.";
          } else if (error.code === "auth/weak-password") {
            errorMessage =
              "Password is too weak. Please choose a stronger password.";
          } else if (error.code === "auth/invalid-email") {
            errorMessage = "Please enter a valid email address.";
          }

          setErrors((prev) => ({
            ...prev,
            general: errorMessage,
          }));
        } finally {
          setAuthLoading(false);
        }
      } else if (currentStep === "questions") {
        if (currentQuestionIndex < questions.length - 1) {
          setCurrentQuestionIndex(currentQuestionIndex + 1);
        } else {
          setCurrentStep("complete");
        }
      }
      setIsAnimating(false);
    }, 300);
  };

  const handleBack = () => {
    setIsAnimating(true);

    setTimeout(() => {
      if (currentStep === "login") {
        setCurrentStep("intro");
      } else if (currentStep === "personal") {
        setCurrentStep("login");
      } else if (currentStep === "personal-pass") {
        setCurrentStep("personal");
      } else if (currentStep === "questions") {
        if (currentQuestionIndex > 0) {
          setCurrentQuestionIndex(currentQuestionIndex - 1);
        } else {
          setCurrentStep("personal-pass");
        }
      }
      setIsAnimating(false);
    }, 300);
  };

  const handleComplete = async () => {
    if (!auth.currentUser) return;

    setAuthLoading(true);
    try {
      const {
        loginEmail,
        signupPassword,
        confirmPassword,
        cleanlinessLevel,
        socialStyle,
        sleepSchedule,
        petPreference,
        noiseLevel,
        guests,
        ...cleanFormData
      } = formData;

      let preferences = {};

      if (onboardingType === "conversational") {
        preferences = {
          type: "conversational",
          semanticTags: llmPreferences,
          conversationSummary: conversationHistory
            .filter((msg) => msg.role === "user")
            .map((msg) => msg.content)
            .join(" "),
        };
      } else {
        preferences = {
          type: "structured",
          cleanlinessLevel,
          socialStyle,
          sleepSchedule,
          petPreference,
          noiseLevel,
          guests,
        };
      }

      const userData = {
        ...cleanFormData,
        uid: auth.currentUser.uid,
        profileImage: formData.profileImage || auth.currentUser.photoURL || "",
        preferences,
      };

      await createUserProfile(auth.currentUser.uid, userData);
      setCurrentStep("complete");
    } catch (error) {
      console.error("Error creating user profile:", error);
      setErrors((prev) => ({
        ...prev,
        general: "Failed to create profile. Please try again.",
      }));
    } finally {
      setAuthLoading(false);
    }
  };

  const canProceed = () => {
    if (currentStep === "login") {
      return (
        formData.loginEmail &&
        formData.password &&
        validateEmail(formData.loginEmail) &&
        !errors.loginEmail
      );
    } else if (currentStep === "personal") {
      return (
        formData.name &&
        formData.email &&
        formData.age &&
        validateEmail(formData.email) &&
        validateAge(formData.age) &&
        !errors.email &&
        !errors.age
      );
    } else if (currentStep === "personal-pass") {
      const passwordValidation = validatePassword(formData.signupPassword);
      return (
        formData.signupPassword &&
        formData.confirmPassword &&
        formData.signupPassword === formData.confirmPassword &&
        passwordValidation.isValid &&
        !errors.signupPassword &&
        !errors.confirmPassword
      );
    } else if (currentStep === "questions") {
      const currentQuestion = questions[currentQuestionIndex];
      return formData[currentQuestion.key];
    }
    return true;
  };

  const gradientRef = useRef(null);
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e) => {
    if (gradientRef.current) {
      const rect = gradientRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setCursorPosition({ x, y });
    }
  };

  const handleInputChange = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: "" }));
    }

    if (key === "email" || key === "loginEmail") {
      if (value && !validateEmail(value)) {
        setErrors((prev) => ({
          ...prev,
          [key]: "Please enter a valid email address",
        }));
      }
    } else if (key === "age") {
      if (value && !validateAge(value)) {
        setErrors((prev) => ({
          ...prev,
          [key]: "Age must be between 0 and 120",
        }));
      }
    } else if (key === "signupPassword") {
      const validation = validatePassword(value);
      if (value && !validation.isValid) {
        setErrors((prev) => ({
          ...prev,
          [key]:
            "Password must be at least 8 characters with uppercase, lowercase, number, and special character",
        }));
      }
    } else if (key === "confirmPassword") {
      if (value && value !== formData.signupPassword) {
        setErrors((prev) => ({ ...prev, [key]: "Passwords do not match" }));
      }
    }
  };

  if (currentStep === "loading") {
    return (
      <div className="h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-orange-600 animate-spin mx-auto mb-4" />
          <p className="text-orange-700 font-medium">
            Waking Up Smart Roomie...
          </p>
        </div>
      </div>
    );
  }

  if (currentStep === "complete") {
    return (
      <div className="h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl font-medium text-gray-800 mb-2">
            Profile Complete!
          </h2>
          <p className="text-gray-600 mt-4 mb-8">
            We&apos;ve got everything we need to find your{" "}
            <span className="font-semibold text-orange-600">
              perfect roommate match
            </span>
            .
          </p>
          <button
            onClick={() => {
              Router.push("/dashboard");
            }}
            className="w-full bg-gradient-to-r from-orange-600 to-amber-500 text-white font-medium py-4 px-6 rounded-lg hover:from-orange-700 hover:to-amber-600 transition-all"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 lg:flex">
      <div className="absolute top-6 left-6 flex items-center space-x-2 z-10">
        <div className="w-12 h-12 bg-orange-600 rounded-full flex items-center justify-center">
          <Home className="w-6 h-6 text-white" />
        </div>
        <span className="text-lg font-medium text-orange-700">
          Smart Roomie
        </span>
      </div>
      {currentStep === "questions" && (
        <div className="fixed top-0 left-0 right-0 h-1 bg-gray-200 z-20">
          <div
            className="h-full bg-gradient-to-r from-orange-600 to-amber-500 transition-all duration-500"
            style={{
              width: `${
                ((currentQuestionIndex + 1) / questions.length) * 100
              }%`,
            }}
          />
        </div>
      )}

      <div className="w-full lg:w-1/2 flex flex-col justify-center p-8 pt-20 min-h-screen">
        {currentStep === "intro" && (
          <div
            className={`max-w-md w-full mx-auto transform transition-all duration-500 ${
              isAnimating ? "scale-95 opacity-0" : "scale-100 opacity-100"
            }`}
          >
            <div className="mb-8">
              <h1 className="text-3xl lg:text-4xl font-timesnewroman text-gray-800 leading-tight">
                Find the perfect roommate with our smart matching system
              </h1>
              <p className="text-gray-500 text-lg leading-relaxed mt-4">
                Answer a few questions about your lifestyle and preferences.
                We&apos;ll match you with compatible roommates in your area.
              </p>
            </div>

            <div
              onClick={handleNext}
              className="flex items-center space-x-2 text-orange-600 cursor-pointer hover:text-orange-700 transition-colors"
            >
              <ArrowRight className="w-5 h-5" />
              <span className="text-lg font-medium">Let&apos;s get started</span>
            </div>
          </div>
        )}
        {(currentStep === "login" ||
          currentStep === "personal" ||
          currentStep === "personal-pass" ||
          currentStep === "questions") && (
          <button
            onClick={handleBack}
            className="max-w-md w-full mx-auto mb-4 flex justify-end space-x-2 text-gray-500 hover:text-gray-800 transition-colors"
          >
            <ArrowRight className="w-4 h-4 rotate-180" />
            <span className="text-sm font-medium">Go Back</span>
          </button>
        )}
        {currentStep === "login" && (
          <div
            className={`max-w-md w-full mx-auto transform transition-all duration-500 ${
              isAnimating ? "scale-95 opacity-0" : "scale-100 opacity-100"
            }`}
          >
            <div className="mb-8">
              <h2 className="text-3xl font-medium text-gray-800 mb-2">
                Welcome back
              </h2>
              <p className="text-gray-600">
                Sign in to your account to continue
              </p>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={formData.loginEmail}
                  onChange={(e) =>
                    handleInputChange("loginEmail", e.target.value)
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Enter your email"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) =>
                      handleInputChange("password", e.target.value)
                    }
                    className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
            {errors.general && (
              <div className=" text-red-700 px-4 py-3 rounded mb-4">
                {errors.general}
              </div>
            )}
            <button
              onClick={handleEmailSignIn}
              disabled={!canProceed()}
              className="w-full bg-gradient-to-r from-orange-600 to-amber-500 text-white font-medium py-4 px-6 rounded-lg hover:from-orange-700 hover:to-amber-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-8"
            >
              Sign In
            </button>

            <div className="mt-4">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-gradient-to-br from-amber-50 to-orange-100 text-gray-500">
                    Or continue with
                  </span>
                </div>
              </div>

              <button
                onClick={handleGoogleSignIn}
                disabled={authLoading}
                className="w-full mt-4 bg-white border border-gray-300 text-gray-700 font-medium py-3 px-6 rounded-lg hover:bg-gray-50 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {authLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    <span>Continue with Google</span>
                  </>
                )}
              </button>
            </div>

            <p className="text-center text-sm text-gray-600 mt-6">
              Don&apos;t have an account?{" "}
              <button
                onClick={() => setCurrentStep("personal")}
                className="text-orange-600 hover:text-orange-700 font-medium"
              >
                Sign up here
              </button>
            </p>
          </div>
        )}
        {currentStep === "personal" && (
          <div
            className={`max-w-md w-full mx-auto transform transition-all duration-500 ${
              isAnimating ? "scale-95 opacity-0" : "scale-100 opacity-100"
            }`}
          >
            <div className="mb-8">
              <h2 className="text-3xl font-medium text-gray-800 mb-2">
                Let&apos;s get to know you
              </h2>
              <p className="text-gray-600">
                Tell us a bit about yourself to get started
              </p>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-4">
                <div className="bg-gradient-to-r from-orange-600 to-amber-500 h-2 rounded-full w-1/4"></div>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Enter your full name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
                    errors.email ? "border-red-500" : "border-gray-300"
                  }`}
                  placeholder="Enter your email"
                />
                {errors.email && (
                  <p className="text-red-500 text-sm mt-1">{errors.email}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Age
                </label>
                <input
                  type="number"
                  value={formData.age}
                  onChange={(e) => handleInputChange("age", e.target.value)}
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
                    errors.age ? "border-red-500" : "border-gray-300"
                  }`}
                  placeholder="Enter your age"
                  min="0"
                  max="120"
                />
                {errors.age && (
                  <p className="text-red-500 text-sm mt-1">{errors.age}</p>
                )}
              </div>
            </div>

            <button
              onClick={handleNext}
              disabled={!canProceed()}
              className="w-full bg-gradient-to-r from-orange-600 to-amber-500 text-white font-medium py-4 px-6 rounded-lg hover:from-orange-700 hover:to-amber-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-8"
            >
              Continue
            </button>
          </div>
        )}
        {currentStep === "personal-pass" && (
          <div
            className={`max-w-md w-full mx-auto transform transition-all duration-500 ${
              isAnimating ? "scale-95 opacity-0" : "scale-100 opacity-100"
            }`}
          >
            <div className="mb-8">
              <h2 className="text-3xl font-medium text-gray-800 mb-2">
                Create your password
              </h2>
              <p className="text-gray-600">
                Choose a secure password for your account
              </p>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-4">
                <div className="bg-gradient-to-r from-orange-600 to-amber-500 h-2 rounded-full w-1/2"></div>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showSignupPassword ? "text" : "password"}
                    value={formData.signupPassword}
                    onChange={(e) =>
                      handleInputChange("signupPassword", e.target.value)
                    }
                    className={`w-full px-4 py-3 pr-12 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
                      errors.signupPassword
                        ? "border-red-500"
                        : "border-gray-300"
                    }`}
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignupPassword(!showSignupPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showSignupPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
                {errors.signupPassword && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.signupPassword}
                  </p>
                )}
                {formData.signupPassword && (
                  <div className="mt-2 space-y-1">
                    {Object.entries(
                      validatePassword(formData.signupPassword)
                    ).map(([key, value], index) => {
                      if (key === "isValid") return null;
                      const labels = {
                        minLength: "At least 8 characters",
                        hasUpperCase: "One uppercase letter",
                        hasLowerCase: "One lowercase letter",
                        hasNumbers: "One number",
                        hasSpecialChar: "One special character",
                      };
                      return (
                        <div
                          key={key}
                          className={`flex items-center space-x-2 text-xs transition-all duration-300 ease-in-out transform ${
                            value
                              ? "text-green-600 scale-100"
                              : "text-gray-400 scale-95"
                          }`}
                          style={{
                            transitionDelay: `${index * 50}ms`,
                            opacity: 1,
                            animation: `slideIn 0.3s ease-out ${
                              index * 50
                            }ms both`,
                          }}
                        >
                          <div
                            className={`transition-all duration-200 ${
                              value ? "scale-110" : "scale-100"
                            }`}
                          >
                            <Check
                              className={`w-3 h-3 transition-colors duration-200 ${
                                value ? "text-green-600" : "text-gray-400"
                              }`}
                            />
                          </div>
                          <span className="transition-colors duration-200">
                            {labels[key]}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={formData.confirmPassword}
                    onChange={(e) =>
                      handleInputChange("confirmPassword", e.target.value)
                    }
                    className={`w-full px-4 py-3 pr-12 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
                      errors.confirmPassword
                        ? "border-red-500"
                        : "border-gray-300"
                    }`}
                    placeholder="Confirm your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.confirmPassword}
                  </p>
                )}
                {errors.general && (
                  <div className=" text-red-700 px-4 py-3 rounded-lg mt-4">
                    {errors.general}
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={handleNext}
              disabled={!canProceed()}
              className="w-full bg-gradient-to-r from-orange-600 to-amber-500 text-white font-medium py-4 px-6 rounded-lg hover:from-orange-700 hover:to-amber-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-8"
            >
              Continue
            </button>
          </div>
        )}
        {currentStep === "onboarding-type" && (
          <div
            className={`max-w-md w-full mx-auto transform transition-all duration-500 ${
              isAnimating ? "scale-95 opacity-0" : "scale-100 opacity-100"
            }`}
          >
            <div className="mb-8">
              <h2 className="text-3xl font-medium text-gray-800 mb-2">
                Let us get to know you better!
              </h2>
              <p className="text-gray-600">
                Choose the option that works best for you
              </p>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-4">
                <div className="bg-gradient-to-r from-orange-600 to-amber-500 h-2 rounded-full w-3/4"></div>
              </div>
            </div>

            <div className="space-y-4">
              <div
                onClick={() => {
                  setOnboardingType("conversational");
                  setCurrentStep("conversational");
                }}
                className="p-6 border-2 border-gray-200 rounded-lg cursor-pointer transition-all hover:border-orange-300 hover:bg-orange-50 group"
              >
                <div className="flex items-start space-x-4">
                  <div className="p-3 bg-orange-100 rounded-lg group-hover:bg-orange-200 transition-colors">
                    <Users className="w-6 h-6 text-orange-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-800 mb-2">
                      Tell Smart Roomie About Yourself
                    </h3>
                    <p className="text-gray-600 text-sm leading-relaxed">
                      Have a natural conversation with our AI assistant. Share
                      your lifestyle, habits, and preferences in your own words
                      for more accurate matching.
                    </p>
                    <div className="mt-3 flex items-center space-x-2 text-orange-600">
                      <span className="text-sm font-medium">More Accurate</span>
                      <div className="flex space-x-1">
                        <Star className="w-4 h-4 fill-current" />
                        <Star className="w-4 h-4 fill-current" />
                        <Star className="w-4 h-4 fill-current" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div
                onClick={() => {
                  setOnboardingType("quick");
                  setCurrentStep("questions");
                }}
                className="p-6 border-2 border-gray-200 rounded-lg cursor-pointer transition-all hover:border-orange-300 hover:bg-orange-50 group"
              >
                <div className="flex items-start space-x-4">
                  <div className="p-3 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                    <Clock className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-800 mb-2">
                      I&apos;m in a Hurry
                    </h3>
                    <p className="text-gray-600 text-sm leading-relaxed">
                      Answer quick multiple-choice questions about your
                      lifestyle and preferences. Get matched fast with basic
                      compatibility.
                    </p>
                    <div className="mt-3 flex items-center space-x-2 text-blue-600">
                      <span className="text-sm font-medium">Quick & Easy</span>
                      <Clock className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {currentStep === "conversational" && (
          <div className="h-screen flex flex-col">
            <div className="flex-1 flex flex-col lg:max-w-md w-full mx-auto py-8 px-0">
              <div className="mb-6">
                <h2 className="text-2xl font-medium text-gray-800 mb-2">
                  Let&apos;s Chat About Your Lifestyle
                </h2>
                <p className="text-gray-600 text-sm">
                  Tell me about yourself and I&apos;ll help find your perfect
                  roommate match
                </p>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-4 flex-1 overflow-y-auto mb-4">
                {conversationHistory.length === 0 ? (
                  <div className="text-center py-4 h-full flex flex-col items-center justify-center">
                    <div className="lg:hidden h-64 w-64 mb-4">
                      <Spline scene="/scene.splinecode" />
                    </div>
                    <p className="text-gray-600 text-sm">
                      Hi! I&apos;m Roomie, your smart assistant. Let&apos;s start by
                      getting to know each other. What&apos;s your ideal living
                      situation like?
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {conversationHistory.map((message, index) => (
                      <div
                        key={index}
                        className={`flex ${
                          message.role === "user"
                            ? "justify-end"
                            : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-xs px-3 py-2 rounded-lg text-sm ${
                            message.role === "user"
                              ? "bg-orange-500 text-white"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {message.content}
                        </div>
                      </div>
                    ))}
                    {isLLMLoading && (
                      <div className="flex justify-start">
                        <div className="bg-gray-100 text-gray-800 px-3 py-2 rounded-lg text-sm flex items-center space-x-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Thinking...</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    placeholder="Hi! I'm Roomie, your assistant. Tell me about your lifestyle..."
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    onKeyPress={(e) => {
                      if (e.key === "Enter" && e.target.value.trim()) {
                        handleLLMConversation(e.target.value.trim());
                        e.target.value = "";
                      }
                    }}
                  />
                  <button
                    onClick={(e) => {
                      const input = e.target
                        .closest("div")
                        .querySelector("input");
                      if (input.value.trim()) {
                        handleLLMConversation(input.value.trim());
                        input.value = "";
                      }
                    }}
                    className="px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                  >
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>

                {llmPreferences.length > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h4 className="font-medium text-green-800 mb-2">
                      Your Preferences Captured!
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {llmPreferences.map((pref, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs"
                        >
                          {pref}
                        </span>
                      ))}
                    </div>
                    <button
                      onClick={handleComplete}
                      className="w-full mt-4 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors"
                    >
                      Complete Profile
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {currentStep === "questions" && (
          <div
            className={`max-w-md w-full mx-auto transform transition-all duration-500 ${
              isAnimating ? "scale-95 opacity-0" : "scale-100 opacity-100"
            }`}
          >
            <div className="mb-8">
              <h2 className="text-3xl font-medium text-gray-800 mb-2">
                {questions[currentQuestionIndex].question}
              </h2>
              <p className="text-gray-600">
                Question {currentQuestionIndex + 1} of {questions.length} - Just
                a few questions to get to know you better
              </p>
            </div>

            <div className="space-y-4">
              {questions[currentQuestionIndex].options.map((option, index) => (
                <div
                  key={index}
                  onClick={() =>
                    handleInputChange(
                      questions[currentQuestionIndex].key,
                      option.value
                    )
                  }
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    formData[questions[currentQuestionIndex].key] ===
                    option.value
                      ? "border-orange-500 bg-orange-50"
                      : "border-gray-200 hover:border-orange-300 hover:bg-orange-50"
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <div
                      className={`p-2 rounded-lg ${
                        formData[questions[currentQuestionIndex].key] ===
                        option.value
                          ? "bg-orange-500 text-white"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {option.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium text-gray-800">
                          {option.value}
                        </h3>
                        {formData[questions[currentQuestionIndex].key] ===
                          option.value && (
                          <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full flex items-center space-x-1">
                            <Check className="w-3 h-3" />
                            <span>Selected</span>
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {option.desc}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={
                currentQuestionIndex === questions.length - 1
                  ? handleComplete
                  : handleNext
              }
              disabled={!canProceed()}
              className="w-full bg-gradient-to-r from-orange-600 to-amber-500 text-white font-medium py-4 px-6 rounded-lg hover:from-orange-700 hover:to-amber-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-8"
            >
              {currentQuestionIndex === questions.length - 1
                ? "Complete Profile"
                : "Next Question"}
            </button>
          </div>
        )}
      </div>

      <div
        className="w-1/2 hidden lg:flex items-center justify-center relative overflow-hidden"
        ref={gradientRef}
        onMouseMove={handleMouseMove}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[#ab2c15] to-[#b2431b]" />
        <div
          className="absolute inset-0 bg-[#F6AA1C] opacity-40"
          style={{
            maskImage: `radial-gradient(
        circle at ${cursorPosition.x}px ${cursorPosition.y}px, 
        rgba(0,0,0,1) 0%, 
        rgba(0,0,0,0) 70%
      )`,
            WebkitMaskImage: `radial-gradient(
        circle at ${cursorPosition.x}px ${cursorPosition.y}px, 
        rgba(0,0,0,1) 0%, 
        rgba(0,0,0,0) 70%
      )`,
          }}
        />
        <AnimatedFeatures />
      </div>
    </div>
  );
};

export default OnboardingApp;
