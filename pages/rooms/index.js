import LoginCreate from "@/components/LoginCreate";
import { parse } from "cookie";
import React, { useEffect, useState } from "react";
import supabase from "@/utils/supabase";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MdOutlineDeleteOutline } from "react-icons/md";
const Rooms = () => {
  const ChatAdminSecret = "shdbfjhsbfjhsbadjhfbajsd";
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isChatAdmin, setIsChatAdmin] = useState("");
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);

  const [copied, setCopied] = useState(false);

  const handleCopy = (roomUUID) => {
    const fullURL = `${window.location.origin}/rooms/${roomUUID}`;
    console.log(fullURL);
  
    navigator.clipboard.writeText(fullURL)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
      })
      .catch((error) => {
        console.error("Failed to copy text:", error);
      });
  };

  useEffect(() => {
    const cookies = parse(document.cookie);
    setIsLoggedIn(cookies.isLoggedIn === "true");
    if (cookies.isChatAdmin === ChatAdminSecret) {
      setIsChatAdmin(cookies.isChatAdmin);
    }
  }, []);

  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
  };

  const handleChatAdminSuccess = () => {
    setIsLoggedIn(true);
    setIsChatAdmin(ChatAdminSecret);
  };

  // Fetch rooms from Supabase
  useEffect(() => {
    const fetchRooms = async () => {
      setLoading(true);
      const { data, error } = await supabase.from("Rooms").select("*");
      setLoading(false);

      if (error) {
        console.error("Error fetching rooms:", error);
      } else {
        setRooms(data);
      }
    };

    fetchRooms();
  }, []);

  const deleteRoom = async (roomId) => {
    setLoading(true);
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this message?"
    );

    if (confirmDelete) {
      try {
        // Get all files in the folder
        const { data: files, error: listError } = await supabase.storage
          .from("Imagesanddocs") // Replace with your actual bucket name
          .list(`${roomId}/`);
  
        if (listError) {
          throw new Error(`Error listing files: ${listError.message}`);
        }
  
        if (files.length > 0) {
          // Remove all files in the folder
          const filePaths = files.map((file) => `${roomId}/${file.name}`);
          const { error: removeError } = await supabase.storage
            .from("Imagesanddocs")
            .remove(filePaths);
  
          if (removeError) {
            throw new Error(`Error deleting files: ${removeError.message}`);
          }
        }
  
        // Delete the room from the "Rooms" table
        const { error: dbError } = await supabase
          .from("Rooms")
          .delete()
          .eq("id", roomId);
        if (dbError) {
          throw new Error(`Database error: ${dbError.message}`);
        }
  
        // Update the rooms state
        setRooms((prevRooms) => prevRooms.filter((room) => room.id !== roomId));
      } catch (error) {
        console.error("Error deleting room:", error.message);
      } finally {
        setLoading(false);
      }
    }
    setLoading(false)

    
  };

  return (
    <>
      {isLoggedIn && isChatAdmin === ChatAdminSecret ? (
        <div className="flex flex-col items-center justify-center  text-center h-screen overflow-y-auto">
          <div className="w-[650px]">
            <h2 className="text-lg font-semibold mb-2">Existing Rooms</h2>
            {loading && <p>Loading...</p>}
            <ul className="space-y-2">
              {rooms.map((room) => (
                <div key={room.id} className="flex items-center space-x-2 w-full">
                  <span>{new Date(room.created_at).toLocaleString()}</span>
                  <Link
                    target="_blank"
                    className={`p-2 ${room.type === "public" ? "bg-green-900" : "bg-[#1c1c1c]"} rounded shadow-sm flex-1 justify-around`}
                    href={`/rooms/${room.uuid}`}
                  >
                    
                    <span>{room.name}</span>
                    <span className="text-gray-500 text-sm ml-4">{room.id}</span>
                  </Link>
                  <button onClick={() => deleteRoom(room.id)}
                    className=""
                    disabled={loading}
                  >
                    <MdOutlineDeleteOutline className="text-lg text-red-500"  />
                  </button>
                  

                  <button
        onClick={() => handleCopy(room.uuid)}
        className="px-2 py-1 text-sm bg-blue-500 text-white rounded"
      >
        {copied ? "Copied!" : "Copy Link"}
      </button>
                </div>
              ))}
            </ul>
            <Button className="mt-5" asChild>
              <Link href="/rooms/create">Create Rooms</Link>
            </Button>
          </div>
        </div>
      ) : (
        <LoginCreate onSuccess={handleLoginSuccess} />
      )}
    </>
  );
};

export default Rooms;
