import React, { useEffect, useState } from "react";
import supabase from "../utils/supabase";
import { Button } from "./ui/button";
import { parseCookies } from "nookies";
import { Textarea } from "./ui/textarea";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTrigger,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./ui/accordion";

const ParticipantList = ({ roomId }) => {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [messages, setMessages] = useState([]);
  const [replyContent, setReplyContent] = useState("");
  const [replying, setReplying] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({
    org: "",
    phone: "",
    desc: "",
    photourl: ""
  });
  const [updating, setUpdating] = useState(false);
  const [editError, setEditError] = useState("");
  const [isPublicRoom, setIsPublicRoom] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  
  const cookies = parseCookies();
  const partyyEmail = decodeURIComponent(cookies.PartyEmail);

  const currentUserEmail =
    partyyEmail === "Jmadmin123#"
      ? decodeURIComponent(cookies.MyEmail)
      : decodeURIComponent(cookies.PartyEmail);

  const currentUserName = cookies.PartyName || cookies.MyName;
  const isLoggedIn = !!currentUserEmail && currentUserEmail !== "undefined";

  // Group profiles by organization with improved error handling
  const groupedProfiles = React.useMemo(() => {
    try {
      const groups = profiles.reduce((acc, profile) => {
        // Handle null/undefined org values
        const org = profile.org ? profile.org?.trim() : "";
        const groupName = org || "Others"; // Use "Others" for empty org names
        
        if (!acc[groupName]) {
          acc[groupName] = [];
        }
        acc[groupName].push(profile);
        return acc;
      }, {});

      // Sort organizations alphabetically, but keep "Others" at the end
      return Object.entries(groups).sort(([a], [b]) => {
        if (a === "Others") return 1;
        if (b === "Others") return -1;
        return a.localeCompare(b);
      });
    } catch (error) {
      console.error("Error grouping profiles:", error);
      return [["Others", profiles]]; // Fallback to showing all profiles under "Others"
    }
  }, [profiles]);

  const validateFields = (fields) => {
    const errors = [];

    // Phone validation (optional but if provided must be valid)
    if (fields.phone && !/^[\d\s()+.-]{10,}$/.test(fields.phone)) {
      errors.push('Invalid phone number format. Please enter at least 10 digits with optional spaces, brackets, plus, dots, or hyphens.');
    }

    // URL validation (optional but if provided must be valid)
    if (fields.photourl) {
      try {
        new URL(fields.photourl);
      } catch {
        errors.push('Invalid photo URL format. Please enter a valid URL starting with http:// or https://');
      }
    }

    // Organization validation
    if (fields.org && fields.org.length > 100) {
      errors.push('Organization name is too long. Maximum 100 characters allowed.');
    }

    // Description validation
    if (fields.desc && fields.desc.length > 500) {
      errors.push('Description is too long. Maximum 500 characters allowed.');
    }

    return errors.length > 0 ? errors.join('\n') : null;
  };

  const handleEdit = (profile) => {
    try {
      setEditForm({
        org: profile.org || "",
        phone: profile.phone || "",
        desc: profile.desc || "",
        photourl: profile.photourl || ""
      });
      setEditMode(true);
      setEditError("");
    } catch (error) {
      console.error("Error setting edit form:", error);
      setEditError("Failed to load profile data for editing");
    }
  };

  const handleUpdate = async (profile) => {
    const validationError = validateFields(editForm);
    if (validationError) {
      setEditError(validationError);
      setTimeout(() => setEditError(""), 5000);
      return;
    }

    setUpdating(true);
    setEditError("");

    try {
      const { error } = await supabase
        .from("Profiles")
        .update({
          org: editForm.org?.trim(),
          phone: editForm.phone?.trim(),
          desc: editForm.desc?.trim(),
          photourl: editForm.photourl?.trim()
        })
        .eq(isPublicRoom ? "name" : "email", isPublicRoom ? profile.name : profile.email)
        .eq("roomid", roomId);

      if (error) throw error;

      setEditMode(false);
      // Refresh profiles to show updated data
      await fetchProfiles();
    } catch (error) {
      console.error("Error updating profile:", error);
      setEditError(`Failed to update profile: ${error.message}`);
      setTimeout(() => setEditError(""), 5000);
    } finally {
      setUpdating(false);
    }
  };

  const fetchRoomType = async () => {
    try {
      const { data, error } = await supabase
        .from("Rooms")
        .select("type")
        .eq("uuid", roomId)
        .single();
      
      if (error) throw error;
      
      setIsPublicRoom(data.type === 'public');
    } catch (error) {
      console.error("Error fetching room type:", error);
      setFetchError("Failed to load room information");
    }
  };

  const fetchProfiles = async () => {
    setLoading(true);
    setFetchError(null);
    
    try {
      const { data, error } = await supabase
        .from("Profiles")
        .select("*")
        .eq("roomid", roomId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      setProfiles(data || []);
    } catch (error) {
      console.error("Error fetching profiles:", error);
      setFetchError("Failed to load participants");
      setProfiles([]); // Reset profiles on error
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from("Chats")
        .select(
          `
          *, 
          Profiles (
            name,
            email,
            photourl
          )
        `
        )
        .eq("roomid", roomId);

      if (error) throw error;

      setMessages(data || []);
    } catch (error) {
      console.error("Error fetching messages:", error);
      setError("Failed to load messages");
    }
  };

  useEffect(() => {
    let profileChannel;
    let messageChannel;

    const setupRealtime = async () => {
      try {
        await fetchRoomType();
        await fetchProfiles();
        await fetchMessages();

        profileChannel = supabase
          .channel("realtime-profiles")
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "Profiles" },
            (payload) => {
              try {
                if (payload.eventType === "INSERT") {
                  setProfiles((prevProfiles) => [...prevProfiles, payload.new]);
                } else if (payload.eventType === "UPDATE") {
                  setProfiles((prevProfiles) =>
                    prevProfiles.map((profile) =>
                      profile.id === payload.new.id ? payload.new : profile
                    )
                  );
                }
              } catch (error) {
                console.error("Error handling profile update:", error);
              }
            }
          )
          .subscribe();

        messageChannel = supabase
          .channel("realtime-messages")
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "Chats" },
            (payload) => {
              try {
                if (payload.eventType === "INSERT") {
                  setMessages((prevMessages) => [...prevMessages, payload.new]);
                } else if (payload.eventType === "UPDATE") {
                  setMessages((prevMessages) =>
                    prevMessages.map((msg) =>
                      msg.uuid === payload.new.uuid ? payload.new : msg
                    )
                  );
                }
              } catch (error) {
                console.error("Error handling message update:", error);
              }
            }
          )
          .subscribe();
      } catch (error) {
        console.error("Error setting up realtime:", error);
        setError("Failed to establish real-time connection");
      }
    };

    setupRealtime();

    return () => {
      if (profileChannel) supabase.removeChannel(profileChannel);
      if (messageChannel) supabase.removeChannel(messageChannel);
    };
  }, [roomId]);

  const getMessagesForProfile = (profile) => {
    if (!messages || messages.length === 0 || !profile || !profile.name) {
      return [];
    }

    try {
      const mentionPattern = new RegExp(`@${profile.name}`, "i");
      return messages?.filter((message) => mentionPattern.test(message.message));
    } catch (error) {
      console.error("Error filtering messages:", error);
      return [];
    }
  };

  const isCurrentUserProfile = (profile) => {
    try {
      if (isPublicRoom) {
        return profile.name === currentUserName;
      }
      return profile.email === currentUserEmail;
    } catch (error) {
      console.error("Error checking current user:", error);
      return false;
    }
  };

  const handleReply = async (message, profile) => {
    if (!replyContent?.trim()) return;

    setReplying(true);
    try {
      const { data: replyData, error: replyError } = await supabase
        .from("Chats")
        .insert([
          {
            message: replyContent,
            profileid: profile.uuid,
            roomid: roomId,
            status: "reply",
            repid: message.uuid
          }
        ]);

      if (replyError) throw replyError;

      const { error: updateError } = await supabase
        .from("Chats")
        .update({ status: "replied" })
        .eq("uuid", message.uuid);

      if (updateError) throw updateError;

      setReplyContent("");
      await fetchMessages();
    } catch (error) {
      console.error("Error handling reply:", error);
      setError("Failed to send reply");
    } finally {
      setReplying(false);
    }
  };

  const getReplyForMessage = (messageId) => {
    try {
      return messages.find(msg => msg.repid === messageId && msg.status === "reply");
    } catch (error) {
      console.error("Error getting reply:", error);
      return null;
    }
  };

  const renderMentionMessage = (message, profile) => {
    const reply = getReplyForMessage(message.uuid);
    
    const messageContent = (
      <div
        key={message.id}
        className={`p-2 rounded-md border relative ${
          message.status === "mentioned"
            ? "bg-[#3e0808b3] border border-red-800"
            : "bg-[rgb(5,37,4)] border-green-700"
        }`}
      >
        <span className="text-gray-200">{message.message}</span>
        <br />
        <span className="text-xs text-gray-400">
          Mentioned by: {message.Profiles?.name || "Unknown"}
        </span>
        <span
          className={`text-xs px-2 py-1 absolute right-2 top-2 border rounded-full ${
            message.status === "mentioned"
              ? "bg-[#3e0808b3] border border-red-800"
              : "bg-[rgb(5,37,4)] border-green-700"
          }`}
        >
          {message.status === "mentioned" ? <>Pending</> : <>Replied</>}
        </span>
      </div>
    );

    if (isLoggedIn && isCurrentUserProfile(profile) && message.status === "mentioned") {
      return (
        <Dialog key={message.id}>
          <DialogTrigger className="cursor-pointer w-full" asChild>
            {messageContent}
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] bg-[#1d1d1d]">
            <DialogHeader>
              <DialogTitle>Reply to {message.Profiles?.name}'s Mention</DialogTitle>
              <DialogDescription>
                Respond to this mention
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div>
                <h4 className="text-sm font-medium mb-1">Original Message:</h4>
                <p className="text-sm text-gray-400">{message.message}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium mb-1">Your Reply:</h4>
                <Textarea
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder="Type your reply here..."
                  className="min-h-[100px] bg-[#2d2d2d] border-gray-700"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                onClick={() => handleReply(message, profile)}
                disabled={replying || !replyContent?.trim()}
              >
                {replying ? "Sending Reply..." : "Send Reply"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      );
    }

    if (message.status === "replied" && reply) {
      return (
        <Dialog key={message.id}>
          <DialogTrigger className="cursor-pointer w-full" asChild>
            {messageContent}
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] bg-[#1d1d1d]">
            <DialogHeader>
              <DialogTitle>View Reply</DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div>
                <h4 className="text-sm font-medium mb-1">Original Message:</h4>
                <p className="text-sm text-gray-400">{message.message}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium mb-1">Reply:</h4>
                <p className="text-sm text-gray-200">{reply.message}</p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      );
    }

    return messageContent;
  };

  const renderProfileContent = (profile) => {
    if (editMode && isCurrentUserProfile(profile)) {
      return (
        <>
          <div className="flex justify-start items-center gap-3 mb-3">
            {profile.photourl ? (
              <img
                src={profile.photourl}
                className="h-12 w-12 rounded-full object-cover"
                alt=""
              />
            ) : (
              <div className="h-12 w-12 rounded-full relative flex justify-center items-center bg-white text-black">
                <span className="text-xl">{profile.name.charAt(0)}</span>
              </div>
            )}
            <div className="flex flex-col">
              <span className="text-xl font-semibold">
                {profile.name}
              </span>
              {!isPublicRoom && (
                <span className="text-sm text-gray-400">
                  {profile.email}
                </span>
              )}
            </div>
          </div>
          {!isPublicRoom && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-2">
                <Label htmlFor="org" className="text-left">
                  Organization
                </Label>
                <Input
                  id="org"
                  value={editForm.org}
                  onChange={(e) => setEditForm(prev => ({...prev, org: e.target.value}))}
                  className="col-span-3 bg-[#2d2d2d] border-gray-700"
                  maxLength={100}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-2">
                <Label htmlFor="phone" className="text-left">
                  Phone
                </Label>
                <Input
                  id="phone"
                  value={editForm.phone}
                  onChange={(e) => setEditForm(prev => ({...prev, phone: e.target.value}))}
                  className="col-span-3 bg-[#2d2d2d] border-gray-700"
                  placeholder="e.g., +1 (123) 456-7890"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-2">
                <Label htmlFor="photourl" className="text-left">
                  Photo URL
                </Label>
                <Input
                  id="photourl"
                  value={editForm.photourl}
                  onChange={(e) => setEditForm(prev => ({...prev, photourl: e.target.value}))}
                  className="col-span-3 bg-[#2d2d2d] border-gray-700"
                  placeholder="https://example.com/photo.jpg"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-2">
                <Label htmlFor="desc" className="text-left">
                  Description
                </Label>
                <Textarea
                  id="desc"
                  value={editForm.desc}
                  onChange={(e) => setEditForm(prev => ({...prev, desc: e.target.value}))}
                  className="col-span-3 min-h-[100px] bg-[#2d2d2d] border-gray-700"
                  maxLength={500}
                />
              </div>
            </div>
          )}
          {editError && (
            <div className="text-red-500 text-sm whitespace-pre-line">{editError}</div>
          )}
          <DialogFooter className="gap-2">
            <Button
              type="button"
              onClick={() => handleUpdate(profile)}
              disabled={updating}
              className="bg-green-700 hover:bg-green-600"
            >
              {updating ? "Updating..." : "Save Changes"}
            </Button>
            <Button
              type="button"
              onClick={() => setEditMode(false)}
              disabled={updating}
              variant="outline"
            >
              Cancel
            </Button>
          </DialogFooter>
        </>
      );
    }

    return (
      <>
        <div className="flex justify-start items-center gap-3 mb-3">
          {profile.photourl ? (
            <img
              src={profile.photourl}
              className="h-12 w-12 rounded-full object-cover"
              alt=""
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = ""; // Reset to initial state on error
              }}
            />
          ) : (
            <div className="h-12 w-12 rounded-full relative flex justify-center items-center bg-white text-black">
              <span className="text-xl">{profile.name.charAt(0)}</span>
            </div>
          )}
          <div className="flex flex-col">
            <span className="text-xl font-semibold">
              {profile.name}
            </span>
            {isPublicRoom && (
              <span className="text-sm text-gray-400">
                {profile.org || "No organization"}
              </span>
            )}
          </div>
        </div>
        {!isPublicRoom && (
          <div className="flex flex-col gap-3">
            <span className="text-gray-400">
              Email -{" "}
              <span className="text-gray-200">{profile.email}</span>
            </span>
            <span className="text-gray-400">
              Phone -{" "}
              <span className="text-gray-200">{profile.phone || "Not provided"}</span>
            </span>
            <span className="text-gray-400">
              Comment -{" "}
              <span className="text-gray-200">{profile.desc || "No comment"}</span>
            </span>
          </div>
        )}
        {isLoggedIn && isCurrentUserProfile(profile) && !isPublicRoom && (
          <Button
            type="button"
            onClick={() => handleEdit(profile)}
            className="mt-4 bg-blue-700 hover:bg-blue-600"
          >
            Edit Profile
          </Button>
        )}
        <div className="mt-4">
          <span className="text-lg font-semibold text-gray-300">
            Mentions
          </span>
          <div className="flex flex-col gap-2 mt-2">
            {getMessagesForProfile(profile).length > 0 ? (
              getMessagesForProfile(profile)?.map((message) =>
                renderMentionMessage(message, profile)
              )
            ) : (
              <span className="text-gray-400">
                No mentions for this user yet.
              </span>
            )}
          </div>
        </div>
      </>
    );
  };

  const renderParticipant = (profile) => (
    <Dialog key={profile.id}>
      <DialogTrigger
        asChild
        className="flex flex-col w-full border-none bg-[#1d1d1d] font-semibold text-gray-200 text-sm items-start my-2 px-3 py-7"
      >
        <Button variant="outline">
          <div className="flex gap-2 items-center">
            {profile.photourl ? (
              <img
                src={profile.photourl}
                className="h-8 w-8 rounded-full object-cover"
                alt=""
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = ""; // Reset to initial state on error
                }}
              />
            ) : (
              <div className="rounded-full relative flex justify-center items-center bg-white text-black p-3">
                <span className="absolute">{profile.name.charAt(0)}</span>
              </div>
            )}
            <div className="text-left">
              <p>{profile.name}</p>
              <p className="text-[11px] font-thin text-gray-500 text-left text-wrap">
                {profile.org ? profile.org?.trim().split(/\s+/).slice(0, 2).join(' ') : 'No organization'}
              </p>
            </div>
          </div>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] max-h-[80vh] overflow-y-auto border-gray-700 bg-[#0f0f0f]">
        <DialogHeader>
          {renderProfileContent(profile)}
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );

  if (fetchError) {
    return (
      <div className="text-red-500 p-4 text-center">
        <p>{fetchError}</p>
        <Button
          onClick={() => {
            setFetchError(null);
            fetchProfiles();
          }}
          className="mt-2"
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div>
      {loading ? (
        <div className="flex justify-center items-center p-4">
          <span className="font-semibold">Loading participants...</span>
        </div>
      ) : profiles.length === 0 ? (
        <div className="text-center p-4 text-gray-400">
          No participants found
        </div>
      ) : (
        <Accordion type="single" collapsible className="w-full">
          {groupedProfiles?.map(([org, orgProfiles], index) => (
            <AccordionItem className="border-none" key={org} value={`org-${index}`}>
              <AccordionTrigger className="py-2 bg-[#1d1d1d] w-full rounded-lg pr-3 my-1 hover:bg-[#3e3e3e] hover:no-underline">
                <div className="flex flex-row items-center font-semibold text-gray-200 text-sm px-2 py-1">
                  <span className="text-base font-semibold">{org}&nbsp;</span>
                  <span className="text-sm text-gray-400">({orgProfiles.length})</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="p-0">
                <div>
                  {orgProfiles.map(renderParticipant)}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
};

export default ParticipantList;
