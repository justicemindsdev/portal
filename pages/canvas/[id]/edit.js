import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import supabase from "@/utils/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { parse } from "cookie";
import LoginCreate from "@/components/LoginCreate";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Head from "next/head";
import { v4 as uuidv4 } from 'uuid';

const EditCanvas = () => {
  const ChatAdminSecret = "shdbfjhsbfjhsbadjhfbajsd";
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isChatAdmin, setIsChatAdmin] = useState("");
  const [previewMode, setPreviewMode] = useState(false);
  const [canvas, setCanvas] = useState(null);
  const [error, setError] = useState(null);
  const router = useRouter();
  const { id } = router.query;
  
  // Drag and drop functionality for images
  const [dragActive, setDragActive] = useState(false);
  const [uploadedImages, setUploadedImages] = useState([]);

  useEffect(() => {
    // Parse the cookie after the page is mounted
    const cookies = parse(document.cookie);
    setIsLoggedIn(cookies.isLoggedIn === "true");
    if (cookies.isChatAdmin === ChatAdminSecret) {
      setIsChatAdmin(cookies.isChatAdmin);
    }

    if (id) {
      fetchCanvas();
    }
  }, [id]);

  const fetchCanvas = async () => {
    try {
      // Fetch canvas details
      const { data: canvasData, error: canvasError } = await supabase
        .from("Canvases")
        .select("*")
        .eq("uuid", id)
        .single();

      if (canvasError) throw canvasError;

      setCanvas(canvasData);
      setTitle(canvasData.title);
      setContent(canvasData.content || "");
      setIsPublic(canvasData.is_public);
    } catch (error) {
      console.error("Error fetching canvas:", error);
      setError("Failed to load canvas data. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
  };

  const handleChatAdminSuccess = () => {
    setIsLoggedIn(true);
    setIsChatAdmin(ChatAdminSecret);
  };
  
  // Drag and drop handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const files = Array.from(e.dataTransfer.files);
      const imageFiles = files.filter(file => file.type.startsWith('image/'));
      
      // Process image files
      const newImages = imageFiles.map(file => ({
        id: uuidv4(),
        file,
        url: URL.createObjectURL(file),
        width: 300,
        height: 'auto',
        position: { x: 50, y: 50 }
      }));
      
      setUploadedImages(prev => [...prev, ...newImages]);
    }
  };
  
  const handleImageResize = (id, width, height) => {
    setUploadedImages(prev => 
      prev.map(img => 
        img.id === id ? { ...img, width, height } : img
      )
    );
  };
  
  const handleImageMove = (id, position) => {
    setUploadedImages(prev => 
      prev.map(img => 
        img.id === id ? { ...img, position } : img
      )
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      // First, upload any images to Supabase storage
      const imageData = [];
      
      for (const img of uploadedImages) {
        if (img.file) {
          // Only upload files that haven't been uploaded yet
          const filePath = `canvas/${id}/${img.id}-${img.file.name}`;
          
          // Upload the file to Supabase storage
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('canvas-images')
            .upload(filePath, img.file);
            
          if (uploadError) throw uploadError;
          
          // Get the public URL
          const { data: { publicUrl } } = supabase.storage
            .from('canvas-images')
            .getPublicUrl(filePath);
            
          imageData.push({
            id: img.id,
            url: publicUrl,
            width: img.width,
            height: img.height,
            position: img.position
          });
        } else {
          // Image was already uploaded, just include its data
          imageData.push({
            id: img.id,
            url: img.url,
            width: img.width,
            height: img.height,
            position: img.position
          });
        }
      }
      
      // Now update the canvas with the image data
      const canvasData = {
        title,
        content,
        is_public: isPublic,
        updated_at: new Date().toISOString(),
        images: imageData
      };
      
      const { data, error } = await supabase
        .from("Canvases")
        .update(canvasData)
        .eq("uuid", id)
        .select();

      if (error) throw error;

      router.push(`/canvas/${id}`);
    } catch (error) {
      console.error("Error updating canvas:", error);
      setError("Failed to update canvas. Please try again.");
      setIsSaving(false);
    }
  };

  const MarkdownPreview = ({ content }) => (
    <div className="prose prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({node, ...props}) => <h1 className="text-white mt-6 mb-4 text-2xl font-bold border-b border-gray-700 pb-2" {...props} />,
          h2: ({node, ...props}) => <h2 className="text-white mt-5 mb-3 text-xl font-bold" {...props} />,
          h3: ({node, ...props}) => <h3 className="text-white mt-4 mb-2 text-lg font-bold" {...props} />,
          p: ({node, ...props}) => <p className="text-gray-300 my-3 leading-relaxed" {...props} />,
          ul: ({node, ordered, ...props}) => <ul className="list-disc list-inside my-3 space-y-1" {...props} />,
          ol: ({node, ordered, ...props}) => <ol className="list-decimal list-inside my-3 space-y-1" {...props} />,
          li: ({node, ...props}) => <li className="text-gray-300 ml-4" {...props} />,
          a: ({node, ...props}) => (
            <a 
              className="text-blue-400 hover:text-blue-300 underline transition-colors" 
              target="_blank"
              rel="noopener noreferrer"
              {...props} 
            />
          ),
          blockquote: ({node, ...props}) => (
            <blockquote 
              className="border-l-4 border-gray-700 pl-4 my-4 italic text-gray-400"
              {...props} 
            />
          ),
          code({node, inline, className, children, ...props}) {
            const match = /language-(\w+)/.exec(className || '');
            return inline ? (
              <code 
                className="bg-gray-800 px-1.5 py-0.5 rounded text-sm text-gray-200"
                {...props}
              >
                {children}
              </code>
            ) : (
              <pre 
                className="bg-gray-800 p-4 rounded-md overflow-x-auto my-4"
              >
                <code 
                  className={`language-${match?.[1] || ''} text-sm text-gray-200`}
                  {...props}
                >
                  {children}
                </code>
              </pre>
            );
          },
          table({node, ...props}) {
            return (
              <div className="overflow-x-auto my-4">
                <table className="min-w-full divide-y divide-gray-700 border border-gray-700" {...props} />
              </div>
            )
          },
          th({node, ...props}) {
            return <th className="px-4 py-2 bg-gray-800 text-left text-sm font-semibold text-white border-b border-gray-700" {...props} />
          },
          td({node, ...props}) {
            return <td className="px-4 py-2 text-sm text-gray-300 border-t border-gray-700" {...props} />
          },
          img({node, ...props}) {
            return (
              <img 
                className="max-w-full h-auto rounded-lg my-4" 
                {...props}
                loading="lazy"
              />
            )
          },
          hr({node, ...props}) {
            return <hr className="my-6 border-gray-700" {...props} />
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );

  // Access control - only allow admin or creator to edit
  const canEdit = isLoggedIn && (isChatAdmin === ChatAdminSecret || (canvas && canvas.created_by === "user_id"));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return <LoginCreate onSuccess={handleLoginSuccess} onChatAdminSuccess={handleChatAdminSuccess} />;
  }

  if (!canEdit) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="mb-4">You don't have permission to edit this canvas.</p>
          <Button
            onClick={() => router.push(`/canvas/${id}`)}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            View Canvas
          </Button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Error</h1>
          <p className="mb-4 text-red-500">{error}</p>
          <Button
            onClick={() => router.push(`/canvas/${id}`)}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 mr-2"
          >
            View Canvas
          </Button>
          <Button
            onClick={() => fetchCanvas()}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Edit Canvas | {title}</title>
      </Head>
      
      <div className="container mx-auto max-w-4xl py-12">
        <Card>
          <CardHeader>
            <CardTitle>Edit Canvas</CardTitle>
            <CardDescription>
              Update your canvas content and settings.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  placeholder="Enter canvas title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="content">Content (Markdown supported)</Label>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setPreviewMode(!previewMode)}
                    className="text-sm"
                  >
                    {previewMode ? "Edit Mode" : "Preview Mode"}
                  </Button>
                </div>
                
                {previewMode ? (
                  <div className="min-h-[300px] p-4 border border-gray-700 rounded-md overflow-auto bg-[#1a1a1a]">
                    <MarkdownPreview content={content} />
                  </div>
                ) : (
                  <div className="relative">
                    <Textarea
                      id="content"
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      className="min-h-[300px] font-mono"
                      onPaste={(e) => {
                        const items = e.clipboardData.items;
                        for (let i = 0; i < items.length; i++) {
                          if (items[i].type.indexOf('image') !== -1) {
                            e.preventDefault();
                            const file = items[i].getAsFile();
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              const imgMarkdown = `![Pasted Image](${event.target.result})\n`;
                              setContent(prev => prev + imgMarkdown);
                            };
                            reader.readAsDataURL(file);
                            break;
                          }
                        }
                      }}
                    />
                    <div className="absolute bottom-2 right-2 text-xs text-gray-400">
                      Tip: You can paste images directly into the editor
                    </div>
                  </div>
                )}
              </div>
              
              {/* Drag and drop area for images */}
              <div className="space-y-2">
                <Label>Images and Files</Label>
                <div 
                  className={`relative min-h-[200px] p-4 border border-gray-700 rounded-md ${dragActive ? 'border-2 border-dashed border-blue-500 bg-blue-50/5' : ''}`}
                  onDragEnter={handleDrag}
                  onDragOver={(e) => {
                    e.preventDefault(); // Allow drop
                    handleDrag(e);
                  }}
                  onDragLeave={handleDrag}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDragActive(false);
                    
                    // Check if this is a file drop or an image being moved
                    try {
                      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                      if (data && data.id) {
                        // This is an image being moved
                        const rect = e.currentTarget.getBoundingClientRect();
                        const newX = e.clientX - rect.left - data.offsetX;
                        const newY = e.clientY - rect.top - data.offsetY;
                        
                        handleImageMove(data.id, { x: newX, y: newY });
                        return;
                      }
                    } catch (err) {
                      // Not JSON data, so it's a file drop
                      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                        handleDrop(e);
                      }
                    }
                  }}
                >
                  {/* Dragged images */}
                  {uploadedImages.map((img) => (
                    <div
                      key={img.id}
                      className="absolute cursor-move"
                      style={{
                        left: `${img.position.x}px`,
                        top: `${img.position.y}px`,
                        width: img.width ? `${img.width}px` : 'auto',
                        height: img.height ? `${img.height}px` : 'auto',
                      }}
                      draggable
                      onDragStart={(e) => {
                        // Store the initial mouse position relative to the image
                        const rect = e.currentTarget.getBoundingClientRect();
                        const offsetX = e.clientX - rect.left;
                        const offsetY = e.clientY - rect.top;
                        e.dataTransfer.setData('text/plain', JSON.stringify({ id: img.id, offsetX, offsetY }));
                      }}
                    >
                      <img
                        src={img.url}
                        alt="Uploaded content"
                        className="w-full h-full object-contain"
                      />
                      
                      {/* Resize handle */}
                      <div
                        className="absolute bottom-0 right-0 w-6 h-6 bg-blue-500 rounded-full cursor-se-resize"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          
                          // Initial dimensions
                          const initialWidth = img.width;
                          const initialHeight = img.height;
                          const startX = e.clientX;
                          const startY = e.clientY;
                          
                          // Resize function
                          const onMouseMove = (moveEvent) => {
                            const deltaX = moveEvent.clientX - startX;
                            const deltaY = moveEvent.clientY - startY;
                            
                            // Calculate new dimensions
                            const newWidth = Math.max(50, initialWidth + deltaX);
                            const newHeight = Math.max(50, initialHeight + deltaY);
                            
                            handleImageResize(img.id, newWidth, newHeight);
                          };
                          
                          // Clean up function
                          const onMouseUp = () => {
                            document.removeEventListener('mousemove', onMouseMove);
                            document.removeEventListener('mouseup', onMouseUp);
                          };
                          
                          // Add event listeners
                          document.addEventListener('mousemove', onMouseMove);
                          document.addEventListener('mouseup', onMouseUp);
                        }}
                      />
                      
                      {/* Delete button */}
                      <button
                        className="absolute top-0 right-0 w-6 h-6 bg-red-500 rounded-full text-white flex items-center justify-center"
                        onClick={() => {
                          setUploadedImages(prev => prev.filter(image => image.id !== img.id));
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  
                  {/* Drag and drop instruction */}
                  {uploadedImages.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <p className="text-lg text-gray-400">Drag and drop images here</p>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isPublic"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <Label htmlFor="isPublic" className="text-sm font-medium text-gray-700">
                  Make this canvas public
                </Label>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => router.push(`/canvas/${id}`)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </>
  );
};

export default EditCanvas;
