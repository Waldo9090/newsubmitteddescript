import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export async function GET(req: NextRequest) {
  try {
    // Get the user email from the Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return NextResponse.json(
        { error: "No authorization header provided" },
        { status: 401 }
      );
    }

    const userEmail = authHeader.replace("Bearer ", "");
    if (!userEmail) {
      return NextResponse.json(
        { error: "Invalid authorization header" },
        { status: 401 }
      );
    }

    // Get the board ID from the URL query parameters
    const url = new URL(req.url);
    const boardId = url.searchParams.get("boardId");
    
    if (!boardId) {
      return NextResponse.json(
        { error: "Board ID is required" },
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

    // Query the Monday.com API to get the groups for the specified board
    const query = `
      query {
        boards(ids: ${boardId}) {
          groups {
            id
            title
          }
        }
      }
    `;

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
        { error: "Failed to fetch Monday.com groups", details: errorData },
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

    // Extract the groups from the response
    const groups = data.data.boards[0]?.groups || [];

    return NextResponse.json({ groups });
  } catch (error) {
    console.error("Error fetching Monday.com groups:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 