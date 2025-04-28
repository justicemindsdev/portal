import React, { useEffect, useState } from "react";
import supabase from "@/utils/supabase";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { parse } from "cookie";
import { MdOutlineDeleteOutline } from "react-icons/md";
import LoginCreate from "@/components/LoginCreate";

const CanvasPages = () => {
  const ChatAdminSecret = "shdbfjhsbfjhsbadjhfbajsd";
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isChatAdmin, setIsChatAdmin] = useState("");
  const [canvases, setCanvases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = (canvasUUID) => {
    const fullURL = `${window.location.origin}/canvas/${canvasUUID}`;
    
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

  // Fetch canvases from Supabase
  useEffect(() => {
    const fetchCanvases = async () => {
      setLoading(true);
      
      try {
        // Check if the Canvases table exists
        const { error: tableError } = await supabase
          .from('Canvases')
          .select('count')
          .limit(1);

        if (tableError) {
          console.log('Canvases table might not exist yet. Will be created when first canvas is added.');
        }
        
        // Fetch canvases
        const { data, error } = await supabase
          .from("Canvases")
          .select("*")
          .order('created_at', { ascending: false });

        if (error && error.code !== '42P01') { // 42P01 is the error code for "relation does not exist"
          console.error("Error fetching canvases:", error);
        } else {
          setCanvases(data || []);
        }
      } catch (error) {
        console.error("Error in fetchCanvases:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCanvases();
  }, []);

  const deleteCanvas = async (canvasId) => {
    setLoading(true);
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this canvas?"
    );

    if (confirmDelete) {
      try {
        // Delete the canvas from the "Canvases" table
        const { error: dbError } = await supabase
          .from("Canvases")
          .delete()
          .eq("id", canvasId);
          
        if (dbError) {
          throw new Error(`Database error: ${dbError.message}`);
        }
  
        // Update the canvases state
        setCanvases((prevCanvases) => prevCanvases.filter((canvas) => canvas.id !== canvasId));
      } catch (error) {
        console.error("Error deleting canvas:", error.message);
      } finally {
        setLoading(false);
      }
    }
    setLoading(false);
  };

  return (
    <>
      {isLoggedIn ? (
        <div className="flex flex-col items-center justify-center text-center h-screen overflow-y-auto">
          <div className="w-[650px]">
            <h2 className="text-lg font-semibold mb-2">Canvas Pages</h2>
            {loading && <p>Loading...</p>}
            
            {canvases.length === 0 && !loading ? (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">No canvas pages available.</p>
                <p className="text-gray-400 mb-6">Create your first canvas page to get started!</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {canvases.map((canvas) => (
                  <div key={canvas.id} className="flex items-center space-x-2 w-full">
                    <span>{new Date(canvas.created_at).toLocaleString()}</span>
                    <Link
                      className={`p-2 ${canvas.is_public ? "bg-green-900" : "bg-[#1c1c1c]"} rounded shadow-sm flex-1 justify-around`}
                      href={`/canvas/${canvas.uuid}`}
                    >
                      <span>{canvas.title}</span>
                    </Link>
                    
                    {isChatAdmin === ChatAdminSecret && (
                      <button 
                        onClick={() => deleteCanvas(canvas.id)}
                        className=""
                        disabled={loading}
                      >
                        <MdOutlineDeleteOutline className="text-lg text-red-500" />
                      </button>
                    )}

                    <button
                      onClick={() => handleCopy(canvas.uuid)}
                      className="px-2 py-1 text-sm bg-blue-500 text-white rounded"
                    >
                      {copied ? "Copied!" : "Copy Link"}
                    </button>
                    
                    <Link
                      href={`/canvas/${canvas.uuid}/edit`}
                      className="px-2 py-1 text-sm bg-yellow-500 text-white rounded"
                    >
                      Edit
                    </Link>
                  </div>
                ))}
              </ul>
            )}
            
            <Button className="mt-5" asChild>
              <Link href="/canvas/create">Create New Canvas</Link>
            </Button>
          </div>
        </div>
      ) : (
        <LoginCreate onSuccess={handleLoginSuccess} onChatAdminSuccess={handleChatAdminSuccess} />
      )}
    </>
  );
};

export default CanvasPages;
