import LoginCreate from "@/components/LoginCreate";
import { parse } from "cookie";
import { useRouter } from "next/router";
import React, { useEffect, useState } from "react";
import supabase from "@/utils/supabase";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";

const CreateRooms = () => {
  const ChatAdminSecret = "shdbfjhsbfjhsbadjhfbajsd";
  const [isLoading, setIsLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isChatAdmin, setIsChatAdmin] = useState("");
  const [roomName, setRoomName] = useState("");
  const [roomType, setRoomType] = useState("normal"); // New state for room type
  const [rooms, setRooms] = useState([]);

  useEffect(() => {
    // Parse the cookie after the page is mounted
    const cookies = parse(document.cookie);
    console.log(cookies);
    
    setIsLoggedIn(cookies.isLoggedIn === "true");
    if (cookies.isChatAdmin === ChatAdminSecret) {
      setIsChatAdmin(cookies.isChatAdmin);
    }
  }, []);

  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
    setIsChatAdmin(ChatAdminSecret);
  };

  // Fetch records from Supabase
  useEffect(() => {
    const fetchRooms = async () => {
      const { data, error } = await supabase.from("Rooms").select("*");

      if (error) {
        console.error("Error fetching rooms:", error);
      } else {
        setRooms(data);
      }
    };

    fetchRooms();

    // Parse the cookie after the page is mounted
    const cookies = parse(document.cookie);
    console.log(cookies);

    setIsLoggedIn(cookies.isLoggedIn === "true");
  }, []);

  // Handle creating a room
  const handleCreate = async () => {
    if (!roomName.trim()) return; // Avoid empty names

    setIsLoading(true);

    // Create a new room in the Rooms table with type field
    const { data: newRoom, error: createError } = await supabase
      .from("Rooms")
      .insert([{ 
        name: roomName,
        type: roomType === 'public' ? 'public' : null // Set type based on selection
      }])
      .select("*")
      .single();

    if (createError) {
      console.error("Error creating room:", createError);
      setIsLoading(false);
      return;
    }

    console.log("Room created:", newRoom);

    // Add a record to the Profiles table with the new room ID
    const { data: profileData, error: profileError } = await supabase
      .from("Profiles")
      .insert([
        {
          name: "Ben Mak",
          email: "authority@legaldueprocess.com",
          phone: "+44 7714 303099",
          org: "Justice Minds",
          photourl:
            "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTybl1kq7Kaz11RCjLzRtpPL84VwxIZ8pb8vw&s",
          desc: "Ben Mak London - Justiceminds",
          roomid: newRoom.uuid, // Use the room ID from the newly created room
        },
      ]);

    if (profileError) {
      console.error("Error creating profile:", profileError);
    } else {
      console.log("Profile created:", profileData);
    }

    // Refetch the rooms to update the UI
    const { data: updatedRooms, error: fetchError } = await supabase
      .from("Rooms")
      .select("*");

    if (fetchError) {
      console.error("Error fetching rooms after create:", fetchError);
    } else {
      setRooms(updatedRooms);
    }

    setRoomName(""); // Clear the input field
    setRoomType("normal"); // Reset room type to default
    setIsLoading(false);
  };

  return (
    <>
      {isLoggedIn && isChatAdmin === ChatAdminSecret ? (
        <div className="flex flex-col items-center justify-center h-screen overflow-y-auto">
          <Card className="w-[350px] dark mb-4">
            <CardHeader>
              <CardTitle>Create Room</CardTitle>
              <CardDescription>Generate Rooms for all Parties.</CardDescription>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleCreate();
                }}
              >
                <div className="grid w-full items-center gap-4">
                  <div className="flex flex-col space-y-1.5">
                    <Label htmlFor="name">Room Name</Label>
                    <Input
                      id="name"
                      placeholder="Write the name"
                      value={roomName}
                      onChange={(e) => setRoomName(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col space-y-1.5">
                    <Label>Room Type</Label>
                    <div className="flex space-x-4">
                      <label className="flex items-center space-x-2">
                        <input
                          type="radio"
                          value="normal"
                          checked={roomType === "normal"}
                          onChange={(e) => setRoomType(e.target.value)}
                          className="form-radio"
                        />
                        <span>Normal</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input
                          type="radio"
                          value="public"
                          checked={roomType === "public"}
                          onChange={(e) => setRoomType(e.target.value)}
                          className="form-radio"
                        />
                        <span>Public</span>
                      </label>
                    </div>
                  </div>
                </div>
              </form>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline">Cancel</Button>
              {isLoading ? (
                <Button className="bg-[#1c1c1c] text-gray-500">
                  Creating ...
                </Button>
              ) : (
                <Button onClick={handleCreate}>Create</Button>
              )}
            </CardFooter>
          </Card>

          <div className="w-[350px]">
            <h2 className="text-lg font-semibold mb-2">Existing Rooms</h2>
            <ul className="space-y-2">
              {rooms.map((room) => (
                <Link
                  target="_blank"
                  key={room.id}
                  className={`p-2 ${room.type === "public" ? "bg-green-900" : "bg-[#1c1c1c]"} rounded shadow-sm flex justify-between`}
                  href={room.uuid}
                >
                  <span>{room.name}</span>
                  <span className="text-gray-500 text-sm">{room.id}</span>
                  {/* <span className="text-gray-500 text-sm">{room.type}</span> */}
                </Link>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <LoginCreate onSuccess={handleLoginSuccess} />
      )}
    </>
  );
};

export default CreateRooms;
