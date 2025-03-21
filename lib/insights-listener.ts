import { collection, doc, onSnapshot, updateDoc, arrayUnion, getDocs, query, orderBy, limit, getDoc } from 'firebase/firestore';
import { getFirebaseDb } from './firebase';

interface InsightConfig {
  name: string;
  description: string;
  frequency: "auto" | "one" | "multiple";
  responses: Array<{
    content: string;
    meeting: string;
    date: Date;
  }>;
}

// Function to setup real-time listener for insights
export function setupInsightsListener(userEmail: string) {
  const db = getFirebaseDb();
  const insightsRef = collection(db, 'insights', userEmail, 'insights');
  
  // Set up real-time listener
  const unsubscribe = onSnapshot(insightsRef, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added' || change.type === 'modified') {
        console.log('Insight updated:', {
          id: change.doc.id,
          data: change.doc.data()
        });
      }
    });
  }, (error) => {
    console.error('Error in insights listener:', error);
  });

  return unsubscribe;
}

// Function to process insights for the most recent transcript
export async function processLatestTranscriptInsights(userEmail: string) {
  const db = getFirebaseDb();
  console.log('Processing insights for latest transcript...');

  try {
    // Get all insight configurations first
    const insightsRef = collection(db, 'insights', userEmail, 'insights');
    const insightsSnapshot = await getDocs(insightsRef);
    const insightConfigs: { [id: string]: InsightConfig } = {};
    
    insightsSnapshot.forEach(doc => {
      insightConfigs[doc.id] = doc.data() as InsightConfig;
    });
    
    console.log('Loaded insight configurations:', Object.keys(insightConfigs));

    // Get the most recent transcript
    const transcriptRef = collection(db, 'transcript', userEmail, 'timestamps');
    const latestTranscriptQuery = query(transcriptRef, orderBy('timestamp', 'desc'), limit(1));
    const transcriptSnapshot = await getDocs(latestTranscriptQuery);

    if (transcriptSnapshot.empty) {
      console.log('No transcripts found');
      return;
    }

    // Get the most recent document
    const latestDoc = transcriptSnapshot.docs[0];
    const meetingData = latestDoc.data();
    const transcript = meetingData.transcript;
    const meetingName = meetingData.name || 'Untitled Meeting';

    if (!transcript) {
      console.log('No transcript found in latest document:', latestDoc.id);
      return;
    }

    console.log('Processing latest meeting:', {
      meetingId: latestDoc.id,
      meetingName,
      transcriptLength: transcript.length
    });

    // Create a single map of insights for this transcript
    const insightsMap: { [insightId: string]: string } = {};

    // Process each insight configuration
    const configEntries = Object.entries(insightConfigs);
    console.log(`Processing ${configEntries.length} insight configurations`);

    for (const [insightId, insightConfig] of configEntries) {
      console.log('Processing insight configuration:', {
        insightId,
        insightName: insightConfig.name,
        description: insightConfig.description,
        frequency: insightConfig.frequency
      });

      try {
        console.log('Generating insight using API...');
        // Generate insight using API endpoint
        const response = await fetch('/api/insights/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            transcript,
            description: insightConfig.description
          })
        });

        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`);
        }

        const { content } = await response.json();

        if (content) {
          console.log('Generated insight content:', {
            insightName: insightConfig.name,
            content: content
          });

          // Add to insights map
          insightsMap[insightId] = content;

          const newResponse = {
            content,
            meeting: meetingName,
            date: new Date()
          };

          // Update the insight document with the new response
          const insightDocRef = doc(db, 'insights', userEmail, 'insights', insightId);
          await updateDoc(insightDocRef, {
            responses: arrayUnion(newResponse)
          });

          console.log(`✅ Successfully saved insight for "${insightConfig.name}" from meeting "${meetingName}"`);
        }
      } catch (error) {
        console.error(`Error generating insight for ${insightId}:`, error);
      }
    }

    // Save the insights map to the transcript document
    const transcriptDocRef = doc(db, 'transcript', userEmail, 'timestamps', latestDoc.id);
    await updateDoc(transcriptDocRef, {
      insights: insightsMap
    });

    console.log('Saved insights map to transcript document:', {
      meetingId: latestDoc.id,
      insightsCount: Object.keys(insightsMap).length
    });

    return {
      success: true,
      meetingId: latestDoc.id,
      meetingName,
      insightsMap
    };

  } catch (error) {
    console.error('Error processing insights:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
} 