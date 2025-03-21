import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const { messages, context, canEdit } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Messages are required and must be an array' },
        { status: 400 }
      );
    }

    // Prepare system message based on editing capability
    const systemMessage = canEdit
      ? `You are a helpful AI assistant that helps users analyze and edit meeting notes and transcripts.
         You can suggest edits to the notes when asked. You should interpret any request that implies changing the notes as an edit request.
         This includes phrases like "add", "change", "update", "modify", "remove", "delete", "format", "restructure", "summarize", etc.
         
         IMPORTANT: Never completely replace the original notes. Always preserve the original content and only add to it or make specific edits while keeping the original structure and information intact.
         
         When you detect an edit request:
         1. Understand what changes they want to make
         2. Make the requested changes to the notes while preserving ALL of the original content and structure
         3. For formatting, use proper Markdown syntax with headings (##, ###), bullet points, bold text, etc.
         4. If summarizing, maintain ALL the original points and only add a summary section
         5. When adding content, clearly indicate what is being added without removing anything
         6. When editing, make minimal changes necessary to fulfill the request while keeping everything else intact
         7. Return your response in this format:
            EDIT_SUGGESTION: true
            EDIT_PREVIEW: [First show the complete edited version of the notes]
            MESSAGE: Here's how I've modified the notes:
            [List the specific changes made]
            
            Would you like me to apply these changes?

         Current content:
         ${context || 'No content provided'}`
      : `You are a helpful AI assistant that helps users analyze meeting notes and transcripts. 
         Use the following meeting content as context for your responses:
         
         ${context || 'No content provided'}`;

    // Add a message to help detect edit intents
    const apiMessages = [
      {
        role: 'system',
        content: systemMessage
      },
      {
        role: 'system',
        content: `If the user's message implies any changes to the content (like adding, modifying, removing, formatting, or summarizing), treat it as an edit request. Be helpful and suggest improvements even if the user's request is vague. IMPORTANT: Never completely replace the original notes. Always preserve the original content and only add to it or make specific edits while keeping the original structure and information intact.`
      },
      ...messages.map((msg: any) => ({
        role: msg.role,
        content: msg.content,
      }))
    ];

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: apiMessages,
      temperature: 0.7,
      max_tokens: 2000,
    });

    const assistantMessage = response.choices[0].message.content;
    
    // Check if this is an edit suggestion
    if (canEdit && assistantMessage?.includes('EDIT_SUGGESTION: true')) {
      const parts = assistantMessage.split('\n');
      const editPreviewIndex = parts.findIndex(p => p.startsWith('EDIT_PREVIEW:'));
      const messageIndex = parts.findIndex(p => p.startsWith('MESSAGE:'));
      
      if (editPreviewIndex !== -1 && messageIndex !== -1) {
        const editedNotes = parts
          .slice(editPreviewIndex + 1, messageIndex)
          .join('\n')
          .trim();
        const message = parts
          .slice(messageIndex + 1)
          .join('\n')
          .trim();
        
        return NextResponse.json({
          response: message,
          editedNotes: editedNotes,
          isEditSuggestion: true
        });
      }
    }

    return NextResponse.json({
      response: assistantMessage,
      isEditSuggestion: false
    });
  } catch (error) {
    console.error('Error in chat API:', error);
    return NextResponse.json(
      { error: 'Failed to generate response' },
      { status: 500 }
    );
  }
} 