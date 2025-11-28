import { GoogleGenAI, Type } from "@google/genai";
import { Trip, Expense, Flight, TripInsights } from "../types";

// Initialize Gemini Client
// In a production environment, you should never expose API keys on the client side.
// This is for demonstration purposes within the specified runtime environment.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateItinerary = async (
  destination: string,
  days: number,
  interests: string,
  budget: string
): Promise<Trip> => {
  const model = "gemini-2.5-flash";
  
  const prompt = `Plan a ${days}-day trip to ${destination}. 
  Budget: ${budget}. 
  Interests: ${interests}.
  Provide a structured itinerary with specific activities, locations, and timings.`;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            destination: { type: Type.STRING },
            duration: { type: Type.INTEGER },
            itinerary: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  day: { type: Type.INTEGER },
                  theme: { type: Type.STRING },
                  activities: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        time: { type: Type.STRING },
                        activity: { type: Type.STRING },
                        location: { type: Type.STRING },
                        description: { type: Type.STRING },
                        estimatedCost: { type: Type.STRING }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    const tripData = JSON.parse(response.text || "{}");
    return {
      ...tripData,
      travelerCount: 1 // Default, will be updated by app state
    };
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw new Error("Failed to generate itinerary. Please try again.");
  }
};

export const generateTripInsights = async (
  destination: string, 
  startDate: string
): Promise<TripInsights> => {
  const model = "gemini-2.5-flash";
  
  const prompt = `I am planning a trip to ${destination} starting on ${startDate}.
  Using Google Search, please provide a concise travel safety and weather report.
  
  Structure the response with the following Markdown headers.
  Under each header, provide strictly 3-5 short bullet points (no paragraphs).
  
  ## 🌦️ Weather
  * (Bullet point about forecast/typical weather)
  * (Bullet point about clothing/packing)

  ## 🛡️ Safety
  * (Bullet point about key risks or scams)
  * (Bullet point about areas to avoid or safety rating)

  ## 🏥 Emergency
  * (Bullet point with emergency numbers)
  * (Bullet point with nearest hospital advice)

  ## 💡 Quick Tips
  * (Bullet point about tipping)
  * (Bullet point about SIM cards/Internet)
  * (Bullet point about local customs)
  `;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });

    // Extract sources from grounding metadata
    // @ts-ignore - The SDK types might lag behind the actual response structure for grounding
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources = chunks
      .filter((c: any) => c.web)
      .map((c: any) => ({
        title: c.web.title,
        uri: c.web.uri
      }));

    return {
      content: response.text || "No insights generated.",
      sources: sources,
      lastFetched: new Date().toISOString()
    };
  } catch (error) {
    console.error("Gemini Insight Error:", error);
    throw new Error("Failed to fetch travel insights.");
  }
};

export const parseReceiptImage = async (base64Image: string): Promise<Partial<Expense>> => {
  const model = "gemini-2.5-flash-image";

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg", // Assuming JPEG for simplicity, can detect from file
              data: base64Image
            }
          },
          {
            text: "Extract expense details from this receipt. Return JSON with 'amount' (number), 'description' (string, merchant name), 'date' (YYYY-MM-DD string), and 'category' (string: Food, Transport, Accommodation, Activity, or Other)."
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            amount: { type: Type.NUMBER },
            description: { type: Type.STRING },
            date: { type: Type.STRING },
            category: { type: Type.STRING } // Allow custom strings
          }
        }
      }
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Gemini Vision Error:", error);
    throw new Error("Failed to parse receipt.");
  }
};

export const parseFlightEmail = async (emailText: string): Promise<Flight> => {
  const model = "gemini-2.5-flash";

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: `Extract flight details from this email confirmation text.
      Text: "${emailText}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            airline: { type: Type.STRING },
            flightNumber: { type: Type.STRING },
            departureTime: { type: Type.STRING, description: "ISO date string or HH:MM format" },
            arrivalTime: { type: Type.STRING, description: "ISO date string or HH:MM format" },
            departureAirport: { type: Type.STRING, description: "Airport Code e.g. JFK" },
            arrivalAirport: { type: Type.STRING, description: "Airport Code e.g. LHR" },
            price: { type: Type.NUMBER }
          }
        }
      }
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Gemini Flight Parsing Error:", error);
    throw new Error("Failed to parse flight details.");
  }
};