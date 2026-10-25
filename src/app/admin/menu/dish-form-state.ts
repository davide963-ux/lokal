// Plain (non-client) module: shared by server pages (initial values) and the client form.
export type DishFormState = {
  name: string; categoryId: string; shortDescription: string; description: string; price: string;
  isAvailable: boolean; imageUrl: string | null;
  ingredients: { key: string; name: string; quantity: string; isOptional: boolean; isRemovable: boolean; substitutionNotes: string }[];
  allergens: Record<string, "CONTAINS" | "MAY_CONTAIN">;
  dietaryTags: string[]; crossContactWarnings: string; allergenNotes: string; allergensVerified: boolean;
  cookingMethod: string; prepTimeMinutes: string; servingTemperature: string; garnishes: string; presentationDetails: string; preparationInstructions: string;
  waiterDescription: string; recommendedPairings: string; guestInformation: string; managerNotes: string;
  changeSummary: string; requiresRetraining: boolean;
};

export const emptyDish = (categoryId = ""): DishFormState => ({
  name: "", categoryId, shortDescription: "", description: "", price: "", isAvailable: true, imageUrl: null,
  ingredients: [], allergens: {}, dietaryTags: [], crossContactWarnings: "", allergenNotes: "", allergensVerified: false,
  cookingMethod: "", prepTimeMinutes: "", servingTemperature: "", garnishes: "", presentationDetails: "", preparationInstructions: "",
  waiterDescription: "", recommendedPairings: "", guestInformation: "", managerNotes: "", changeSummary: "", requiresRetraining: false,
});

// Random (not a counter): keys minted on the server for existing rows must never collide with
// keys the browser mints when a row is added.
export const newKey = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
