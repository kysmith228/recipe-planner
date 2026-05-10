"use client";

import { useEffect, useMemo, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type FamilyMember = {
  id: number;
  name: string;
  mealCalories: number;
  mealProtein: number;
  mealFat: number;
  mealCarbs: number;
  mealFiber: number;
  enabledSlots: MealSlot[];
};
type Ingredient = { item: string; qty: number; unit: string; section: string };
type Recipe = {
  id: number; name: string; category: string; tags: string;
  servings: number; calories: number; protein: number; fat: number; carbs: number; fiber: number;
  ingredients: Ingredient[];
};
type MealSlot = "Breakfast" | "Lunch" | "Dinner" | "Snack";
type MealEntry = { main: number | ""; sides: number[] };
function emptyMealEntry(): MealEntry { return { main: "", sides: [] }; }
type PersonMealPlan = Record<number, Record<string, Record<MealSlot, MealEntry>>>;
type UsdaFoodNutrient = { nutrientName?: string; value?: number };
type UsdaFood = { description?: string; dataType?: string; brandOwner?: string; foodNutrients?: UsdaFoodNutrient[] };
type MatchLog = { ingredient: string; matched: string; dataType: string; score: number; source: "local" | "usda" };

// ---------------------------------------------------------------------------
// Local nutrition rules — per 100g
// ---------------------------------------------------------------------------
type LocalNutrition = { cal: number; protein: number; fat: number; carbs: number; fiber: number };
const localNutritionRules: { pattern: RegExp; label: string; nutrition: LocalNutrition }[] = [
  { pattern: /avocado oil/i,              label: "Avocado Oil",               nutrition: { cal: 884, protein: 0,   fat: 100, carbs: 0,   fiber: 0   } },
  { pattern: /olive oil/i,                label: "Olive Oil",                 nutrition: { cal: 884, protein: 0,   fat: 100, carbs: 0,   fiber: 0   } },
  { pattern: /coconut oil/i,              label: "Coconut Oil",               nutrition: { cal: 892, protein: 0,   fat: 99,  carbs: 0,   fiber: 0   } },
  { pattern: /vegetable oil|canola oil/i, label: "Vegetable Oil",             nutrition: { cal: 884, protein: 0,   fat: 100, carbs: 0,   fiber: 0   } },
  { pattern: /sesame oil/i,               label: "Sesame Oil",                nutrition: { cal: 884, protein: 0,   fat: 100, carbs: 0,   fiber: 0   } },
  { pattern: /balsamic vinegar/i,         label: "Balsamic Vinegar",          nutrition: { cal: 88,  protein: 0.5, fat: 0,   carbs: 17,  fiber: 0   } },
  { pattern: /apple cider vinegar/i,      label: "Apple Cider Vinegar",       nutrition: { cal: 21,  protein: 0,   fat: 0,   carbs: 0.9, fiber: 0   } },
  { pattern: /red wine vinegar/i,         label: "Red Wine Vinegar",          nutrition: { cal: 19,  protein: 0,   fat: 0,   carbs: 0.3, fiber: 0   } },
  { pattern: /white wine vinegar|white vinegar|rice vinegar/i, label: "White Vinegar", nutrition: { cal: 18, protein: 0, fat: 0, carbs: 0.6, fiber: 0 } },
  { pattern: /vinegar/i,                  label: "Vinegar",                   nutrition: { cal: 18,  protein: 0,   fat: 0,   carbs: 0.6, fiber: 0   } },
  { pattern: /dijon mustard/i,            label: "Dijon Mustard",             nutrition: { cal: 66,  protein: 3.8, fat: 3.6, carbs: 5.3, fiber: 2   } },
  { pattern: /yellow mustard/i,           label: "Yellow Mustard",            nutrition: { cal: 60,  protein: 3.7, fat: 3.3, carbs: 5.8, fiber: 2   } },
  { pattern: /mustard/i,                  label: "Mustard",                   nutrition: { cal: 63,  protein: 3.7, fat: 3.4, carbs: 5.5, fiber: 2   } },
  { pattern: /soy sauce/i,                label: "Soy Sauce",                 nutrition: { cal: 53,  protein: 8.1, fat: 0.1, carbs: 4.9, fiber: 0.8 } },
  { pattern: /hot sauce/i,                label: "Hot Sauce",                 nutrition: { cal: 11,  protein: 0.5, fat: 0.4, carbs: 0.9, fiber: 0.2 } },
  { pattern: /worcestershire/i,           label: "Worcestershire Sauce",      nutrition: { cal: 78,  protein: 0,   fat: 0,   carbs: 19,  fiber: 0   } },
  { pattern: /honey/i,                    label: "Honey",                     nutrition: { cal: 304, protein: 0.3, fat: 0,   carbs: 82,  fiber: 0.2 } },
  { pattern: /maple syrup/i,              label: "Maple Syrup",               nutrition: { cal: 260, protein: 0,   fat: 0.1, carbs: 67,  fiber: 0   } },
  { pattern: /ketchup/i,                  label: "Ketchup",                   nutrition: { cal: 100, protein: 1.7, fat: 0.1, carbs: 27,  fiber: 0.3 } },
  { pattern: /mayo|mayonnaise/i,          label: "Mayonnaise",                nutrition: { cal: 680, protein: 1,   fat: 75,  carbs: 0.6, fiber: 0   } },
  { pattern: /^salt$|kosher salt|sea salt|table salt/i, label: "Salt (negligible)",    nutrition: { cal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 } },
  { pattern: /black pepper|white pepper|^pepper$/i,     label: "Pepper (negligible)",  nutrition: { cal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 } },
  { pattern: /^garlic powder$/i,          label: "Garlic Powder (negligible)", nutrition: { cal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 } },
  { pattern: /^onion powder$/i,           label: "Onion Powder (negligible)",  nutrition: { cal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 } },
  { pattern: /cumin|paprika|oregano|basil|thyme|rosemary|chili powder|cayenne|cinnamon|nutmeg|turmeric|coriander|seasoning|spice mix|italian seasoning|taco seasoning/i,
    label: "Spice/Seasoning (negligible)", nutrition: { cal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 } },
];

const MAX_RECIPE_CALORIES = 6000;
const STORAGE_KEY = "recipe-planner-v5-ux";
const OLD_STORAGE_KEYS = ["recipe-planner-v4-sides","recipe-planner-v3-per-person","recipe-planner-phase-2-alias-normalized-v1"];
const days = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const allMealSlots: MealSlot[] = ["Breakfast","Lunch","Dinner","Snack"];
const ALL_CATEGORIES = ["Breakfast","Lunch","Dinner","Snack","Side","Dressing","Dessert"];
const grocerySections = ["Produce","Meat","Dairy","Frozen","Pantry","Bakery","Canned Goods","Spices","Other"];
const noiseWords = ["fresh","raw","cooked","diced","chopped","sliced","shredded","minced","boneless","skinless","large","small","medium","extra","lean","organic","use","press","or","and"];

const defaultFamily: FamilyMember[] = [
  { id: 1, name: "Kyle",   mealCalories: 700, mealProtein: 60, mealFat: 25, mealCarbs: 70, mealFiber: 10, enabledSlots: ["Breakfast","Lunch","Dinner","Snack"] },
  { id: 2, name: "Kathie", mealCalories: 500, mealProtein: 40, mealFat: 18, mealCarbs: 50, mealFiber: 8,  enabledSlots: ["Breakfast","Lunch","Dinner","Snack"] },
  { id: 3, name: "Koen",   mealCalories: 450, mealProtein: 30, mealFat: 17, mealCarbs: 55, mealFiber: 7,  enabledSlots: ["Breakfast","Lunch","Dinner","Snack"] },
  { id: 4, name: "Kole",   mealCalories: 450, mealProtein: 30, mealFat: 17, mealCarbs: 55, mealFiber: 7,  enabledSlots: ["Breakfast","Lunch","Dinner","Snack"] },
];

const ingredientAliases: { pattern: RegExp; replacement: string }[] = [
  { pattern: /garlic.*clove|garlic clove|clove garlic|cloves garlic|garlic press/i, replacement: "garlic" },
  { pattern: /black pepper spice|pepper spice|ground black pepper|black pepper/i,   replacement: "black pepper" },
  { pattern: /dijon.*mustard|spicy brown mustard|brown mustard|dijon mustard/i,     replacement: "dijon mustard" },
  { pattern: /avocado oil/i,             replacement: "avocado oil" },
  { pattern: /balsamic vinegar|balsamic/i, replacement: "balsamic vinegar" },
  { pattern: /extra virgin olive oil|olive oil/i, replacement: "olive oil" },
  { pattern: /kosher salt|sea salt|table salt|^salt$/i, replacement: "salt" },
  { pattern: /chicken breast/i,          replacement: "chicken breast" },
  { pattern: /ground beef/i,             replacement: "ground beef" },
  { pattern: /ground turkey/i,           replacement: "ground turkey" },
  { pattern: /white rice|brown rice/i,   replacement: "rice" },
  { pattern: /romaine lettuce|shredded lettuce|lettuce/i, replacement: "lettuce" },
  { pattern: /black beans/i,             replacement: "black beans" },
  { pattern: /tortilla|tortillas/i,      replacement: "tortilla" },
];

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------
function createEmptyPersonPlan(): Record<string, Record<MealSlot, MealEntry>> {
  return days.reduce((p, day) => {
    p[day] = { Breakfast: emptyMealEntry(), Lunch: emptyMealEntry(), Dinner: emptyMealEntry(), Snack: emptyMealEntry() };
    return p;
  }, {} as Record<string, Record<MealSlot, MealEntry>>);
}
function createEmptyPersonMealPlan(fam: FamilyMember[]): PersonMealPlan {
  return fam.reduce((acc, p) => { acc[p.id] = createEmptyPersonPlan(); return acc; }, {} as PersonMealPlan);
}
function migratePlan(old: Record<string, Record<MealSlot, number | "" | MealEntry>>): Record<string, Record<MealSlot, MealEntry>> {
  const result = createEmptyPersonPlan();
  for (const day of days) for (const slot of allMealSlots) {
    const val = old?.[day]?.[slot];
    if (!val) continue;
    if (typeof val === "object" && "main" in val) result[day][slot] = val as MealEntry;
    else if (typeof val === "number") result[day][slot] = { main: val, sides: [] };
  }
  return result;
}
function normalizeIngredientName(item: string) {
  const s = item.toLowerCase().replace(/\([^)]*\)/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const alias = ingredientAliases.find((e) => e.pattern.test(s));
  return alias ? alias.replacement : s;
}
function cleanIngredientForSearch(item: string) {
  return normalizeIngredientName(item).split(/\s+/).filter((w) => w && !noiseWords.includes(w)).join(" ").trim();
}
function getLocalRule(norm: string) {
  const m = localNutritionRules.find((r) => r.pattern.test(norm));
  return m ? { label: m.label, nutrition: m.nutrition } : null;
}
function sectionForItem(item: string) {
  const v = normalizeIngredientName(item);
  if (/chicken|beef|turkey|pork|fish|salmon|shrimp|bacon|sausage/.test(v)) return "Meat";
  if (/milk|cheese|yogurt|butter|cream|egg/.test(v)) return "Dairy";
  if (/lettuce|tomato|onion|pepper|broccoli|carrot|apple|banana|potato|avocado|cilantro|spinach|garlic/.test(v)) return "Produce";
  if (/bread|tortilla|bun|roll|bagel/.test(v)) return "Bakery";
  if (/beans|soup|salsa|tomato sauce|marinara|corn/.test(v)) return "Canned Goods";
  if (/salt|pepper|paprika|cumin|seasoning|oregano|basil|chili|mustard/.test(v)) return "Spices";
  if (/frozen/.test(v)) return "Frozen";
  if (/rice|pasta|flour|sugar|oil|oats|cereal|chips|vinegar/.test(v)) return "Pantry";
  return "Other";
}
function parseAmount(value: string) {
  const mixed = value.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  if (value.includes("/")) { const [t, b] = value.split("/").map(Number); return b ? t / b : 1; }
  return Number(value) || 1;
}
function parseIngredientLine(line: string): Ingredient {
  const cleaned = line.replace(/^[-*•]\s*/, "").replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
  const parts = cleaned.split(/\s+/);
  let qty = parseAmount(parts[0] || "1"); let unitIndex = 1;
  if (parts.length >= 3 && parts[1]?.includes("/")) { qty = parseAmount(`${parts[0]} ${parts[1]}`); unitIndex = 2; }
  const unit = parts[unitIndex] || "each";
  const rawItem = parts.slice(unitIndex + 1).join(" ") || cleaned;
  const item = normalizeIngredientName(rawItem);
  return { qty, unit, item, section: sectionForItem(item) };
}
function blankRecipe(): Recipe {
  return { id: 0, name: "", category: "Dinner", tags: "", servings: 4, calories: 500, protein: 35, fat: 15, carbs: 45, fiber: 5, ingredients: [] };
}
function getNutrient(food: UsdaFood, names: string[]) {
  const n = food.foodNutrients?.find((x) => names.some((name) => (x.nutrientName || "").toLowerCase().includes(name)));
  return Number(n?.value || 0);
}
function unitToGrams(unit: string, item = "") {
  const u = unit.toLowerCase(); const i = normalizeIngredientName(item);
  if (["g","gram","grams"].includes(u)) return 1;
  if (["kg","kilogram","kilograms"].includes(u)) return 1000;
  if (["oz","ounce","ounces"].includes(u)) return 28.35;
  if (["lb","lbs","pound","pounds"].includes(u)) return 453.6;
  if (["ml","milliliter","milliliters","millilitre","millilitres"].includes(u)) return 1;
  if (["l","liter","liters","litre","litres"].includes(u)) return 1000;
  if (["cup","cups"].includes(u)) {
    if (/oil/.test(i)) return 218; if (/vinegar/.test(i)) return 240;
    if (/rice|pasta/.test(i)) return 185; if (/cheese/.test(i)) return 113;
    if (/lettuce/.test(i)) return 47; if (/salsa/.test(i)) return 260;
    if (/beans/.test(i)) return 172; return 240;
  }
  if (["tbsp","tablespoon","tablespoons"].includes(u)) {
    if (/oil/.test(i)) return 13.6; if (/vinegar/.test(i)) return 15;
    if (/mustard|honey|syrup|ketchup/.test(i)) return 21;
    if (/mayo/.test(i)) return 14; if (/soy sauce/.test(i)) return 16; return 15;
  }
  if (["tsp","teaspoon","teaspoons"].includes(u)) {
    if (/oil/.test(i)) return 4.5; if (/salt/.test(i)) return 6;
    if (/pepper|spice|seasoning/.test(i)) return 2.3; if (/mustard/.test(i)) return 5; return 5;
  }
  if (["clove","cloves"].includes(u)) return 3;
  if (["each","ea","ct","count"].includes(u)) { if (/tortilla/.test(i)) return 45; if (/egg/.test(i)) return 50; return 100; }
  return 100;
}
function scoreUsdaFood(food: UsdaFood, ingredient: string) {
  const desc = (food.description || "").toLowerCase(); const dt = (food.dataType || "").toLowerCase();
  const norm = normalizeIngredientName(ingredient);
  const terms = cleanIngredientForSearch(norm).split(/\s+/).filter(Boolean);
  let score = 0;
  terms.forEach((t) => { if (desc.includes(t)) score += 10; });
  if (dt.includes("foundation")) score += 40; if (dt.includes("sr legacy")) score += 35;
  if (dt.includes("survey")) score += 20; if (dt.includes("branded")) score -= 25;
  if (food.brandOwner) score -= 15;
  if (/breast/.test(norm) && /breast/.test(desc)) score += 12;
  if (/with salt|prepared|restaurant|fast food|babyfood|formula/.test(desc)) score -= 20;
  if (/cloves, ground/.test(desc) && /garlic/.test(norm)) score -= 100;
  return score;
}
function chooseBest(foods: UsdaFood[], ingredient: string) {
  return foods.map((food) => ({ food, score: scoreUsdaFood(food, ingredient) })).sort((a, b) => b.score - a.score)[0];
}
function entryRecipeIds(entry: MealEntry): number[] {
  const ids: number[] = [];
  if (entry.main) ids.push(entry.main);
  ids.push(...entry.sides);
  return ids;
}
function accumulateIngredients(recipe: Recipe, servingsNeeded: number, list: Record<string, { qty: number; unit: string; section: string }>) {
  const scale = servingsNeeded / recipe.servings;
  recipe.ingredients.forEach((ing) => {
    const key = `${ing.item.toLowerCase()}|${ing.unit.toLowerCase()}`;
    if (!list[key]) list[key] = { qty: 0, unit: ing.unit, section: ing.section };
    list[key].qty += ing.qty * scale;
  });
}

// ── FEATURE 3: Human-friendly quantity formatting ──
function formatQty(qty: number, unit: string): string {
  const u = unit.toLowerCase();
  // Convert small oz amounts to tsp/tbsp
  if (["oz","ounce","ounces"].includes(u)) {
    if (qty < 0.5) return `${+(qty * 6).toFixed(1)} tsp`;
    if (qty < 1)   return `${+(qty * 2).toFixed(1)} tbsp`;
  }
  // Convert large tsp to tbsp
  if (["tsp","teaspoon","teaspoons"].includes(u) && qty >= 3) {
    return `${+(qty / 3).toFixed(1)} tbsp`;
  }
  // Convert large tbsp to cups
  if (["tbsp","tablespoon","tablespoons"].includes(u) && qty >= 16) {
    return `${+(qty / 16).toFixed(2)} cups`;
  }
  // Round to nearest sensible fraction
  if (qty >= 10)  return `${Math.round(qty)} ${unit}`;
  if (qty >= 1)   return `${+(Math.round(qty * 4) / 4).toFixed(2).replace(/\.?0+$/, "")} ${unit}`;
  // Show fractions for small amounts
  const fracs: [number, string][] = [[0.125,"⅛"],[0.25,"¼"],[0.333,"⅓"],[0.5,"½"],[0.667,"⅔"],[0.75,"¾"]];
  const closest = fracs.reduce((a, b) => Math.abs(b[0] - qty) < Math.abs(a[0] - qty) ? b : a);
  if (Math.abs(closest[0] - qty) < 0.05) return `${closest[1]} ${unit}`;
  return `${qty.toFixed(2)} ${unit}`;
}

// ── FEATURE 1: Macro feedback color for a slot ──
function slotMacroColor(entry: MealEntry, person: FamilyMember, recipes: Recipe[], scaleBy: "calories" | "protein"): string {
  const ids = entryRecipeIds(entry);
  if (!ids.length) return "";
  const target = scaleBy === "protein" ? person.mealProtein : person.mealCalories;
  let total = 0;
  ids.forEach((rid) => {
    const r = recipes.find((x) => x.id === rid);
    if (!r) return;
    const rt = scaleBy === "protein" ? r.protein : r.calories;
    total += rt > 0 ? (target / rt) * (scaleBy === "protein" ? r.protein : r.calories) : 0;
  });
  const pct = target > 0 ? total / target : 0;
  if (pct < 0.7) return "bg-blue-50 border-blue-200";      // under
  if (pct <= 1.15) return "bg-green-50 border-green-200";  // on target
  return "bg-red-50 border-red-200";                        // over
}

// ── FEATURE 1: Macro summary text for a slot ──
function slotMacroSummary(entry: MealEntry, person: FamilyMember, recipes: Recipe[], scaleBy: "calories" | "protein"): string {
  const ids = entryRecipeIds(entry);
  if (!ids.length) return "";
  const target = scaleBy === "protein" ? person.mealProtein : person.mealCalories;
  let cal = 0; let pro = 0;
  ids.forEach((rid) => {
    const r = recipes.find((x) => x.id === rid);
    if (!r) return;
    const rt = scaleBy === "protein" ? r.protein : r.calories;
    const servings = rt > 0 ? target / rt : 1;
    cal += r.calories * servings;
    pro += r.protein  * servings;
  });
  return `${Math.round(cal)} cal · ${Math.round(pro)}g pro`;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function Home() {
  const [family, setFamily] = useState<FamilyMember[]>(defaultFamily);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [editingRecipeId, setEditingRecipeId] = useState<number | null>(null);
  const [recipeForm, setRecipeForm] = useState<Recipe>(blankRecipe());
  const [ingredientsText, setIngredientsText] = useState("1 lb chicken breast\n8 each tortillas\n1 cup salsa");
  const [scaleBy, setScaleBy] = useState<"calories" | "protein">("calories");
  const [personMealPlan, setPersonMealPlan] = useState<PersonMealPlan>(() => createEmptyPersonMealPlan(defaultFamily));
  const [activePlanTab, setActivePlanTab] = useState<number>(defaultFamily[0].id);
  const [activeMainTab, setActiveMainTab] = useState<"planner" | "summary" | "recipes" | "family">("planner");
  const [usdaStatus, setUsdaStatus] = useState("Oils, vinegars, mustards, and spices use built-in local rules. USDA is called only for real foods.");
  const [isEstimating, setIsEstimating] = useState(false);
  const [matchLog, setMatchLog] = useState<MatchLog[]>([]);
  const [expandedSlot, setExpandedSlot] = useState<string | null>(null);
  // Feature 2: recipe search/filter
  const [recipeSearch, setRecipeSearch] = useState("");
  const [recipeCatFilter, setRecipeCatFilter] = useState("All");
  // Feature 6: delete confirm
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  // Feature 7: copy week modal
  const [copyFromId, setCopyFromId] = useState<number | null>(null);
  const [copyToId, setCopyToId] = useState<number | null>(null);

  // Load
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY) || OLD_STORAGE_KEYS.map((k) => localStorage.getItem(k)).find(Boolean);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    const loadedFamily: FamilyMember[] = (parsed.family || defaultFamily).map((p: FamilyMember) => ({ ...p, enabledSlots: p.enabledSlots || allMealSlots }));
    setFamily(loadedFamily);
    setRecipes(parsed.recipes || []);
    setScaleBy(parsed.scaleBy || "calories");
    if (parsed.personMealPlan) {
      const migrated: PersonMealPlan = {};
      for (const [pid, plan] of Object.entries(parsed.personMealPlan))
        migrated[Number(pid)] = migratePlan(plan as Record<string, Record<MealSlot, number | "" | MealEntry>>);
      setPersonMealPlan(migrated);
    } else {
      setPersonMealPlan(createEmptyPersonMealPlan(loadedFamily));
    }
    setActivePlanTab(loadedFamily[0]?.id ?? 1);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ family, recipes, scaleBy, personMealPlan }));
  }, [family, recipes, scaleBy, personMealPlan]);

  useEffect(() => {
    setPersonMealPlan((cur) => {
      const next = { ...cur };
      family.forEach((p) => { if (!next[p.id]) next[p.id] = createEmptyPersonPlan(); });
      return next;
    });
  }, [family]);

  // ---------------------------------------------------------------------------
  // Family
  // ---------------------------------------------------------------------------
  function updateFamily(id: number, field: keyof FamilyMember, value: string) {
    setFamily((cur) => cur.map((p) => (p.id === id ? { ...p, [field]: field === "name" ? value : Number(value) } : p)));
  }
  function toggleSlot(personId: number, slot: MealSlot) {
    setFamily((cur) => cur.map((p) => {
      if (p.id !== personId) return p;
      const has = p.enabledSlots.includes(slot);
      const next = has ? p.enabledSlots.filter((s) => s !== slot) : [...p.enabledSlots, slot];
      return { ...p, enabledSlots: next.length ? next : p.enabledSlots };
    }));
  }

  // ---------------------------------------------------------------------------
  // Recipes
  // ---------------------------------------------------------------------------
  function updateRecipeField(field: keyof Recipe, value: string) {
    setRecipeForm((cur) => ({ ...cur, [field]: ["name","category","tags"].includes(field) ? value : Number(value) }));
  }

  // Feature 5: duplicate recipe
  function duplicateRecipe(recipe: Recipe) {
    const copy: Recipe = { ...recipe, id: Date.now(), name: `${recipe.name} (copy)` };
    setRecipes((cur) => [...cur, copy]);
  }

  async function estimateNutrition() {
    const ingredients = ingredientsText.split("\n").map((l) => l.trim()).filter(Boolean).map(parseIngredientLine);
    if (!ingredients.length) { setUsdaStatus("Add ingredients first."); return; }
    setIsEstimating(true); setUsdaStatus("Estimating nutrition..."); setMatchLog([]);
    const total = { calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 };
    const matched: MatchLog[] = []; const missed: string[] = [];
    try {
      for (const ing of ingredients) {
        const norm = normalizeIngredientName(ing.item);
        const mult = (ing.qty * unitToGrams(ing.unit, norm)) / 100;
        const local = getLocalRule(norm);
        if (local) {
          const n = local.nutrition;
          total.calories += n.cal * mult; total.protein += n.protein * mult;
          total.fat += n.fat * mult; total.carbs += n.carbs * mult; total.fiber += n.fiber * mult;
          matched.push({ ingredient: ing.item, matched: local.label, dataType: "Local nutrition rule", score: 999, source: "local" });
          continue;
        }
        const query = cleanIngredientForSearch(norm) || norm;
        const res = await fetch(`/api/usda/search?query=${encodeURIComponent(query)}`);
        if (!res.ok) { missed.push(ing.item); continue; }
        const data = await res.json();
        const foods: UsdaFood[] = data.foods || [];
        if (!foods.length) { missed.push(ing.item); continue; }
        const best = chooseBest(foods, norm);
        if (!best?.food) { missed.push(ing.item); continue; }
        total.calories += getNutrient(best.food, ["energy"])            * mult;
        total.protein  += getNutrient(best.food, ["protein"])           * mult;
        total.fat      += getNutrient(best.food, ["total lipid","fat"]) * mult;
        total.carbs    += getNutrient(best.food, ["carbohydrate"])      * mult;
        total.fiber    += getNutrient(best.food, ["fiber"])             * mult;
        matched.push({ ingredient: ing.item, matched: best.food.description || "USDA match", dataType: best.food.dataType || "Unknown", score: best.score, source: "usda" });
      }
      const divisor = recipeForm.servings || 1;
      const rawCal = total.calories;
      const capHit = total.calories > MAX_RECIPE_CALORIES;
      if (capHit) { const s = MAX_RECIPE_CALORIES / total.calories; (Object.keys(total) as (keyof typeof total)[]).forEach((k) => { total[k] *= s; }); }
      setRecipeForm((cur) => ({
        ...cur,
        calories: Math.round(total.calories / divisor), protein: Math.round(total.protein / divisor),
        fat: Math.round(total.fat / divisor), carbs: Math.round(total.carbs / divisor), fiber: Math.round(total.fiber / divisor),
      }));
      setMatchLog(matched);
      const capNote = capHit ? ` ⚠️ Raw total (${Math.round(rawCal)} cal) exceeded sanity cap and was scaled down.` : "";
      const missNote = missed.length ? ` Not matched: ${missed.join(", ")}.` : "";
      setUsdaStatus(`Estimate complete. ${matched.length} matched.${missNote}${capNote} Review before saving.`);
    } catch { setUsdaStatus("Estimate failed. Check the API route."); }
    finally { setIsEstimating(false); }
  }

  function saveRecipe() {
    const ingredients = ingredientsText.split("\n").map((l) => l.trim()).filter(Boolean).map(parseIngredientLine);
    const toSave: Recipe = { ...recipeForm, id: editingRecipeId ?? Date.now(), name: recipeForm.name.trim() || "Untitled Recipe", ingredients };
    if (editingRecipeId) setRecipes((cur) => cur.map((r) => (r.id === editingRecipeId ? toSave : r)));
    else setRecipes((cur) => [...cur, toSave]);
    cancelEdit();
  }
  function editRecipe(recipe: Recipe) {
    setEditingRecipeId(recipe.id);
    setRecipeForm(recipe);
    setIngredientsText(recipe.ingredients.map((i) => `${i.qty} ${i.unit} ${i.item}`).join("\n"));
    setMatchLog([]);
    setActiveMainTab("recipes");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Feature 6: confirm delete if recipe is in use
  function requestDeleteRecipe(id: number) {
    const inUse = family.some((p) => {
      const plan = personMealPlan[p.id];
      return plan && days.some((day) => allMealSlots.some((slot) => entryRecipeIds(plan[day]?.[slot] ?? emptyMealEntry()).includes(id)));
    });
    if (inUse) { setConfirmDeleteId(id); }
    else confirmDeleteRecipe(id);
  }
  function confirmDeleteRecipe(id: number) {
    setRecipes((cur) => cur.filter((r) => r.id !== id));
    setPersonMealPlan((cur) => {
      const next = { ...cur };
      family.forEach((p) => {
        next[p.id] = { ...next[p.id] };
        days.forEach((day) => {
          next[p.id][day] = { ...next[p.id][day] };
          allMealSlots.forEach((slot) => {
            const e = next[p.id][day][slot];
            next[p.id][day][slot] = { main: e.main === id ? "" : e.main, sides: e.sides.filter((s) => s !== id) };
          });
        });
      });
      return next;
    });
    if (editingRecipeId === id) cancelEdit();
    setConfirmDeleteId(null);
  }
  function cancelEdit() {
    setEditingRecipeId(null); setRecipeForm(blankRecipe());
    setIngredientsText("1 lb chicken breast\n8 each tortillas\n1 cup salsa");
    setMatchLog([]);
  }

  // ---------------------------------------------------------------------------
  // Meal plan
  // ---------------------------------------------------------------------------
  function setMain(personId: number, day: string, slot: MealSlot, recipeId: string) {
    setPersonMealPlan((cur) => ({
      ...cur,
      [personId]: { ...cur[personId], [day]: { ...cur[personId]?.[day], [slot]: { ...cur[personId]?.[day]?.[slot], main: recipeId ? Number(recipeId) : "" } } },
    }));
  }
  function addSide(personId: number, day: string, slot: MealSlot, recipeId: number) {
    setPersonMealPlan((cur) => {
      const entry = cur[personId]?.[day]?.[slot] ?? emptyMealEntry();
      if (entry.sides.includes(recipeId)) return cur;
      return { ...cur, [personId]: { ...cur[personId], [day]: { ...cur[personId]?.[day], [slot]: { ...entry, sides: [...entry.sides, recipeId] } } } };
    });
  }
  function removeSide(personId: number, day: string, slot: MealSlot, recipeId: number) {
    setPersonMealPlan((cur) => {
      const entry = cur[personId]?.[day]?.[slot] ?? emptyMealEntry();
      return { ...cur, [personId]: { ...cur[personId], [day]: { ...cur[personId]?.[day], [slot]: { ...entry, sides: entry.sides.filter((s) => s !== recipeId) } } } };
    });
  }
  function clearPersonPlan(personId: number) {
    setPersonMealPlan((cur) => ({ ...cur, [personId]: createEmptyPersonPlan() }));
  }

  // Feature 7: copy week
  function copyWeek() {
    if (!copyFromId || !copyToId || copyFromId === copyToId) return;
    setPersonMealPlan((cur) => {
      const sourcePlan = cur[copyFromId];
      if (!sourcePlan) return cur;
      const copied: Record<string, Record<MealSlot, MealEntry>> = {};
      days.forEach((day) => {
        copied[day] = { Breakfast: emptyMealEntry(), Lunch: emptyMealEntry(), Dinner: emptyMealEntry(), Snack: emptyMealEntry() };
        allMealSlots.forEach((slot) => {
          const e = sourcePlan[day]?.[slot];
          if (e) copied[day][slot] = { main: e.main, sides: [...e.sides] };
        });
      });
      return { ...cur, [copyToId]: copied };
    });
    setCopyFromId(null); setCopyToId(null);
  }

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------
  function calcPersonWeeklyTotals(person: FamilyMember) {
    const t = { calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 };
    const plan = personMealPlan[person.id]; if (!plan) return t;
    const target = scaleBy === "protein" ? person.mealProtein : person.mealCalories;
    days.forEach((day) => allMealSlots.forEach((slot) => {
      const entry = plan[day]?.[slot]; if (!entry) return;
      entryRecipeIds(entry).forEach((rid) => {
        const r = recipes.find((x) => x.id === rid); if (!r) return;
        const rt = scaleBy === "protein" ? r.protein : r.calories;
        const servings = rt > 0 ? target / rt : 1;
        t.calories += r.calories * servings; t.protein += r.protein * servings;
        t.fat += r.fat * servings; t.carbs += r.carbs * servings; t.fiber += r.fiber * servings;
      });
    }));
    return t;
  }

  const groceryList = useMemo(() => {
    const list: Record<string, { qty: number; unit: string; section: string }> = {};
    family.forEach((person) => {
      const plan = personMealPlan[person.id]; if (!plan) return;
      const target = scaleBy === "protein" ? person.mealProtein : person.mealCalories;
      days.forEach((day) => allMealSlots.forEach((slot) => {
        const entry = plan[day]?.[slot]; if (!entry) return;
        entryRecipeIds(entry).forEach((rid) => {
          const recipe = recipes.find((r) => r.id === rid); if (!recipe) return;
          const rt = scaleBy === "protein" ? recipe.protein : recipe.calories;
          accumulateIngredients(recipe, rt > 0 ? target / rt : 1, list);
        });
      }));
    });
    return Object.entries(list)
      .map(([key, val]) => ({ item: key.split("|")[0], ...val }))
      .sort((a, b) => a.section.localeCompare(b.section) || a.item.localeCompare(b.item));
  }, [family, recipes, scaleBy, personMealPlan]);

  const totalPlannedMeals = useMemo(() =>
    family.reduce((sum, p) => {
      const plan = personMealPlan[p.id]; if (!plan) return sum;
      return sum + days.reduce((ds, day) => ds + allMealSlots.filter((slot) => { const e = plan[day]?.[slot]; return e && (e.main || e.sides.length > 0); }).length, 0);
    }, 0), [family, personMealPlan]);

  // Feature 2: filtered recipes
  const filteredRecipes = useMemo(() => recipes.filter((r) => {
    const matchSearch = recipeSearch === "" || r.name.toLowerCase().includes(recipeSearch.toLowerCase()) || r.tags.toLowerCase().includes(recipeSearch.toLowerCase());
    const matchCat = recipeCatFilter === "All" || r.category === recipeCatFilter;
    return matchSearch && matchCat;
  }), [recipes, recipeSearch, recipeCatFilter]);

  // ---------------------------------------------------------------------------
  // CSS helpers
  // ---------------------------------------------------------------------------
  const activePerson = family.find((p) => p.id === activePlanTab) ?? family[0];
  const mainTabCls = (tab: typeof activeMainTab) =>
    `px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${activeMainTab === tab ? "border-blue-600 text-blue-700 bg-white" : "border-transparent text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-50"}`;
  const personTabCls = (id: number) =>
    `px-4 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${activePlanTab === id ? "border-blue-600 text-blue-700 bg-white" : "border-transparent text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-white"}`;

  // Planner cell component
  function PlannerCell({ personId, day, slot, person }: { personId: number; day: string; slot: MealSlot; person: FamilyMember }) {
    const entry = personMealPlan[personId]?.[day]?.[slot] ?? emptyMealEntry();
    const slotKey = `${personId}-${day}-${slot}`;
    const isExpanded = expandedSlot === slotKey;
    const mainOptions = recipes.filter((r) => slot === "Snack" || r.category === slot || r.category === "Dinner");
    const sideOptions = recipes.filter((r) => r.id !== entry.main && !entry.sides.includes(r.id));
    const colorCls = slotMacroColor(entry, person, recipes, scaleBy);
    const summary = slotMacroSummary(entry, person, recipes, scaleBy);

    return (
      <div className={`space-y-1 rounded p-1 border ${colorCls || "border-transparent"}`}>
        <select className="w-full rounded border p-1 text-xs bg-white" value={entry.main || ""} onChange={(e) => setMain(personId, day, slot, e.target.value)}>
          <option value="">— main —</option>
          {mainOptions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        {entry.sides.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {entry.sides.map((sid) => {
              const sr = recipes.find((r) => r.id === sid); if (!sr) return null;
              return (
                <span key={sid} className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">
                  {sr.name}
                  <button onClick={() => removeSide(personId, day, slot, sid)} className="text-emerald-600 hover:text-red-600 font-bold">×</button>
                </span>
              );
            })}
          </div>
        )}
        {/* Feature 1: macro feedback */}
        {summary && <div className="text-xs text-slate-500 leading-tight">{summary}</div>}
        {sideOptions.length > 0 && (
          isExpanded ? (
            <div className="flex gap-1">
              <select className="flex-1 rounded border p-1 text-xs" defaultValue=""
                onChange={(e) => { if (e.target.value) { addSide(personId, day, slot, Number(e.target.value)); setExpandedSlot(null); } }}>
                <option value="">+ pick side / dressing</option>
                {sideOptions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <button onClick={() => setExpandedSlot(null)} className="text-xs text-slate-400 hover:text-slate-600 px-1">✕</button>
            </div>
          ) : (
            <button onClick={() => setExpandedSlot(slotKey)} className="text-xs text-emerald-700 hover:underline">+ add side</button>
          )
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // JSX
  // ---------------------------------------------------------------------------
  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <h1 className="text-3xl font-bold md:text-4xl">Recipe Macro Grocery Planner</h1>

        {/* Main tabs */}
        <div className="flex gap-1 border-b border-slate-300 overflow-x-auto">
          <button className={mainTabCls("planner")}  onClick={() => setActiveMainTab("planner")}>📅 Planner</button>
          <button className={mainTabCls("summary")}  onClick={() => setActiveMainTab("summary")}>👨‍👩‍👧‍👦 Family Summary</button>
          <button className={mainTabCls("recipes")}  onClick={() => setActiveMainTab("recipes")}>🍽 Recipes</button>
          <button className={mainTabCls("family")}   onClick={() => setActiveMainTab("family")}>⚙️ Family Settings</button>
        </div>

        {/* ══════════════════════════ PLANNER ═════════════════════════════ */}
        {activeMainTab === "planner" && (
          <div className="space-y-6">
            <section className="rounded-2xl bg-white shadow overflow-hidden">
              <div className="flex gap-1 px-4 pt-3 border-b border-slate-200 bg-slate-50 overflow-x-auto">
                {family.map((p) => <button key={p.id} className={personTabCls(p.id)} onClick={() => setActivePlanTab(p.id)}>{p.name}</button>)}
              </div>
              <div className="p-4 md:p-6">
                <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">{activePerson?.name}'s Week</h2>
                    <p className="text-sm text-slate-500">{activePerson?.mealCalories} cal · {activePerson?.mealProtein}g protein per meal target</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="text-sm font-medium">Scale by&nbsp;
                      <select className="rounded border p-1.5 text-sm" value={scaleBy} onChange={(e) => setScaleBy(e.target.value as "calories" | "protein")}>
                        <option value="calories">Calories</option><option value="protein">Protein</option>
                      </select>
                    </label>
                    {/* Feature 7: copy week button */}
                    <button onClick={() => { setCopyFromId(activePlanTab); setCopyToId(null); }}
                      className="rounded border px-3 py-1.5 text-sm hover:bg-slate-50 text-slate-600">📋 Copy Week</button>
                    <button onClick={() => clearPersonPlan(activePlanTab)} className="rounded border px-3 py-1.5 text-sm hover:bg-slate-50 text-slate-600">Clear</button>
                  </div>
                </div>

                {/* Macro legend */}
                <div className="mb-3 flex flex-wrap gap-3 text-xs">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-100 border border-green-200 inline-block"></span>On target</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-100 border border-blue-200 inline-block"></span>Under target</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 border border-red-200 inline-block"></span>Over target</span>
                </div>

                {/* Slot toggles */}
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Slots:</span>
                  {allMealSlots.map((slot) => {
                    const on = activePerson?.enabledSlots.includes(slot);
                    return <button key={slot} onClick={() => toggleSlot(activePlanTab, slot)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold border transition-colors ${on ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-400 border-slate-300"}`}>{slot}</button>;
                  })}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px] border text-sm">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="border p-2 text-left w-24">Day</th>
                        {(activePerson?.enabledSlots ?? allMealSlots).map((slot) => <th key={slot} className="border p-2 text-center">{slot}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {days.map((day) => (
                        <tr key={day}>
                          <td className="border p-2 font-semibold text-slate-700 whitespace-nowrap align-top">{day}</td>
                          {(activePerson?.enabledSlots ?? allMealSlots).map((slot) => (
                            <td key={slot} className="border p-1.5 align-top min-w-[150px]">
                              {activePerson && <PlannerCell personId={activePlanTab} day={day} slot={slot} person={activePerson} />}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {activePerson && (() => {
                  const t = calcPersonWeeklyTotals(activePerson);
                  return (
                    <div className="mt-4 grid gap-3 grid-cols-2 sm:grid-cols-5">
                      {([
                        { label: "Calories/wk", value: Math.round(t.calories), unit: "" },
                        { label: "Protein/wk",  value: Math.round(t.protein),  unit: "g" },
                        { label: "Carbs/wk",    value: Math.round(t.carbs),    unit: "g" },
                        { label: "Fat/wk",      value: Math.round(t.fat),      unit: "g" },
                        { label: "Fiber/wk",    value: Math.round(t.fiber),    unit: "g" },
                      ] as { label: string; value: number; unit: string }[]).map(({ label, value, unit }) => (
                        <div key={label} className="rounded-xl bg-slate-100 p-3">
                          <div className="text-xs text-slate-500">{label}</div>
                          <div className="text-xl font-semibold">{value}{unit}</div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </section>

            {/* Grocery List */}
            <section className="rounded-2xl bg-white p-4 shadow md:p-6">
              <h2 className="mb-1 text-2xl font-semibold">Combined Grocery List</h2>
              <p className="mb-4 text-sm text-slate-500">{family.length} family members · {totalPlannedMeals} meals · scaled per person to their individual targets</p>
              {totalPlannedMeals === 0 ? (
                <div className="rounded border border-dashed p-6 text-center text-slate-400">Plan some meals above to generate a grocery list.</div>
              ) : (
                <div className="space-y-5">
                  {grocerySections.map((section) => {
                    const items = groceryList.filter((i) => i.section === section);
                    if (!items.length) return null;
                    return (
                      <div key={section}>
                        <h3 className="mb-2 font-semibold text-slate-700 border-b pb-1">{section}</h3>
                        <div className="space-y-0.5">
                          {items.map((d) => (
                            <div key={`${d.item}-${d.unit}`} className="flex justify-between py-1.5 text-sm border-b border-slate-100 last:border-0">
                              <span className="capitalize">{d.item}</span>
                              {/* Feature 3: human-friendly quantities */}
                              <span className="text-slate-500 tabular-nums">{formatQty(d.qty, d.unit)}</span>
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
        )}

        {/* ══════════════════════════ FAMILY SUMMARY ══════════════════════ */}
        {/* Feature 4: family summary view */}
        {activeMainTab === "summary" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">All Family Plans at a Glance</h2>
              <label className="text-sm font-medium">Scale by&nbsp;
                <select className="rounded border p-1.5 text-sm" value={scaleBy} onChange={(e) => setScaleBy(e.target.value as "calories" | "protein")}>
                  <option value="calories">Calories</option><option value="protein">Protein</option>
                </select>
              </label>
            </div>
            {days.map((day) => (
              <div key={day} className="rounded-2xl bg-white shadow overflow-hidden">
                <div className="bg-slate-100 px-4 py-2 font-semibold text-slate-700">{day}</div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px] text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="border p-2 text-left w-24">Slot</th>
                        {family.map((p) => <th key={p.id} className="border p-2 text-center">{p.name}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {allMealSlots.map((slot) => {
                        const anyPlanned = family.some((p) => {
                          const e = personMealPlan[p.id]?.[day]?.[slot];
                          return e && (e.main || e.sides.length > 0);
                        });
                        if (!anyPlanned) return null;
                        return (
                          <tr key={slot}>
                            <td className="border p-2 font-medium text-slate-600">{slot}</td>
                            {family.map((p) => {
                              const entry = personMealPlan[p.id]?.[day]?.[slot] ?? emptyMealEntry();
                              const ids = entryRecipeIds(entry);
                              const colorCls = slotMacroColor(entry, p, recipes, scaleBy);
                              return (
                                <td key={p.id} className={`border p-2 text-xs align-top ${colorCls}`}>
                                  {ids.length === 0 ? <span className="text-slate-300">—</span> : (
                                    <div className="space-y-0.5">
                                      {ids.map((rid) => {
                                        const r = recipes.find((x) => x.id === rid);
                                        return r ? <div key={rid} className="truncate max-w-[120px]">{r.name}</div> : null;
                                      })}
                                      <div className="text-slate-500 text-xs">{slotMacroSummary(entry, p, recipes, scaleBy)}</div>
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ══════════════════════════ RECIPES ══════════════════════════════ */}
        {activeMainTab === "recipes" && (
          <div className="space-y-6">
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
                    {ALL_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </label>
                <label className="block md:col-span-2">
                  <span className="mb-1 block text-sm font-medium">Tags</span>
                  <input className="w-full rounded border p-2" value={recipeForm.tags} onChange={(e) => updateRecipeField("tags", e.target.value)} placeholder="high protein, quick, kid friendly" />
                </label>
                {(["servings","calories","protein","fat","carbs","fiber"] as const).map((field) => (
                  <label key={field} className="block">
                    <span className="mb-1 block text-sm font-medium">{field === "servings" ? "Servings" : `${field.charAt(0).toUpperCase() + field.slice(1)} Per Serving`}</span>
                    <input className="w-full rounded border p-2" type="number" value={recipeForm[field]} onChange={(e) => updateRecipeField(field, e.target.value)} />
                  </label>
                ))}
                <label className="block md:col-span-2">
                  <span className="mb-1 block text-sm font-medium">Ingredients (one per line — e.g. "1 lb chicken breast")</span>
                  <textarea className="min-h-32 w-full rounded border p-2 font-mono text-sm" value={ingredientsText} onChange={(e) => setIngredientsText(e.target.value)} />
                </label>
                <p className="text-sm text-slate-600 md:col-span-2">{usdaStatus}</p>
                {matchLog.length > 0 && (
                  <div className="rounded bg-slate-50 p-3 text-sm md:col-span-2 space-y-1">
                    <div className="font-semibold mb-2">Nutrition Sources Used</div>
                    {matchLog.map((m) => (
                      <div key={`${m.ingredient}-${m.matched}`} className="flex items-start gap-2 border-b pb-1 last:border-0">
                        <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-xs font-bold ${m.source === "local" ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800"}`}>
                          {m.source === "local" ? "LOCAL" : "USDA"}
                        </span>
                        <span><span className="font-medium">{m.ingredient}</span> → {m.matched}
                          {m.source === "usda" && <span className="text-slate-400 text-xs"> ({m.dataType}, score {m.score})</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-3 md:col-span-2">
                  <button onClick={estimateNutrition} disabled={isEstimating} className="rounded bg-green-600 px-4 py-2 text-white disabled:bg-slate-400">
                    {isEstimating ? "Estimating..." : "Estimate Nutrition"}
                  </button>
                  <button onClick={saveRecipe} className="rounded bg-blue-600 px-4 py-2 text-white">
                    {editingRecipeId ? "Update Recipe" : "Save Recipe"}
                  </button>
                  {editingRecipeId && <button onClick={cancelEdit} className="rounded border px-4 py-2 hover:bg-slate-50">Cancel</button>}
                </div>
              </div>
            </section>

            {/* Feature 2: search + filter */}
            <section className="rounded-2xl bg-white p-4 shadow md:p-6">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-2xl font-semibold">Saved Recipes ({filteredRecipes.length}{filteredRecipes.length !== recipes.length ? ` of ${recipes.length}` : ""})</h2>
                <div className="flex gap-2 flex-wrap">
                  <input
                    className="rounded border p-2 text-sm w-48"
                    placeholder="🔍 Search recipes..."
                    value={recipeSearch}
                    onChange={(e) => setRecipeSearch(e.target.value)}
                  />
                  <select className="rounded border p-2 text-sm" value={recipeCatFilter} onChange={(e) => setRecipeCatFilter(e.target.value)}>
                    <option value="All">All categories</option>
                    {ALL_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              {filteredRecipes.length === 0 ? (
                <div className="rounded border border-dashed p-6 text-center text-slate-400">
                  {recipes.length === 0 ? "No recipes yet — add one above." : "No recipes match your search."}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredRecipes.map((recipe) => (
                    <div key={recipe.id} className="rounded border p-3 hover:bg-slate-50 transition-colors">
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="font-semibold">{recipe.name}
                            {["Side","Dressing"].includes(recipe.category) && (
                              <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700 font-medium">{recipe.category}</span>
                            )}
                          </div>
                          <div className="text-sm text-slate-500">{recipe.category}{recipe.tags ? ` · ${recipe.tags}` : ""}</div>
                          <div className="text-sm text-slate-500">
                            {recipe.servings} srv · {recipe.calories} cal · {recipe.protein}g pro · {recipe.fat}g fat · {recipe.carbs}g carbs · {recipe.fiber}g fiber
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button onClick={() => editRecipe(recipe)} className="rounded border px-3 py-1.5 text-sm hover:bg-slate-100">Edit</button>
                          {/* Feature 5: duplicate */}
                          <button onClick={() => duplicateRecipe(recipe)} className="rounded border px-3 py-1.5 text-sm hover:bg-slate-100" title="Duplicate recipe">⧉ Copy</button>
                          <button onClick={() => requestDeleteRecipe(recipe.id)} className="rounded bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700">Delete</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* ══════════════════════════ FAMILY SETTINGS ══════════════════════ */}
        {activeMainTab === "family" && (
          <section className="rounded-2xl bg-white p-4 shadow md:p-6">
            <h2 className="mb-1 text-2xl font-semibold">Family Settings</h2>
            <p className="mb-4 text-sm text-slate-500">Set per-meal nutrition targets and toggle which meal slots each person uses.</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] border text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="border p-2 text-left">Name</th>
                    <th className="border p-2">Calories</th>
                    <th className="border p-2">Protein (g)</th>
                    <th className="border p-2">Fat (g)</th>
                    <th className="border p-2">Carbs (g)</th>
                    <th className="border p-2">Fiber (g)</th>
                    <th className="border p-2 text-left">Meal Slots</th>
                  </tr>
                </thead>
                <tbody>
                  {family.map((person) => (
                    <tr key={person.id} className="hover:bg-slate-50">
                      <td className="border p-2">
                        <input className="w-28 rounded border p-1" value={person.name} onChange={(e) => updateFamily(person.id, "name", e.target.value)} />
                      </td>
                      {(["mealCalories","mealProtein","mealFat","mealCarbs","mealFiber"] as const).map((field) => (
                        <td key={field} className="border p-2 text-center">
                          <input className="w-20 rounded border p-1 text-center" type="number" value={person[field]} onChange={(e) => updateFamily(person.id, field, e.target.value)} />
                        </td>
                      ))}
                      <td className="border p-2">
                        <div className="flex flex-wrap gap-1">
                          {allMealSlots.map((slot) => (
                            <button key={slot} onClick={() => toggleSlot(person.id, slot)}
                              className={`rounded px-2 py-0.5 text-xs font-semibold border transition-colors ${person.enabledSlots.includes(slot) ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-400 border-slate-300"}`}>
                              {slot}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ══════════════ FEATURE 6: Delete confirmation modal ════════════ */}
        {confirmDeleteId !== null && (() => {
          const recipe = recipes.find((r) => r.id === confirmDeleteId);
          return (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full space-y-4">
                <h3 className="text-lg font-semibold">Delete "{recipe?.name}"?</h3>
                <p className="text-sm text-slate-600">This recipe is currently used in one or more meal plans. Deleting it will remove it from all plans.</p>
                <div className="flex gap-3 justify-end">
                  <button onClick={() => setConfirmDeleteId(null)} className="rounded border px-4 py-2 text-sm hover:bg-slate-50">Cancel</button>
                  <button onClick={() => confirmDeleteRecipe(confirmDeleteId)} className="rounded bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700">Yes, Delete</button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ══════════════ FEATURE 7: Copy week modal ══════════════════════ */}
        {copyFromId !== null && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full space-y-4">
              <h3 className="text-lg font-semibold">Copy Week</h3>
              <p className="text-sm text-slate-600">
                Copy <strong>{family.find((p) => p.id === copyFromId)?.name}'s</strong> entire week to another person. This will overwrite their current plan.
              </p>
              <label className="block">
                <span className="mb-1 block text-sm font-medium">Copy to:</span>
                <select className="w-full rounded border p-2" value={copyToId ?? ""} onChange={(e) => setCopyToId(e.target.value ? Number(e.target.value) : null)}>
                  <option value="">Select person...</option>
                  {family.filter((p) => p.id !== copyFromId).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
              <div className="flex gap-3 justify-end">
                <button onClick={() => { setCopyFromId(null); setCopyToId(null); }} className="rounded border px-4 py-2 text-sm hover:bg-slate-50">Cancel</button>
                <button onClick={copyWeek} disabled={!copyToId} className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:bg-slate-400">Copy Week</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
