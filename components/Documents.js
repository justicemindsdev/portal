import React, { useEffect, useState, useRef } from "react";
import supabase from "../utils/supabase";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from "./ui/sheet";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { FiEdit2, FiX, FiMaximize2, FiMinimize2 } from "react-icons/fi";

const Documents = ({ isLoggedIn, isChatAdmin, secret, roomId }) => {
  const [Docislandss, setDocislandss] = useState([]);
  const [documents, setDocuments] = useState({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [newIslandName, setNewIslandName] = useState("");
  const [editingIsland, setEditingIsland] = useState(null);
  const [editName, setEditName] = useState("");
  const [previewDoc, setPreviewDoc] = useState(null);
  const [previewIslandUuid, setPreviewIslandUuid] = useState(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [editingFileName, setEditingFileName] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);

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
        // Close the preview if the deleted file is currently being previewed
        if (previewDoc && previewDoc.name === fileName && previewIslandUuid === islandUuid) {
          setShowPreview(false);
          setPreviewDoc(null);
          setPreviewIslandUuid(null);
        }
      }
    } catch (err) {
      console.error("Unexpected error deleting file:", err);
    }
  };

  // Updated to handle multiple files
  const handleFileUpload = async (event, islandUuid) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    setUploading(true);
    setUploadProgress(0);
    
    try {
      const uploadPromises = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const folderPath = `${roomId}/${islandUuid}/`;
        uploadPromises.push(
          supabase.storage
            .from("Imagesanddocs")
            .upload(`${folderPath}${file.name}`, file, {
              cacheControl: "3600",
              upsert: false,
            })
        );
      }
      
      // Process all upload promises
      for (let i = 0; i < uploadPromises.length; i++) {
        await uploadPromises[i];
        // Update progress
        setUploadProgress(Math.round(((i + 1) / uploadPromises.length) * 100));
      }
      
      // Refresh document list
      fetchDocumentsForIsland(islandUuid);
    } catch (err) {
      console.error("Unexpected error uploading files:", err);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // File renaming function
  const handleRenameFile = async () => {
    if (!previewDoc || !previewIslandUuid || !newFileName.trim()) return;
    
    const oldPath = `${roomId}/${previewIslandUuid}/${previewDoc.name}`;
    const fileExt = previewDoc.name.split('.').pop();
    const newName = newFileName.endsWith(`.${fileExt}`) ? newFileName : `${newFileName}.${fileExt}`;
    const newPath = `${roomId}/${previewIslandUuid}/${newName}`;
    
    try {
      // First, download the file
      const { data: fileData, error: downloadError } = await supabase.storage
        .from("Imagesanddocs")
        .download(oldPath);
      
      if (downloadError) {
        console.error("Error downloading file for rename:", downloadError.message);
        return;
      }
      
      // Then upload with the new name
      const { error: uploadError } = await supabase.storage
        .from("Imagesanddocs")
        .upload(newPath, fileData, {
          cacheControl: "3600",
          upsert: false,
        });
        
      if (uploadError) {
        console.error("Error uploading file with new name:", uploadError.message);
        return;
      }
      
      // Then delete the old file
      const { error: deleteError } = await supabase.storage
        .from("Imagesanddocs")
        .remove([oldPath]);
        
      if (deleteError) {
        console.error("Error deleting old file:", deleteError.message);
      }
      
      // Update preview doc and fetch documents
      setPreviewDoc({...previewDoc, name: newName});
      fetchDocumentsForIsland(previewIslandUuid);
      setEditingFileName(false);
    } catch (err) {
      console.error("Unexpected error renaming file:", err);
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

  const openPreview = (doc, islandUuid) => {
    setPreviewDoc(doc);
    setPreviewIslandUuid(islandUuid);
    
    // Extract the file name without extension for easier editing
    const nameParts = doc.name.split('.');
    const ext = nameParts.pop(); // Remove extension
    const baseName = nameParts.join('.'); // Handle files with multiple dots
    setNewFileName(baseName);
    
    setShowPreview(true);
  };

  const closePreview = () => {
    setShowPreview(false);
    setPreviewDoc(null);
    setPreviewIslandUuid(null);
    setIsFullScreen(false);
    setEditingFileName(false);
  };

  const toggleFullScreen = () => {
    setIsFullScreen(!isFullScreen);
  };

  const startEditFileName = () => {
    if (previewDoc) {
      // Keep the extension visible to the user for clarity
      const nameParts = previewDoc.name.split('.');
      const ext = nameParts.pop(); // Remove the extension
      const baseName = nameParts.join('.'); // Handle files with multiple dots
      
      setNewFileName(baseName);
      setEditingFileName(true);
    }
  };

  const cancelEditFileName = () => {
    setEditingFileName(false);
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

  // Render document preview content
  const renderPreviewContent = () => {
    if (!previewDoc || !previewIslandUuid) return null;

    if (isImage(previewDoc.name)) {
      return (
        <img
          src={getPublicURL(previewIslandUuid, previewDoc.name)}
          alt={previewDoc.name}
          className="max-w-full max-h-[80vh] rounded-lg object-contain"
        />
      );
    } else if (isPDF(previewDoc.name)) {
      return (
        <iframe
          src={getPublicURL(previewIslandUuid, previewDoc.name)}
          title={previewDoc.name}
          className="w-full h-[80vh] border-2 border-gray-600 rounded-lg"
        />
      );
    } else if (isDocument(previewDoc.name)) {
      return (
        <iframe
          src={getPublicURL(previewIslandUuid, previewDoc.name)}
          title={previewDoc.name}
          className="w-full h-[80vh] border-2 border-gray-600 rounded-lg"
        />
      );
    } else if (isAudio(previewDoc.name)) {
      return (
        <audio controls className="mt-10">
          <source
            src={getPublicURL(previewIslandUuid, previewDoc.name)}
            type="audio/ogg"
          />
          <source
            src={getPublicURL(previewIslandUuid, previewDoc.name)}
            type="audio/mpeg"
          />
          Your browser does not support the audio tag.
        </audio>
      );
    } else if (isVideo(previewDoc.name)) {
      return (
        <video controls className="max-w-full max-h-[80vh]">
          <source src={getPublicURL(previewIslandUuid, previewDoc.name)} type="video/mp4" />
          <source src={getPublicURL(previewIslandUuid, previewDoc.name)} type="video/ogg" />
          Your browser does not support HTML video.
        </video>
      );
    }
    return (
      <p className="text-gray-400">
        Cannot preview this file type.
      </p>
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
            <div key={index} className="w-full h-full">
              <div 
                className="w-full h-full border border-gray-700 rounded-lg bg-[#1a1a1a] cursor-pointer overflow-hidden aspect-square"
                onClick={() => doc ? openPreview(doc, islandUuid) : null}
              >
                {doc
                  ? renderThumbnail(islandUuid, doc)
                  : isAdmin && (
                      <div className="w-full h-full flex items-center justify-center text-gray-500">
                        +
                      </div>
                    )}
              </div>
              {/* Upload Dialog for empty cells */}
              {!doc && isAdmin && (
                <Dialog>
                  <DialogTrigger asChild>
                    <button type="button" aria-haspopup="dialog" aria-expanded="false" aria-controls="radix-:r15:" data-state="closed" className="w-full h-full">
                      <div className="w-full h-full border border-gray-700 rounded-lg bg-[#1a1a1a] cursor-pointer overflow-hidden aspect-square">
                        <div className="w-full h-full flex items-center justify-center text-gray-500">+</div>
                      </div>
                    </button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[800px] border-gray-700 bg-[#0f0f0f]">
                    <DialogHeader>
                      <DialogTitle className="text-white">
                        Upload Files
                      </DialogTitle>
                    </DialogHeader>
                    <div className="mt-4">
                      <Label htmlFor="uploadFiles" className="block mb-2 text-sm font-medium text-white">
                        Select multiple files to upload
                      </Label>
                      <Input
                        id="uploadFiles"
                        type="file"
                        multiple
                        onChange={(e) => handleFileUpload(e, islandUuid)}
                        disabled={uploading}
                        className="block w-full text-sm border border-gray-600 rounded-lg cursor-pointer bg-[#1a1a1a] focus:outline-none"
                      />
                      <p className="mt-1 text-xs text-gray-400">You can select multiple files at once</p>
                      {uploading && (
                        <div className="mt-4">
                          <div className="w-full bg-gray-700 rounded-full h-2.5">
                            <div 
                              className="bg-blue-600 h-2.5 rounded-full" 
                              style={{ width: `${uploadProgress}%` }}
                            ></div>
                          </div>
                          <p className="text-gray-400 mt-2">Uploading... {uploadProgress}%</p>
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
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

      {/* Right side document preview sheet */}
      <Sheet open={showPreview} onOpenChange={setShowPreview} side="right">
        <SheetContent 
          className={`${isFullScreen ? 'w-screen p-0 inset-0 max-w-full' : 'w-full md:max-w-md'} bg-[#0f0f0f] border-gray-700`}
          overlayClassName="z-50"
          style={isFullScreen ? {position: 'fixed', top: 0, left: 0, right: 0, bottom: 0} : {}}
        >
          <div className={`${isFullScreen ? 'p-4' : ''} flex flex-col h-full`}>
            <SheetHeader className="flex flex-row items-center justify-between mb-4">
              <div className="flex items-center gap-2 flex-1">
                {editingFileName ? (
                  <div className="flex items-center gap-2 flex-1">
                    <Input
                      value={newFileName}
                      onChange={(e) => setNewFileName(e.target.value)}
                      className="text-lg"
                      autoFocus
                    />
                    <Button onClick={handleRenameFile} size="sm">Save</Button>
                    <Button onClick={cancelEditFileName} variant="outline" size="sm">Cancel</Button>
                  </div>
                ) : (
                  <>
                    <SheetTitle className="text-white flex-1 overflow-hidden text-ellipsis">
                      {previewDoc?.name}
                    </SheetTitle>
                    {isLoggedIn && isChatAdmin === secret && (
                      <button
                        onClick={startEditFileName}
                        className="p-1 hover:bg-gray-700 rounded-full transition-colors"
                      >
                        <FiEdit2 size={14} />
                      </button>
                    )}
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleFullScreen}
                  className="p-1 hover:bg-gray-700 rounded-full transition-colors"
                >
                  {isFullScreen ? <FiMinimize2 size={18} /> : <FiMaximize2 size={18} />}
                </button>
                <SheetClose asChild>
                  <button className="p-1 hover:bg-gray-700 rounded-full transition-colors">
                    <FiX size={18} />
                  </button>
                </SheetClose>
              </div>
            </SheetHeader>
            
            <div className="flex-1 overflow-auto flex items-center justify-center">
              {renderPreviewContent()}
            </div>
            
            {isLoggedIn && isChatAdmin === secret && previewDoc && (
              <div className="mt-4 flex justify-center">
                <Button
                  onClick={() => handleDeleteFile(previewIslandUuid, previewDoc.name)}
                  variant="destructive"
                  className="bg-red-600 hover:bg-red-700"
                >
                  Delete
                </Button>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default Documents;
