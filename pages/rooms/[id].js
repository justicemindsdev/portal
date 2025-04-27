import React, { useEffect, useState } from "react";
import { setCookie } from "nookies";
import { parse } from "cookie";
import Login from "@/components/Login";
import localFont from "next/font/local";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import ParticipantsDialogue from "@/components/ParticipantsDialogue";
import ParticipantList from "@/components/ParticipantList";
import Chat from "@/components/Chat";
import Documents from "@/components/Documents";
import CustomAcc from "@/components/CustomAcc";
import { useRouter } from "next/router";
import supabase from "@/utils/supabase";
import { Menu, Files } from "lucide-react";
import LoginPublic from "@/components/LoginPublic";

const geistSans = localFont({
  src: "../fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

const geistMono = localFont({
  src: "../fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export default function Home() {
  const ChatAdminSecret = "shdbfjhsbfjhsbadjhfbajsd";
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isChatAdmin, setIsChatAdmin] = useState("");
  const [roomExists, setRoomExists] = useState(false);
  const [showLeftPanel, setShowLeftPanel] = useState(false);
  const [showRightPanel, setShowRightPanel] = useState(false);
  const router = useRouter();
  const { id } = router.query;
  const [roomname, setRoomname] = useState("");
  const [isPublicRoom, setIsPublicRoom] = useState(false);

  const fetchRoomType = async () => {
    const { data, error } = await supabase
      .from("Rooms")
      .select("type")
      .eq("uuid", id)
      .single();
    
    if (!error && data) {
      setIsPublicRoom(data.type === 'public');
    }
  };

  useEffect(() => {
    const cookies = parse(document.cookie);
    setIsLoggedIn(cookies.isLoggedIn === "true");
    if (cookies.isChatAdmin === ChatAdminSecret) {
      setIsChatAdmin(cookies.isChatAdmin);
    }

    fetchRoomType();
    if (id) {
      const fetchRoom = async () => {
        const { data, error } = await supabase
          .from("Rooms")
          .select("*")
          .eq("uuid", id)
          .single();
        if (data) {
          setRoomExists(true);
          setRoomname(data.name);
        } else {
          setRoomExists(false);
        }
        setIsLoading(false);
        if (error) {
          console.error("Error fetching room:", error);
        }
      };
      fetchRoom();
    }
  }, [id]);

  const handleLoginSuccess = () => {
    setIsLoading(true);
    setIsLoggedIn(true);
    setIsLoading(false);
  };

  const handleChatAdminSuccess = () => {
    setIsLoading(true);
    setIsLoggedIn(true);
    setIsChatAdmin(ChatAdminSecret);
    setIsLoading(false);
  };

  const handleLogout = () => {
    setIsLoading(true);
    const allCookies = parse(document.cookie);
    Object.keys(allCookies).forEach((cookieName) => {
      setCookie(null, cookieName, "", { maxAge: -1 });
    });
    setIsLoggedIn(false);
    setIsChatAdmin("");
    setIsLoading(false);
    router.reload();
  };

  if (isLoading) return <span>Loading...</span>;
  if (!roomExists) return <span>The room does not exist.</span>;

  const LeftPanel = () => (
    <div className="h-screen p-6 overflow-scroll">
      <div className="flex flex-row pb-6 items-center justify-between gap-2">
        <div className="flex flex-row gap-2 items-center">
          <img src="/smalllogo.png" className="w-[50px]" alt="" />
          <span className="text-md font-semibold">Justiceminds</span>
        </div>
      </div>

      {isLoggedIn && isChatAdmin == ChatAdminSecret && id && (
        <ParticipantsDialogue roomId={id} />
      )}

      <span className="text-sm font-semibold">All Parties</span>

      {id ? (
        <ParticipantList roomId={id} />
      ) : (
        <span className="text-gray-500">Loading List...</span>
      )}
    </div>
  );

  const RightPanel = () => (
    <ResizablePanelGroup direction="vertical">
      <ResizablePanel defaultSize={50} className="h-full" style={{ overflow: "auto" }}>
        <div className="p-1">
          {id ? (
            <Documents
              isLoggedIn={isLoggedIn}
              isChatAdmin={isChatAdmin}
              secret={ChatAdminSecret}
              roomId={id}
            />
          ) : (
            <span className="text-gray-500">Loading Docs...</span>
          )}
        </div>
      </ResizablePanel>
      <ResizableHandle className="bg-[#373737]" />
      <ResizablePanel defaultSize={50}>
        <div className="flex h-full items-start justify-start p-4 overflow-scroll">
          {id ? (
            <CustomAcc
              isLoggedIn={isLoggedIn}
              isChatAdmin={isChatAdmin}
              secret={ChatAdminSecret}
              roomId={id}
            />
          ) : (
            <span className="text-gray-500">Loading Content...</span>
          )}
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );

  return (
    <div className="h-screen overflow-hidden">
      {/* Mobile Navigation */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 flex justify-between items-center p-2 bg-[#121212] border-b border-[#373737]">
        <Sheet open={showLeftPanel} onOpenChange={setShowLeftPanel}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[300px] p-0">
            <LeftPanel />
          </SheetContent>
        </Sheet>

        <span className="text-sm font-medium">{roomname}</span>
        <Link href="https://casework.justice-minds.com/" className="text-sm font-medium">Case Works</Link>

        <Sheet open={showRightPanel} onOpenChange={setShowRightPanel}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Files className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[300px] p-0">
            <RightPanel />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop and Mobile Layout */}
      <div className="h-full md:overflow-hidden">
        <ResizablePanelGroup
          direction="horizontal"
          className="rounded-lg w-full h-full"
        >
          {/* Left Panel - Hidden on Mobile */}
          <ResizablePanel 
            defaultSize={20} 
            className="hidden md:block overflow-y-auto"
          >
            <LeftPanel />
          </ResizablePanel>
          
          <ResizableHandle className="hidden md:block bg-[#373737]" />
          
          {/* Main Chat Panel */}
          <ResizablePanel defaultSize={55}>
            <div className="h-screen overflow-scroll bg-[#121212] pt-[60px] md:pt-0">
              {id ? (
                <Chat
                  isLoggedIn={isLoggedIn}
                  isChatAdmin={isChatAdmin}
                  secret={ChatAdminSecret}
                  roomId={id}
                  name={roomname}
                />
              ) : (
                <span className="text-gray-500">Loading Chats...</span>
              )}
            </div>
          </ResizablePanel>
          
          {/* Right Panel - Hidden on Mobile */}
          <ResizablePanel 
            className="hidden md:block border-l border-[#373737]" 
            defaultSize={25}
          >
            <RightPanel />
          </ResizablePanel>
        </ResizablePanelGroup>

        {/* Login/Logout Button */}
        {!isLoggedIn ? (
          <Dialog>
            <DialogTrigger asChild>
              <Button className="text-black hover:text-white hover:bg-[black] bg-white font-semibold fixed left-5 bottom-5">
                Login to Chat
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] h-[600px] overflow-scroll border-[#3c3c3c] bg-black">
              {isPublicRoom ? (
                <LoginPublic 
                  onSuccess={handleLoginSuccess}
                  onChatAdminSuccess={handleChatAdminSuccess} 
                  roomId={id} 
                />
              ) : (
                <Login
                  onSuccess={handleLoginSuccess}
                  onChatAdminSuccess={handleChatAdminSuccess}
                />
              )}
            </DialogContent>
          </Dialog>
        ) : (
          <Button
            className="text-black hidden md:block hover:text-white hover:bg-[black] bg-white font-semibold fixed left-5 bottom-5"
            onClick={handleLogout}
          >
            Logout
          </Button>
        )}
      </div>
    </div>
  );
}
