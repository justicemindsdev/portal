import React, { useState, useEffect } from "react";
import { setCookie } from "nookies";
import { useRouter } from "next/router";
import supabase from "../utils/supabase";

const LoginPublic = ({ onSuccess, onChatAdminSuccess, roomId }) => {
  const [username, setUsername] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [profiles, setProfiles] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const fetchRoomProfiles = async (name) => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('Profiles')
        .select('*')
        .eq('roomid', roomId)
        .eq('name', name)
        // .single();
        
      if (error) {
        if (error.code === 'PGRST116') {
          // No match found
          setProfiles(null);
        } else {
          console.error('Error fetching room profiles:', error);
          setProfiles(null);
        }
      } else {
        setProfiles(data);
      }
    } catch (error) {
      console.error('Error:', error);
      setProfiles(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Update profile check whenever username changes
  useEffect(() => {
    if (username && username.trim() !== "" && roomId) {
      fetchRoomProfiles(username);
    } else {
      setProfiles(null);
    }
  }, [username, roomId]);

  const handleLogin = async () => {
    if (!username.trim()) {
      setErrorMessage("Please enter your name");
      return;
    }

    if (username === "Ben Mak") {
      setCookie(null, "isLoggedIn", "true", { maxAge: 900 });
      setCookie(null, "isAccessed", "true", { maxAge: 900 });
      setCookie(null, "isChatAdmin", "shdbfjhsbfjhsbadjhfbajsd", { maxAge: 900 });
      setCookie(null, "MyName", "Ben Mak", { maxAge: 900 });
      setCookie(null, "MyEmail", "authority@legaldueprocess.com", { maxAge: 900 });
      setCookie(null, "PartyName", username, { maxAge: 900 });
      onChatAdminSuccess();
      router.reload();
      return;
    }

    if (!profiles) {
      setErrorMessage("Name not found in the Parties list for this room");
      return;
    }

    // User exists in profiles, proceed with login
    setCookie(null, "isLoggedIn", "true", { maxAge: 900 });
    setCookie(null, "isAccessed", "true", { maxAge: 900 });
    setCookie(null, "PartyName", username, { maxAge: 900 });
    onSuccess(profiles);
    router.reload();
  };

  return (
    <>
      <div className="bg-black flex flex-col items-center justify-center">
        <form className="flex flex-col justify-center items-center">
          <img src="/logomain.png" className="w-[200px]" alt="" />
          <div className="mb-4">
            <input
              type="text"
              placeholder="Your Name"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="px-4 py-2 w-64 bg-black border focus:border-white"
              style={{ border: "2px solid #171717", borderRadius: "5px" }}
            />
          </div>
          <button
            type="button"
            onClick={handleLogin}
            disabled={isLoading}
            className="text-white px-8 py-2 cursor-pointer disabled:opacity-50"
            style={{ background: "#1d1d1d", borderRadius: "5px" }}
          >
            {isLoading ? "Checking..." : "Continue to chat"}
          </button>
        </form>

        {errorMessage && <p className="text-red-500 mt-4">{errorMessage}</p>}
      </div>
    </>
  );
};

export default LoginPublic;
