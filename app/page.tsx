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
  foodNutrients?: UsdaFoodNutrient[];
};

const STORAGE_KEY = "recipe-planner-phase-2-usda-v1";
const OLD_STORAGE_KEY = "recipe-planner-phase-2-v1";

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const mealSlots: MealSlot[] = ["Breakfast", "Lunch", "Dinner", "Snack"];

const defaultFamily: FamilyMember[] = [
  { id: 1, name: "Kyle", mealCalories: 700, mealProtein: 60, mealFat: 25, mealCarbs: 70, mealFiber: 10 },
  { id: 2, name: "Kathie", mealCalories: 500, mealProtein: 40, mealFat: 18, mealCarbs: 50, mealFiber: 8 },
  { id: 3, name: "Koen", mealCalories: 450, mealProtein: 30, mealFat: 17, mealCarbs: 55, mealFiber: 7 },
  { id: 4, name: "Kole", mealCalories: 450, mealProtein: 30, mealFat: 17, mealCarbs: 55, mealFiber: 7 },
];

const grocerySections = [
  "Produce",
  "Meat",
  "Dairy",
  "Frozen",
  "Pantry",
  "Bakery",
  "Canned Goods",
  "Spices",
  "Other",
];

function createEmptyMealPlan(): MealPlan {
  return days.reduce((plan, day) => {
    plan[day] = {
      Breakfast: "",
      Lunch: "",
      Dinner: "",
      Snack: "",
    };
    return plan;
  }, {} as MealPlan);
}

function sectionForItem(item: string) {
  const value = item.toLowerCase();

  if (/chicken|beef|turkey|pork|fish|salmon|shrimp|bacon|sausage/.test(value)) return "Meat";
  if (/milk|cheese|yogurt|butter|cream|egg/.test(value)) return "Dairy";
  if (/lettuce|tomato|onion|pepper|broccoli|carrot|apple|banana|potato|avocado|cilantro|spinach/.test(value)) return "Produce";
  if (/bread|tortilla|bun|roll|bagel/.test(value)) return "Bakery";
  if (/beans|soup|salsa|tomato sauce|marinara|corn/.test(value)) return "Canned Goods";
  if (/salt|pepper|garlic|paprika|cumin|seasoning|oregano|basil|chili/.test(value)) return "Spices";
  if (/frozen/.test(value)) return "Frozen";
  if (/rice|pasta|flour|sugar|oil|oats|cereal|chips/.test(value)) return "Pantry";

  return "Other";
}

function parseAmount(value: string) {
  if (value.includes("/")) {
    const [top, bottom] = value.split("/").map(Number);
    return bottom ? top / bottom : 1;
  }

  return Number(value) || 1;
}

function parseIngredientLine(line: string): Ingredient {
  const cleaned = line.replace(/^[-*•]\s*/, "").trim();
  const parts = cleaned.split(/\s+/);

  const qty = parseAmount(parts[0] || "1");
  const unit = parts[1] || "each";
  const item = parts.slice(2).join(" ") || cleaned;

  return {
    qty,
    unit,
    item,
    section: sectionForItem(item),
  };
}

function blankRecipe(): Recipe {
  return {
    id: 0,
    name: "",
    category: "Dinner",
    tags: "",
    servings: 4,
    calories: 500,
    protein: 35,
    fat: 15,
    carbs: 45,
    fiber: 5,
    ingredients: [],
  };
}

function getNutrient(food: UsdaFood, names: string[]) {
  const nutrient = food.foodNutrients?.find((item) => {
    const nutrientName = item.nutrientName?.toLowerCase() || "";
    return names.some((name) => nutrientName.includes(name));
  });

  return Number(nutrient?.value || 0);
}

function unitToApproxGramMultiplier(unit: string) {
  const normalized = unit.toLowerCase();

  if (["g", "gram", "grams"].includes(normalized)) return 1;
  if (["kg", "kilogram", "kilograms"].includes(normalized)) return 1000;
  if (["oz", "ounce", "ounces"].includes(normalized)) return 28.35;
  if (["lb", "lbs", "pound", "pounds"].includes(normalized)) return 453.6;
  if (["cup", "cups"].includes(normalized)) return 240;
  if (["tbsp", "tablespoon", "tablespoons"].includes(normalized)) return 15;
  if (["tsp", "teaspoon", "teaspoons"].includes(normalized)) return 5;
  if (["each", "ea", "ct", "count"].includes(normalized)) return 100;

  return 100;
}

export default function Home() {
  const [family, setFamily] = useState<FamilyMember[]>(defaultFamily);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [editingRecipeId, setEditingRecipeId] = useState<number | null>(null);
  const [recipeForm, setRecipeForm] = useState<Recipe>(blankRecipe());
  const [ingredientsText, setIngredientsText] = useState("1 lb chicken breast\n8 each tortillas\n1 cup salsa");
  const [scaleBy, setScaleBy] = useState<"calories" | "protein">("calories");
  const [mealPlan, setMealPlan] = useState<MealPlan>(createEmptyMealPlan());
  const [usdaStatus, setUsdaStatus] = useState("USDA estimate will search the first USDA result for each ingredient. Review before saving.");
  const [isEstimating, setIsEstimating] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(OLD_STORAGE_KEY);
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
    setFamily((current) =>
      current.map((person) =>
        person.id === id
          ? { ...person, [field]: field === "name" ? value : Number(value) }
          : person
      )
    );
  }

  function updateRecipeField(field: keyof Recipe, value: string) {
    setRecipeForm((current) => ({
      ...current,
      [field]: ["name", "category", "tags"].includes(field) ? value : Number(value),
    }));
  }

  async function estimateNutritionFromUsda() {
    const ingredients = ingredientsText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map(parseIngredientLine);

    if (ingredients.length === 0) {
      setUsdaStatus("Add ingredients first, then run USDA estimate.");
      return;
    }

    setIsEstimating(true);
    setUsdaStatus("Searching USDA nutrition data...");

    const total = { calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 };
    const matched: string[] = [];
    const missed: string[] = [];

    try {
      for (const ingredient of ingredients) {
        const response = await fetch(`/api/usda/search?query=${encodeURIComponent(ingredient.item)}`);
        if (!response.ok) {
          missed.push(ingredient.item);
          continue;
        }

        const data = await response.json();
        const food: UsdaFood | undefined = data.foods?.[0];
        if (!food) {
          missed.push(ingredient.item);
          continue;
        }

        const grams = ingredient.qty * unitToApproxGramMultiplier(ingredient.unit);
        const multiplier = grams / 100;

        total.calories += getNutrient(food, ["energy"]) * multiplier;
        total.protein += getNutrient(food, ["protein"]) * multiplier;
        total.fat += getNutrient(food, ["total lipid", "fat"]) * multiplier;
        total.carbs += getNutrient(food, ["carbohydrate"]) * multiplier;
        total.fiber += getNutrient(food, ["fiber"]) * multiplier;
        matched.push(`${ingredient.item} → ${food.description || "USDA match"}`);
      }

      const divisor = recipeForm.servings || 1;

      setRecipeForm((current) => ({
        ...current,
        calories: Math.round(total.calories / divisor),
        protein: Math.round(total.protein / divisor),
        fat: Math.round(total.fat / divisor),
        carbs: Math.round(total.carbs / divisor),
        fiber: Math.round(total.fiber / divisor),
      }));

      const missedText = missed.length ? ` Not matched: ${missed.join(", ")}.` : "";
      setUsdaStatus(`USDA estimate complete. Matched ${matched.length} ingredient(s).${missedText} Review values before saving.`);
    } catch (error) {
      setUsdaStatus("USDA estimate failed. Check the API route and try again.");
    } finally {
      setIsEstimating(false);
    }
  }

  function saveRecipe() {
    const ingredients = ingredientsText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map(parseIngredientLine);

    const recipeToSave: Recipe = {
      ...recipeForm,
      id: editingRecipeId ?? Date.now(),
      name: recipeForm.name.trim() || "Untitled Recipe",
      ingredients,
    };

    if (editingRecipeId) {
      setRecipes((current) => current.map((recipe) => (recipe.id === editingRecipeId ? recipeToSave : recipe)));
    } else {
      setRecipes((current) => [...current, recipeToSave]);
    }

    setEditingRecipeId(null);
    setRecipeForm(blankRecipe());
    setIngredientsText("1 lb chicken breast\n8 each tortillas\n1 cup salsa");
  }

  function editRecipe(recipe: Recipe) {
    setEditingRecipeId(recipe.id);
    setRecipeForm(recipe);
    setIngredientsText(recipe.ingredients.map((ingredient) => `${ingredient.qty} ${ingredient.unit} ${ingredient.item}`).join("\n"));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function deleteRecipe(id: number) {
    setRecipes((current) => current.filter((recipe) => recipe.id !== id));

    setMealPlan((current) => {
      const next = { ...current };
      days.forEach((day) => {
        next[day] = { ...next[day] };
        mealSlots.forEach((slot) => {
          if (next[day][slot] === id) next[day][slot] = "";
        });
      });
      return next;
    });

    if (editingRecipeId === id) {
      setEditingRecipeId(null);
      setRecipeForm(blankRecipe());
    }
  }

  function cancelEdit() {
    setEditingRecipeId(null);
    setRecipeForm(blankRecipe());
    setIngredientsText("1 lb chicken breast\n8 each tortillas\n1 cup salsa");
  }

  function updateMealPlan(day: string, slot: MealSlot, recipeId: string) {
    setMealPlan((current) => ({
      ...current,
      [day]: {
        ...current[day],
        [slot]: recipeId ? Number(recipeId) : "",
      },
    }));
  }

  function clearMealPlan() {
    setMealPlan(createEmptyMealPlan());
  }

  const plannedRecipeIds = useMemo(() => {
    return days.flatMap((day) => mealSlots.map((slot) => mealPlan[day]?.[slot])).filter(Boolean) as number[];
  }, [mealPlan]);

  const plannedMealCount = plannedRecipeIds.length;

  const weeklyMacroTotals = useMemo(() => {
    return plannedRecipeIds.reduce(
      (totals, recipeId) => {
        const recipe = recipes.find((item) => item.id === recipeId);
        if (!recipe) return totals;

        const target = family.reduce(
          (sum, person) => sum + (scaleBy === "protein" ? person.mealProtein : person.mealCalories),
          0
        );

        const recipeTarget = scaleBy === "protein" ? recipe.protein : recipe.calories;
        const servingsNeeded = recipeTarget > 0 ? target / recipeTarget : family.length;

        totals.calories += recipe.calories * servingsNeeded;
        totals.protein += recipe.protein * servingsNeeded;
        totals.fat += recipe.fat * servingsNeeded;
        totals.carbs += recipe.carbs * servingsNeeded;
        totals.fiber += recipe.fiber * servingsNeeded;
        return totals;
      },
      { calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 }
    );
  }, [plannedRecipeIds, recipes, family, scaleBy]);

  const groceryList = useMemo(() => {
    const target = family.reduce(
      (sum, person) => sum + (scaleBy === "protein" ? person.mealProtein : person.mealCalories),
      0
    );

    const list: Record<string, { qty: number; unit: string; section: string }> = {};

    plannedRecipeIds.forEach((recipeId) => {
      const recipe = recipes.find((item) => item.id === recipeId);
      if (!recipe) return;

      const recipeTarget = scaleBy === "protein" ? recipe.protein : recipe.calories;
      const servingsNeeded = recipeTarget > 0 ? target / recipeTarget : family.length;
      const scale = servingsNeeded / recipe.servings;

      recipe.ingredients.forEach((ingredient) => {
        const key = `${ingredient.item.toLowerCase()}|${ingredient.unit.toLowerCase()}`;

        if (!list[key]) {
          list[key] = { qty: 0, unit: ingredient.unit, section: ingredient.section };
        }

        list[key].qty += ingredient.qty * scale;
      });
    });

    return Object.entries(list)
      .map(([key, value]) => ({ item: key.split("|")[0], ...value }))
      .sort((a, b) => a.section.localeCompare(b.section) || a.item.localeCompare(b.item));
  }, [family, recipes, scaleBy, plannedRecipeIds]);

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <h1 className="text-3xl font-bold md:text-4xl">Recipe Macro Grocery Planner</h1>

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
                <option>Breakfast</option>
                <option>Lunch</option>
                <option>Dinner</option>
                <option>Snack</option>
                <option>Dessert</option>
              </select>
            </label>

            <label className="block md:col-span-2">
              <span className="mb-1 block text-sm font-medium">Tags</span>
              <input className="w-full rounded border p-2" value={recipeForm.tags} onChange={(e) => updateRecipeField("tags", e.target.value)} placeholder="high protein, quick, kid friendly" />
            </label>

            {(["servings", "calories", "protein", "fat", "carbs", "fiber"] as const).map((field) => (
              <label key={field} className="block">
                <span className="mb-1 block text-sm font-medium">
                  {field === "servings" ? "Servings" : `${field.charAt(0).toUpperCase() + field.slice(1)} Per Serving`}
                </span>
                <input className="w-full rounded border p-2" type="number" value={recipeForm[field]} onChange={(e) => updateRecipeField(field, e.target.value)} />
              </label>
            ))}

            <label className="block md:col-span-2">
              <span className="mb-1 block text-sm font-medium">Ingredients</span>
              <textarea className="min-h-32 w-full rounded border p-2" value={ingredientsText} onChange={(e) => setIngredientsText(e.target.value)} placeholder="One ingredient per line, example: 1 lb chicken breast" />
            </label>

            <p className="text-sm text-slate-600 md:col-span-2">{usdaStatus}</p>

            <div className="flex flex-wrap gap-3 md:col-span-2">
              <button onClick={estimateNutritionFromUsda} disabled={isEstimating} className="rounded bg-green-600 px-4 py-2 text-white disabled:bg-slate-400">
                {isEstimating ? "Estimating..." : "Estimate Nutrition from USDA"}
              </button>
              <button onClick={saveRecipe} className="rounded bg-blue-600 px-4 py-2 text-white">
                {editingRecipeId ? "Update Recipe" : "Save Recipe"}
              </button>
              {editingRecipeId && (
                <button onClick={cancelEdit} className="rounded border px-4 py-2">
                  Cancel Edit
                </button>
              )}
            </div>
          </div>
        </section>

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
                  {mealSlots.map((slot) => (
                    <th key={slot} className="border p-2">{slot}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {days.map((day) => (
                  <tr key={day}>
                    <td className="border p-2 font-semibold">{day}</td>
                    {mealSlots.map((slot) => (
                      <td key={slot} className="border p-2">
                        <select
                          className="w-full rounded border p-2"
                          value={mealPlan[day]?.[slot] || ""}
                          onChange={(e) => updateMealPlan(day, slot, e.target.value)}
                        >
                          <option value="">No meal</option>
                          {recipes
                            .filter((recipe) => slot === "Snack" || recipe.category === slot || recipe.category === "Dinner")
                            .map((recipe) => (
                              <option key={recipe.id} value={recipe.id}>{recipe.name}</option>
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
            <div className="rounded-xl bg-slate-100 p-3">
              <div className="text-xs text-slate-500">Planned Meals</div>
              <div className="text-xl font-semibold">{plannedMealCount}</div>
            </div>
            <div className="rounded-xl bg-slate-100 p-3">
              <div className="text-xs text-slate-500">Calories</div>
              <div className="text-xl font-semibold">{Math.round(weeklyMacroTotals.calories)}</div>
            </div>
            <div className="rounded-xl bg-slate-100 p-3">
              <div className="text-xs text-slate-500">Protein</div>
              <div className="text-xl font-semibold">{Math.round(weeklyMacroTotals.protein)}g</div>
            </div>
            <div className="rounded-xl bg-slate-100 p-3">
              <div className="text-xs text-slate-500">Carbs</div>
              <div className="text-xl font-semibold">{Math.round(weeklyMacroTotals.carbs)}g</div>
            </div>
            <div className="rounded-xl bg-slate-100 p-3">
              <div className="text-xs text-slate-500">Fat / Fiber</div>
              <div className="text-xl font-semibold">{Math.round(weeklyMacroTotals.fat)}g / {Math.round(weeklyMacroTotals.fiber)}g</div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-4 shadow md:p-6">
          <h2 className="mb-4 text-2xl font-semibold">Saved Recipes</h2>
          <div className="space-y-3">
            {recipes.map((recipe) => (
              <div key={recipe.id} className="rounded border p-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="font-semibold">{recipe.name}</div>
                    <div className="text-sm text-slate-600">
                      {recipe.category} {recipe.tags ? `• ${recipe.tags}` : ""}
                    </div>
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

        <section className="rounded-2xl bg-white p-4 shadow md:p-6">
          <h2 className="mb-1 text-2xl font-semibold">Grocery List For This Week</h2>
          <p className="mb-4 text-sm text-slate-600">Only recipes assigned in the weekly meal planner are included.</p>

          {plannedMealCount === 0 ? (
            <div className="rounded border border-dashed p-4 text-slate-500">Add recipes to the weekly meal planner to generate a grocery list.</div>
          ) : (
            <div className="space-y-4">
              {grocerySections.map((section) => {
                const items = groceryList.filter((item) => item.section === section);
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
