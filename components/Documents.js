import React, { useEffect, useState } from "react";
import supabase from "../utils/supabase";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { FiEdit2 } from "react-icons/fi"; // Import edit icon

const Documents = ({ isLoggedIn, isChatAdmin, secret, roomId }) => {
  const [Docislandss, setDocislandss] = useState([]);
  const [documents, setDocuments] = useState({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [newIslandName, setNewIslandName] = useState("");
  const [editingIsland, setEditingIsland] = useState(null);
  const [editName, setEditName] = useState("");

  // Fetch all Docislandss for the room
  const fetchDocislandss = async () => {
    try {
      const { data, error } = await supabase
        .from("Docislands")
        .select("*")
        .eq("roomid", roomId)
        .order("id", { ascending: false });

      if (error) {
        console.error("Error fetching Docislandss:", error.message);
      } else {
        setDocislandss(data || []);
        // Fetch documents for each island
        data?.forEach((island) => {
          fetchDocumentsForIsland(island.uuid);
        });
      }
    } catch (err) {
      console.error("Unexpected error:", err);
    }
  };

  // Fetch documents for a specific island
  const fetchDocumentsForIsland = async (islandUuid) => {
    try {
      const folderPath = `${roomId}/${islandUuid}/`;
      const { data, error } = await supabase.storage
        .from("Imagesanddocs")
        .list(folderPath);

      if (error) {
        console.error("Error fetching documents:", error.message);
      } else {
        setDocuments((prev) => ({
          ...prev,
          [islandUuid]: data || [],
        }));
      }
    } catch (err) {
      console.error("Unexpected error:", err);
    }
  };

  // Create new Docislands
  const createDocislands = async () => {
    if (!newIslandName.trim()) return;

    try {
      const { data, error } = await supabase
        .from("Docislands")
        .insert([
          {
            name: newIslandName,
            roomid: roomId,
          },
        ])
        .select();

      if (error) {
        console.error("Error creating Docislands:", error.message);
      } else {
        setNewIslandName("");
        fetchDocislandss();
      }
    } catch (err) {
      console.error("Unexpected error:", err);
    }
  };

  // Update Docislands name
  const updateIslandName = async (islandId) => {
    if (!editName.trim() || !islandId) return;

    try {
      const { error } = await supabase
        .from("Docislands")
        .update({ name: editName })
        .eq("uuid", islandId)
        .eq("roomid", roomId);

      if (error) {
        console.error("Error updating Docislands name:", error.message);
      } else {
        setEditingIsland(null);
        setEditName("");
        fetchDocislandss();
      }
    } catch (err) {
      console.error("Unexpected error:", err);
    }
  };

  // Handle edit mode
  const handleEditClick = (island) => {
    setEditingIsland(island.uuid);
    setEditName(island.name);
  };

  // Handle edit submit
  const handleEditSubmit = (e, islandId) => {
    e.preventDefault();
    updateIslandName(islandId);
  };

  // Handle edit cancel
  const handleEditCancel = () => {
    setEditingIsland(null);
    setEditName("");
  };

  // Realtime updates
  useEffect(() => {
    setLoading(true);
    fetchDocislandss();
    setLoading(false);

    const channel = supabase
      .channel(`room-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "Docislands",
          filter: `roomid=eq.${roomId}`,
        },
        () => {
          fetchDocislandss();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "storage" },
        () => {
          Docislandss.forEach((island) => {
            fetchDocumentsForIsland(island.uuid);
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  const handleDeleteFile = async (islandUuid, fileName) => {
    try {
      const filePath = `${roomId}/${islandUuid}/${fileName}`;
      const { error } = await supabase.storage
        .from("Imagesanddocs")
        .remove([filePath]);

      if (error) {
        console.error("Error deleting file:", error.message);
      } else {
        fetchDocumentsForIsland(islandUuid);
      }
    } catch (err) {
      console.error("Unexpected error deleting file:", err);
    }
  };

  const handleFileUpload = async (event, islandUuid) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploading(true);

    try {
      const folderPath = `${roomId}/${islandUuid}/`;
      const { error } = await supabase.storage
        .from("Imagesanddocs")
        .upload(`${folderPath}${file.name}`, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (error) {
        console.error("Error uploading file:", error.message);
      } else {
        fetchDocumentsForIsland(islandUuid);
      }
    } catch (err) {
      console.error("Unexpected error uploading file:", err);
    } finally {
      setUploading(false);
    }
  };

  const getPublicURL = (islandUuid, fileName) => {
    const { data } = supabase.storage
      .from("Imagesanddocs")
      .getPublicUrl(`${roomId}/${islandUuid}/${fileName}`);
    return data?.publicUrl;
  };

  const isImage = (fileName) => {
    const imageExtensions = ["jpg", "jpeg", "png", "gif", "svg", "bmp", "webp"];
    const ext = fileName.split(".").pop().toLowerCase();
    return imageExtensions.includes(ext);
  };

  const isDocument = (fileName) => {
    const documentExtensions = ["pdf", "doc", "docx", "txt"];
    const ext = fileName.split(".").pop().toLowerCase();
    return documentExtensions.includes(ext);
  };
  const isAudio = (fileName) => {
    const documentExtensions = ["mp3", "wav", "m4a"];
    const ext = fileName.split(".").pop().toLowerCase();
    return documentExtensions.includes(ext);
  };

  const isVideo = (fileName) => {
    const documentExtensions = ["mp4", "mov", "mkv", "webm"];
    const ext = fileName.split(".").pop().toLowerCase();
    return documentExtensions.includes(ext);
  };

  const isPDF = (fileName) => {
    return fileName.toLowerCase().endsWith('.pdf');
  };

  const renderThumbnail = (islandUuid, doc) => {
    if (!doc) return null;

    if (isImage(doc.name)) {
      return (
        <img
          src={getPublicURL(islandUuid, doc.name)}
          alt={doc.name}
          className="w-full h-full object-cover rounded-md"
        />
      );
    } else if (isPDF(doc.name)) {
      return (
        <div className="relative w-full h-full">
          <iframe
            src={`${getPublicURL(islandUuid, doc.name)}#view=FitH`}
            title={doc.name}
            className="absolute inset-0 w-full h-full rounded-md"
            style={{ pointerEvents: "none" }}
          />
          <div className="absolute inset-0 bg-black bg-opacity-5 flex items-center justify-center">
            <span className="text-gray-800 text-sm font-medium">PDF</span>
          </div>
        </div>
      );
    } else if (isDocument(doc.name)) {
      return (
        <div className="flex justify-center items-center w-full h-full bg-gray-600 rounded-md text-white">
          {doc.name.split(".").pop().toUpperCase()}
        </div>
      );
    } else if (isAudio(doc.name)) {
      return (
        <div className="flex justify-center items-center w-full h-full bg-gray-600 rounded-md text-white">
          {doc.name.split(".").pop().toUpperCase()}
        </div>
      );
    } else if (isVideo(doc.name)) {
      return (
        <div className="flex justify-center items-center w-full h-full bg-gray-600 rounded-md text-white">
          {doc.name.split(".").pop().toUpperCase()}
        </div>
      );
    }
    return (
      <div className="flex justify-center items-center w-full h-full bg-gray-500 rounded-md text-white">
        Empty
      </div>
    );
  };

  const renderGrid = (islandUuid) => {
    const islandDocs = documents[islandUuid] || [];
    const isAdmin = isLoggedIn && isChatAdmin === secret;

    // For admin, show all 9 cells. For non-admin, only show cells with documents
    const cells = isAdmin
      ? Array(9)
          .fill(null)
          .map((_, index) => islandDocs[index] || null)
      : islandDocs;

    return (
      <div
        className={`grid grid-cols-3 gap-2 w-full ${
          isAdmin ? "aspect-square" : ""
        }`}
      >
        {cells.map((doc, index) =>
          doc || isAdmin ? (
            <Dialog key={index}>
              <DialogTrigger className="w-full h-full">
                <div className="w-full h-full border border-gray-700 rounded-lg bg-[#1a1a1a] cursor-pointer overflow-hidden aspect-square">
                  {doc
                    ? renderThumbnail(islandUuid, doc)
                    : isAdmin && (
                        <div className="w-full h-full flex items-center justify-center text-gray-500">
                          +
                        </div>
                      )}
                </div>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[800px] border-gray-700 bg-[#0f0f0f]">
                <DialogHeader>
                  <DialogTitle className="text-white">
                    {doc ? doc.name : "Upload File"}
                  </DialogTitle>
                </DialogHeader>
                {doc ? (
                  <>
                    <div className="flex justify-center items-center mt-4">
                      {isImage(doc.name) ? (
                        <img
                          src={getPublicURL(islandUuid, doc.name)}
                          alt={doc.name}
                          className="max-w-full max-h-[500px] rounded-lg"
                        />
                      ) : isPDF(doc.name) ? (
                        <div className="w-[70%]">
                          <iframe
                            src={getPublicURL(islandUuid, doc.name)}
                            title={doc.name}
                            className="w-full h-[480px] border-2 border-gray-600 rounded-lg"
                          />
                        </div>
                      ) : isDocument(doc.name) ? (
                        <iframe
                          src={getPublicURL(islandUuid, doc.name)}
                          title={doc.name}
                          className="w-full h-[500px] border-2 border-gray-600 rounded-lg"
                        />
                      ) : isAudio(doc.name) ? (
                        <audio controls>
                          <source
                            src={getPublicURL(islandUuid, doc.name)}
                            type="audio/ogg"
                          />
                          <source
                            src={getPublicURL(islandUuid, doc.name)}
                            type="audio/mpeg"
                          />
                          Your browser does not support the audio tag.
                        </audio>
                      ) : isVideo(doc.name) ? (
                        <video width="500px" controls>
                          <source src={getPublicURL(islandUuid, doc.name)} type="video/mp4" />
                          <source src={getPublicURL(islandUuid, doc.name)} type="video/ogg" />
                          Your browser does not support HTML video.
                        </video>
                      ) : (
                        <p className="text-gray-400">
                          Cannot preview this file type.
                        </p>
                      )}
                    </div>
                    {isAdmin && (
                      <div className="flex justify-center items-center mt-4">
                        <button
                          onClick={() => handleDeleteFile(islandUuid, doc.name)}
                          className="ml-4 bg-red-600 text-white px-2 py-1 w-1/4 rounded hover:bg-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  isAdmin && (
                    <div className="mt-4">
                      <Input
                        type="file"
                        onChange={(e) => handleFileUpload(e, islandUuid)}
                        disabled={uploading}
                      />
                      {uploading && (
                        <p className="text-gray-400 mt-2">Uploading...</p>
                      )}
                    </div>
                  )
                )}
              </DialogContent>
            </Dialog>
          ) : null
        )}
      </div>
    );
  };

  return (
    <div className="p-4">
      <div className="flex flex-col justify-between items-start mb-6">
        <h1 className="text-md font-semibold mb-2">Evidences & Documents</h1>
        {isLoggedIn && isChatAdmin === secret && (
          <div className="flex gap-2">
            <Input
              placeholder="Grid Title"
              value={newIslandName}
              onChange={(e) => setNewIslandName(e.target.value)}
              className="border-none bg-[#1d1d1d] w-48"
            />
            <Button onClick={createDocislands}>Create</Button>
          </div>
        )}
      </div>

      {loading ? (
        <p>Loading document ...</p>
      ) : (
        <div className="space-y-4">
          {Docislandss.map((island) => (
            <div
              key={island.uuid}
              className="border border-[#373737] rounded-lg p-4"
            >
              <div className="flex items-center gap-2 mb-4">
                {editingIsland === island.uuid ? (
                  <form
                    onSubmit={(e) => handleEditSubmit(e, island.uuid)}
                    className="flex items-center gap-2"
                  >
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="text-lg font-semibold"
                      autoFocus
                    />
                    <Button type="submit" size="sm">
                      Save
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleEditCancel}
                    >
                      Cancel
                    </Button>
                  </form>
                ) : (
                  <>
                    <h2 className="text-lg font-semibold">{island.name}</h2>
                    {isLoggedIn && isChatAdmin === secret && (
                      <button
                        onClick={() => handleEditClick(island)}
                        className="p-1 hover:bg-gray-700 rounded-full transition-colors"
                      >
                        <FiEdit2 size={14} />
                      </button>
                    )}
                  </>
                )}
              </div>
              {renderGrid(island.uuid)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Documents;
