"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatColumnProps {
  transcript?: string;
  notes?: string;
  meetingTitle?: string;
}

export function ChatColumn({ transcript, notes, meetingTitle }: ChatColumnProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    // Initialize system message with context when props change
    if (transcript || notes) {
      const contextParts = [];
      
      if (meetingTitle) {
        contextParts.push(`Meeting Title: ${meetingTitle}`);
      }
      
      if (notes) {
        contextParts.push(`Meeting Notes:\n${notes}`);
      }
      
      if (transcript) {
        contextParts.push(`Meeting Transcript:\n${transcript}`);
      }
      
      if (contextParts.length > 0 && !isInitialized) {
        const systemMessage: Message = {
          role: 'system',
          content: `You are an AI assistant helping with a meeting. Here is the context:\n\n${contextParts.join('\n\n')}\n\nPlease use this information to answer questions about the meeting.`
        };
        
        setMessages([systemMessage]);
        setIsInitialized(true);
      }
    }
  }, [transcript, notes, meetingTitle, isInitialized]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Format message content to ensure proper line breaks
  const formatMessageContent = (content: string) => {
    // Split content into words and group them into chunks of 4
    const words = content.split(' ');
    const chunks = [];
    for (let i = 0; i < words.length; i += 4) {
      chunks.push(words.slice(i, i + 4).join(' '));
    }
    return chunks.join('\n');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages((prev) => [...prev.filter(msg => msg.role !== 'system'), userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Get the system message if it exists
      const systemMessage = messages.find(msg => msg.role === 'system');
      const chatMessages = systemMessage 
        ? [systemMessage, ...messages.filter(msg => msg.role !== 'system'), userMessage]
        : [...messages, userMessage];

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: chatMessages,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch response');
      }

      const data = await response.json();
      setMessages((prev) => [...prev, { role: 'assistant', content: data.content }]);
    } catch (error) {
      console.error('Error fetching AI response:', error);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Loading animation component
  const LoadingAnimation = () => (
    <div className="bg-secondary border-border mr-4 p-3 rounded-lg border shadow-sm">
      <div className="flex items-center space-x-2">
        <div className="flex space-x-1">
          <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
        <span className="text-xs text-muted-foreground">AI is thinking...</span>
      </div>
    </div>
  );

  // Function to render message content with proper formatting
  const renderMessageContent = (content: string) => {
    // Split content by double newlines (paragraphs)
    return content.split('\n\n').map((paragraph, i) => (
      <p key={i} className="mb-2 last:mb-0">
        {/* Split each paragraph by single newlines and join with <br> */}
        {paragraph.split('\n').map((line, j) => (
          <React.Fragment key={j}>
            {line}
            {j < paragraph.split('\n').length - 1 && <br />}
          </React.Fragment>
        ))}
      </p>
    ));
  };

  return (
    <div className="flex flex-col h-full w-80 max-w-80 overflow-hidden bg-background">
      <div className="p-4 border-b border-border bg-card flex-shrink-0">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">AI Assistant</h2>
        </div>
        <p className="text-sm text-muted-foreground mt-1 truncate">
          {meetingTitle 
            ? `Ask about "${meetingTitle}"`
            : "Ask about your notes"
          }
        </p>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages
          .filter(message => message.role !== 'system')
          .map((message, index) => (
          <div
            key={index}
            className={cn(
              "flex flex-col space-y-2",
              message.role === "assistant"
                ? "items-start"
                : "items-end"
            )}
          >
            <div
              className={cn(
                "rounded-lg px-3 py-2 max-w-full break-words whitespace-pre-wrap",
                message.role === "assistant"
                  ? "bg-muted text-foreground"
                  : "bg-primary text-primary-foreground"
              )}
              style={{ maxWidth: "85%", wordBreak: "break-word" }}
            >
              {formatMessageContent(message.content)}
            </div>
          </div>
        ))}
        {isLoading && <LoadingAnimation />}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="p-4 border-t border-border bg-card flex-shrink-0">
        <form onSubmit={handleSubmit} className="flex items-center space-x-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question..."
            disabled={isLoading}
            className="flex-1 bg-background border-input text-foreground"
          />
          <Button 
            type="submit" 
            size="icon" 
            disabled={isLoading}
            variant="default"
          >
            <Send className="h-4 w-4" />
            <span className="sr-only">Send message</span>
          </Button>
        </form>
      </div>
    </div>
  );
} 