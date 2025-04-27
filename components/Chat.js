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
import { MdOutlineDeleteOutline } from "react-icons/md";
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
      setLoading(false);
    }
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

      const { data, error } = await supabase.from("Chats").insert([
        {
          profileid: profiles[0].uuid,
          message: msg,
          roomid: roomId,
          status: status,
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

  return (
    <div className="h-screen flex flex-col relative">
      <Navbar name={name} />
      <div className="absolute inset-0 flex items-center justify-center opacity-5 z-0 pointer-events-none">
        <img 
          src="/logomain.png" 
          alt="Background Logo" 
          className="max-w-[300px] max-h-[300px] object-contain" 
        />
      </div>
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
                      {console.log(msgg)
                      }
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
                    <div className="bg-black px-2 py-1 rounded-lg max-w-xs">
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
  );
};

export default Chat;
