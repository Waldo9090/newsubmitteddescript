import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Send, User, Check, X, FileEdit, Sparkles } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import React from 'react';

interface Message {
  role: 'assistant' | 'user';
  content: string;
  isEditSuggestion?: boolean;
  suggestedEdit?: string;
}

interface AIChatProps {
  meetingNotes: string;
  onEditNotes?: (newNotes: string) => void;
}

export function AIChat({ meetingNotes, onEditNotes }: AIChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Hi! I can help you analyze and edit these meeting notes. You can ask me to:\n\n• Add new sections or content\n• Modify existing sections\n• Format and restructure the notes\n• Ask questions about the content\n\nI will always preserve your original content while making edits. What would you like me to help you with?'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingEdit, setPendingEdit] = useState<string | null>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  // Function to scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Function to check if edited notes preserve the original content
  const preservesOriginalContent = (original: string, edited: string): boolean => {
    // If original is empty, any edit is fine
    if (!original.trim()) return true;
    
    // Remove whitespace and convert to lowercase for comparison
    const normalizedOriginal = original.replace(/\s+/g, ' ').toLowerCase().trim();
    const normalizedEdited = edited.replace(/\s+/g, ' ').toLowerCase().trim();
    
    // Check if the edited content contains the original content
    // This is a simple check that might need refinement based on specific requirements
    return normalizedEdited.includes(normalizedOriginal) || 
           // Check if most of the original words are preserved (80% threshold)
           normalizedOriginal.split(' ').filter(word => 
             normalizedEdited.includes(word) && word.length > 3
           ).length >= normalizedOriginal.split(' ').filter(word => word.length > 3).length * 0.8;
  };

  // Update messages when meetingNotes change
  useEffect(() => {
    // Only add a message if the notes have changed and we have more than just the welcome message
    if (messages.length > 1) {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: 'I noticed the meeting content has been updated. How else can I help you with these notes?'
        }
      ]);
    }
  }, [meetingNotes]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, { role: 'user', content: userMessage }],
          context: meetingNotes,
          canEdit: Boolean(onEditNotes),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      
      if (data.isEditSuggestion && data.editedNotes) {
        setPendingEdit(data.editedNotes);
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: data.response,
          isEditSuggestion: true,
          suggestedEdit: data.editedNotes
        }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
      }
    } catch (error) {
      console.error('Error getting AI response:', error);
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmEdit = () => {
    if (pendingEdit && onEditNotes) {
      // Check if the edited notes preserve the original content
      if (!preservesOriginalContent(meetingNotes, pendingEdit)) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: "I cannot apply these changes as they don't preserve the original content. I'll discard this suggestion. Please ask me to make a different edit that preserves the original notes."
        }]);
        setPendingEdit(null);
        return;
      }
      
      onEditNotes(pendingEdit);
      setPendingEdit(null);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "I've applied the changes to your notes. Is there anything else you'd like me to help you with?"
      }]);
    }
  };

  const handleRejectEdit = () => {
    setPendingEdit(null);
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: "I've discarded the suggested changes. Would you like me to try a different edit?"
    }]);
  };

  const handleQuickAction = (action: string) => {
    setInput(action);
    handleSubmit(new Event('submit') as any);
  };

  return (
    <div className="flex flex-col h-full relative">
      {/* Messages area - with padding at the bottom to ensure messages aren't hidden behind the input */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full pr-2">
          <div className="p-4 space-y-4 pb-32"> {/* Increased bottom padding to ensure content isn't hidden */}
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${
                  message.role === 'assistant' ? 'justify-start' : 'justify-end'
                }`}
              >
                <div
                  className={`rounded-lg px-3 py-2 max-w-[85%] ${
                    message.role === 'assistant'
                      ? 'bg-muted text-foreground'
                      : 'bg-primary text-primary-foreground'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {message.role === 'assistant' ? (
                      <Bot className="h-4 w-4 mt-1 flex-shrink-0" />
                    ) : (
                      <User className="h-4 w-4 mt-1 flex-shrink-0" />
                    )}
                    <div className="text-sm">
                      {message.isEditSuggestion ? (
                        <div className="space-y-4">
                          <div className="whitespace-pre-wrap">{message.content}</div>
                          {message.suggestedEdit && pendingEdit === message.suggestedEdit && (
                            <>
                              <div className="mt-4 border rounded-md p-3 bg-background/50">
                                <div className="text-xs font-medium mb-2 text-muted-foreground">Preview of changes:</div>
                                <div className="prose prose-sm dark:prose-invert max-w-none">
                                  <ReactMarkdown>
                                    {message.suggestedEdit}
                                  </ReactMarkdown>
                                </div>
                              </div>
                              <div className="mt-2 text-xs text-amber-500 font-medium">
                                Note: The AI will preserve your original content while making edits.
                              </div>
                              <div className="flex items-center gap-2 mt-2">
                                <Button
                                  size="sm"
                                  className="bg-green-500 hover:bg-green-600 text-white"
                                  onClick={handleConfirmEdit}
                                >
                                  <Check className="h-4 w-4 mr-1" />
                                  Apply Changes
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-500 border-red-500 hover:bg-red-50"
                                  onClick={handleRejectEdit}
                                >
                                  <X className="h-4 w-4 mr-1" />
                                  Discard
                                </Button>
                              </div>
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap">{message.content}</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4" />
                    <div className="text-sm">Thinking...</div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </div>

      {/* Fixed bottom container for quick actions and input */}
      <div className="absolute bottom-0 left-0 right-0 bg-background shadow-md z-10">
        {/* Quick actions */}
        <div className="p-2 flex gap-2 overflow-x-auto border-t border-b">
          <Button 
            variant="outline" 
            size="sm" 
            className="whitespace-nowrap"
            onClick={() => handleQuickAction("Format my notes with proper headings and bullet points")}
          >
            <Sparkles className="h-3 w-3 mr-1" />
            Format Notes
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="whitespace-nowrap"
            onClick={() => handleQuickAction("Summarize the key points from this meeting")}
          >
            <FileEdit className="h-3 w-3 mr-1" />
            Summarize
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="whitespace-nowrap"
            onClick={() => handleQuickAction("Extract action items from these notes")}
          >
            <Check className="h-3 w-3 mr-1" />
            Extract Actions
          </Button>
        </div>

        {/* Input area */}
        <form onSubmit={handleSubmit} className="p-3 flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your meeting..."
            className="flex-1 text-sm"
          />
          <button 
            type="submit" 
            disabled={isLoading || !input.trim()}
            className="flex-shrink-0 rounded-md p-2 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
} 