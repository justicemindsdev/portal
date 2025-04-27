import React, { useEffect, useState } from "react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./ui/accordion";
import supabase from "../utils/supabase";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";

const markdownExample = `# Heading 1
## Heading 2
### Heading 3

**Bold text** and *italic text*

- Bullet point 1
- Bullet point 2
  - Nested bullet point

1. Numbered list
2. Second item
   1. Nested numbered item

> Blockquote text here

[Link text](https://example.com)

\`inline code\`

\`\`\`javascript
// Code block
function example() {
  return "Hello World";
}
\`\`\`

| Table | Header |
|-------|--------|
| Cell 1| Cell 2 |

~~Strikethrough text~~

- [x] Task list item
- [ ] Unchecked task
`;

const CustomAcc = ({ isLoggedIn, isChatAdmin, secret, roomId }) => {
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [accordionItems, setAccordionItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showExample, setShowExample] = useState(false);

  const fetchContent = async () => {
    const { data, error } = await supabase
      .from("Content")
      .select("*")
      .eq("roomid", roomId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching content:", error.message);
    } else {
      setAccordionItems(data);
    }
  };

  useEffect(() => {
    fetchContent();
  }, []);

  const handleSend = async (idd) => {
    try {
      if (!title.trim() || !content.trim()) {
        return;
      }

      setLoading(true);
      const { error } = await supabase
        .from("Content")
        .insert([
          {
            title: title.trim(),
            content: content.trim(),
            roomid: idd
          },
        ]);

      if (error) {
        console.error("Error inserting content:", error.message);
      } else {
        setTitle("");
        setContent("");
        fetchContent();
      }
    } catch (error) {
      console.error("Error sending content:", error.message);
    } finally {
      setLoading(false);
    }
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

  return (
    <div className="w-full">
      {isLoggedIn && isChatAdmin === secret && (
        <div className="space-y-4 mb-6">
          <div>
            <Input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter title"
              className="w-full p-2 border border-gray-700 rounded"
            />
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm text-gray-400">Content (Markdown or HTML)</label>
                {/* <button
                  onClick={() => setShowExample(!showExample)}
                  className="text-sm text-blue-400 hover:text-blue-300"
                >
                  {showExample ? 'Hide Example' : 'Show Markdown Example'}
                </button> */}
              </div>
              {showExample && (
                <div className="mb-4 p-4 bg-gray-800 rounded-md">
                  <pre className="text-sm text-gray-300 whitespace-pre-wrap">{markdownExample}</pre>
                </div>
              )}
              <div className="relative">
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Write your content in Markdown or HTML..."
                  className="w-full h-[300px] p-2 border border-gray-700 rounded font-mono"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-gray-400">Preview</label>
              <div className="w-full min-h-[300px] p-4 border border-gray-700 rounded overflow-auto bg-[#1a1a1a]">
                {renderContent(content)}
              </div>
            </div>
          </div>

          <Button
            onClick={() => handleSend(roomId)}
            disabled={loading || !title.trim() || !content.trim()}
            className="w-full md:w-auto"
          >
            {loading ? "Adding..." : "Add Content"}
          </Button>
        </div>
      )}

      <Accordion type="single" collapsible className="w-full">
        {accordionItems.map((item) => (
          <AccordionItem 
            className="border-none bg-[#121212] rounded-lg px-3 mt-2" 
            key={item.id} 
            value={`item-${item.id}`}
          >
            <AccordionTrigger>{item.title}</AccordionTrigger>
            <AccordionContent>
              <div className="py-4">
                {renderContent(item.content)}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
};

export default CustomAcc;
