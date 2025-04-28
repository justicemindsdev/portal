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

const CreateCanvas = () => {
  const ChatAdminSecret = "shdbfjhsbfjhsbadjhfbajsd";
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isChatAdmin, setIsChatAdmin] = useState("");
  const [previewMode, setPreviewMode] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Parse the cookie after the page is mounted
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Check if Canvases table exists, if not it will be created automatically when we insert
      try {
        const { data: existingCanvases, error: checkError } = await supabase
          .from('Canvases')
          .select('count')
          .limit(1);
          
        if (checkError) {
          console.log('Canvases table might not exist yet. Will be created when first canvas is added.');
        }
      } catch (error) {
        console.log('Canvases table might not exist yet. Will be created when first canvas is added.');
      }

      // Insert the new canvas
      const { data, error } = await supabase
        .from("Canvases")
        .insert([
          { 
            title, 
            content, 
            is_public: isPublic,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
        ])
        .select();

      if (error) throw error;

      // Redirect to the view page with a success message
      router.push({
        pathname: `/canvas/${data[0].uuid}`,
        query: { newlyCreated: true }
      });
    } catch (error) {
      console.error("Error creating canvas:", error);
      setIsLoading(false);
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

  return (
    <>
      {isLoggedIn ? (
        <div className="container mx-auto max-w-4xl py-12">
          <Card>
            <CardHeader>
              <CardTitle>Create a New Canvas</CardTitle>
              <CardDescription>
                Create a blank canvas page for your blog, documentation, or any content you want to share.
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
                        placeholder="# Your content here
                        
You can use **Markdown** formatting.

- List items
- Another item

Or HTML/TSX code for more advanced layouts.

```html
<div className='custom-component'>
  <h2>Custom HTML</h2>
  <p>This will be rendered as HTML</p>
</div>
```

```tsx
import React from 'react';

const MyComponent = () => {
  return (
    <div className='custom-tsx-component'>
      <h2>Custom TSX Component</h2>
      <p>This will be rendered as a React component</p>
    </div>
  );
};

export default MyComponent;
```"
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
              <CardFooter>
                <Button type="submit" disabled={isLoading} className="w-full">
                  {isLoading ? "Creating..." : "Create Canvas"}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      ) : (
        <LoginCreate onSuccess={handleLoginSuccess} onChatAdminSuccess={handleChatAdminSuccess} />
      )}
    </>
  );
};

export default CreateCanvas;
