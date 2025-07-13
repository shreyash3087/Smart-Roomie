import React, { useState, useEffect } from "react";
import {
  MessageCircle,
  Send,
  User,
  Search,
  X,
  Plus,
  ChevronLeft,
  MoreVertical,
  AlertCircle,
  Shield,
  FileText,
  Bot,
  DollarSign,
  MapPin,
  CheckCircle,
} from "lucide-react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  doc,
  updateDoc,
  getDocs,
  writeBatch,
  Timestamp,
  getDoc,
} from "firebase/firestore";
import { db, storage } from "../../utils/firebase";
import { Download } from "lucide-react";
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from "firebase/storage";

const Messages = ({ user, userProfile }) => {
  const [conversations, setConversations] = useState([]);
  const [isCurrentUserLister, setIsCurrentUserLister] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [error, setError] = useState(null);
  const [showLeaseModal, setShowLeaseModal] = useState(false);
  const [conflictCoachSuggestion, setConflictCoachSuggestion] = useState(null);
  const [listingDetails, setListingDetails] = useState(null);
  const [participantProfiles, setParticipantProfiles] = useState({});
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedUserProfile, setSelectedUserProfile] = useState(null);

  const [leaseTerms, setLeaseTerms] = useState({
    rent: "",
    deposit: "",
    duration: "12",
    moveInDate: "",
    utilities: false,
    furnished: false,
    parking: false,
    pets: false,
  });
  const GEMINI_API_KEY =
    process.env.NEXT_PUBLIC_GEMINI_API_KEY || "your-api-key-here";
  const initializeGemini = async () => {
    try {
      const { GoogleGenerativeAI } = await import("@google/generative-ai");
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      return genAI;
    } catch (error) {
      console.error("Failed to initialize Gemini:", error);
      return null;
    }
  };
  const handleProfileClick = async (otherParticipant) => {
    setSelectedUserProfile(otherParticipant);
    setShowProfileModal(true);
  };

  const fetchParticipantProfile = async (userId) => {
    try {
      if (participantProfiles[userId]) {
        return participantProfiles[userId];
      }

      const userRef = doc(db, "users", userId);
      const userDoc = await getDoc(userRef);

      if (userDoc.exists()) {
        const profile = userDoc.data();
        setParticipantProfiles((prev) => ({
          ...prev,
          [userId]: profile,
        }));
        return profile;
      }
      return null;
    } catch (error) {
      console.error("Error fetching participant profile:", error);
      return null;
    }
  };
  const detectConflictAndCoach = async (recentMessages) => {
    try {
      const genAI = await initializeGemini();
      if (!genAI) return null;

      const lastThreeMessages = recentMessages.slice(-3);
      const messagesText = lastThreeMessages
        .map((msg) => `${msg.senderName}: ${msg.text}`)
        .join("\n");

      const prompt = `
      Analyze these recent messages for conflict, tension, or miscommunication:
      ${messagesText}

      Respond with JSON format:
      {
        "hasConflict": boolean,
        "conflictLevel": "low|medium|high",
        "suggestion": "specific advice for de-escalation",
        "recommendedResponse": "suggested diplomatic response"
      }

      Focus on:
      - Rental/roommate disputes
      - Miscommunication about property details
      - Pricing disagreements
      - Scheduling conflicts
      - Personality clashes

      If no conflict detected, return hasConflict: false.
    `;

      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
      const result = await model.generateContent(prompt);
      const response = await result.response;

      let responseText = response.text();
      responseText = responseText.replace(/```json\s*|\s*```/g, "").trim();
      responseText = responseText.replace(/^```\s*|\s*```$/g, "").trim();

      try {
        const analysis = JSON.parse(responseText);
        console.log(analysis, "conflict analysis result");
        return analysis;
      } catch (parseError) {
        console.error("Failed to parse conflict analysis:", parseError);
        console.error("Raw response:", responseText);
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const analysis = JSON.parse(jsonMatch[0]);
            console.log(analysis, "conflict analysis result (fallback)");
            return analysis;
          } catch (fallbackError) {
            console.error("Fallback parsing also failed:", fallbackError);
          }
        }

        return null;
      }
    } catch (error) {
      console.error("Error in conflict detection:", error);
      return null;
    }
  };

  const getListingDetails = async (conversationId) => {
    try {
      const conversationRef = doc(db, "conversations", conversationId);
      const conversationDoc = await getDoc(conversationRef);

      if (conversationDoc.exists()) {
        const conversationData = conversationDoc.data();
        const listingId = conversationData.listingId;

        if (listingId) {
          const listingRef = doc(db, "listings", listingId);
          const listingDoc = await getDoc(listingRef);

          if (listingDoc.exists()) {
            const listingData = listingDoc.data();
            return {
              id: listingId,
              ...listingData,
              address:
                listingData.address ||
                listingData.locationName ||
                "Address not specified",
            };
          }
        }
      }
      return null;
    } catch (error) {
      console.error("Error fetching listing details:", error);
      return null;
    }
  };

  // Generate lease agreement using LLM
  const generateLeaseAgreement = async (listingDetails, terms) => {
    try {
      const genAI = await initializeGemini();
      if (!genAI) return null;

      const isSharedRoom = listingDetails.roomType === "shared";
      const documentType = isSharedRoom
        ? "Roommate Agreement"
        : "Lease Agreement";

      const prompt = `
      Generate a comprehensive ${documentType.toLowerCase()} based on these details:
      
      Property Details:
      - Address: ${listingDetails.address}
      - Rent: $${listingDetails.rent}/month
      - Property Type: ${listingDetails.type}
      - Room Type: ${listingDetails.roomType}
      - Bedrooms: ${listingDetails.bedrooms}
      - Bathrooms: ${listingDetails.bathrooms}
      
      Agreed Terms:
      - Monthly ${isSharedRoom ? "Share" : "Rent"}: $${terms.rent}
      - Security Deposit: $${terms.deposit}
      - ${isSharedRoom ? "Agreement" : "Lease"} Duration: ${
        terms.duration
      } months
      - Move-in Date: ${terms.moveInDate}
      - Utilities Included: ${terms.utilities ? "Yes" : "No"}
      - Furnished: ${terms.furnished ? "Yes" : "No"}
      - Parking: ${terms.parking ? "Yes" : "No"}
      - Pets Allowed: ${terms.pets ? "Yes" : "No"}
      
      Create a legally-informed ${documentType.toLowerCase()} covering:
      ${
        isSharedRoom
          ? `
      1. Shared room arrangement and personal space boundaries
      2. Cost sharing and payment responsibilities
      3. Shared facilities usage and cleaning duties
      4. Guest policies and quiet hours
      5. Personal belongings and storage arrangements
      6. Conflict resolution and communication guidelines
      7. Termination conditions and notice requirements
      `
          : `
      1. Rental terms and payment schedule
      2. Security deposit conditions
      3. Utilities and maintenance responsibilities
      4. Property usage and house rules
      5. Termination conditions
      6. Dispute resolution process
      `
      }
      
      Format as a clear, professional document with sections and bullet points.
      Title the document as "${documentType}".
    `;

      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
      const result = await model.generateContent(prompt);
      const response = await result.response;

      return response.text();
    } catch (error) {
      console.error("Error generating lease agreement:", error);
      return null;
    }
  };

  // Load conversations with better error handling
  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    const conversationsRef = collection(db, "conversations");
    const q = query(
      conversationsRef,
      where("participants", "array-contains", user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        const conversationsData = [];
        const participantIds = new Set();

        snapshot.forEach((doc) => {
          const data = doc.data();
          conversationsData.push({
            id: doc.id,
            ...data,
          });

          // Collect all participant IDs
          data.participants.forEach((id) => {
            if (id !== user.uid) {
              participantIds.add(id);
            }
          });
        });

        // Fetch profiles for all participants
        const profilePromises = Array.from(participantIds).map((id) =>
          fetchParticipantProfile(id)
        );
        await Promise.all(profilePromises);

        const sortedConversations = conversationsData.sort((a, b) => {
          const aTime =
            a.lastMessageAt?.toDate?.() || a.lastMessageAt?.toMillis?.() || 0;
          const bTime =
            b.lastMessageAt?.toDate?.() || b.lastMessageAt?.toMillis?.() || 0;
          return bTime - aTime;
        });

        setConversations(sortedConversations);
        setIsLoading(false);
        setError(null);
      },
      (error) => {
        console.error("Error loading conversations:", error);
        setError("Failed to load conversations. Please try again.");
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Load messages for selected conversation
  useEffect(() => {
    if (!selectedConversation) return;

    // Check if current user is lister
    checkIfCurrentUserIsLister(selectedConversation.id).then(
      setIsCurrentUserLister
    );

    const messagesRef = collection(
      db,
      "conversations",
      selectedConversation.id,
      "messages"
    );
    const q = query(messagesRef, orderBy("createdAt", "asc"));

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        const messagesData = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          messagesData.push({
            id: doc.id,
            ...data,
          });
        });

        setMessages(messagesData);

        // Check for conflict in recent messages
        if (messagesData.length >= 2) {
          const conflictAnalysis = await detectConflictAndCoach(messagesData);
          if (conflictAnalysis && conflictAnalysis.hasConflict) {
            setConflictCoachSuggestion(conflictAnalysis);
          } else {
            setConflictCoachSuggestion(null);
          }
        }

        markMessagesAsRead(selectedConversation.id);
      },
      (error) => {
        console.error("Error loading messages:", error);
      }
    );

    return () => unsubscribe();
  }, [selectedConversation]);

  // Mark messages as read
  const markMessagesAsRead = async (conversationId) => {
    try {
      const messagesRef = collection(
        db,
        "conversations",
        conversationId,
        "messages"
      );
      const q = query(
        messagesRef,
        where("read", "==", false),
        where("senderId", "!=", user.uid)
      );

      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const batch = writeBatch(db);
        snapshot.docs.forEach((doc) => {
          batch.update(doc.ref, { read: true });
        });
        await batch.commit();
      }
    } catch (error) {
      console.error("Error marking messages as read:", error);
    }
  };

  // Send message with improved error handling
  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConversation || isSending) return;

    setIsSending(true);
    const messageText = newMessage.trim();
    setNewMessage("");

    try {
      const now = Timestamp.now();

      const messagesRef = collection(
        db,
        "conversations",
        selectedConversation.id,
        "messages"
      );
      await addDoc(messagesRef, {
        text: messageText,
        senderId: user.uid,
        senderName: userProfile?.name || user.displayName || "Anonymous",
        createdAt: now,
        read: false,
      });

      const conversationRef = doc(db, "conversations", selectedConversation.id);
      await updateDoc(conversationRef, {
        lastMessage: messageText,
        lastMessageAt: now,
        lastMessageSenderId: user.uid,
      });
    } catch (error) {
      console.error("Error sending message:", error);
      setNewMessage(messageText);
      setError("Failed to send message. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  const handleLeaseFinalization = async () => {
    try {
      const details = await getListingDetails(selectedConversation.id);
      if (details) {
        setListingDetails(details);
        setLeaseTerms((prev) => ({
          ...prev,
          rent: details.rent || "",
          deposit: details.rent ? (details.rent * 1.5).toString() : "",
          utilities: details.amenities?.includes("Utilities") || false,
          furnished: details.amenities?.includes("Furnished") || false,
          parking: details.amenities?.includes("Parking") || false,
          pets: details.amenities?.includes("Pet-friendly") || false,
        }));

        setShowLeaseModal(true);
      }
    } catch (error) {
      console.error("Error initiating lease finalization:", error);
      setError("Failed to load listing details for lease finalization.");
    }
  };
  // Use conflict coach suggestion
  const useConflictCoachSuggestion = () => {
    if (
      conflictCoachSuggestion &&
      conflictCoachSuggestion.recommendedResponse
    ) {
      setNewMessage(conflictCoachSuggestion.recommendedResponse);
      setConflictCoachSuggestion(null);
    }
  };
  const getOtherParticipant = (conversation) => {
    const otherParticipantId = conversation.participants.find(
      (id) => id !== user.uid
    );
    const profile = participantProfiles[otherParticipantId];

    return {
      id: otherParticipantId,
      name:
        profile?.name ||
        conversation.participantNames[otherParticipantId] ||
        "Anonymous",
      profileImage: profile?.profileImage || null,
      profile: profile,
    };
  };

  const formatMessageTime = (timestamp) => {
    if (!timestamp) return "";

    let date;
    if (timestamp.toDate) {
      date = timestamp.toDate();
    } else if (timestamp.seconds) {
      date = new Date(timestamp.seconds * 1000);
    } else {
      date = new Date(timestamp);
    }

    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatConversationTime = (timestamp) => {
    if (!timestamp) return "";

    let date;
    if (timestamp.toDate) {
      date = timestamp.toDate();
    } else if (timestamp.seconds) {
      date = new Date(timestamp.seconds * 1000);
    } else {
      date = new Date(timestamp);
    }

    const now = new Date();
    const diff = now - date;

    if (diff < 24 * 60 * 60 * 1000) {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else if (diff < 7 * 24 * 60 * 60 * 1000) {
      return date.toLocaleDateString([], { weekday: "short" });
    } else {
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    }
  };
  const checkIfCurrentUserIsLister = async (conversationId) => {
    try {
      const conversationRef = doc(db, "conversations", conversationId);
      const conversationDoc = await getDoc(conversationRef);

      if (conversationDoc.exists()) {
        const conversationData = conversationDoc.data();
        const listingId = conversationData.listingId;

        if (listingId) {
          const listingRef = doc(db, "listings", listingId);
          const listingDoc = await getDoc(listingRef);

          if (listingDoc.exists()) {
            const listingData = listingDoc.data();
            return listingData.userId === user.uid;
          }
        }
      }
      return false;
    } catch (error) {
      console.error("Error checking lister status:", error);
      return false;
    }
  };

  const generateAndDownloadLease = async () => {
    try {
      const leaseAgreement = await generateLeaseAgreement(
        listingDetails,
        leaseTerms
      );

      if (leaseAgreement) {
        const isSharedRoom = listingDetails.roomType === "shared";
        const documentType = isSharedRoom
          ? "Roommate Agreement"
          : "Lease Agreement";

        // Create filename
        const filename = `${documentType
          .toLowerCase()
          .replace(" ", "-")}-${listingDetails.address.replace(
          /[^a-zA-Z0-9]/g,
          "-"
        )}-${new Date().toISOString().split("T")[0]}.txt`;

        // Create blob
        const blob = new Blob([leaseAgreement], { type: "text/plain" });

        // Upload to Firebase Storage
        const storageRef = ref(
          storage,
          `lease-documents/${selectedConversation.id}/${filename}`
        );
        const uploadResult = await uploadBytes(storageRef, blob);
        const downloadURL = await getDownloadURL(uploadResult.ref);

        // Download locally
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        // Send message with download link
        const now = Timestamp.now();
        const messagesRef = collection(
          db,
          "conversations",
          selectedConversation.id,
          "messages"
        );

        await addDoc(messagesRef, {
          text: `📋 ${documentType} Generated and Available for Download\n\nA comprehensive ${documentType.toLowerCase()} has been generated for this property. Both parties can download the document using the link below.\n\n🔗 Download: ${downloadURL}`,
          senderId: user.uid,
          senderName: userProfile?.name || user.displayName || "Anonymous",
          createdAt: now,
          read: false,
          type: "lease_agreement",
          downloadURL: downloadURL,
          filename: filename,
          documentType: documentType,
        });

        // Update conversation
        const conversationRef = doc(
          db,
          "conversations",
          selectedConversation.id
        );
        await updateDoc(conversationRef, {
          lastMessage: `📋 ${documentType} generated and available for download`,
          lastMessageAt: now,
          lastMessageSenderId: user.uid,
          leaseStatus: "document_generated",
          leaseDocumentURL: downloadURL,
          leaseDocumentName: filename,
        });

        setShowLeaseModal(false);
        setError(null);
      }
    } catch (error) {
      console.error("Error generating lease document:", error);
      setError("Failed to generate lease document. Please try again.");
    }
  };

  const isMessageUnread = (conversation) => {
    return (
      conversation.lastMessageSenderId !== user.uid &&
      conversation.lastMessage &&
      !conversation.lastMessageRead
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <MessageCircle className="w-12 h-12 text-gray-400 mx-auto mb-4 animate-pulse" />
          <p className="text-gray-600">Loading conversations...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => {
              setError(null);
              setIsLoading(true);
              window.location.reload();
            }}
            className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 h-[600px] flex">
      <div
        className={`${
          selectedConversation ? "hidden lg:flex" : "flex"
        } flex-col w-full lg:w-80 border-r border-gray-200`}
      >
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Messages</h2>
            <button
              onClick={() => setShowNewChatModal(true)}
              className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search conversations..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-8 text-center">
              <MessageCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No conversations yet
              </h3>
              <p className="text-gray-600 text-sm">
                Start chatting with property listers
              </p>
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {conversations.map((conversation) => {
                const otherParticipant = getOtherParticipant(conversation);
                const isSelected = selectedConversation?.id === conversation.id;
                const isUnread = isMessageUnread(conversation);

                return (
                  <button
                    key={conversation.id}
                    onClick={() => setSelectedConversation(conversation)}
                    className={`w-full p-3 rounded-lg text-left transition-colors ${
                      isSelected
                        ? "bg-orange-50 border-orange-200"
                        : "hover:bg-gray-50 border-transparent"
                    } border`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        <img
                          src={
                            otherParticipant.profileImage ||
                            "https://img.freepik.com/premium-vector/vector-flat-illustration-grayscale-avatar-user-profile-person-icon-profile-picture-business-profile-woman-suitable-social-media-profiles-icons-screensavers-as-templatex9_719432-1351.jpg?semt=ais_hybrid&w=740"
                          }
                          alt={otherParticipant.name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3
                            className={`text-sm font-medium ${
                              isUnread ? "text-gray-900" : "text-gray-700"
                            } truncate`}
                          >
                            {otherParticipant.name}
                          </h3>
                          <span className="text-xs text-gray-500">
                            {formatConversationTime(conversation.lastMessageAt)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mb-1 truncate">
                          {conversation.listingTitle}
                        </p>

                        {/* Match data and rent info */}
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center space-x-2">
                            {conversation.matchData && (
                              <span className="text-xs bg-green-100 text-green-600 px-1.5 py-0.5 rounded">
                                {conversation.matchData.combinedScore}% Match
                              </span>
                            )}
                            {conversation.rent && (
                              <span className="text-xs text-gray-600">
                                ₹{conversation.rent}/month
                              </span>
                            )}
                          </div>
                        </div>

                        <p
                          className={`text-sm ${
                            isUnread
                              ? "text-gray-900 font-medium"
                              : "text-gray-600"
                          } truncate`}
                        >
                          {conversation.lastMessage || "No messages yet"}
                        </p>
                        {conversation.leaseStatus && (
                          <div className="flex items-center mt-1">
                            <FileText className="w-3 h-3 text-blue-500 mr-1" />
                            <span className="text-xs text-blue-600 capitalize">
                              {conversation.leaseStatus.replace("_", " ")}
                            </span>
                          </div>
                        )}
                      </div>
                      {isUnread && (
                        <div className="w-2 h-2 bg-orange-500 rounded-full flex-shrink-0 mt-2"></div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div
        className={`${
          selectedConversation ? "flex" : "hidden lg:flex"
        } flex-col flex-1`}
      >
        {selectedConversation ? (
          <>
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div
                  className="flex items-center space-x-3 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors"
                  onClick={() =>
                    handleProfileClick(
                      getOtherParticipant(selectedConversation)
                    )
                  }
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedConversation(null);
                    }}
                    className="lg:hidden p-1 text-gray-500 hover:text-gray-700"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <img
                    src={
                      getOtherParticipant(selectedConversation).profileImage ||
                      "https://img.freepik.com/premium-vector/vector-flat-illustration-grayscale-avatar-user-profile-person-icon-profile-picture-business-profile-woman-suitable-social-media-profiles-icons-screensavers-as-templatex9_719432-1351.jpg?semt=ais_hybrid&w=740"
                    }
                    alt={getOtherParticipant(selectedConversation).name}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">
                      {getOtherParticipant(selectedConversation).name}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {selectedConversation.listingTitle}
                    </p>
                    <div className="flex items-center space-x-3 mt-1">
                      {selectedConversation.rent && (
                        <span className="text-sm font-medium text-green-600">
                          ₹{selectedConversation.rent}/month
                        </span>
                      )}
                      {getOtherParticipant(selectedConversation).profile
                        ?.age && (
                        <p className="text-xs text-gray-400">
                          Age:{" "}
                          {
                            getOtherParticipant(selectedConversation).profile
                              .age
                          }
                        </p>
                      )}
                      {selectedConversation.matchData && (
                        <div className="flex items-center space-x-2">
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                            {selectedConversation.matchData.combinedScore}%
                            Match
                          </span>
                          {selectedConversation.matchData.distance && (
                            <span className="text-xs text-gray-500">
                              {selectedConversation.matchData.distance.toFixed(
                                1
                              )}
                              km away
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {isCurrentUserLister && (
                    <button
                      onClick={handleLeaseFinalization}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Generate Lease/Agreement"
                    >
                      <FileText className="w-4 h-4" />
                    </button>
                  )}
                  <button className="p-2 text-gray-400 hover:text-gray-600">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {showProfileModal && selectedUserProfile && (
              <div className="fixed inset-0 bg-[#0000009a] bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl max-w-2xl w-full max-h-[95vh] overflow-y-auto">
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-xl font-semibold text-gray-900">
                        User Profile
                      </h3>
                      <button
                        onClick={() => setShowProfileModal(false)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-6 h-6" />
                      </button>
                    </div>

                    <div className="space-y-6">
                      <div className="flex items-center space-x-4">
                        <img
                          src={
                            selectedUserProfile.profileImage ||
                            "https://img.freepik.com/premium-vector/vector-flat-illustration-grayscale-avatar-user-profile-person-icon-profile-picture-business-profile-woman-suitable-social-media-profiles-icons-screensavers-as-templatex9_719432-1351.jpg?semt=ais_hybrid&w=740"
                          }
                          alt={selectedUserProfile.name}
                          className="w-16 h-16 object-cover rounded-full border-2 border-gray-200"
                        />
                        <div>
                          <h2 className="text-2xl font-bold text-gray-900">
                            {selectedUserProfile.name}
                          </h2>
                          {selectedUserProfile.profile?.email && (
                            <p className="text-gray-600">
                              {selectedUserProfile.profile.email}
                            </p>
                          )}
                          {selectedUserProfile.profile?.age && (
                            <p className="text-gray-600">
                              Age: {selectedUserProfile.profile.age}
                            </p>
                          )}
                        </div>
                      </div>

                      {selectedUserProfile.profile && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">
                              Lifestyle Preferences
                            </h3>
                            <div className="space-y-3">
                              {selectedUserProfile.profile.preferences ? (
                                <>
                                  {selectedUserProfile.profile.preferences
                                    .type === "structured" ? (
                                    Object.entries(
                                      selectedUserProfile.profile.preferences
                                    )
                                      .filter(([key]) => key !== "type")
                                      .map(([key, value]) => (
                                        <div
                                          key={key}
                                          className="flex items-center justify-between py-2 border-b border-gray-100"
                                        >
                                          <span className="text-gray-600 capitalize font-medium">
                                            {key
                                              .replace(/([A-Z])/g, " $1")
                                              .trim()}
                                          </span>
                                          <span className="text-gray-900">
                                            {value}
                                          </span>
                                        </div>
                                      ))
                                  ) : (
                                    <div className="space-y-4">
                                      <div>
                                        <h4 className="font-medium text-gray-900 mb-2">
                                          Preferences Summary
                                        </h4>
                                        <p className="text-gray-600 leading-relaxed">
                                          {
                                            selectedUserProfile.profile
                                              .preferences.conversationSummary
                                          }
                                        </p>
                                      </div>
                                      {selectedUserProfile.profile.preferences
                                        .semanticTags && (
                                        <div>
                                          <h4 className="font-medium text-gray-900 mb-2">
                                            Key Characteristics
                                          </h4>
                                          <div className="flex flex-wrap gap-2">
                                            {selectedUserProfile.profile.preferences.semanticTags.map(
                                              (tag, index) => (
                                                <span
                                                  key={index}
                                                  className="bg-gray-100 text-gray-700 px-3 py-1 text-sm rounded-full border border-gray-200"
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
                                  No preferences available
                                </p>
                              )}
                            </div>
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">
                              Account Information
                            </h3>
                            <div className="space-y-3">
                              {selectedUserProfile.profile.createdAt && (
                                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                                  <span className="text-gray-600 font-medium">
                                    Member Since
                                  </span>
                                  <span className="text-gray-900">
                                    {new Date(
                                      selectedUserProfile.profile.createdAt
                                    ).toLocaleDateString()}
                                  </span>
                                </div>
                              )}
                              {selectedUserProfile.profile.updatedAt && (
                                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                                  <span className="text-gray-600 font-medium">
                                    Profile Updated
                                  </span>
                                  <span className="text-gray-900">
                                    {new Date(
                                      selectedUserProfile.profile.updatedAt
                                    ).toLocaleDateString()}
                                  </span>
                                </div>
                              )}
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
                      )}
                      {!selectedUserProfile.profile && (
                        <div className="text-center py-8">
                          <User className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                          <h4 className="text-lg font-medium text-gray-900 mb-2">
                            Limited Profile Information
                          </h4>
                          <p className="text-gray-600">
                            This user hasn't completed their profile setup yet.
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="mt-6 pt-4 border-t border-gray-200">
                      <button
                        onClick={() => setShowProfileModal(false)}
                        className="w-full bg-orange-600 text-white py-2 px-4 rounded-lg hover:bg-orange-700 transition-colors"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {/* Conflict Coach Alert */}
            {conflictCoachSuggestion && (
              <div className="mx-4 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start space-x-3">
                  <Bot className="w-5 h-5 text-amber-600 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-amber-800">
                      💡 Conflict Coach Suggestion
                    </h4>
                    <p className="text-sm text-amber-700 mt-1">
                      {conflictCoachSuggestion.suggestion}
                    </p>
                    <div className="flex items-center space-x-2 mt-2">
                      <button
                        onClick={useConflictCoachSuggestion}
                        className="text-xs bg-amber-600 text-white px-2 py-1 rounded hover:bg-amber-700"
                      >
                        Use Suggested Response
                      </button>
                      <button
                        onClick={() => setConflictCoachSuggestion(null)}
                        className="text-xs text-amber-600 hover:text-amber-700"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message) => {
                const isOwnMessage = message.senderId === user.uid;
                const isLeaseAgreement = message.type === "lease_agreement";

                return (
                  <div
                    key={message.id}
                    className={`flex ${
                      isOwnMessage ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        isLeaseAgreement
                          ? "bg-blue-50 text-blue-900 border border-blue-200"
                          : isOwnMessage
                          ? "bg-orange-600 text-white"
                          : "bg-gray-100 text-gray-900"
                      }`}
                    >
                      {isLeaseAgreement && (
                        <div className="flex items-center mb-2">
                          <FileText className="w-4 h-4 mr-2" />
                          <span className="text-xs font-medium">
                            {message.documentType || "Lease Agreement"}
                          </span>
                        </div>
                      )}
                      <p
                        className={`text-sm ${
                          isLeaseAgreement ? "whitespace-pre-wrap" : ""
                        }`}
                      >
                        {message.text}
                      </p>
                      {isLeaseAgreement && message.downloadURL && (
                        <div className="mt-2 pt-2 border-t border-blue-200">
                          <a
                            href={message.downloadURL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-xs text-blue-700 hover:text-blue-800 font-medium"
                          >
                            <Download className="w-3 h-3 mr-1" />
                            Download Document
                          </a>
                        </div>
                      )}
                      <div className="flex items-center justify-between mt-1">
                        <span
                          className={`text-xs ${
                            isLeaseAgreement
                              ? "text-blue-600"
                              : isOwnMessage
                              ? "text-orange-200"
                              : "text-gray-500"
                          }`}
                        >
                          {formatMessageTime(message.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Message Input */}
            <form
              onSubmit={sendMessage}
              className="p-4 border-t border-gray-200"
            >
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  disabled={isSending}
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim() || isSending}
                  className="p-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Select a conversation
              </h3>
              <p className="text-gray-600">
                Choose a conversation from the list to start messaging
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Lease Finalization Modal */}
      {showLeaseModal && listingDetails && (
        <div className="fixed inset-0 bg-[#00000086] bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[95vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-2">
                  <Download className="w-5 h-5 text-orange-600" />
                  <h3 className="text-xl font-semibold text-gray-900">
                    {listingDetails?.roomType === "shared"
                      ? "Roommate Agreement"
                      : "Lease Agreement"}{" "}
                    Finalization
                  </h3>
                </div>
                <button
                  onClick={() => setShowLeaseModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Property Details */}
              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <h4 className="font-medium text-gray-900 mb-3">
                  Property Details
                </h4>
                <div className="space-y-3">
                  <div className="flex items-start">
                    <MapPin className="w-4 h-4 text-gray-500 mr-2 mt-0.5" />
                    <div>
                      <span className="font-medium">
                        {listingDetails.address}
                      </span>
                      {listingDetails.locationName &&
                        listingDetails.locationName !==
                          listingDetails.address && (
                          <p className="text-sm text-gray-600">
                            {listingDetails.locationName}
                          </p>
                        )}
                    </div>
                  </div>

                  <div className="flex items-center">
                    <DollarSign className="w-4 h-4 text-gray-500 mr-2" />
                    <span>{listingDetails.rent}/month</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm text-gray-600">Room Type:</span>
                      <p className="font-medium capitalize">
                        {listingDetails.roomType}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Room Size:</span>
                      <p className="font-medium">
                        {listingDetails.roomSize?.area} sq ft
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm text-gray-600">
                        Light Level:
                      </span>
                      <p className="font-medium">
                        {listingDetails.lightLevel}/10
                      </p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">
                        Noise Level:
                      </span>
                      <p className="font-medium">
                        {listingDetails.noiseLevel}/10
                      </p>
                    </div>
                  </div>

                  {listingDetails.amenities &&
                    listingDetails.amenities.length > 0 && (
                      <div>
                        <span className="text-sm text-gray-600">
                          Amenities:
                        </span>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {listingDetails.amenities.map((amenity, index) => (
                            <span
                              key={index}
                              className="bg-blue-100 text-blue-700 px-2 py-1 text-xs rounded-full"
                            >
                              {amenity}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                  {listingDetails.description && (
                    <div>
                      <span className="text-sm text-gray-600">
                        Description:
                      </span>
                      <p className="text-sm mt-1">
                        {listingDetails.description}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Lease Terms Form */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Lease Terms</h4>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Monthly Rent ($)
                    </label>
                    <input
                      type="number"
                      value={leaseTerms.rent}
                      onChange={(e) =>
                        setLeaseTerms((prev) => ({
                          ...prev,
                          rent: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                      placeholder="Enter agreed rent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Security Deposit ($)
                    </label>
                    <input
                      type="number"
                      value={leaseTerms.deposit}
                      onChange={(e) =>
                        setLeaseTerms((prev) => ({
                          ...prev,
                          deposit: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                      placeholder="Enter deposit amount"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Lease Duration (months)
                    </label>
                    <select
                      value={leaseTerms.duration}
                      onChange={(e) =>
                        setLeaseTerms((prev) => ({
                          ...prev,
                          duration: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      <option value="3">3 months</option>
                      <option value="6">6 months</option>
                      <option value="12">12 months</option>
                      <option value="24">24 months</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Move-in Date
                    </label>
                    <input
                      type="date"
                      value={leaseTerms.moveInDate}
                      onChange={(e) =>
                        setLeaseTerms((prev) => ({
                          ...prev,
                          moveInDate: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>

                {/* Amenities Checkboxes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Included Amenities
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={leaseTerms.utilities}
                        onChange={(e) =>
                          setLeaseTerms((prev) => ({
                            ...prev,
                            utilities: e.target.checked,
                          }))
                        }
                        className="mr-2 text-orange-600 focus:ring-orange-500"
                      />
                      <span className="text-sm">Utilities Included</span>
                    </label>

                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={leaseTerms.furnished}
                        onChange={(e) =>
                          setLeaseTerms((prev) => ({
                            ...prev,
                            furnished: e.target.checked,
                          }))
                        }
                        className="mr-2 text-orange-600 focus:ring-orange-500"
                      />
                      <span className="text-sm">Furnished</span>
                    </label>

                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={leaseTerms.parking}
                        onChange={(e) =>
                          setLeaseTerms((prev) => ({
                            ...prev,
                            parking: e.target.checked,
                          }))
                        }
                        className="mr-2 text-orange-600 focus:ring-orange-500"
                      />
                      <span className="text-sm">Parking Included</span>
                    </label>

                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={leaseTerms.pets}
                        onChange={(e) =>
                          setLeaseTerms((prev) => ({
                            ...prev,
                            pets: e.target.checked,
                          }))
                        }
                        className="mr-2 text-orange-600 focus:ring-orange-500"
                      />
                      <span className="text-sm">Pets Allowed</span>
                    </label>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    onClick={() => setShowLeaseModal(false)}
                    className="px-4 py-2 text-gray-600 hover:text-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={generateAndDownloadLease}
                    disabled={
                      !leaseTerms.rent ||
                      !leaseTerms.deposit ||
                      !leaseTerms.moveInDate
                    }
                    className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Generate & Download{" "}
                    {listingDetails?.roomType === "shared"
                      ? "Agreement"
                      : "Lease"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Chat Modal */}
      {showNewChatModal && (
        <div className="fixed inset-0 bg-[#0000007c] bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                New Message
              </h3>
              <button
                onClick={() => setShowNewChatModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="text-center py-8">
              <MessageCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-gray-900 mb-2">
                Start a Conversation
              </h4>
              <p className="text-gray-600 mb-6">
                You can start a conversation by clicking "Connect" on any
                listing, or use the quick actions below.
              </p>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <Shield className="w-5 h-5 text-blue-600 mr-3" />
                    <span className="text-sm font-medium">
                      AI Conflict Coach
                    </span>
                  </div>
                  <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                    Active
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <FileText className="w-5 h-5 text-orange-600 mr-3" />
                    <span className="text-sm font-medium">
                      Lease Finalization
                    </span>
                  </div>
                  <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                    Available
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <MapPin className="w-5 h-5 text-purple-600 mr-3" />
                    <span className="text-sm font-medium">Safe Meet-up</span>
                  </div>
                  <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
                    Coming Soon
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowNewChatModal(false)}
              className="w-full bg-orange-600 text-white py-2 px-4 rounded-lg hover:bg-orange-700 transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Messages;
