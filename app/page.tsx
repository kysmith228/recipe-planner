"use client";

import { useEffect, useMemo, useState } from "react";

type FamilyMember = {
  id: number;
  name: string;
  mealCalories: number;
  mealProtein: number;
  mealFat: number;
  mealCarbs: number;
  mealFiber: number;
};

type Ingredient = {
  item: string;
  qty: number;
  unit: string;
  section: string;
};

type Recipe = {
  id: number;
  name: string;
  category: string;
  tags: string;
  servings: number;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number;
  ingredients: Ingredient[];
};

type MealSlot = "Breakfast" | "Lunch" | "Dinner" | "Snack";

type MealPlan = Record<string, Record<MealSlot, number | "">>;

type UsdaFoodNutrient = {
  nutrientName?: string;
  value?: number;
  unitName?: string;
};

type UsdaFood = {
  description?: string;
  dataType?: string;
  foodCategory?: string;
  brandOwner?: string;
  ingredients?: string;
  foodNutrients?: UsdaFoodNutrient[];
};

type MatchLog = {
  ingredient: string;
  matched: string;
  dataType: string;
  score: number;
  source: "local" | "usda";
};

// ---------------------------------------------------------------------------
// Local nutrition rules — per 100g
// Calories, protein, fat, carbs, fiber — all per 100g
// ---------------------------------------------------------------------------
type LocalNutrition = { cal: number; protein: number; fat: number; carbs: number; fiber: number };

const localNutritionRules: { pattern: RegExp; label: string; nutrition: LocalNutrition }[] = [
  // Oils
  { pattern: /avocado oil/i,            label: "Avocado Oil",         nutrition: { cal: 884, protein: 0,    fat: 100,  carbs: 0,   fiber: 0 } },
  { pattern: /olive oil/i,              label: "Olive Oil",           nutrition: { cal: 884, protein: 0,    fat: 100,  carbs: 0,   fiber: 0 } },
  { pattern: /coconut oil/i,            label: "Coconut Oil",         nutrition: { cal: 892, protein: 0,    fat: 99,   carbs: 0,   fiber: 0 } },
  { pattern: /vegetable oil|canola oil/i, label: "Vegetable Oil",     nutrition: { cal: 884, protein: 0,    fat: 100,  carbs: 0,   fiber: 0 } },
  { pattern: /sesame oil/i,             label: "Sesame Oil",          nutrition: { cal: 884, protein: 0,    fat: 100,  carbs: 0,   fiber: 0 } },
  // Vinegars
  { pattern: /balsamic vinegar/i,       label: "Balsamic Vinegar",    nutrition: { cal: 88,  protein: 0.5,  fat: 0,    carbs: 17,  fiber: 0 } },
  { pattern: /apple cider vinegar/i,    label: "Apple Cider Vinegar", nutrition: { cal: 21,  protein: 0,    fat: 0,    carbs: 0.9, fiber: 0 } },
  { pattern: /red wine vinegar/i,       label: "Red Wine Vinegar",    nutrition: { cal: 19,  protein: 0,    fat: 0,    carbs: 0.3, fiber: 0 } },
  { pattern: /white wine vinegar|white vinegar|rice vinegar/i, label: "White Vinegar", nutrition: { cal: 18, protein: 0, fat: 0, carbs: 0.6, fiber: 0 } },
  { pattern: /vinegar/i,                label: "Vinegar",             nutrition: { cal: 18,  protein: 0,    fat: 0,    carbs: 0.6, fiber: 0 } },
  // Mustards
  { pattern: /dijon mustard/i,          label: "Dijon Mustard",       nutrition: { cal: 66,  protein: 3.8,  fat: 3.6,  carbs: 5.3, fiber: 2 } },
  { pattern: /yellow mustard/i,         label: "Yellow Mustard",      nutrition: { cal: 60,  protein: 3.7,  fat: 3.3,  carbs: 5.8, fiber: 2 } },
  { pattern: /mustard/i,                label: "Mustard",             nutrition: { cal: 63,  protein: 3.7,  fat: 3.4,  carbs: 5.5, fiber: 2 } },
  // Condiments
  { pattern: /soy sauce/i,              label: "Soy Sauce",           nutrition: { cal: 53,  protein: 8.1,  fat: 0.1,  carbs: 4.9, fiber: 0.8 } },
  { pattern: /hot sauce/i,              label: "Hot Sauce",           nutrition: { cal: 11,  protein: 0.5,  fat: 0.4,  carbs: 0.9, fiber: 0.2 } },
  { pattern: /worcestershire/i,         label: "Worcestershire Sauce",nutrition: { cal: 78,  protein: 0,    fat: 0,    carbs: 19,  fiber: 0 } },
  { pattern: /honey/i,                  label: "Honey",               nutrition: { cal: 304, protein: 0.3,  fat: 0,    carbs: 82,  fiber: 0.2 } },
  { pattern: /maple syrup/i,            label: "Maple Syrup",         nutrition: { cal: 260, protein: 0,    fat: 0.1,  carbs: 67,  fiber: 0 } },
  { pattern: /ketchup/i,                label: "Ketchup",             nutrition: { cal: 100, protein: 1.7,  fat: 0.1,  carbs: 27,  fiber: 0.3 } },
  { pattern: /mayo|mayonnaise/i,        label: "Mayonnaise",          nutrition: { cal: 680, protein: 1,    fat: 75,   carbs: 0.6, fiber: 0 } },
  // Near-zero seasonings — skip
  { pattern: /^salt$|kosher salt|sea salt|table salt/i, label: "Salt",         nutrition: { cal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 } },
  { pattern: /black pepper|white pepper|^pepper$/i,     label: "Black Pepper", nutrition: { cal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 } },
  { pattern: /^garlic powder$/i,        label: "Garlic Powder (negligible)", nutrition: { cal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 } },
  { pattern: /^onion powder$/i,         label: "Onion Powder (negligible)",  nutrition: { cal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 } },
  { pattern: /cumin|paprika|oregano|basil|thyme|rosemary|chili powder|cayenne|cinnamon|nutmeg|turmeric|coriander|seasoning|spice mix|italian seasoning|taco seasoning/i,
    label: "Spice/Seasoning (negligible)", nutrition: { cal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 } },
];

// Sanity cap: a single recipe total should never exceed this
const MAX_RECIPE_CALORIES = 6000;

const STORAGE_KEY = "recipe-planner-phase-2-alias-normalized-v1";
const OLD_STORAGE_KEYS = [
  "recipe-planner-phase-2-better-usda-v1",
  "recipe-planner-phase-2-usda-v1",
  "recipe-planner-phase-2-v1",
  "recipe-planner-phase-1-v1",
];

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const mealSlots: MealSlot[] = ["Breakfast", "Lunch", "Dinner", "Snack"];

const defaultFamily: FamilyMember[] = [
  { id: 1, name: "Kyle",   mealCalories: 700, mealProtein: 60, mealFat: 25, mealCarbs: 70, mealFiber: 10 },
  { id: 2, name: "Kathie", mealCalories: 500, mealProtein: 40, mealFat: 18, mealCarbs: 50, mealFiber: 8  },
  { id: 3, name: "Koen",   mealCalories: 450, mealProtein: 30, mealFat: 17, mealCarbs: 55, mealFiber: 7  },
  { id: 4, name: "Kole",   mealCalories: 450, mealProtein: 30, mealFat: 17, mealCarbs: 55, mealFiber: 7  },
];

const grocerySections = ["Produce", "Meat", "Dairy", "Frozen", "Pantry", "Bakery", "Canned Goods", "Spices", "Other"];

const noiseWords = [
  "fresh", "raw", "cooked", "diced", "chopped", "sliced", "shredded", "minced",
  "boneless", "skinless", "large", "small", "medium", "extra", "lean",
  "organic", "use", "press", "or", "and",
];

const ingredientAliases: { pattern: RegExp; replacement: string }[] = [
  { pattern: /garlic.*clove|garlic clove|clove garlic|cloves garlic|garlic press/i, replacement: "garlic" },
  { pattern: /black pepper spice|pepper spice|ground black pepper|black pepper/i,   replacement: "black pepper" },
  { pattern: /dijon.*mustard|spicy brown mustard|brown mustard|dijon mustard/i,     replacement: "dijon mustard" },
  { pattern: /avocado oil/i,                                                         replacement: "avocado oil" },
  { pattern: /balsamic vinegar|balsamic/i,                                           replacement: "balsamic vinegar" },
  { pattern: /extra virgin olive oil|olive oil/i,                                    replacement: "olive oil" },
  { pattern: /kosher salt|sea salt|table salt|^salt$/i,                              replacement: "salt" },
  { pattern: /chicken breast/i,                                                       replacement: "chicken breast" },
  { pattern: /ground beef/i,                                                          replacement: "ground beef" },
  { pattern: /ground turkey/i,                                                        replacement: "ground turkey" },
  { pattern: /white rice|brown rice/i,                                                replacement: "rice" },
  { pattern: /romaine lettuce|shredded lettuce|lettuce/i,                             replacement: "lettuce" },
  { pattern: /black beans/i,                                                          replacement: "black beans" },
  { pattern: /tortilla|tortillas/i,                                                   replacement: "tortilla" },
];

function createEmptyMealPlan(): MealPlan {
  return days.reduce((plan, day) => {
    plan[day] = { Breakfast: "", Lunch: "", Dinner: "", Snack: "" };
    return plan;
  }, {} as MealPlan);
}

function normalizeIngredientName(item: string) {
  const withoutNotes = item
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const alias = ingredientAliases.find((entry) => entry.pattern.test(withoutNotes));
  if (alias) return alias.replacement;
  return withoutNotes;
}

function cleanIngredientForSearch(item: string) {
  const normalized = normalizeIngredientName(item);
  return normalized
    .split(/\s+/)
    .filter((word) => word && !noiseWords.includes(word))
    .join(" ")
    .trim();
}

function getLocalRule(normalizedItem: string): { label: string; nutrition: LocalNutrition } | null {
  const match = localNutritionRules.find((rule) => rule.pattern.test(normalizedItem));
  return match ? { label: match.label, nutrition: match.nutrition } : null;
}

function sectionForItem(item: string) {
  const value = normalizeIngredientName(item);
  if (/chicken|beef|turkey|pork|fish|salmon|shrimp|bacon|sausage/.test(value)) return "Meat";
  if (/milk|cheese|yogurt|butter|cream|egg/.test(value)) return "Dairy";
  if (/lettuce|tomato|onion|pepper|broccoli|carrot|apple|banana|potato|avocado|cilantro|spinach|garlic/.test(value)) return "Produce";
  if (/bread|tortilla|bun|roll|bagel/.test(value)) return "Bakery";
  if (/beans|soup|salsa|tomato sauce|marinara|corn/.test(value)) return "Canned Goods";
  if (/salt|pepper|paprika|cumin|seasoning|oregano|basil|chili|mustard/.test(value)) return "Spices";
  if (/frozen/.test(value)) return "Frozen";
  if (/rice|pasta|flour|sugar|oil|oats|cereal|chips|vinegar/.test(value)) return "Pantry";
  return "Other";
}

function parseAmount(value: string) {
  const mixedNumber = value.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixedNumber) return Number(mixedNumber[1]) + Number(mixedNumber[2]) / Number(mixedNumber[3]);
  if (value.includes("/")) {
    const [top, bottom] = value.split("/").map(Number);
    return bottom ? top / bottom : 1;
  }
  return Number(value) || 1;
}

function parseIngredientLine(line: string): Ingredient {
  // Strip bullet markers, then remove ALL parenthetical notes like "(2 tablespoons)" or "(1/3 cup)"
  // These appear in recipe formats like "30 ml (2 tablespoons) balsamic vinegar"
  const cleaned = line
    .replace(/^[-*•]\s*/, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const parts = cleaned.split(/\s+/);

  let qty = parseAmount(parts[0] || "1");
  let unitIndex = 1;

  // Handle mixed fractions like "1 1/2"
  if (parts.length >= 3 && parts[1]?.includes("/")) {
    qty = parseAmount(`${parts[0]} ${parts[1]}`);
    unitIndex = 2;
  }

  const unit = parts[unitIndex] || "each";
  const rawItem = parts.slice(unitIndex + 1).join(" ") || cleaned;
  const item = normalizeIngredientName(rawItem);
  return { qty, unit, item, section: sectionForItem(item) };
}

function blankRecipe(): Recipe {
  return { id: 0, name: "", category: "Dinner", tags: "", servings: 4, calories: 500, protein: 35, fat: 15, carbs: 45, fiber: 5, ingredients: [] };
}

function getNutrient(food: UsdaFood, names: string[]) {
  const nutrient = food.foodNutrients?.find((item) => {
    const n = item.nutrientName?.toLowerCase() || "";
    return names.some((name) => n.includes(name));
  });
  return Number(nutrient?.value || 0);
}

function unitToApproxGramMultiplier(unit: string, item = "") {
  const u = unit.toLowerCase();
  const i = normalizeIngredientName(item);

  if (["g", "gram", "grams"].includes(u)) return 1;
  if (["kg", "kilogram", "kilograms"].includes(u)) return 1000;
  if (["oz", "ounce", "ounces"].includes(u)) return 28.35;
  if (["lb", "lbs", "pound", "pounds"].includes(u)) return 453.6;
  // ml and l — 1 ml ≈ 1g for most liquids
  if (["ml", "milliliter", "milliliters", "millilitre", "millilitres"].includes(u)) return 1;
  if (["l", "liter", "liters", "litre", "litres"].includes(u)) return 1000;

  if (["cup", "cups"].includes(u)) {
    if (/oil/.test(i)) return 218;
    if (/vinegar/.test(i)) return 240;
    if (/rice|pasta/.test(i)) return 185;
    if (/cheese/.test(i)) return 113;
    if (/lettuce/.test(i)) return 47;
    if (/salsa/.test(i)) return 260;
    if (/beans/.test(i)) return 172;
    return 240;
  }
  if (["tbsp", "tablespoon", "tablespoons"].includes(u)) {
    if (/oil/.test(i)) return 13.6;
    if (/vinegar/.test(i)) return 15;
    if (/mustard|honey|syrup|ketchup/.test(i)) return 21;
    if (/mayo/.test(i)) return 14;
    if (/soy sauce/.test(i)) return 16;
    return 15;
  }
  if (["tsp", "teaspoon", "teaspoons"].includes(u)) {
    if (/oil/.test(i)) return 4.5;
    if (/salt/.test(i)) return 6;
    if (/pepper|spice|seasoning/.test(i)) return 2.3;
    if (/mustard/.test(i)) return 5;
    return 5;
  }
  if (["clove", "cloves"].includes(u)) return 3;
  if (["each", "ea", "ct", "count"].includes(u)) {
    if (/tortilla/.test(i)) return 45;
    if (/egg/.test(i)) return 50;
    return 100;
  }
  return 100;
}

function scoreUsdaFood(food: UsdaFood, originalIngredient: string) {
  const description = (food.description || "").toLowerCase();
  const dataType = (food.dataType || "").toLowerCase();
  const normalizedIngredient = normalizeIngredientName(originalIngredient);
  const searchTerms = cleanIngredientForSearch(normalizedIngredient).split(/\s+/).filter(Boolean);
  let score = 0;

  searchTerms.forEach((term) => { if (description.includes(term)) score += 10; });
  if (dataType.includes("foundation")) score += 40;
  if (dataType.includes("sr legacy"))  score += 35;
  if (dataType.includes("survey"))     score += 20;
  if (dataType.includes("branded"))    score -= 25;
  if (food.brandOwner)                 score -= 15;

  if (/raw|uncooked/.test(originalIngredient.toLowerCase()) && /raw/.test(description)) score += 15;
  if (/cooked/.test(originalIngredient.toLowerCase()) && /cooked/.test(description))    score += 15;
  if (/breast/.test(normalizedIngredient) && /breast/.test(description)) score += 12;
  if (/lean/.test(originalIngredient.toLowerCase()) && /lean/.test(description))        score += 8;
  if (/with salt|prepared|restaurant|fast food|babyfood|formula/.test(description)) score -= 20;
  if (/cloves, ground/.test(description) && /garlic/.test(normalizedIngredient)) score -= 100;

  return score;
}

function chooseBestUsdaFood(foods: UsdaFood[], ingredient: string) {
  return foods
    .map((food) => ({ food, score: scoreUsdaFood(food, ingredient) }))
    .sort((a, b) => b.score - a.score)[0];
}

export default function Home() {
  const [family, setFamily] = useState<FamilyMember[]>(defaultFamily);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [editingRecipeId, setEditingRecipeId] = useState<number | null>(null);
  const [recipeForm, setRecipeForm] = useState<Recipe>(blankRecipe());
  const [ingredientsText, setIngredientsText] = useState("1 lb chicken breast\n8 each tortillas\n1 cup salsa");
  const [scaleBy, setScaleBy] = useState<"calories" | "protein">("calories");
  const [mealPlan, setMealPlan] = useState<MealPlan>(createEmptyMealPlan());
  const [usdaStatus, setUsdaStatus] = useState("Oils, vinegar, mustard, and spices use built-in local rules. USDA is only called for real foods like meat, grains, and vegetables.");
  const [isEstimating, setIsEstimating] = useState(false);
  const [matchLog, setMatchLog] = useState<MatchLog[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) || OLD_STORAGE_KEYS.map((k) => localStorage.getItem(k)).find(Boolean);
    if (!saved) return;
    const parsed = JSON.parse(saved);
    setFamily(parsed.family || defaultFamily);
    setRecipes(parsed.recipes || []);
    setScaleBy(parsed.scaleBy || "calories");
    setMealPlan(parsed.mealPlan || createEmptyMealPlan());
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ family, recipes, scaleBy, mealPlan }));
  }, [family, recipes, scaleBy, mealPlan]);

  function updateFamily(id: number, field: keyof FamilyMember, value: string) {
    setFamily((cur) => cur.map((p) => (p.id === id ? { ...p, [field]: field === "name" ? value : Number(value) } : p)));
  }

  function updateRecipeField(field: keyof Recipe, value: string) {
    setRecipeForm((cur) => ({ ...cur, [field]: ["name", "category", "tags"].includes(field) ? value : Number(value) }));
  }

  async function estimateNutritionFromUsda() {
    const ingredients = ingredientsText.split("\n").map((l) => l.trim()).filter(Boolean).map(parseIngredientLine);
    if (ingredients.length === 0) { setUsdaStatus("Add ingredients first, then run estimate."); return; }

    setIsEstimating(true);
    setUsdaStatus("Estimating nutrition...");
    setMatchLog([]);

    const total = { calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 };
    const matched: MatchLog[] = [];
    const missed: string[] = [];

    try {
      for (const ingredient of ingredients) {
        const normalizedItem = normalizeIngredientName(ingredient.item);
        const grams = ingredient.qty * unitToApproxGramMultiplier(ingredient.unit, normalizedItem);
        const multiplier = grams / 100;

        // Step 1: Try local rule first
        const localRule = getLocalRule(normalizedItem);
        if (localRule) {
          const n = localRule.nutrition;
          if (n.cal === 0 && n.protein === 0 && n.fat === 0) {
            matched.push({ ingredient: ingredient.item, matched: `${localRule.label} — negligible amount skipped`, dataType: "Local rule", score: 999, source: "local" });
          } else {
            total.calories += n.cal     * multiplier;
            total.protein  += n.protein * multiplier;
            total.fat      += n.fat     * multiplier;
            total.carbs    += n.carbs   * multiplier;
            total.fiber    += n.fiber   * multiplier;
            matched.push({ ingredient: ingredient.item, matched: localRule.label, dataType: "Local nutrition rule", score: 999, source: "local" });
          }
          continue;
        }

        // Step 2: Use USDA for real foods
        const cleanedQuery = cleanIngredientForSearch(normalizedItem) || normalizedItem;
        const response = await fetch(`/api/usda/search?query=${encodeURIComponent(cleanedQuery)}`);
        if (!response.ok) { missed.push(ingredient.item); continue; }

        const data = await response.json();
        const foods: UsdaFood[] = data.foods || [];
        if (foods.length === 0) { missed.push(ingredient.item); continue; }

        const best = chooseBestUsdaFood(foods, normalizedItem);
        if (!best?.food) { missed.push(ingredient.item); continue; }

        total.calories += getNutrient(best.food, ["energy"])              * multiplier;
        total.protein  += getNutrient(best.food, ["protein"])             * multiplier;
        total.fat      += getNutrient(best.food, ["total lipid", "fat"])  * multiplier;
        total.carbs    += getNutrient(best.food, ["carbohydrate"])        * multiplier;
        total.fiber    += getNutrient(best.food, ["fiber"])               * multiplier;

        matched.push({ ingredient: ingredient.item, matched: best.food.description || "USDA match", dataType: best.food.dataType || "Unknown", score: best.score, source: "usda" });
      }

      // Step 3: Sanity cap
      const divisor = recipeForm.servings || 1;
      const rawCalTotal = total.calories;
      const capHit = total.calories > MAX_RECIPE_CALORIES;
      if (capHit) {
        const scale = MAX_RECIPE_CALORIES / total.calories;
        total.calories *= scale;
        total.protein  *= scale;
        total.fat      *= scale;
        total.carbs    *= scale;
        total.fiber    *= scale;
      }

      setRecipeForm((cur) => ({
        ...cur,
        calories: Math.round(total.calories / divisor),
        protein:  Math.round(total.protein  / divisor),
        fat:      Math.round(total.fat      / divisor),
        carbs:    Math.round(total.carbs    / divisor),
        fiber:    Math.round(total.fiber    / divisor),
      }));

      setMatchLog(matched);
      const capNote = capHit ? ` ⚠️ Raw estimate (${Math.round(rawCalTotal)} cal total) exceeded the sanity cap of ${MAX_RECIPE_CALORIES} cal and was scaled down — check your ingredient quantities.` : "";
      const missedText = missed.length ? ` Not matched: ${missed.join(", ")}.` : "";
      setUsdaStatus(`Estimate complete. ${matched.length} ingredient(s) matched (local rules + USDA).${missedText}${capNote} Review before saving.`);
    } catch {
      setUsdaStatus("Estimate failed. Check the API route and try again.");
    } finally {
      setIsEstimating(false);
    }
  }

  function saveRecipe() {
    const ingredients = ingredientsText.split("\n").map((l) => l.trim()).filter(Boolean).map(parseIngredientLine);
    const toSave: Recipe = { ...recipeForm, id: editingRecipeId ?? Date.now(), name: recipeForm.name.trim() || "Untitled Recipe", ingredients };

    if (editingRecipeId) setRecipes((cur) => cur.map((r) => (r.id === editingRecipeId ? toSave : r)));
    else setRecipes((cur) => [...cur, toSave]);

    setEditingRecipeId(null);
    setRecipeForm(blankRecipe());
    setIngredientsText("1 lb chicken breast\n8 each tortillas\n1 cup salsa");
    setMatchLog([]);
  }

  function editRecipe(recipe: Recipe) {
    setEditingRecipeId(recipe.id);
    setRecipeForm(recipe);
    setIngredientsText(recipe.ingredients.map((i) => `${i.qty} ${i.unit} ${i.item}`).join("\n"));
    setMatchLog([]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function deleteRecipe(id: number) {
    setRecipes((cur) => cur.filter((r) => r.id !== id));
    setMealPlan((cur) => {
      const next = { ...cur };
      days.forEach((day) => {
        next[day] = { ...next[day] };
        mealSlots.forEach((slot) => { if (next[day][slot] === id) next[day][slot] = ""; });
      });
      return next;
    });
    if (editingRecipeId === id) { setEditingRecipeId(null); setRecipeForm(blankRecipe()); }
  }

  function cancelEdit() {
    setEditingRecipeId(null);
    setRecipeForm(blankRecipe());
    setIngredientsText("1 lb chicken breast\n8 each tortillas\n1 cup salsa");
    setMatchLog([]);
  }

  function updateMealPlan(day: string, slot: MealSlot, recipeId: string) {
    setMealPlan((cur) => ({ ...cur, [day]: { ...cur[day], [slot]: recipeId ? Number(recipeId) : "" } }));
  }

  function clearMealPlan() { setMealPlan(createEmptyMealPlan()); }

  const plannedRecipeIds = useMemo(
    () => days.flatMap((day) => mealSlots.map((slot) => mealPlan[day]?.[slot])).filter(Boolean) as number[],
    [mealPlan]
  );
  const plannedMealCount = plannedRecipeIds.length;

  const weeklyMacroTotals = useMemo(() => {
    return plannedRecipeIds.reduce(
      (totals, recipeId) => {
        const recipe = recipes.find((r) => r.id === recipeId);
        if (!recipe) return totals;
        const target = family.reduce((sum, p) => sum + (scaleBy === "protein" ? p.mealProtein : p.mealCalories), 0);
        const recipeTarget = scaleBy === "protein" ? recipe.protein : recipe.calories;
        const servingsNeeded = recipeTarget > 0 ? target / recipeTarget : family.length;
        totals.calories += recipe.calories * servingsNeeded;
        totals.protein  += recipe.protein  * servingsNeeded;
        totals.fat      += recipe.fat      * servingsNeeded;
        totals.carbs    += recipe.carbs    * servingsNeeded;
        totals.fiber    += recipe.fiber    * servingsNeeded;
        return totals;
      },
      { calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 }
    );
  }, [plannedRecipeIds, recipes, family, scaleBy]);

  const groceryList = useMemo(() => {
    const target = family.reduce((sum, p) => sum + (scaleBy === "protein" ? p.mealProtein : p.mealCalories), 0);
    const list: Record<string, { qty: number; unit: string; section: string }> = {};
    plannedRecipeIds.forEach((recipeId) => {
      const recipe = recipes.find((r) => r.id === recipeId);
      if (!recipe) return;
      const recipeTarget = scaleBy === "protein" ? recipe.protein : recipe.calories;
      const servingsNeeded = recipeTarget > 0 ? target / recipeTarget : family.length;
      const scale = servingsNeeded / recipe.servings;
      recipe.ingredients.forEach((ingredient) => {
        const key = `${ingredient.item.toLowerCase()}|${ingredient.unit.toLowerCase()}`;
        if (!list[key]) list[key] = { qty: 0, unit: ingredient.unit, section: ingredient.section };
        list[key].qty += ingredient.qty * scale;
      });
    });
    return Object.entries(list).map(([key, value]) => ({ item: key.split("|")[0], ...value })).sort((a, b) => a.section.localeCompare(b.section) || a.item.localeCompare(b.item));
  }, [family, recipes, scaleBy, plannedRecipeIds]);

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <h1 className="text-3xl font-bold md:text-4xl">Recipe Macro Grocery Planner</h1>

        {/* Family Targets */}
        <section className="rounded-2xl bg-white p-4 shadow md:p-6">
          <h2 className="mb-4 text-2xl font-semibold">Family Meal Targets</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border text-sm">
              <thead className="bg-slate-200">
                <tr>
                  <th className="border p-2">Name</th>
                  <th className="border p-2">Meal Calories</th>
                  <th className="border p-2">Meal Protein</th>
                  <th className="border p-2">Meal Fat</th>
                  <th className="border p-2">Meal Carbs</th>
                  <th className="border p-2">Meal Fiber</th>
                </tr>
              </thead>
              <tbody>
                {family.map((person) => (
                  <tr key={person.id}>
                    <td className="border p-2">
                      <input className="w-28 rounded border p-1" value={person.name} onChange={(e) => updateFamily(person.id, "name", e.target.value)} />
                    </td>
                    {(["mealCalories", "mealProtein", "mealFat", "mealCarbs", "mealFiber"] as const).map((field) => (
                      <td key={field} className="border p-2">
                        <input className="w-20 rounded border p-1" type="number" value={person[field]} onChange={(e) => updateFamily(person.id, field, e.target.value)} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Add / Edit Recipe */}
        <section className="rounded-2xl bg-white p-4 shadow md:p-6">
          <h2 className="mb-4 text-2xl font-semibold">{editingRecipeId ? "Edit Recipe" : "Add Recipe"}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Recipe Name</span>
              <input className="w-full rounded border p-2" value={recipeForm.name} onChange={(e) => updateRecipeField("name", e.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Category</span>
              <select className="w-full rounded border p-2" value={recipeForm.category} onChange={(e) => updateRecipeField("category", e.target.value)}>
                <option>Breakfast</option><option>Lunch</option><option>Dinner</option><option>Snack</option><option>Dessert</option>
              </select>
            </label>
            <label className="block md:col-span-2">
              <span className="mb-1 block text-sm font-medium">Tags</span>
              <input className="w-full rounded border p-2" value={recipeForm.tags} onChange={(e) => updateRecipeField("tags", e.target.value)} placeholder="high protein, quick, kid friendly" />
            </label>
            {(["servings", "calories", "protein", "fat", "carbs", "fiber"] as const).map((field) => (
              <label key={field} className="block">
                <span className="mb-1 block text-sm font-medium">{field === "servings" ? "Servings" : `${field.charAt(0).toUpperCase() + field.slice(1)} Per Serving`}</span>
                <input className="w-full rounded border p-2" type="number" value={recipeForm[field]} onChange={(e) => updateRecipeField(field, e.target.value)} />
              </label>
            ))}
            <label className="block md:col-span-2">
              <span className="mb-1 block text-sm font-medium">Ingredients (one per line, e.g. "1 lb chicken breast")</span>
              <textarea className="min-h-32 w-full rounded border p-2" value={ingredientsText} onChange={(e) => setIngredientsText(e.target.value)} />
            </label>

            <p className="text-sm text-slate-600 md:col-span-2">{usdaStatus}</p>

            {matchLog.length > 0 && (
              <div className="rounded bg-slate-50 p-3 text-sm md:col-span-2">
                <div className="mb-2 font-semibold">Nutrition Sources Used</div>
                {matchLog.map((m) => (
                  <div key={`${m.ingredient}-${m.matched}`} className="border-b py-1 last:border-b-0 flex items-start gap-2">
                    <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold ${m.source === "local" ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800"}`}>
                      {m.source === "local" ? "LOCAL" : "USDA"}
                    </span>
                    <span>
                      <span className="font-medium">{m.ingredient}</span> → {m.matched}
                      {m.source === "usda" && <span className="text-slate-500"> ({m.dataType}, score {m.score})</span>}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-3 md:col-span-2">
              <button onClick={estimateNutritionFromUsda} disabled={isEstimating} className="rounded bg-green-600 px-4 py-2 text-white disabled:bg-slate-400">
                {isEstimating ? "Estimating..." : "Estimate Nutrition"}
              </button>
              <button onClick={saveRecipe} className="rounded bg-blue-600 px-4 py-2 text-white">
                {editingRecipeId ? "Update Recipe" : "Save Recipe"}
              </button>
              {editingRecipeId && (
                <button onClick={cancelEdit} className="rounded border px-4 py-2">Cancel Edit</button>
              )}
            </div>
          </div>
        </section>

        {/* Weekly Planner */}
        <section className="rounded-2xl bg-white p-4 shadow md:p-6">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h2 className="text-2xl font-semibold">Weekly Meal Planner</h2>
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm font-medium">
                Scale grocery list by
                <select className="ml-2 rounded border p-2" value={scaleBy} onChange={(e) => setScaleBy(e.target.value as "calories" | "protein")}>
                  <option value="calories">Calories</option>
                  <option value="protein">Protein</option>
                </select>
              </label>
              <button onClick={clearMealPlan} className="rounded border px-3 py-2 text-sm">Clear Week</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border text-sm">
              <thead className="bg-slate-200">
                <tr>
                  <th className="border p-2">Day</th>
                  {mealSlots.map((slot) => <th key={slot} className="border p-2">{slot}</th>)}
                </tr>
              </thead>
              <tbody>
                {days.map((day) => (
                  <tr key={day}>
                    <td className="border p-2 font-semibold">{day}</td>
                    {mealSlots.map((slot) => (
                      <td key={slot} className="border p-2">
                        <select className="w-full rounded border p-2" value={mealPlan[day]?.[slot] || ""} onChange={(e) => updateMealPlan(day, slot, e.target.value)}>
                          <option value="">No meal</option>
                          {recipes.filter((r) => slot === "Snack" || r.category === slot || r.category === "Dinner").map((r) => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                          ))}
                        </select>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-5">
            {[
              { label: "Planned Meals", value: plannedMealCount,                        unit: ""  },
              { label: "Calories",      value: Math.round(weeklyMacroTotals.calories),  unit: ""  },
              { label: "Protein",       value: Math.round(weeklyMacroTotals.protein),   unit: "g" },
              { label: "Carbs",         value: Math.round(weeklyMacroTotals.carbs),     unit: "g" },
              { label: "Fat / Fiber",   value: `${Math.round(weeklyMacroTotals.fat)}g / ${Math.round(weeklyMacroTotals.fiber)}g`, unit: "" },
            ].map(({ label, value, unit }) => (
              <div key={label} className="rounded-xl bg-slate-100 p-3">
                <div className="text-xs text-slate-500">{label}</div>
                <div className="text-xl font-semibold">{value}{unit}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Saved Recipes */}
        <section className="rounded-2xl bg-white p-4 shadow md:p-6">
          <h2 className="mb-4 text-2xl font-semibold">Saved Recipes</h2>
          <div className="space-y-3">
            {recipes.map((recipe) => (
              <div key={recipe.id} className="rounded border p-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="font-semibold">{recipe.name}</div>
                    <div className="text-sm text-slate-600">{recipe.category}{recipe.tags ? ` • ${recipe.tags}` : ""}</div>
                    <div className="text-sm text-slate-600">
                      {recipe.servings} servings | {recipe.calories} cal | {recipe.protein}g protein | {recipe.fat}g fat | {recipe.carbs}g carbs | {recipe.fiber}g fiber
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => editRecipe(recipe)} className="rounded border px-3 py-2 text-sm">Edit</button>
                    <button onClick={() => deleteRecipe(recipe.id)} className="rounded bg-red-600 px-3 py-2 text-sm text-white">Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Grocery List */}
        <section className="rounded-2xl bg-white p-4 shadow md:p-6">
          <h2 className="mb-1 text-2xl font-semibold">Grocery List For This Week</h2>
          <p className="mb-4 text-sm text-slate-600">Only recipes assigned in the weekly meal planner are included.</p>
          {plannedMealCount === 0 ? (
            <div className="rounded border border-dashed p-4 text-slate-500">Add recipes to the weekly meal planner to generate a grocery list.</div>
          ) : (
            <div className="space-y-4">
              {grocerySections.map((section) => {
                const items = groceryList.filter((i) => i.section === section);
                if (items.length === 0) return null;
                return (
                  <div key={section}>
                    <h3 className="mb-2 font-semibold text-slate-700">{section}</h3>
                    <div className="space-y-2">
                      {items.map((data) => (
                        <div key={`${data.item}-${data.unit}`} className="flex justify-between border-b py-2 text-sm md:text-base">
                          <span className="capitalize">{data.item}</span>
                          <span>{data.qty.toFixed(2)} {data.unit}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}