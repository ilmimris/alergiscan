import { GoogleGenAI, Type } from "@google/genai";
import { ScanResult, AllergenProfile } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function analyzeIngredients(input: { base64?: string; text?: string }, profile: AllergenProfile): Promise<Omit<ScanResult, 'id' | 'timestamp' | 'image'>> {
  const allergenList = profile.selected.join(", ") + (profile.custom?.length ? ", " + profile.custom.join(", ") : "");
  
  const prompt = `Analyze this food ingredient ${input.text ? "text" : "label image"}. 
Identify all ingredients and cross-reference them with the user's allergens: [${allergenList}].
Include common synonyms, derivatives (e.g. whey for milk), and "may contain" (dapat mengandung) warnings.

Return a JSON object with:
- status: "danger" (allergen found), "warning" (ambiguous, derivative, or "may contain"), "safe" (none found).
- ingredients: Array of all detected main ingredients.
- foundAllergens: Array of specific allergens from the user's list that were found.
- explanation: A concise summary in Indonesian (Bahasa Indonesia) explaining the status and any warnings.

Format:
{
  "status": "danger" | "warning" | "safe",
  "ingredients": string[],
  "foundAllergens": string[],
  "explanation": string
}`;

  const parts: any[] = [{ text: prompt }];
  if (input.base64) {
    parts.push({ inlineData: { data: input.base64.split(",")[1], mimeType: "image/jpeg" } });
  } else if (input.text) {
    parts.push({ text: `Ingredients Text: ${input.text}` });
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ parts }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            status: { type: Type.STRING, enum: ["danger", "warning", "safe"] },
            ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
            foundAllergens: { type: Type.ARRAY, items: { type: Type.STRING } },
            explanation: { type: Type.STRING }
          },
          required: ["status", "ingredients", "foundAllergens", "explanation"]
        }
      }
    });

    const data = JSON.parse(response.text || "{}");
    return data;
  } catch (error) {
    console.error("Gemini Scan Error:", error);
    throw new Error("Gagal menganalisis. Pastikan input jelas dan coba lagi.");
  }
}
