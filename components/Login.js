import React, { useState } from "react";
import { setCookie } from "nookies";
import { useRouter } from "next/router";

const Login = ({ onSuccess, onChatAdminSuccess }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const router = useRouter()

  const handleLogin = () => {
    if (username === "jmadmin" && password === "Jmadmin123#") {
      // Set a cookie named "isLoggedIn" with value "true"
      setCookie(null, "isLoggedIn", "true", { maxAge: 900 }); // Expires in 5 minutes
      setCookie(null, "isAccessed", "true", { maxAge: 900 }); // Expires in 5 minutes
      setCookie(null, "isChatAdmin", "shdbfjhsbfjhsbadjhfbajsd", { maxAge: 900 }); // Expires in 5 minutes
      setCookie(null, "MyName", "Ben Mak", { maxAge: 900 });
      setCookie(null, "MyEmail", "authority@legaldueprocess.com", { maxAge: 900 });
      // onSuccess();
      onChatAdminSuccess();
      router.reload()
    } 
    if (username != null && password != null) {
      setCookie(null, "isLoggedIn", "true", { maxAge: 900 }); // Expires in 5 minutes
      setCookie(null, "isAccessed", "true", { maxAge: 900 });
      setCookie(null, "PartyName", username, { maxAge: 900 });
      setCookie(null, "PartyEmail", password, { maxAge: 900 });

      onSuccess();
      router.reload()
    } else {
      setErrorMessage("Something went wrong");
    }
  };

  return (
    <>
      <div className="bg-black flex flex-col items-center justify-center">
        
        <form className="flex flex-col justify-center items-center">
          <img src="/logomain.png" className="w-[200px] " alt="" />
          <div className="mb-4">
            <input
              type="text"
              placeholder="Your Name"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="px-4 py-2 w-64 bg-black border focus:border-white"
              style={{ border: "2px solid #171717", borderRadius:"5px" }}
            />
          </div>
          <div className="mb-6">
            <input
              type="password"
              placeholder="Your Email"
              autoComplete="current password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="px-4 py-2 w-64 bg-black border focus:border-white "
              style={{ border: "2px solid #171717",borderRadius:"5px" }}
            />
          </div>
          <button
            onClick={handleLogin}
            className=" text-white px-8 py-2 cursor-pointer"
            style={{ background: "#1d1d1d",borderRadius:"5px" }}
          >
            Continue to chat
          </button>
        </form>

        {errorMessage && <p className="text-red-500 mt-4">{errorMessage}</p>}
      </div>
    </>
  );
};

export default Login;
