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

type NutritionEstimate = {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number;
};

const STORAGE_KEY = "recipe-planner-phase-1-estimator-v1";

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

const nutritionPerUnit: Record<string, NutritionEstimate> = {
  "chicken breast": { calories: 748, protein: 139, fat: 16, carbs: 0, fiber: 0 },
  chicken: { calories: 748, protein: 139, fat: 16, carbs: 0, fiber: 0 },
  "ground beef": { calories: 1152, protein: 104, fat: 80, carbs: 0, fiber: 0 },
  beef: { calories: 1152, protein: 104, fat: 80, carbs: 0, fiber: 0 },
  "ground turkey": { calories: 676, protein: 88, fat: 36, carbs: 0, fiber: 0 },
  turkey: { calories: 676, protein: 88, fat: 36, carbs: 0, fiber: 0 },
  rice: { calories: 205, protein: 4, fat: 0, carbs: 45, fiber: 1 },
  pasta: { calories: 200, protein: 7, fat: 1, carbs: 42, fiber: 2 },
  tortilla: { calories: 140, protein: 4, fat: 4, carbs: 24, fiber: 2 },
  tortillas: { calories: 140, protein: 4, fat: 4, carbs: 24, fiber: 2 },
  salsa: { calories: 70, protein: 2, fat: 0, carbs: 14, fiber: 3 },
  cheese: { calories: 455, protein: 28, fat: 37, carbs: 4, fiber: 0 },
  broccoli: { calories: 154, protein: 13, fat: 2, carbs: 31, fiber: 12 },
  lettuce: { calories: 10, protein: 1, fat: 0, carbs: 2, fiber: 1 },
  beans: { calories: 227, protein: 15, fat: 1, carbs: 41, fiber: 15 },
  "black beans": { calories: 227, protein: 15, fat: 1, carbs: 41, fiber: 15 },
  "olive oil": { calories: 119, protein: 0, fat: 14, carbs: 0, fiber: 0 },
  oil: { calories: 119, protein: 0, fat: 14, carbs: 0, fiber: 0 },
};

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

function findNutritionMatch(item: string) {
  const lowered = item.toLowerCase();
  const key = Object.keys(nutritionPerUnit).find((food) => lowered.includes(food));
  return key ? nutritionPerUnit[key] : null;
}

function unitMultiplier(unit: string) {
  const normalized = unit.toLowerCase();

  if (["lb", "lbs", "pound", "pounds"].includes(normalized)) return 1;
  if (["cup", "cups"].includes(normalized)) return 1;
  if (["tbsp", "tablespoon", "tablespoons"].includes(normalized)) return 1;
  if (["each", "ea", "ct", "count"].includes(normalized)) return 1;
  if (["oz", "ounce", "ounces"].includes(normalized)) return 1 / 16;

  return 1;
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

export default function Home() {
  const [family, setFamily] = useState<FamilyMember[]>(defaultFamily);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [editingRecipeId, setEditingRecipeId] = useState<number | null>(null);
  const [recipeForm, setRecipeForm] = useState<Recipe>(blankRecipe());
  const [ingredientsText, setIngredientsText] = useState("1 lb chicken breast\n8 each tortillas\n1 cup salsa");
  const [scaleBy, setScaleBy] = useState<"calories" | "protein">("calories");
  const [estimateMessage, setEstimateMessage] = useState("Nutrition estimate uses a small starter food table. Review before saving.");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;

    const parsed = JSON.parse(saved);
    setFamily(parsed.family || defaultFamily);
    setRecipes(parsed.recipes || []);
    setScaleBy(parsed.scaleBy || "calories");
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ family, recipes, scaleBy }));
  }, [family, recipes, scaleBy]);

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

  function estimateNutrition() {
    const ingredients = ingredientsText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map(parseIngredientLine);

    const missing: string[] = [];

    const total = ingredients.reduce<NutritionEstimate>(
      (sum, ingredient) => {
        const match = findNutritionMatch(ingredient.item);
        if (!match) {
          missing.push(ingredient.item);
          return sum;
        }

        const multiplier = ingredient.qty * unitMultiplier(ingredient.unit);
        sum.calories += match.calories * multiplier;
        sum.protein += match.protein * multiplier;
        sum.fat += match.fat * multiplier;
        sum.carbs += match.carbs * multiplier;
        sum.fiber += match.fiber * multiplier;
        return sum;
      },
      { calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 }
    );

    const divisor = recipeForm.servings || 1;

    setRecipeForm((current) => ({
      ...current,
      calories: Math.round(total.calories / divisor),
      protein: Math.round(total.protein / divisor),
      fat: Math.round(total.fat / divisor),
      carbs: Math.round(total.carbs / divisor),
      fiber: Math.round(total.fiber / divisor),
    }));

    if (missing.length > 0) {
      setEstimateMessage(`Estimated using known foods. Not matched: ${missing.join(", ")}`);
    } else {
      setEstimateMessage("Estimated nutrition populated. Review before saving.");
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

  const groceryList = useMemo(() => {
    const target = family.reduce(
      (sum, person) => sum + (scaleBy === "protein" ? person.mealProtein : person.mealCalories),
      0
    );

    const list: Record<string, { qty: number; unit: string; section: string }> = {};

    recipes.forEach((recipe) => {
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
  }, [family, recipes, scaleBy]);

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
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

            <p className="text-sm text-slate-600 md:col-span-2">{estimateMessage}</p>

            <div className="flex flex-wrap gap-3 md:col-span-2">
              <button onClick={estimateNutrition} className="rounded bg-green-600 px-4 py-2 text-white">
                Estimate Nutrition
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
            <h2 className="text-2xl font-semibold">Saved Recipes</h2>
            <label className="text-sm font-medium">
              Scale grocery list by
              <select className="ml-2 rounded border p-2" value={scaleBy} onChange={(e) => setScaleBy(e.target.value as "calories" | "protein")}>
                <option value="calories">Calories</option>
                <option value="protein">Protein</option>
              </select>
            </label>
          </div>

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
          <h2 className="mb-4 text-2xl font-semibold">Grocery List</h2>
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
        </section>
      </div>
    </main>
  );
}
