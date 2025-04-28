import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import supabase from "@/utils/supabase";
import { Button } from "@/components/ui/button";
import { parse } from "cookie";
import Link from "next/link";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Head from "next/head";

const CanvasPage = () => {
  const router = useRouter();
  const { id, newlyCreated } = router.query;
  const [canvas, setCanvas] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isChatAdmin, setIsChatAdmin] = useState("");
  const [copied, setCopied] = useState(false);
  const [showShareMessage, setShowShareMessage] = useState(!!newlyCreated);
  const ChatAdminSecret = "shdbfjhsbfjhsbadjhfbajsd";
  
  // Hide the share message after 5 seconds
  useEffect(() => {
    if (showShareMessage) {
      const timer = setTimeout(() => {
        setShowShareMessage(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showShareMessage]);

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
    } catch (error) {
      console.error("Error fetching canvas:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    const fullURL = `${window.location.origin}/canvas/${id}`;
    
    navigator.clipboard.writeText(fullURL)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
      })
      .catch((error) => {
        console.error("Failed to copy text:", error);
      });
  };

  const isHTML = (str) => {
    const doc = new DOMParser().parseFromString(str, "text/html");
    return Array.from(doc.body.childNodes).some(node => node.nodeType === 1);
  };

  const MarkdownContent = ({ content }) => (
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

  const renderContent = (content) => {
    if (isHTML(content)) {
      return (
        <div
          dangerouslySetInnerHTML={{ __html: content }}
          className="prose lg:prose-md max-w-none"
        />
      );
    }
    return <MarkdownContent content={content} />;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!canvas) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Canvas not found</h1>
          <p className="mb-4">The canvas you're looking for doesn't exist.</p>
          <Button
            onClick={() => router.push("/canvas")}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Go back to canvas pages
          </Button>
        </div>
      </div>
    );
  }

  // If canvas is not public and user is not logged in, show access denied
  if (!canvas.is_public && !isLoggedIn) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="mb-4">This canvas is private. Please log in to view it.</p>
          <Button
            onClick={() => router.push("/")}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Go to login
          </Button>
        </div>
      </div>
    );
  }

  // Drag and drop functionality for images
  const [dragActive, setDragActive] = useState(false);
  const [uploadedImages, setUploadedImages] = useState([]);
  
  // Load images from canvas data
  useEffect(() => {
    if (canvas && canvas.images && Array.isArray(canvas.images)) {
      setUploadedImages(canvas.images.map(img => ({
        ...img,
        position: img.position || { x: 50, y: 50 },
        width: img.width || 300,
        height: img.height || 'auto'
      })));
    }
  }, [canvas]);
  
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
        id: Math.random().toString(36).substring(2, 9),
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

  return (
    <>
      <Head>
        <title>{canvas.title} | Canvas</title>
        <meta name="description" content={`${canvas.title} - Canvas page`} />
      </Head>
      
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {showShareMessage && (
          <div className="bg-green-500 text-white p-4 mb-6 rounded-md flex justify-between items-center">
            <div>
              <p className="font-bold">Canvas created successfully!</p>
              <p>Your canvas is now live and ready to share.</p>
            </div>
            <Button 
              onClick={handleCopy} 
              variant="outline" 
              className="bg-white text-green-500 hover:bg-green-100 border-white"
            >
              {copied ? "Copied!" : "Copy Share Link"}
            </Button>
          </div>
        )}
        
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">{canvas.title}</h1>
          
          <div className="flex space-x-2">
            <Button 
              onClick={handleCopy} 
              variant={copied ? "default" : "outline"} 
              size="sm"
              className={copied ? "bg-green-500 hover:bg-green-600" : ""}
            >
              {copied ? "Copied!" : "Share Link"}
            </Button>
            
            {(isLoggedIn && (isChatAdmin === ChatAdminSecret || canvas.created_by === "user_id")) && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/canvas/${id}/edit`}>Edit</Link>
              </Button>
            )}
            
            <Button asChild variant="outline" size="sm">
              <Link href="/canvas/create">Create New</Link>
            </Button>
            
            <Button asChild variant="outline" size="sm">
              <Link href="/canvas">Back to Canvas Pages</Link>
            </Button>
          </div>
        </div>
        
        <div 
          className={`bg-[#1a1a1a] rounded-lg p-6 shadow-lg relative min-h-[400px] ${dragActive ? 'border-2 border-dashed border-blue-500' : ''}`}
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
          {/* Canvas content */}
          {canvas.content ? (
            renderContent(canvas.content)
          ) : (
            <p className="text-gray-400 italic">No content available.</p>
          )}
          
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
            </div>
          ))}
          
          {/* Drag and drop instruction */}
          {uploadedImages.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-30">
              <p className="text-lg text-gray-400">Drag and drop images here</p>
            </div>
          )}
        </div>
        
        <div className="mt-4 text-sm text-gray-500">
          <p>Created: {new Date(canvas.created_at).toLocaleString()}</p>
          {canvas.updated_at && canvas.updated_at !== canvas.created_at && (
            <p>Last updated: {new Date(canvas.updated_at).toLocaleString()}</p>
          )}
        </div>
      </div>
    </>
  );
};

export default CanvasPage;
