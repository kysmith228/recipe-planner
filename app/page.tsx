"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type FamilyMember = {
  id: number; name: string;
  mealCalories: number; mealProtein: number; mealFat: number; mealCarbs: number; mealFiber: number;
  enabledSlots: MealSlot[];
};
type Ingredient = { item: string; qty: number; unit: string; section: string };
type Recipe = {
  id: number; name: string; category: string; tags: string; notes: string;
  servings: number; calories: number; protein: number; fat: number; carbs: number; fiber: number;
  ingredients: Ingredient[];
};
type MealSlot = "Breakfast" | "Lunch" | "Dinner" | "Snack";
type MealEntry = { main: number | ""; sides: number[]; servingOverride?: number };
function emptyMealEntry(): MealEntry { return { main: "", sides: [] }; }
type PersonMealPlan = Record<number, Record<string, Record<MealSlot, MealEntry>>>;
type WeekTemplate = { id: number; name: string; plan: PersonMealPlan };
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
  { pattern: /^salt$|kosher salt|sea salt|table salt/i, label: "Salt (negligible)",     nutrition: { cal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 } },
  { pattern: /black pepper|white pepper|^pepper$/i,     label: "Pepper (negligible)",   nutrition: { cal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 } },
  { pattern: /^garlic powder$/i,          label: "Garlic Powder (negligible)", nutrition: { cal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 } },
  { pattern: /^onion powder$/i,           label: "Onion Powder (negligible)",  nutrition: { cal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 } },
  { pattern: /cumin|paprika|oregano|basil|thyme|rosemary|chili powder|cayenne|cinnamon|nutmeg|turmeric|coriander|seasoning|spice mix|italian seasoning|taco seasoning/i,
    label: "Spice/Seasoning (negligible)", nutrition: { cal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 } },
];

const MAX_RECIPE_CALORIES = 6000;
const STORAGE_KEY = "recipe-planner-v6-full";
const OLD_STORAGE_KEYS = ["recipe-planner-v5-ux","recipe-planner-v4-sides","recipe-planner-v3-per-person","recipe-planner-phase-2-alias-normalized-v1"];
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
  return { qty, unit, item: normalizeIngredientName(rawItem), section: sectionForItem(rawItem) };
}
function blankRecipe(): Recipe {
  return { id: 0, name: "", category: "Dinner", tags: "", notes: "", servings: 4, calories: 500, protein: 35, fat: 15, carbs: 45, fiber: 5, ingredients: [] };
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
function formatQty(qty: number, unit: string): string {
  const u = unit.toLowerCase();
  if (["oz","ounce","ounces"].includes(u)) {
    if (qty < 0.5) return `${+(qty * 6).toFixed(1)} tsp`;
    if (qty < 1)   return `${+(qty * 2).toFixed(1)} tbsp`;
  }
  if (["tsp","teaspoon","teaspoons"].includes(u) && qty >= 3) return `${+(qty / 3).toFixed(1)} tbsp`;
  if (["tbsp","tablespoon","tablespoons"].includes(u) && qty >= 16) return `${+(qty / 16).toFixed(2)} cups`;
  if (qty >= 10) return `${Math.round(qty)} ${unit}`;
  if (qty >= 1)  return `${+(Math.round(qty * 4) / 4).toFixed(2).replace(/\.?0+$/, "")} ${unit}`;
  const fracs: [number, string][] = [[0.125,"⅛"],[0.25,"¼"],[0.333,"⅓"],[0.5,"½"],[0.667,"⅔"],[0.75,"¾"]];
  const closest = fracs.reduce((a, b) => Math.abs(b[0] - qty) < Math.abs(a[0] - qty) ? b : a);
  if (Math.abs(closest[0] - qty) < 0.05) return `${closest[1]} ${unit}`;
  return `${qty.toFixed(2)} ${unit}`;
}
function slotMacroColor(entry: MealEntry, person: FamilyMember, recipes: Recipe[], scaleBy: "calories" | "protein"): string {
  const ids = entryRecipeIds(entry); if (!ids.length) return "";
  const target = scaleBy === "protein" ? person.mealProtein : person.mealCalories;
  let total = 0;
  ids.forEach((rid) => {
    const r = recipes.find((x) => x.id === rid); if (!r) return;
    const rt = scaleBy === "protein" ? r.protein : r.calories;
    const servings = entry.servingOverride ?? (rt > 0 ? target / rt : 1);
    total += (scaleBy === "protein" ? r.protein : r.calories) * servings;
  });
  const pct = target > 0 ? total / target : 0;
  if (pct < 0.7) return "bg-blue-50 border-blue-200";
  if (pct <= 1.15) return "bg-green-50 border-green-200";
  return "bg-red-50 border-red-200";
}
function slotMacroSummary(entry: MealEntry, person: FamilyMember, recipes: Recipe[], scaleBy: "calories" | "protein"): string {
  const ids = entryRecipeIds(entry); if (!ids.length) return "";
  const target = scaleBy === "protein" ? person.mealProtein : person.mealCalories;
  let cal = 0; let pro = 0;
  ids.forEach((rid) => {
    const r = recipes.find((x) => x.id === rid); if (!r) return;
    const rt = scaleBy === "protein" ? r.protein : r.calories;
    const servings = entry.servingOverride ?? (rt > 0 ? target / rt : 1);
    cal += r.calories * servings; pro += r.protein * servings;
  });
  return `${Math.round(cal)} cal · ${Math.round(pro)}g pro`;
}

// Progress bar component
function MacroBar({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  const pct = Math.min(100, target > 0 ? (value / target) * 100 : 0);
  const over = target > 0 && value > target * 1.1;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="font-medium text-slate-600">{label}</span>
        <span className={over ? "text-red-600 font-semibold" : "text-slate-500"}>{Math.round(value)} / {Math.round(target)}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${over ? "bg-red-500" : color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
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
  const [recipeSearch, setRecipeSearch] = useState("");
  const [recipeCatFilter, setRecipeCatFilter] = useState("All");
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [copyFromId, setCopyFromId] = useState<number | null>(null);
  const [copyToId, setCopyToId] = useState<number | null>(null);
  // New state
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [weekTemplates, setWeekTemplates] = useState<WeekTemplate[]>([]);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [showLoadTemplate, setShowLoadTemplate] = useState(false);
  const [urlImportValue, setUrlImportValue] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState("");
  const [expandedNotes, setExpandedNotes] = useState<number | null>(null);
  const [mobileDay, setMobileDay] = useState(days[0]);
  const importRef = useRef<HTMLInputElement>(null);

  // Load
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY) || OLD_STORAGE_KEYS.map((k) => localStorage.getItem(k)).find(Boolean);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    const loadedFamily: FamilyMember[] = (parsed.family || defaultFamily).map((p: FamilyMember) => ({ ...p, enabledSlots: p.enabledSlots || allMealSlots }));
    setFamily(loadedFamily);
    setRecipes((parsed.recipes || []).map((r: Recipe) => ({ ...r, notes: r.notes ?? "" })));
    setScaleBy(parsed.scaleBy || "calories");
    if (parsed.personMealPlan) {
      const migrated: PersonMealPlan = {};
      for (const [pid, plan] of Object.entries(parsed.personMealPlan))
        migrated[Number(pid)] = migratePlan(plan as Record<string, Record<MealSlot, number | "" | MealEntry>>);
      setPersonMealPlan(migrated);
    } else { setPersonMealPlan(createEmptyPersonMealPlan(loadedFamily)); }
    setWeekTemplates(parsed.weekTemplates || []);
    setActivePlanTab(loadedFamily[0]?.id ?? 1);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ family, recipes, scaleBy, personMealPlan, weekTemplates }));
  }, [family, recipes, scaleBy, personMealPlan, weekTemplates]);

  useEffect(() => {
    setPersonMealPlan((cur) => {
      const next = { ...cur };
      family.forEach((p) => { if (!next[p.id]) next[p.id] = createEmptyPersonPlan(); });
      return next;
    });
  }, [family]);

  // Family
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

  // Recipes
  function updateRecipeField(field: keyof Recipe, value: string) {
    setRecipeForm((cur) => ({ ...cur, [field]: ["name","category","tags","notes"].includes(field) ? value : Number(value) }));
  }
  function duplicateRecipe(recipe: Recipe) {
    setRecipes((cur) => [...cur, { ...recipe, id: Date.now(), name: `${recipe.name} (copy)` }]);
  }

  // Feature: URL import via Claude API
  async function importFromUrl() {
    const url = urlImportValue.trim();
    if (!url) return;
    setIsImporting(true);
    setImportStatus("Fetching recipe from URL...");
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: `Visit this recipe URL and extract the recipe details: ${url}

Return ONLY a JSON object with these exact fields (no markdown, no explanation):
{
  "name": "Recipe Name",
  "category": "Dinner",
  "tags": "tag1, tag2",
  "notes": "Brief cooking instructions or notes",
  "servings": 4,
  "ingredients": ["1 lb chicken breast", "2 cups rice", "1 tsp salt"]
}

Category must be one of: Breakfast, Lunch, Dinner, Snack, Side, Dressing, Dessert.
Ingredients must be plain strings like "1 lb chicken breast" — quantity, unit, then item.
If you cannot access the URL, return {"error": "Could not fetch URL"}.`
          }],
        }),
      });
      const data = await response.json();
      const text = data.content?.map((c: { type: string; text?: string }) => c.text || "").join("") || "";
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      if (parsed.error) { setImportStatus(`Import failed: ${parsed.error}`); return; }
      setRecipeForm({
        ...blankRecipe(),
        name: parsed.name || "",
        category: ALL_CATEGORIES.includes(parsed.category) ? parsed.category : "Dinner",
        tags: parsed.tags || "",
        notes: parsed.notes || "",
        servings: Number(parsed.servings) || 4,
      });
      setIngredientsText((parsed.ingredients || []).join("\n"));
      setImportStatus(`✅ Imported "${parsed.name}" — review and click Estimate Nutrition, then Save Recipe.`);
      setUrlImportValue("");
      setActiveMainTab("recipes");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setImportStatus(`Import failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally { setIsImporting(false); }
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
      setUsdaStatus(`Done. ${matched.length} matched.${missNote}${capNote} Review before saving.`);
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
    setRecipeForm({ ...recipe, notes: recipe.notes ?? "" });
    setIngredientsText(recipe.ingredients.map((i) => `${i.qty} ${i.unit} ${i.item}`).join("\n"));
    setMatchLog([]); setActiveMainTab("recipes");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function requestDeleteRecipe(id: number) {
    const inUse = family.some((p) => {
      const plan = personMealPlan[p.id];
      return plan && days.some((day) => allMealSlots.some((slot) => entryRecipeIds(plan[day]?.[slot] ?? emptyMealEntry()).includes(id)));
    });
    if (inUse) setConfirmDeleteId(id); else confirmDeleteRecipe(id);
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

  // Meal plan
  function setMain(personId: number, day: string, slot: MealSlot, recipeId: string) {
    setPersonMealPlan((cur) => ({
      ...cur, [personId]: { ...cur[personId], [day]: { ...cur[personId]?.[day],
        [slot]: { ...cur[personId]?.[day]?.[slot], main: recipeId ? Number(recipeId) : "" } } },
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
  // Feature: serving override per slot
  function setServingOverride(personId: number, day: string, slot: MealSlot, value: string) {
    setPersonMealPlan((cur) => {
      const entry = cur[personId]?.[day]?.[slot] ?? emptyMealEntry();
      return { ...cur, [personId]: { ...cur[personId], [day]: { ...cur[personId]?.[day],
        [slot]: { ...entry, servingOverride: value ? Number(value) : undefined } } } };
    });
  }
  function clearPersonPlan(personId: number) { setPersonMealPlan((cur) => ({ ...cur, [personId]: createEmptyPersonPlan() })); }
  function copyWeek() {
    if (!copyFromId || !copyToId || copyFromId === copyToId) return;
    setPersonMealPlan((cur) => {
      const src = cur[copyFromId]; if (!src) return cur;
      const copied: Record<string, Record<MealSlot, MealEntry>> = {};
      days.forEach((day) => {
        copied[day] = { Breakfast: emptyMealEntry(), Lunch: emptyMealEntry(), Dinner: emptyMealEntry(), Snack: emptyMealEntry() };
        allMealSlots.forEach((slot) => { const e = src[day]?.[slot]; if (e) copied[day][slot] = { ...e, sides: [...e.sides] }; });
      });
      return { ...cur, [copyToId]: copied };
    });
    setCopyFromId(null); setCopyToId(null);
  }

  // Templates
  function saveTemplate() {
    if (!templateName.trim()) return;
    const t: WeekTemplate = { id: Date.now(), name: templateName.trim(), plan: JSON.parse(JSON.stringify(personMealPlan)) };
    setWeekTemplates((cur) => [...cur, t]);
    setTemplateName(""); setShowSaveTemplate(false);
  }
  function loadTemplate(t: WeekTemplate) {
    setPersonMealPlan(JSON.parse(JSON.stringify(t.plan)));
    setShowLoadTemplate(false);
  }
  function deleteTemplate(id: number) { setWeekTemplates((cur) => cur.filter((t) => t.id !== id)); }

  // Grocery checkboxes
  function toggleCheck(key: string) {
    setCheckedItems((cur) => { const n = new Set(cur); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  }
  function clearChecks() { setCheckedItems(new Set()); }

  // Derived
  function calcPersonWeeklyTotals(person: FamilyMember) {
    const t = { calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 };
    const plan = personMealPlan[person.id]; if (!plan) return t;
    const target = scaleBy === "protein" ? person.mealProtein : person.mealCalories;
    days.forEach((day) => allMealSlots.forEach((slot) => {
      const entry = plan[day]?.[slot]; if (!entry) return;
      entryRecipeIds(entry).forEach((rid) => {
        const r = recipes.find((x) => x.id === rid); if (!r) return;
        const rt = scaleBy === "protein" ? r.protein : r.calories;
        const servings = entry.servingOverride ?? (rt > 0 ? target / rt : 1);
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
          const servingsNeeded = entry.servingOverride ?? (rt > 0 ? target / rt : 1);
          accumulateIngredients(recipe, servingsNeeded, list);
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

  const filteredRecipes = useMemo(() => recipes.filter((r) => {
    const ms = recipeSearch === "" || r.name.toLowerCase().includes(recipeSearch.toLowerCase()) || r.tags.toLowerCase().includes(recipeSearch.toLowerCase());
    const mc = recipeCatFilter === "All" || r.category === recipeCatFilter;
    return ms && mc;
  }), [recipes, recipeSearch, recipeCatFilter]);

  const activePerson = family.find((p) => p.id === activePlanTab) ?? family[0];
  const mainTabCls = (tab: typeof activeMainTab) =>
    `px-3 py-2 text-xs sm:text-sm font-medium rounded-t-lg border-b-2 transition-colors whitespace-nowrap ${activeMainTab === tab ? "border-blue-600 text-blue-700 bg-white" : "border-transparent text-slate-500 hover:text-slate-700 bg-slate-100"}`;
  const personTabCls = (id: number) =>
    `px-3 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${activePlanTab === id ? "border-blue-600 text-blue-700 bg-white" : "border-transparent text-slate-500 bg-slate-50 hover:bg-white"}`;

  // Planner cell
  function PlannerCell({ personId, day, slot, person }: { personId: number; day: string; slot: MealSlot; person: FamilyMember }) {
    const entry = personMealPlan[personId]?.[day]?.[slot] ?? emptyMealEntry();
    const slotKey = `${personId}-${day}-${slot}`;
    const isExpanded = expandedSlot === slotKey;
    const mainOptions = recipes.filter((r) => slot === "Snack" || r.category === slot || r.category === "Dinner");
    const sideOptions = recipes.filter((r) => r.id !== entry.main && !entry.sides.includes(r.id));
    const colorCls = slotMacroColor(entry, person, recipes, scaleBy);
    const summary = slotMacroSummary(entry, person, recipes, scaleBy);
    return (
      <div className={`space-y-1 rounded p-1.5 border ${colorCls || "border-transparent"}`}>
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
                  {sr.name}<button onClick={() => removeSide(personId, day, slot, sid)} className="text-emerald-600 hover:text-red-600 font-bold">×</button>
                </span>
              );
            })}
          </div>
        )}
        {summary && <div className="text-xs text-slate-500">{summary}</div>}
        {/* Serving override */}
        {(entry.main || entry.sides.length > 0) && (
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <span>Srv:</span>
            <input type="number" min="0.5" step="0.5"
              className="w-14 rounded border p-0.5 text-xs"
              placeholder="auto"
              value={entry.servingOverride ?? ""}
              onChange={(e) => setServingOverride(personId, day, slot, e.target.value)}
            />
          </div>
        )}
        {sideOptions.length > 0 && (
          isExpanded ? (
            <div className="flex gap-1">
              <select className="flex-1 rounded border p-1 text-xs" defaultValue=""
                onChange={(e) => { if (e.target.value) { addSide(personId, day, slot, Number(e.target.value)); setExpandedSlot(null); } }}>
                <option value="">+ pick side</option>
                {sideOptions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <button onClick={() => setExpandedSlot(null)} className="text-xs text-slate-400 px-1">✕</button>
            </div>
          ) : (
            <button onClick={() => setExpandedSlot(slotKey)} className="text-xs text-emerald-700 hover:underline">+ side</button>
          )
        )}
      </div>
    );
  }

  // ── Mobile planner view ──
  function MobilePlanner({ person }: { person: FamilyMember }) {
    return (
      <div className="space-y-3">
        {/* Day selector */}
        <div className="flex gap-1 overflow-x-auto pb-1">
          {days.map((d) => (
            <button key={d} onClick={() => setMobileDay(d)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold border transition-colors ${mobileDay === d ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-500 border-slate-300"}`}>
              {d.slice(0, 3)}
            </button>
          ))}
        </div>
        <div className="space-y-3">
          {person.enabledSlots.map((slot) => (
            <div key={slot} className="rounded-xl bg-slate-50 border p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">{slot}</div>
              <PlannerCell personId={person.id} day={mobileDay} slot={slot} person={person} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── JSX ──
  return (
    <main className="min-h-screen bg-slate-100 p-3 md:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <h1 className="text-2xl font-bold md:text-4xl">Recipe Macro Grocery Planner</h1>

        {/* Main tabs */}
        <div className="flex gap-1 border-b border-slate-300 overflow-x-auto">
          <button className={mainTabCls("planner")} onClick={() => setActiveMainTab("planner")}>📅 Planner</button>
          <button className={mainTabCls("summary")} onClick={() => setActiveMainTab("summary")}>👨‍👩‍👧‍👦 Summary</button>
          <button className={mainTabCls("recipes")} onClick={() => setActiveMainTab("recipes")}>🍽 Recipes</button>
          <button className={mainTabCls("family")}  onClick={() => setActiveMainTab("family")}>⚙️ Family</button>
        </div>

        {/* ══════════════════════ PLANNER ═══════════════════════════════════ */}
        {activeMainTab === "planner" && (
          <div className="space-y-5">
            <section className="rounded-2xl bg-white shadow overflow-hidden">
              <div className="flex gap-1 px-3 pt-3 border-b border-slate-200 bg-slate-50 overflow-x-auto">
                {family.map((p) => <button key={p.id} className={personTabCls(p.id)} onClick={() => setActivePlanTab(p.id)}>{p.name}</button>)}
              </div>
              <div className="p-3 md:p-6">
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">{activePerson?.name}'s Week</h2>
                    <p className="text-xs text-slate-500">{activePerson?.mealCalories} cal · {activePerson?.mealProtein}g pro per meal</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <label className="text-xs font-medium flex items-center gap-1">Scale:
                      <select className="rounded border p-1 text-xs" value={scaleBy} onChange={(e) => setScaleBy(e.target.value as "calories" | "protein")}>
                        <option value="calories">Cal</option><option value="protein">Protein</option>
                      </select>
                    </label>
                    <button onClick={() => setShowSaveTemplate(true)} className="rounded border px-2 py-1 text-xs hover:bg-slate-50">💾 Save Template</button>
                    <button onClick={() => setShowLoadTemplate(true)} className="rounded border px-2 py-1 text-xs hover:bg-slate-50">📂 Load Template</button>
                    <button onClick={() => { setCopyFromId(activePlanTab); setCopyToId(null); }} className="rounded border px-2 py-1 text-xs hover:bg-slate-50">📋 Copy Week</button>
                    <button onClick={() => clearPersonPlan(activePlanTab)} className="rounded border px-2 py-1 text-xs hover:bg-slate-50 text-slate-600">Clear</button>
                  </div>
                </div>

                {/* Color legend */}
                <div className="mb-2 flex flex-wrap gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-100 border border-green-200 inline-block"></span>On target</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-100 border border-blue-200 inline-block"></span>Under</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 border border-red-200 inline-block"></span>Over</span>
                </div>

                {/* Slot toggles */}
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Slots:</span>
                  {allMealSlots.map((slot) => {
                    const on = activePerson?.enabledSlots.includes(slot);
                    return <button key={slot} onClick={() => toggleSlot(activePlanTab, slot)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold border transition-colors ${on ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-400 border-slate-300"}`}>{slot}</button>;
                  })}
                </div>

                {/* Desktop grid */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full min-w-[640px] border text-sm">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="border p-2 text-left w-24">Day</th>
                        {(activePerson?.enabledSlots ?? allMealSlots).map((slot) => <th key={slot} className="border p-2 text-center">{slot}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {days.map((day) => (
                        <tr key={day}>
                          <td className="border p-2 font-semibold text-slate-700 whitespace-nowrap align-top text-sm">{day}</td>
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

                {/* Mobile card view */}
                <div className="md:hidden">
                  {activePerson && <MobilePlanner person={activePerson} />}
                </div>

                {/* Weekly progress bars */}
                {activePerson && (() => {
                  const t = calcPersonWeeklyTotals(activePerson);
                  const weeklyTarget = (slot: keyof typeof t) => {
                    const slots = activePerson.enabledSlots.length || 3;
                    const perMeal = slot === "calories" ? activePerson.mealCalories : slot === "protein" ? activePerson.mealProtein : slot === "fat" ? activePerson.mealFat : slot === "carbs" ? activePerson.mealCarbs : activePerson.mealFiber;
                    return perMeal * slots * 7;
                  };
                  return (
                    <div className="mt-4 rounded-xl bg-slate-50 border p-4 space-y-3">
                      <div className="text-sm font-semibold text-slate-700">Weekly Progress — {activePerson.name}</div>
                      <MacroBar label="Calories" value={t.calories} target={weeklyTarget("calories")} color="bg-orange-400" />
                      <MacroBar label="Protein"  value={t.protein}  target={weeklyTarget("protein")}  color="bg-blue-500" />
                      <MacroBar label="Carbs"    value={t.carbs}    target={weeklyTarget("carbs")}    color="bg-yellow-400" />
                      <MacroBar label="Fat"      value={t.fat}      target={weeklyTarget("fat")}      color="bg-purple-400" />
                      <MacroBar label="Fiber"    value={t.fiber}    target={weeklyTarget("fiber")}    color="bg-green-500" />
                    </div>
                  );
                })()}
              </div>
            </section>

            {/* Grocery List */}
            <section className="rounded-2xl bg-white p-3 shadow md:p-6">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-xl font-semibold">Grocery List</h2>
                <div className="flex gap-2">
                  {checkedItems.size > 0 && (
                    <button onClick={clearChecks} className="text-xs text-slate-500 hover:text-slate-700 border rounded px-2 py-1">Clear checks</button>
                  )}
                  <button onClick={() => window.print()} className="text-xs border rounded px-2 py-1 hover:bg-slate-50">🖨 Print</button>
                </div>
              </div>
              <p className="mb-4 text-xs text-slate-500">{family.length} people · {totalPlannedMeals} meals · scaled per person</p>
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
                          {items.map((d) => {
                            const key = `${d.item}|${d.unit}`;
                            const checked = checkedItems.has(key);
                            return (
                              <label key={key} className={`flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0 cursor-pointer gap-2 ${checked ? "opacity-40" : ""}`}>
                                <div className="flex items-center gap-2">
                                  <input type="checkbox" checked={checked} onChange={() => toggleCheck(key)} className="rounded" />
                                  <span className={`capitalize text-sm ${checked ? "line-through" : ""}`}>{d.item}</span>
                                </div>
                                <span className="text-slate-500 text-sm tabular-nums shrink-0">{formatQty(d.qty, d.unit)}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}

        {/* ══════════════════════ FAMILY SUMMARY ════════════════════════════ */}
        {activeMainTab === "summary" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-xl font-semibold">Family Week at a Glance</h2>
              <label className="text-sm font-medium flex items-center gap-1">Scale:
                <select className="rounded border p-1.5 text-sm" value={scaleBy} onChange={(e) => setScaleBy(e.target.value as "calories" | "protein")}>
                  <option value="calories">Calories</option><option value="protein">Protein</option>
                </select>
              </label>
            </div>
            {/* Per-person weekly progress */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {family.map((person) => {
                const t = calcPersonWeeklyTotals(person);
                const slots = person.enabledSlots.length || 3;
                return (
                  <div key={person.id} className="rounded-2xl bg-white border shadow p-4 space-y-3">
                    <div className="font-semibold text-slate-700">{person.name}</div>
                    <MacroBar label="Calories" value={t.calories} target={person.mealCalories * slots * 7} color="bg-orange-400" />
                    <MacroBar label="Protein"  value={t.protein}  target={person.mealProtein  * slots * 7} color="bg-blue-500" />
                    <MacroBar label="Carbs"    value={t.carbs}    target={person.mealCarbs    * slots * 7} color="bg-yellow-400" />
                  </div>
                );
              })}
            </div>
            {/* Day-by-day grid */}
            {days.map((day) => (
              <div key={day} className="rounded-2xl bg-white shadow overflow-hidden">
                <div className="bg-slate-100 px-4 py-2 font-semibold text-slate-700 text-sm">{day}</div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[500px] text-xs">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="border p-2 text-left w-20">Slot</th>
                        {family.map((p) => <th key={p.id} className="border p-2 text-center">{p.name}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {allMealSlots.map((slot) => {
                        const anyPlanned = family.some((p) => { const e = personMealPlan[p.id]?.[day]?.[slot]; return e && (e.main || e.sides.length > 0); });
                        if (!anyPlanned) return null;
                        return (
                          <tr key={slot}>
                            <td className="border p-2 font-medium text-slate-600">{slot}</td>
                            {family.map((p) => {
                              const entry = personMealPlan[p.id]?.[day]?.[slot] ?? emptyMealEntry();
                              const ids = entryRecipeIds(entry);
                              return (
                                <td key={p.id} className={`border p-2 align-top ${slotMacroColor(entry, p, recipes, scaleBy)}`}>
                                  {ids.length === 0 ? <span className="text-slate-300">—</span> : (
                                    <div className="space-y-0.5">
                                      {ids.map((rid) => { const r = recipes.find((x) => x.id === rid); return r ? <div key={rid} className="truncate max-w-[110px]">{r.name}</div> : null; })}
                                      <div className="text-slate-400">{slotMacroSummary(entry, p, recipes, scaleBy)}</div>
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

        {/* ══════════════════════ RECIPES ═══════════════════════════════════ */}
        {activeMainTab === "recipes" && (
          <div className="space-y-5">
            {/* URL import */}
            <section className="rounded-2xl bg-white p-4 shadow">
              <h2 className="mb-3 text-lg font-semibold">🔗 Import Recipe from URL</h2>
              <div className="flex gap-2 flex-wrap">
                <input ref={importRef} className="flex-1 min-w-0 rounded border p-2 text-sm" placeholder="Paste a recipe URL (AllRecipes, Food Network, etc.)"
                  value={urlImportValue} onChange={(e) => setUrlImportValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") importFromUrl(); }} />
                <button onClick={importFromUrl} disabled={isImporting || !urlImportValue.trim()} className="rounded bg-purple-600 px-4 py-2 text-sm text-white disabled:bg-slate-400 whitespace-nowrap">
                  {isImporting ? "Importing..." : "Import"}
                </button>
              </div>
              {importStatus && <p className="mt-2 text-sm text-slate-600">{importStatus}</p>}
            </section>

            {/* Add/Edit form */}
            <section className="rounded-2xl bg-white p-4 shadow md:p-6">
              <h2 className="mb-4 text-xl font-semibold">{editingRecipeId ? "Edit Recipe" : "Add Recipe"}</h2>
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
                  <span className="mb-1 block text-sm font-medium">Ingredients (one per line)</span>
                  <textarea className="min-h-28 w-full rounded border p-2 font-mono text-sm" value={ingredientsText} onChange={(e) => setIngredientsText(e.target.value)} />
                </label>
                {/* Feature: recipe notes */}
                <label className="block md:col-span-2">
                  <span className="mb-1 block text-sm font-medium">Instructions / Notes</span>
                  <textarea className="min-h-20 w-full rounded border p-2 text-sm" value={recipeForm.notes} onChange={(e) => updateRecipeField("notes", e.target.value)} placeholder="Cooking steps, prep tips, variations..." />
                </label>
                <p className="text-sm text-slate-600 md:col-span-2">{usdaStatus}</p>
                {matchLog.length > 0 && (
                  <div className="rounded bg-slate-50 p-3 text-sm md:col-span-2 space-y-1">
                    <div className="font-semibold mb-1">Nutrition Sources Used</div>
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

            {/* Saved recipes */}
            <section className="rounded-2xl bg-white p-4 shadow md:p-6">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-xl font-semibold">Saved Recipes ({filteredRecipes.length}{filteredRecipes.length !== recipes.length ? ` of ${recipes.length}` : ""})</h2>
                <div className="flex gap-2 flex-wrap">
                  <input className="rounded border p-2 text-sm w-44" placeholder="🔍 Search..." value={recipeSearch} onChange={(e) => setRecipeSearch(e.target.value)} />
                  <select className="rounded border p-2 text-sm" value={recipeCatFilter} onChange={(e) => setRecipeCatFilter(e.target.value)}>
                    <option value="All">All categories</option>
                    {ALL_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              {filteredRecipes.length === 0 ? (
                <div className="rounded border border-dashed p-6 text-center text-slate-400">
                  {recipes.length === 0 ? "No recipes yet — add one above or import from a URL." : "No recipes match your search."}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredRecipes.map((recipe) => (
                    <div key={recipe.id} className="rounded border p-3 hover:bg-slate-50 transition-colors">
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <div className="font-semibold flex items-center gap-2 flex-wrap">
                            {recipe.name}
                            {["Side","Dressing"].includes(recipe.category) && (
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700 font-medium">{recipe.category}</span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500">{recipe.category}{recipe.tags ? ` · ${recipe.tags}` : ""}</div>
                          <div className="text-xs text-slate-500">{recipe.servings} srv · {recipe.calories} cal · {recipe.protein}g pro · {recipe.fat}g fat · {recipe.carbs}g carbs · {recipe.fiber}g fiber</div>
                          {/* Notes expand */}
                          {recipe.notes && (
                            <div className="mt-1">
                              <button onClick={() => setExpandedNotes(expandedNotes === recipe.id ? null : recipe.id)} className="text-xs text-blue-600 hover:underline">
                                {expandedNotes === recipe.id ? "▲ Hide notes" : "▼ Show notes"}
                              </button>
                              {expandedNotes === recipe.id && (
                                <div className="mt-1 text-xs text-slate-600 whitespace-pre-wrap bg-slate-50 rounded p-2 border">{recipe.notes}</div>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2 shrink-0 flex-wrap">
                          <button onClick={() => editRecipe(recipe)} className="rounded border px-3 py-1.5 text-xs hover:bg-slate-100">Edit</button>
                          <button onClick={() => duplicateRecipe(recipe)} className="rounded border px-3 py-1.5 text-xs hover:bg-slate-100">⧉ Copy</button>
                          <button onClick={() => requestDeleteRecipe(recipe.id)} className="rounded bg-red-600 px-3 py-1.5 text-xs text-white hover:bg-red-700">Delete</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* ══════════════════════ FAMILY SETTINGS ═══════════════════════════ */}
        {activeMainTab === "family" && (
          <section className="rounded-2xl bg-white p-4 shadow md:p-6">
            <h2 className="mb-1 text-xl font-semibold">Family Settings</h2>
            <p className="mb-4 text-sm text-slate-500">Set per-meal nutrition targets and toggle meal slots.</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] border text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="border p-2 text-left">Name</th>
                    <th className="border p-2">Cal</th><th className="border p-2">Pro (g)</th>
                    <th className="border p-2">Fat (g)</th><th className="border p-2">Carbs (g)</th>
                    <th className="border p-2">Fiber (g)</th><th className="border p-2 text-left">Slots</th>
                  </tr>
                </thead>
                <tbody>
                  {family.map((person) => (
                    <tr key={person.id} className="hover:bg-slate-50">
                      <td className="border p-2"><input className="w-24 rounded border p-1" value={person.name} onChange={(e) => updateFamily(person.id, "name", e.target.value)} /></td>
                      {(["mealCalories","mealProtein","mealFat","mealCarbs","mealFiber"] as const).map((field) => (
                        <td key={field} className="border p-2 text-center">
                          <input className="w-16 rounded border p-1 text-center" type="number" value={person[field]} onChange={(e) => updateFamily(person.id, field, e.target.value)} />
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

        {/* ══════════ MODALS ════════════════════════════════════════════════ */}

        {/* Delete confirm */}
        {confirmDeleteId !== null && (() => {
          const recipe = recipes.find((r) => r.id === confirmDeleteId);
          return (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full space-y-4">
                <h3 className="text-lg font-semibold">Delete "{recipe?.name}"?</h3>
                <p className="text-sm text-slate-600">This recipe is used in one or more meal plans and will be removed from them.</p>
                <div className="flex gap-3 justify-end">
                  <button onClick={() => setConfirmDeleteId(null)} className="rounded border px-4 py-2 text-sm hover:bg-slate-50">Cancel</button>
                  <button onClick={() => confirmDeleteRecipe(confirmDeleteId)} className="rounded bg-red-600 px-4 py-2 text-sm text-white">Yes, Delete</button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Copy week */}
        {copyFromId !== null && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full space-y-4">
              <h3 className="text-lg font-semibold">Copy Week</h3>
              <p className="text-sm text-slate-600">Copy <strong>{family.find((p) => p.id === copyFromId)?.name}'s</strong> week to another person. Overwrites their current plan.</p>
              <label className="block">
                <span className="mb-1 block text-sm font-medium">Copy to:</span>
                <select className="w-full rounded border p-2" value={copyToId ?? ""} onChange={(e) => setCopyToId(e.target.value ? Number(e.target.value) : null)}>
                  <option value="">Select person...</option>
                  {family.filter((p) => p.id !== copyFromId).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
              <div className="flex gap-3 justify-end">
                <button onClick={() => { setCopyFromId(null); setCopyToId(null); }} className="rounded border px-4 py-2 text-sm hover:bg-slate-50">Cancel</button>
                <button onClick={copyWeek} disabled={!copyToId} className="rounded bg-blue-600 px-4 py-2 text-sm text-white disabled:bg-slate-400">Copy Week</button>
              </div>
            </div>
          </div>
        )}

        {/* Save template */}
        {showSaveTemplate && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full space-y-4">
              <h3 className="text-lg font-semibold">Save as Template</h3>
              <p className="text-sm text-slate-600">Save the current week plan for all family members as a reusable template.</p>
              <label className="block">
                <span className="mb-1 block text-sm font-medium">Template name:</span>
                <input className="w-full rounded border p-2" placeholder="e.g. High Protein Week" value={templateName} onChange={(e) => setTemplateName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") saveTemplate(); }} />
              </label>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setShowSaveTemplate(false)} className="rounded border px-4 py-2 text-sm hover:bg-slate-50">Cancel</button>
                <button onClick={saveTemplate} disabled={!templateName.trim()} className="rounded bg-blue-600 px-4 py-2 text-sm text-white disabled:bg-slate-400">Save</button>
              </div>
            </div>
          </div>
        )}

        {/* Load template */}
        {showLoadTemplate && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full space-y-4">
              <h3 className="text-lg font-semibold">Load Template</h3>
              {weekTemplates.length === 0 ? (
                <p className="text-sm text-slate-500">No templates saved yet. Plan a week and click "Save Template".</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {weekTemplates.map((t) => (
                    <div key={t.id} className="flex items-center justify-between rounded border p-3">
                      <span className="text-sm font-medium">{t.name}</span>
                      <div className="flex gap-2">
                        <button onClick={() => loadTemplate(t)} className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700">Load</button>
                        <button onClick={() => deleteTemplate(t.id)} className="rounded border px-3 py-1 text-xs hover:bg-red-50 text-red-600">Del</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-end">
                <button onClick={() => setShowLoadTemplate(false)} className="rounded border px-4 py-2 text-sm hover:bg-slate-50">Close</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
