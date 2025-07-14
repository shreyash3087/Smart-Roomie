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
import { db } from "../../utils/firebase";
import { Download } from "lucide-react";
import jsPDF from "jspdf";
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
  const [isGeneratingLease, setIsGeneratingLease] = useState(false);
  const [leaseTerms, setLeaseTerms] = useState({
    rent: "",
    deposit: "",
    duration: "12",
    moveInDate: "",
    utilities: false,
    furnished: false,
    parking: false,
    pets: false,
    roommate1Name: "",
    roommate1Email: "",
    roommate2Name: "",
    roommate2Email: "",
    roommate1RentShare: "",
    roommate2RentShare: "",
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

      const otherParticipant = getOtherParticipant(selectedConversation);
      const currentUserName =
        userProfile?.name || user.displayName || "Current User";
      const otherUserName = otherParticipant.name;

      const prompt = `
    Analyze these recent messages for conflict, tension, or miscommunication:
    ${messagesText}

    Current user viewing this: ${currentUserName}
    Other participant: ${otherUserName}

    Generate PERSONALIZED suggestions for ${currentUserName} specifically.

    Respond with JSON format:
    {
      "hasConflict": boolean,
      "conflictLevel": "low|medium|high",
      "suggestion": "specific advice for ${currentUserName} on how to handle this situation",
      "recommendedResponse": "suggested diplomatic response that ${currentUserName} should send",
      "targetUser": "${currentUserName}"
    }

    Important: 
    - The suggestion should be tailored specifically for ${currentUserName}
    - If ${currentUserName} sent the last message that seems aggressive, suggest self-reflection and a more diplomatic approach
    - If ${otherUserName} sent the aggressive message, suggest how ${currentUserName} should respond diplomatically
    - Consider the context of rental/roommate relationships
    - Focus on de-escalation techniques appropriate for the current user's position

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

        if (analysis.targetUser === currentUserName) {
          return analysis;
        }

        return null;
      } catch (parseError) {
        console.error("Failed to parse conflict analysis:", parseError);
        console.error("Raw response:", responseText);
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const analysis = JSON.parse(jsonMatch[0]);
            console.log(analysis, "conflict analysis result (fallback)");

            if (analysis.targetUser === currentUserName) {
              return analysis;
            }

            return null;
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
      const currentDate = new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      const prompt = `
    Generate a comprehensive and legally-informed ${documentType.toLowerCase()} in clean, professional format. Use proper formatting with clear headers and sections.

    **AGREEMENT DETAILS:**
    Document Type: ${documentType}
    Date: ${currentDate}
    
    **PARTIES:**
    ${
      isSharedRoom
        ? `
    Roommate 1: ${terms.roommate1Name}
    Email: ${terms.roommate1Email}
    
    Roommate 2: ${terms.roommate2Name}
    Email: ${terms.roommate2Email}
    `
        : `
    Landlord/Lister: ${terms.roommate1Name}
    Email: ${terms.roommate1Email}
    
    Tenant: ${terms.roommate2Name}
    Email: ${terms.roommate2Email}
    `
    }

    **PROPERTY DETAILS:**
    Address: ${listingDetails.address}
    Room Type: ${listingDetails.roomType}
    Room Size: ${listingDetails.roomSize?.area || "N/A"} sq ft
    
    **FINANCIAL TERMS:**
    ${
      isSharedRoom
        ? `
    Total Monthly Rent: $${terms.rent}
    ${terms.roommate1Name} Share: $${terms.roommate1RentShare}
    ${terms.roommate2Name} Share: $${terms.roommate2RentShare}
    `
        : `
    Monthly Rent: $${terms.rent}
    `
    }
    Security Deposit: $${terms.deposit}
    Agreement Duration: ${terms.duration} months
    Move-in Date: ${terms.moveInDate}
    Utilities Included: ${terms.utilities ? "Yes" : "No"}
    Furnished: ${terms.furnished ? "Yes" : "No"}
    Parking: ${terms.parking ? "Yes" : "No"}
    Pets Allowed: ${terms.pets ? "Yes" : "No"}
    
    **REQUIREMENTS:**
    1. Create a professional, legally-informed document
    2. Include all standard clauses for ${
      isSharedRoom ? "roommate arrangements" : "rental agreements"
    }
    3. Cover payment terms, responsibilities, and termination conditions
    4. Include dispute resolution procedures
    5. Use clear, professional language
    6. Format with proper headers and sections
    ${
      isSharedRoom
        ? `
    7. Include shared space usage guidelines
    8. Define personal space boundaries
    9. Include guest policies and quiet hours
    10. Address cleaning and maintenance responsibilities
    `
        : `
    7. Include property maintenance responsibilities
    8. Define permitted use of property
    9. Include standard landlord-tenant clauses
    `
    }
    
    Generate the complete ${documentType.toLowerCase()} now:
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
          data.participants.forEach((id) => {
            if (id !== user.uid) {
              participantIds.add(id);
            }
          });
        });

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

  useEffect(() => {
    if (!selectedConversation) return;

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

        if (messagesData.length >= 2) {
          const lastMessage = messagesData[messagesData.length - 1];
          setTimeout(async () => {
            const conflictAnalysis = await detectConflictAndCoach(messagesData);
            if (conflictAnalysis && conflictAnalysis.hasConflict) {
              setConflictCoachSuggestion(conflictAnalysis);
            } else {
              setConflictCoachSuggestion(null);
            }
          }, 500);
        }

        markMessagesAsRead(selectedConversation.id);
      },
      (error) => {
        console.error("Error loading messages:", error);
      }
    );

    return () => unsubscribe();
  }, [selectedConversation, user, userProfile]);

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
      const otherParticipant = getOtherParticipant(selectedConversation);

      if (details) {
        setListingDetails(details);
        setLeaseTerms((prev) => ({
          ...prev,
          rent: details.rent || "",
          totalRent: details.rent || "",
          deposit: details.rent ? (details.rent * 1.5).toString() : "",
          utilities: details.amenities?.includes("Utilities") || false,
          furnished: details.amenities?.includes("Furnished") || false,
          parking: details.amenities?.includes("Parking") || false,
          pets: details.amenities?.includes("Pet-friendly") || false,
          roommate1Name: userProfile?.name || user.displayName || "",
          roommate1Email: userProfile?.email || user.email || "",
          roommate2Name: otherParticipant.name || "",
          roommate2Email: otherParticipant.profile?.email || "",
          roommate1RentShare: details.rent ? (details.rent / 2).toString() : "",
          roommate2RentShare: details.rent ? (details.rent / 2).toString() : "",
        }));

        setShowLeaseModal(true);
      }
    } catch (error) {
      console.error("Error initiating lease finalization:", error);
      setError("Failed to load listing details for lease finalization.");
    }
  };

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
  const generateAndDownloadLease = async () => {
    try {
      setIsGeneratingLease(true);
      const leaseAgreement = await generateLeaseAgreement(
        listingDetails,
        leaseTerms
      );

      if (leaseAgreement) {
        const isSharedRoom = listingDetails.roomType === "shared";
        const documentType = isSharedRoom
          ? "Roommate Agreement"
          : "Lease Agreement";

        // Create PDF with markdown formatting
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 20;
        const maxWidth = pageWidth - 2 * margin;

        // Add document header
        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        doc.text(documentType, pageWidth / 2, 30, { align: "center" });

        // Add property address
        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        doc.text(`Property: ${listingDetails.address}`, pageWidth / 2, 45, {
          align: "center",
        });

        // Add date
        const today = new Date().toLocaleDateString();
        doc.text(`Date: ${today}`, pageWidth / 2, 55, { align: "center" });

        // Add separator line
        doc.setDrawColor(0);
        doc.setLineWidth(0.5);
        doc.line(margin, 65, pageWidth - margin, 65);

        // Process and render markdown content
        const lines = leaseAgreement.split("\n");
        let y = 80; // Start content below header

        lines.forEach((line) => {
          // Check if we need a new page
          if (y > pageHeight - margin - 20) {
            doc.addPage();
            y = margin;
          }

          // Handle different markdown elements
          if (line.startsWith("## ")) {
            // Header 2 - Large bold text
            const headerText = line.replace("## ", "");
            doc.setFontSize(16);
            doc.setFont("helvetica", "bold");

            const headerLines = doc.splitTextToSize(headerText, maxWidth);
            headerLines.forEach((headerLine) => {
              doc.text(headerLine, margin, y);
              y += 12;
            });
            y += 5; // Extra spacing after header
          } else if (line.startsWith("### ")) {
            // Header 3 - Medium bold text
            const headerText = line.replace("### ", "");
            doc.setFontSize(14);
            doc.setFont("helvetica", "bold");

            const headerLines = doc.splitTextToSize(headerText, maxWidth);
            headerLines.forEach((headerLine) => {
              doc.text(headerLine, margin, y);
              y += 10;
            });
            y += 3; // Extra spacing after header
          } else if (line.trim() === "") {
            // Empty line - add spacing
            y += 5;
          } else {
            // Regular text with possible bold formatting
            doc.setFontSize(11);

            // Handle bold text within paragraphs
            if (line.includes("**")) {
              const parts = line.split(/(\*\*[^*]+\*\*)/);
              let textFragments = [];

              parts.forEach((part) => {
                if (part.startsWith("**") && part.endsWith("**")) {
                  // Bold text
                  const boldText = part.replace(/\*\*/g, "");
                  textFragments.push({ text: boldText, bold: true });
                } else if (part.trim() !== "") {
                  // Normal text
                  textFragments.push({ text: part, bold: false });
                }
              });

              // Render mixed text
              let currentX = margin;
              textFragments.forEach((fragment) => {
                doc.setFont("helvetica", fragment.bold ? "bold" : "normal");

                const words = fragment.text.split(" ");
                words.forEach((word, index) => {
                  const spaceWidth = index > 0 ? doc.getTextWidth(" ") : 0;
                  const wordWidth = doc.getTextWidth(word);

                  if (currentX + spaceWidth + wordWidth > pageWidth - margin) {
                    y += 8;
                    currentX = margin;
                  }

                  if (index > 0 && currentX > margin) {
                    doc.text(" ", currentX, y);
                    currentX += spaceWidth;
                  }

                  doc.text(word, currentX, y);
                  currentX += wordWidth;
                });
              });

              y += 8; // Move to next line
            } else {
              // Regular text without bold formatting
              doc.setFont("helvetica", "normal");
              const textLines = doc.splitTextToSize(line, maxWidth);

              textLines.forEach((textLine) => {
                doc.text(textLine, margin, y);
                y += 8;
              });
            }
          }
        });

        // Generate PDF blob
        const pdfBlob = doc.output("blob");

        // Create filename for PDF
        const filename = `${documentType
          .toLowerCase()
          .replace(" ", "-")}-${listingDetails.address.replace(
          /[^a-zA-Z0-9]/g,
          "-"
        )}-${new Date().toISOString().split("T")[0]}.pdf`;

        // Convert PDF blob to base64 for Firebase upload
        const reader = new FileReader();
        reader.readAsDataURL(pdfBlob);

        reader.onloadend = async () => {
          const base64Data = reader.result.split(",")[1];

          // Upload PDF to Firebase Storage via API
          const uploadResponse = await fetch("/api/storage", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              content: base64Data,
              filename,
              conversationId: selectedConversation.id,
              documentType,
              contentType: "application/pdf",
              isBase64: true,
            }),
          });

          if (!uploadResponse.ok) {
            const errorData = await uploadResponse.json();
            throw new Error(errorData.error || "Failed to upload document");
          }

          const { downloadURL } = await uploadResponse.json();

          // Download PDF locally for user
          const url = window.URL.createObjectURL(pdfBlob);
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
        };

        reader.onerror = (error) => {
          console.error("Error reading PDF blob:", error);
          setError("Failed to process PDF document");
        };
      }
    } catch (error) {
      console.error("Error generating lease document:", error);
      setError(`Failed to generate lease document: ${error.message}`);
    } finally {
      setIsGeneratingLease(false);
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

            {/* Conflict Coach Alert */}
            {conflictCoachSuggestion && (
              <div className="mx-4 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start space-x-3">
                  <Bot className="w-5 h-5 text-amber-600 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-amber-800 flex items-center">
                      💡 Conflict Coach Suggestion
                    </h4>
                    <p className="text-sm text-amber-700 mt-1">
                      {conflictCoachSuggestion.suggestion}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={useConflictCoachSuggestion}
                          className="text-xs bg-amber-600 text-white px-3 py-1 rounded hover:bg-amber-700 transition-colors"
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
                      <span className="text-xs text-amber-600">
                        Conflict Level: {conflictCoachSuggestion.conflictLevel}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

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
                <h4 className="font-medium text-gray-900"> Terms</h4>

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
                {listingDetails?.roomType === "shared" && (
                  <>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {leaseTerms.roommate1Name || "Your"} Share ($)
                        </label>
                        <input
                          type="number"
                          value={leaseTerms.roommate1RentShare}
                          onChange={(e) =>
                            setLeaseTerms((prev) => ({
                              ...prev,
                              roommate1RentShare: e.target.value,
                            }))
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                          placeholder="Your rent share"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {leaseTerms.roommate2Name || "Roommate"} Share ($)
                        </label>
                        <input
                          type="number"
                          value={leaseTerms.roommate2RentShare}
                          onChange={(e) =>
                            setLeaseTerms((prev) => ({
                              ...prev,
                              roommate2RentShare: e.target.value,
                            }))
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                          placeholder="Roommate rent share"
                        />
                      </div>
                    </div>

                    {/* Rent share validation */}
                    {leaseTerms.rent &&
                      leaseTerms.roommate1RentShare &&
                      leaseTerms.roommate2RentShare &&
                      parseInt(leaseTerms.roommate1RentShare) +
                        parseInt(leaseTerms.roommate2RentShare) !==
                        parseInt(leaseTerms.rent) && (
                        <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                          ⚠️ Warning: Individual shares don't add up to total
                          rent
                        </div>
                      )}
                  </>
                )}
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
                      !leaseTerms.moveInDate ||
                      isGeneratingLease
                    }
                    className="px-6 py-2 bg-orange-600 cursor-pointer text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
