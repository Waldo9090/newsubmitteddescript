import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export async function POST(req: NextRequest) {
  try {
    // Parse the request body
    const { 
      userEmail, 
      automationId, 
      meetingTitle, 
      meetingDate, 
      meetingAttendees, 
      meetingNotes,
      meetingActionItems
    } = await req.json();

    if (!userEmail) {
      return NextResponse.json(
        { error: "User email is required" },
        { status: 400 }
      );
    }

    if (!automationId) {
      return NextResponse.json(
        { error: "Automation ID is required" },
        { status: 400 }
      );
    }

    // Get the user's Monday.com token from Firestore
    const userDocRef = doc(db, "users", userEmail);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const userData = userDoc.data();
    const mondayToken = userData.mondayIntegration?.accessToken;

    if (!mondayToken) {
      return NextResponse.json(
        { error: "Monday.com is not connected for this user" },
        { status: 404 }
      );
    }

    // Get the automation details to retrieve board and group IDs
    const automationDocRef = doc(db, "savedautomations", automationId);
    const automationDoc = await getDoc(automationDocRef);

    if (!automationDoc.exists()) {
      return NextResponse.json(
        { error: "Automation not found" },
        { status: 404 }
      );
    }

    const automationData = automationDoc.data();
    const mondayStepData = automationData.steps.find((step: any) => step.type === 'monday');

    if (!mondayStepData) {
      return NextResponse.json(
        { error: "Monday.com step not found in automation" },
        { status: 404 }
      );
    }

    const { board, group } = mondayStepData;

    if (!board || !group) {
      return NextResponse.json(
        { error: "Board or group ID not found in automation configuration" },
        { status: 400 }
      );
    }

    // Format the item data
    const formattedDate = meetingDate ? new Date(meetingDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    const attendeesList = Array.isArray(meetingAttendees) ? meetingAttendees.join(", ") : "";
    
    // Format action items if available
    let actionItemsText = "";
    if (meetingActionItems && Array.isArray(meetingActionItems) && meetingActionItems.length > 0) {
      actionItemsText = meetingActionItems.map((item: string) => `• ${item}`).join("\\n");
    }

    // Prepare notes with action items
    let formattedNotes = meetingNotes || "";
    if (actionItemsText) {
      formattedNotes += "\\n\\n**Action Items:**\\n" + actionItemsText;
    }

    // Create the item name from the meeting title or a default
    const itemName = meetingTitle || `Meeting Notes - ${formattedDate}`;

    // Query the Monday.com API to create a new item
    const query = `
      mutation {
        create_item (
          board_id: ${board},
          group_id: "${group}",
          item_name: "${itemName.replace(/"/g, '\\"')}"
        ) {
          id
        }
      }
    `;

    // Make the API call to create the item
    const response = await fetch("https://api.monday.com/v2", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": mondayToken
      },
      body: JSON.stringify({ query })
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        { error: "Failed to create Monday.com item", details: errorData },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Check for errors in the Monday.com API response
    if (data.errors) {
      return NextResponse.json(
        { error: "Monday.com API error", details: data.errors },
        { status: 400 }
      );
    }

    const itemId = data.data.create_item.id;

    // Add additional fields if there's content to add
    if (formattedNotes || attendeesList) {
      // Find column IDs for text columns to update
      const columnsQuery = `
        query {
          boards (ids: ${board}) {
            columns {
              id
              title
              type
            }
          }
        }
      `;

      const columnsResponse = await fetch("https://api.monday.com/v2", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": mondayToken
        },
        body: JSON.stringify({ query: columnsQuery })
      });

      if (columnsResponse.ok) {
        const columnsData = await columnsResponse.json();
        const columns = columnsData.data.boards[0]?.columns || [];
        
        // Look for notes/description column and people/attendees column
        const notesColumn = columns.find((col: any) => 
          ['text', 'long-text'].includes(col.type.toLowerCase()) && 
          ['notes', 'description', 'details'].some(term => col.title.toLowerCase().includes(term))
        );
        
        const peopleColumn = columns.find((col: any) => 
          ['text', 'people'].includes(col.type.toLowerCase()) && 
          ['attendees', 'people', 'participants'].some(term => col.title.toLowerCase().includes(term))
        );
        
        const dateColumn = columns.find((col: any) => 
          col.type.toLowerCase() === 'date' && 
          ['date', 'meeting date'].some(term => col.title.toLowerCase().includes(term))
        );

        // Build mutations to update columns
        const mutations = [];
        
        if (notesColumn && formattedNotes) {
          mutations.push(`
            change_column_value (
              board_id: ${board},
              item_id: ${itemId},
              column_id: "${notesColumn.id}",
              value: ${JSON.stringify(JSON.stringify({ text: formattedNotes }))}
            ) {
              id
            }
          `);
        }
        
        if (peopleColumn && attendeesList) {
          mutations.push(`
            change_column_value (
              board_id: ${board},
              item_id: ${itemId},
              column_id: "${peopleColumn.id}",
              value: ${JSON.stringify(JSON.stringify({ text: attendeesList }))}
            ) {
              id
            }
          `);
        }
        
        if (dateColumn && formattedDate) {
          mutations.push(`
            change_column_value (
              board_id: ${board},
              item_id: ${itemId},
              column_id: "${dateColumn.id}",
              value: ${JSON.stringify(JSON.stringify({ date: formattedDate }))}
            ) {
              id
            }
          `);
        }

        // Execute mutations if any
        if (mutations.length > 0) {
          const updateQuery = `
            mutation {
              ${mutations.join('\n')}
            }
          `;

          await fetch("https://api.monday.com/v2", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": mondayToken
            },
            body: JSON.stringify({ query: updateQuery })
          });
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: "Item created successfully", 
      itemId 
    });
  } catch (error) {
    console.error("Error creating Monday.com item:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 