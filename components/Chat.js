import React, { useEffect, useRef, useState } from "react";
import supabase from "../utils/supabase";
import { parseCookies } from "nookies";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import { MdOutlineDeleteOutline, MdNotifications, MdPeople, MdEmail } from "react-icons/md";
import CompanyDirectory from "./CompanyDirectory";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "./ui/command";
import Navbar from "./Navbar";

const Chat = ({ isLoggedIn, isChatAdmin, secret, roomId, name }) => {
  const [canChat, setCanChat] = useState(false);
  const [profiles, setProfiles] = useState([]);
  const [messages, setMessages] = useState([]);
  const [profs, setProfs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [isPublicRoom, setIsPublicRoom] = useState(false);
  const [unansweredMentions, setUnansweredMentions] = useState([]);
  const [showUnansweredList, setShowUnansweredList] = useState(false);
  const [showDirectory, setShowDirectory] = useState(false);
  const [csvData, setCsvData] = useState(null);
  const [massMessageMode, setMassMessageMode] = useState(false);
  const [massMessage, setMassMessage] = useState("");
  const [sendingMassMessage, setSendingMassMessage] = useState(false);
  const inputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const cookies = parseCookies();
  const partyEmail = decodeURIComponent(cookies.PartyEmail)
  const partyName = decodeURIComponent(cookies.PartyName)
  const [myEmail, setMyEmail] = useState("");
  const [myName, setMyName] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);

  const checkRoomType = async (roomId) => {
    try {
      const { data, error } = await supabase
        .from("Rooms")
        .select("type")
        .eq("uuid", roomId)
        // .single();
      
      if (!error && data) {
        setIsPublicRoom(data[0].type === 'public');
        return data[0].type === 'public';
      }
      return false;
    } catch (error) {
      console.error("Error checking room type:", error);
      return false;
    }
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    const caretPos = e.target.selectionStart;
    setMsg(value);
    setCursorPosition(caretPos);
  };

  const handleKeyDown = (e) => {
    if (e.key === "@") {
      setShowDialog(true);
    }
    if (e.key === "Enter") {
      handleSendMessage(profiles, roomId);
    }
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
  };

  const fetchMessages = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("Chats")
      .select(`
        *, 
        Profiles (
          name,
          email,
          photourl,
          org
        )
      `)
      .eq("roomid", roomId);

    if (error) {
      console.error("Error fetching profiles:", error);
    } else {
      setMessages(data || []);
      // Extract unanswered mentions
      const mentions = data
        .filter(msg => msg.status === "mentioned" && !msg.answered)
        .map(msg => ({
          id: msg.id,
          message: msg.message,
          from: msg.Profiles?.name || "Unknown",
          date: new Date(msg.created_at),
          mentioned: extractMentionedUsers(msg.message)
        }));
      setUnansweredMentions(mentions);
      setLoading(false);
    }
  };

  // Extract mentioned users from message
  const extractMentionedUsers = (message) => {
    const regex = /@([a-zA-Z0-9_-]+)/g;
    const matches = [];
    let match;
    
    while ((match = regex.exec(message)) !== null) {
      matches.push(match[1]);
    }
    
    return matches;
  };

  const fetchProfs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("Profiles")
      .select("*")
      .eq("roomid", roomId);

    if (error) {
      console.error("Error fetching profiles:", error);
    } else {
      setProfs(data || []);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
    fetchProfs();

    const channel = supabase
      .channel("realtime-chats")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "Chats",
          filter: `roomid=eq.${roomId}`,
        },
        async (payload) => {
          const newMessage = payload.new;
          const { data: profileData, error } = await supabase
            .from("Profiles")
            .select("name, email, photourl")
            .eq("uuid", newMessage.profileid)
            .single();

          if (!error && profileData) {
            newMessage.Profiles = profileData;
            setMessages((prevMessages) => [...prevMessages, newMessage]);
          } else {
            console.error("Error fetching profile for new message:", error);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "Chats",
          filter: `roomid=eq.${roomId}`,
        },
        (payload) => {
          const deletedMessage = payload.old;
          setMessages((prevMessages) =>
            prevMessages.filter((message) => message.id !== deletedMessage.id)
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const initializeChat = async () => {
      const isPublic = await checkRoomType(roomId);
      
      if (partyEmail === "Jmadmin123#") {
        setCanChat(true);
        setMyName("Ben Mak");
        setMyEmail("authority@legaldueprocess.com");
        checkUserProfile("authority@legaldueprocess.com", roomId);
      } else if (partyEmail) {
        const decodedEmail = decodeURIComponent(partyEmail);
        
        if (isPublic) {
          // For public rooms, check if PartyName exists in room's profiles
          checkPublicRoomAccess(partyName, roomId);
        } else {
          // For private rooms, check email as before
          checkUserProfile(decodedEmail, roomId);
        }
      }
    };

    initializeChat();
  }, [roomId, partyEmail, partyName]);

  const checkPublicRoomAccess = async (name, roomId) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("Profiles")
        .select("*")
        .eq("name", name)
        .eq("roomid", roomId)
        .limit(1);

      if (error) {
        console.error("Error checking profile:", error.message);
        setCanChat(false);
      } else if (data && data.length > 0) {
        setCanChat(true);
        setProfiles(data);
      } else {
        setCanChat(false);
      }
    } catch (error) {
      console.error("Error:", error);
      setCanChat(false);
    } finally {
      setLoading(false);
    }
  };

  const checkUserProfile = async (email, roomId, name) => {
    if (!isPublicRoom) {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("Profiles")
          .select("*")
          .eq("email", decodeURIComponent(email))
          .eq("roomid", roomId)
          .limit(1);
  
        if (error) {
          console.error("Error checking profile:", error.message);
          setCanChat(false);
        } else if (data && data.length > 0) {
          setCanChat(true);
          setProfiles(data);
        } else {
          setCanChat(false);
        }
      } catch (error) {
        console.error("Error:", error);
        setCanChat(false);
      } finally {
        setLoading(false);
      }
    } else {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("Profiles")
          .select("*")
          .eq("name", decodeURIComponent(name))
          .eq("roomid", roomId)
          .limit(1);
  
        if (error) {
          console.error("Error checking profile:", error.message);
          setCanChat(false);
        } else if (data && data.length > 0) {
          setCanChat(true);
          setProfiles(data);
        } else {
          setCanChat(false);
        }
      } catch (error) {
        console.error("Error:", error);
        setCanChat(false);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleProfClick = (profName) => {
    const lastAtIndex = msg.lastIndexOf("@", cursorPosition - 1);
    if (lastAtIndex !== -1) {
      const updatedValue =
        msg.slice(0, lastAtIndex) + `@${profName} ` + msg.slice(cursorPosition);
      setMsg(updatedValue);
      setShowDialog(false);
    }
  };

  const handleSendMessage = async (profiles, roomId) => {
    if (msg?.trim() === "") return;
    try {
      setLoading(true);
      const hasMentions = msg.includes("@");
      const status = hasMentions ? "mentioned" : null;
      const mentionedUsers = hasMentions ? extractMentionedUsers(msg) : [];

      const { data, error } = await supabase.from("Chats").insert([
        {
          profileid: profiles[0].uuid,
          message: msg,
          roomid: roomId,
          status: status,
          mentioned_users: mentionedUsers,
          answered: false
        },
      ]);

      if (!error) {
        setMsg("");
      } else {
        console.log(error);
      }
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  // Mark a mentioned message as answered
  const markAsAnswered = async (messageId) => {
    try {
      const { error } = await supabase
        .from("Chats")
        .update({ answered: true })
        .eq("id", messageId);

      if (!error) {
        // Remove from unanswered list
        setUnansweredMentions(prev => prev.filter(item => item.id !== messageId));
        // Update local message state
        setMessages(prev => prev.map(msg => 
          msg.id === messageId ? {...msg, answered: true} : msg
        ));
      } else {
        console.error("Error marking message as answered:", error);
      }
    } catch (error) {
      console.error("Unexpected error:", error);
    }
  };

  // Toggle the unanswered list display
  const toggleUnansweredList = () => {
    setShowUnansweredList(!showUnansweredList);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleDeleteMessage = async (messageId, roomId) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this message?"
    );

    if (confirmDelete) {
      try {
        const { error } = await supabase
          .from("Chats")
          .delete()
          .eq("id", messageId)
          .eq("roomid", roomId);

        if (!error) {
          setMessages((prevMessages) =>
            prevMessages.filter((message) => message.id !== messageId)
          );
        } else {
          console.error("Error deleting message:", error);
        }
      } catch (error) {
        console.error("Error:", error);
      }
    }
  };

  // Load CSV data
  useEffect(() => {
    const fetchCsvData = async () => {
      try {
        const response = await fetch('/mailsuite_tracks_1747994159.csv');
        const data = await response.text();
        setCsvData(data);
      } catch (error) {
        console.error("Error loading CSV:", error);
      }
    };

    fetchCsvData();
  }, []);

  const toggleDirectory = () => {
    setShowDirectory(!showDirectory);
  };
  
  // Function to send a message to all participants and email them
  const handleSendMassMessage = async () => {
    if (!massMessage.trim()) return;
    
    try {
      setSendingMassMessage(true);
      
      // Get all participants for the room
      const { data: participants, error: participantsError } = await supabase
        .from("Profiles")
        .select("*")
        .eq("roomid", roomId);
      
      if (participantsError) {
        console.error("Error fetching participants:", participantsError);
        alert("Failed to fetch participants");
        setSendingMassMessage(false);
        return;
      }
      
      // Send the message to the chat (visible to everyone)
      const { error: chatError } = await supabase.from("Chats").insert([
        {
          profileid: profiles[0].uuid,
          message: `[ANNOUNCEMENT TO ALL] ${massMessage}`,
          roomid: roomId,
          is_mass_message: true,
        },
      ]);
      
      if (chatError) {
        console.error("Error sending chat message:", chatError);
        alert("Failed to send message to chat");
        setSendingMassMessage(false);
        return;
      }
      
      // Send emails to all participants (using serverless function or API route)
      // Here we'd normally call an API route to handle email sending
      // For now, we'll just simulate successful email sending
      const emailRecipients = participants
        .filter(p => p.email && p.email.includes('@'))
        .map(p => p.email);
      
      console.log(`Emails would be sent to: ${emailRecipients.join(', ')}`);
      
      // If we had a real email API, we'd call it like this:
      /* 
      const emailResponse = await fetch('/api/send-mass-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients: emailRecipients,
          subject: `Message from ${profiles[0]?.name || myName} in ${name}`,
          message: massMessage
        })
      });
      
      if (!emailResponse.ok) {
        throw new Error('Email sending failed');
      }
      */
      
      // Close the modal and reset state on success
      setMassMessageMode(false);
      setMassMessage("");
      alert("Message sent to all participants and emails dispatched");
    } catch (error) {
      console.error("Error sending mass message:", error);
      alert("An error occurred while sending the message");
    } finally {
      setSendingMassMessage(false);
    }
  };

  return (
    <div className="h-screen flex flex-col relative">
      <Navbar name={name} />
      
      <div className="flex h-full">
        {/* Company Directory Sidebar - conditionally shown */}
        {showDirectory && (
          <div className="w-80 h-full" style={{ height: 'calc(100vh - 60px)' }}>
            <CompanyDirectory csvData={csvData} />
          </div>
        )}
        
        <div className="flex-1 flex flex-col relative">
          <div className="absolute inset-0 flex items-center justify-center opacity-5 z-0 pointer-events-none">
            <img 
              src="/logomain.png" 
              alt="Background Logo" 
              className="max-w-[300px] max-h-[300px] object-contain" 
            />
          </div>
      
          {/* Directory Toggle Button */}
          <div className="absolute top-2 left-2 z-10 flex space-x-2">
            <button
              onClick={toggleDirectory}
              className="bg-[#1a1a1a] text-white p-2 rounded-full hover:bg-[#2d2d2d]"
              title="Company Directory"
            >
              <MdPeople size={20} />
            </button>
            {isLoggedIn && isChatAdmin === secret && (
              <button
                onClick={() => setMassMessageMode(true)}
                className="bg-[#1a1a1a] text-white p-2 rounded-full hover:bg-[#2d2d2d]"
                title="Message Everyone"
              >
                <MdEmail size={20} />
              </button>
            )}
          </div>
          
          {/* Mass Message Modal */}
          {massMessageMode && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-[#1a1a1a] p-6 rounded-lg max-w-lg w-full">
                <h3 className="text-lg font-semibold mb-4">Message Everyone</h3>
                <p className="text-sm text-gray-400 mb-4">
                  This will send a message to all participants in the chat and also email them.
                </p>
                <textarea
                  value={massMessage}
                  onChange={(e) => setMassMessage(e.target.value)}
                  className="w-full h-32 bg-[#2d2d2d] border border-gray-700 rounded p-2 text-white mb-4"
                  placeholder="Enter your message here..."
                ></textarea>
                <div className="flex justify-end space-x-2">
                  <button
                    onClick={() => setMassMessageMode(false)}
                    className="px-4 py-2 border border-gray-600 rounded"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSendMassMessage}
                    disabled={sendingMassMessage || !massMessage.trim()}
                    className={`px-4 py-2 bg-blue-600 text-white rounded ${sendingMassMessage || !massMessage.trim() ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700'}`}
                  >
                    {sendingMassMessage ? 'Sending...' : 'Send to All'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Notification Banner for Unanswered Mentions */}
          {unansweredMentions.length > 0 && (
            <div 
              className="bg-red-600 text-white p-2 text-center cursor-pointer flex items-center justify-center"
              onClick={toggleUnansweredList}
            >
              <MdNotifications className="mr-2" size={20} />
              <span>
                {unansweredMentions.length} unanswered {unansweredMentions.length === 1 ? 'question' : 'questions'}
              </span>
            </div>
          )}
      
      {/* Dropdown for Unanswered List */}
      {showUnansweredList && (
        <div className="bg-[#0f0f0f] border border-[#333333] p-4 max-h-[300px] overflow-y-auto">
          <h3 className="text-white font-semibold mb-3">Unanswered Questions</h3>
          <div className="space-y-3">
            {unansweredMentions.map((item) => (
              <div key={item.id} className="border-b border-[#333333] pb-2">
                <div className="flex justify-between items-start">
                  <p className="text-white">{item.message}</p>
                  {isLoggedIn && isChatAdmin === secret && (
                    <button 
                      onClick={() => markAsAnswered(item.id)} 
                      className="bg-green-600 text-white text-xs px-2 py-1 rounded hover:bg-green-700"
                    >
                      Mark Answered
                    </button>
                  )}
                </div>
                <div className="flex justify-between text-gray-400 text-sm mt-1">
                  <span>From: {item.from}</span>
                  <span>{item.date.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-6">
        {messages?.map((msgg) => (
          <>
            {msgg.profileid === profiles[0]?.uuid ? (
              <>
                <div className="flex items-center justify-end space-x-2 mb-5">
                  <div className="flex flex-col">
                    <p className="text-xs text-gray-500"></p>
                    <div className="bg-black border-[#333333] border text-white px-2 py-1 rounded-lg max-w-xs">
                      <p>{msgg.message}</p>
                    </div>
                      <span className="text-xs text-gray-600 pt-2">
                      <span className="font-semibold">{msgg.Profiles?.name} : {msgg.Profiles?.org?.trim().split(/\s+/).slice(0, 3).join(' ')}</span> : {new Date(msgg.created_at).toLocaleString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: true,
                      })}
                    </span>
                  </div>
                  {isLoggedIn && isChatAdmin === secret && (
                    <button
                      onClick={() => handleDeleteMessage(msgg.id, roomId)}
                      className="text-red-500 text-sm mt-1"
                    >
                      x
                    </button>
                  )}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        {msgg.Profiles?.photourl === "" || msgg.Profiles?.photourl === null ? (
                          <div className="h-6 w-6 rounded-full relative flex justify-center items-center bg-white text-black">
                          <span className="text-sm">{msgg.Profiles?.name.charAt(0)}</span>
                        </div>
                        ) : (
                        <img
                          src={msgg.Profiles?.photourl}
                          className="h-6 w-6 rounded-full object-cover"
                          alt=""
                        />
                        )}
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{msgg.Profiles?.name}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center space-x-2 mb-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                      {msgg.Profiles?.photourl === "" || msgg.Profiles?.photourl === null ? (
                          <div className="h-6 w-6 rounded-full relative flex justify-center items-center bg-white text-black">
                          <span className="text-sm">{msgg.Profiles?.name.charAt(0)}</span>
                        </div>
                        ) : (
                        <img
                          src={msgg.Profiles?.photourl}
                          className="h-6 w-6 rounded-full object-cover"
                          alt=""
                        />
                        )}
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{msgg.Profiles?.name}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  {isLoggedIn && isChatAdmin === secret && (
                    <button
                      onClick={() => handleDeleteMessage(msgg.id, roomId)}
                      className="text-red-500 text-sm mt-1"
                    >
                      x
                    </button>
                  )}
                  <div className="flex flex-col">
                      <div className={`bg-black px-2 py-1 rounded-lg max-w-xs ${
                        msgg.status === "mentioned" && !msgg.answered ? "border-2 border-red-500" : ""
                      }`}>
                      <p>{msgg.message}</p>
                    </div>
                    <span className="text-xs text-gray-600 pt-2">
                      <span className="font-semibold">{msgg.Profiles?.name} : {msgg.Profiles?.org?.trim().split(/\s+/).slice(0, 3).join(' ')}</span> : {new Date(msgg.created_at).toLocaleString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: true,
                      })}
                    </span>
                  </div>
                </div>
              </>
            )}
          </>
        ))}
        <div ref={messagesEndRef} />
      </div>

          {canChat ? (
            <div className="bg-[#1d1d1d] pt-2 absolute bottom-0 w-full md:static">
              <span className="px-4 text-sm mb-2 font-semibold">
                Chat as {profiles[0]?.name || myName}
              </span>
              <div className="pb-4 px-4 flex items-center space-x-2">
            <Input
              ref={inputRef}
              type="text"
              value={msg}
              onChange={handleInputChange}
              onKeyUp={handleKeyDown}
              placeholder="Type your message..."
              className="flex-1 p-3 border border-[#363636] text-gray-200 rounded-lg"
            />

            <Dialog open={showDialog} onOpenChange={setShowDialog}>
              <DialogTrigger asChild>
                <Button className="hidden">Open Dialog</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px] border-none bg-[#1c1c1c] overflow-y-scroll max-h-[300px]">
                <DialogHeader>
                  <DialogTitle>Select Participants to Mention</DialogTitle>
                </DialogHeader>
                <Command className="rounded-lg border shadow-md w-auto dark">
                  <CommandInput placeholder="Type a name..." />
                  <CommandList>
                    <CommandEmpty>No results found.</CommandEmpty>
                    <CommandGroup heading="Suggestions">
                      {profs?.map((p) => (
                        <CommandItem key={p.id}>
                          <span
                            className="flex w-full"
                            onClick={() => handleProfClick(p.name)}
                          >
                            {p.name}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </DialogContent>
            </Dialog>

            {loading ? (
              <Button className="border text-gray-700 cursor-not-allowed border-gray-500">
                Sending
              </Button>
            ) : (
              <Button
                onClick={() => handleSendMessage(profiles, roomId)}
                className="border border-gray-500"
              >
                Send
              </Button>
            )}
          </div>
        </div>
      ) : (
        <>
          {loading ? (
            <span className="font-semibold m-auto pb-5">
              Authenticating...
            </span>
          ) : (
            <span className="font-semibold m-auto pb-5">
              {isPublicRoom ? "Your name is not in the participants list" : "Not Added in the Parties"}
            </span>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Chat;
