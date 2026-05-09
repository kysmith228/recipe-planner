"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Save, ShoppingCart, Users, Utensils, RotateCcw } from "lucide-react";

type Ingredient = {
  item: string;
  qty: number;
  unit: string;
};

type Recipe = {
  id: number;
  name: string;
  servings: number;
  caloriesPerServing: number;
  proteinPerServing: number;
  carbsPerServing: number;
  fatPerServing: number;
  ingredients: Ingredient[];
};

type FamilyMember = {
  id: number;
  name: string;
  mealCalories: number;
  proteinTarget: number;
  carbsTarget: number;
  fatTarget: number;
};

const STORAGE_KEY = "recipe-macro-grocery-planner-v1";

const starterFamily: FamilyMember[] = [
  { id: 1, name: "Kyle", mealCalories: 700, proteinTarget: 50, carbsTarget: 60, fatTarget: 25 },
  { id: 2, name: "Kathie", mealCalories: 500, proteinTarget: 35, carbsTarget: 45, fatTarget: 18 },
  { id: 3, name: "Koen", mealCalories: 450, proteinTarget: 30, carbsTarget: 50, fatTarget: 15 },
  { id: 4, name: "Kole", mealCalories: 450, proteinTarget: 30, carbsTarget: 50, fatTarget: 15 },
];

const starterRecipes: Recipe[] = [
  {
    id: 1,
    name: "Chicken Rice Bowls",
    servings: 4,
    caloriesPerServing: 500,
    proteinPerServing: 42,
    carbsPerServing: 48,
    fatPerServing: 14,
    ingredients: [
      { item: "Chicken Breast", qty: 2, unit: "lb" },
      { item: "Rice", qty: 2, unit: "cups" },
      { item: "Broccoli", qty: 1, unit: "lb" },
      { item: "Olive Oil", qty: 2, unit: "tbsp" },
    ],
  },
];

const blankRecipe: Recipe = {
  id: 0,
  name: "",
  servings: 4,
  caloriesPerServing: 500,
  proteinPerServing: 30,
  carbsPerServing: 40,
  fatPerServing: 15,
  ingredients: [{ item: "", qty: 1, unit: "" }],
};

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function emptyToZero(value: string) {
  return value === "" ? 0 : Number(value);
}

export default function Home() {
  const [family, setFamily] = useState<FamilyMember[]>(starterFamily);
  const [recipes, setRecipes] = useState<Recipe[]>(starterRecipes);
  const [selectedRecipeIds, setSelectedRecipeIds] = useState<number[]>([1]);
  const [mealsPerWeek, setMealsPerWeek] = useState(5);
  const [recipeForm, setRecipeForm] = useState<Recipe>(blankRecipe);
  const [editingRecipeId, setEditingRecipeId] = useState<number | null>(null);
  const [status, setStatus] = useState("Saved automatically in this browser");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved);
      if (parsed.family) setFamily(parsed.family);
      if (parsed.recipes) setRecipes(parsed.recipes);
      if (parsed.selectedRecipeIds) setSelectedRecipeIds(parsed.selectedRecipeIds);
      if (parsed.mealsPerWeek) setMealsPerWeek(parsed.mealsPerWeek);
    } catch {
      setStatus("Could not load saved data");
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ family, recipes, selectedRecipeIds, mealsPerWeek })
    );
    setStatus("Saved automatically in this browser");
  }, [family, recipes, selectedRecipeIds, mealsPerWeek]);

  const totalMealCalories = family.reduce((sum, person) => sum + Number(person.mealCalories || 0), 0);
  const selectedRecipes = recipes.filter((recipe) => selectedRecipeIds.includes(recipe.id));

  const groceryList = useMemo(() => {
    const groceries: Record<string, { item: string; qty: number; unit: string; recipes: string[] }> = {};

    selectedRecipes.forEach((recipe) => {
      const servingsNeeded = recipe.caloriesPerServing > 0
        ? totalMealCalories / recipe.caloriesPerServing
        : family.length;
      const scaleFactor = servingsNeeded / recipe.servings;

      recipe.ingredients.forEach((ingredient) => {
        if (!ingredient.item.trim()) return;
        const key = `${ingredient.item.trim().toLowerCase()}|${ingredient.unit.trim().toLowerCase()}`;
        if (!groceries[key]) {
          groceries[key] = {
            item: ingredient.item.trim(),
            qty: 0,
            unit: ingredient.unit.trim(),
            recipes: [],
          };
        }
        groceries[key].qty += Number(ingredient.qty || 0) * scaleFactor * mealsPerWeek;
        if (!groceries[key].recipes.includes(recipe.name)) groceries[key].recipes.push(recipe.name);
      });
    });

    return Object.values(groceries).sort((a, b) => a.item.localeCompare(b.item));
  }, [selectedRecipes, totalMealCalories, mealsPerWeek, family.length]);

  const plannedMacros = useMemo(() => {
    return selectedRecipes.reduce(
      (totals, recipe) => {
        const servingsNeeded = recipe.caloriesPerServing > 0
          ? totalMealCalories / recipe.caloriesPerServing
          : family.length;
        totals.calories += recipe.caloriesPerServing * servingsNeeded * mealsPerWeek;
        totals.protein += recipe.proteinPerServing * servingsNeeded * mealsPerWeek;
        totals.carbs += recipe.carbsPerServing * servingsNeeded * mealsPerWeek;
        totals.fat += recipe.fatPerServing * servingsNeeded * mealsPerWeek;
        return totals;
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  }, [selectedRecipes, totalMealCalories, mealsPerWeek, family.length]);

  function updateFamilyMember(id: number, field: keyof FamilyMember, value: string) {
    setFamily((current) =>
      current.map((person) =>
        person.id === id
          ? { ...person, [field]: field === "name" ? value : emptyToZero(value) }
          : person
      )
    );
  }

  function addFamilyMember() {
    setFamily((current) => [
      ...current,
      { id: Date.now(), name: "New Member", mealCalories: 500, proteinTarget: 30, carbsTarget: 40, fatTarget: 15 },
    ]);
  }

  function updateRecipeForm(field: keyof Recipe, value: string) {
    setRecipeForm((current) => ({
      ...current,
      [field]: field === "name" ? value : emptyToZero(value),
    }));
  }

  function updateIngredient(index: number, field: keyof Ingredient, value: string) {
    setRecipeForm((current) => ({
      ...current,
      ingredients: current.ingredients.map((ingredient, ingredientIndex) =>
        ingredientIndex === index
          ? { ...ingredient, [field]: field === "qty" ? emptyToZero(value) : value }
          : ingredient
      ),
    }));
  }

  function addIngredientRow() {
    setRecipeForm((current) => ({
      ...current,
      ingredients: [...current.ingredients, { item: "", qty: 1, unit: "" }],
    }));
  }

  function removeIngredientRow(index: number) {
    setRecipeForm((current) => ({
      ...current,
      ingredients: current.ingredients.filter((_, ingredientIndex) => ingredientIndex !== index),
    }));
  }

  function saveRecipe() {
    const cleanedRecipe: Recipe = {
      ...recipeForm,
      id: editingRecipeId ?? Date.now(),
      name: recipeForm.name.trim() || "Untitled Recipe",
      ingredients: recipeForm.ingredients.filter((ingredient) => ingredient.item.trim()),
    };

    if (editingRecipeId) {
      setRecipes((current) => current.map((recipe) => recipe.id === editingRecipeId ? cleanedRecipe : recipe));
    } else {
      setRecipes((current) => [...current, cleanedRecipe]);
      setSelectedRecipeIds((current) => [...current, cleanedRecipe.id]);
    }

    setRecipeForm(blankRecipe);
    setEditingRecipeId(null);
    setStatus("Recipe saved");
  }

  function editRecipe(recipe: Recipe) {
    setRecipeForm({ ...recipe, ingredients: recipe.ingredients.length ? recipe.ingredients : [{ item: "", qty: 1, unit: "" }] });
    setEditingRecipeId(recipe.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function deleteRecipe(id: number) {
    setRecipes((current) => current.filter((recipe) => recipe.id !== id));
    setSelectedRecipeIds((current) => current.filter((recipeId) => recipeId !== id));
  }

  function resetDemoData() {
    setFamily(starterFamily);
    setRecipes(starterRecipes);
    setSelectedRecipeIds([1]);
    setMealsPerWeek(5);
    setRecipeForm(blankRecipe);
    setEditingRecipeId(null);
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 md:text-4xl">Recipe Macro Grocery Planner</h1>
              <p className="mt-2 text-slate-600">Add real recipes, set family meal targets, scale serving sizes, and build a grocery list.</p>
              <p className="mt-2 text-sm text-green-700">{status}</p>
            </div>
            <button onClick={resetDemoData} className="flex w-fit items-center gap-2 rounded-xl border px-4 py-2 text-sm hover:bg-slate-50">
              <RotateCcw size={16} /> Reset demo data
            </button>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-3xl bg-white p-5 shadow-sm lg:col-span-2">
            <div className="mb-4 flex items-center gap-2">
              <Utensils size={22} />
              <h2 className="text-2xl font-semibold">Add / Edit Recipe</h2>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1"><span className="text-sm font-medium">Recipe name</span><input className="w-full rounded-xl border p-3" value={recipeForm.name} onChange={(e) => updateRecipeForm("name", e.target.value)} placeholder="Example: Beef Taco Bowls" /></label>
              <label className="space-y-1"><span className="text-sm font-medium">Original servings</span><input className="w-full rounded-xl border p-3" type="number" value={recipeForm.servings} onChange={(e) => updateRecipeForm("servings", e.target.value)} /></label>
              <label className="space-y-1"><span className="text-sm font-medium">Calories / serving</span><input className="w-full rounded-xl border p-3" type="number" value={recipeForm.caloriesPerServing} onChange={(e) => updateRecipeForm("caloriesPerServing", e.target.value)} /></label>
              <label className="space-y-1"><span className="text-sm font-medium">Protein / serving</span><input className="w-full rounded-xl border p-3" type="number" value={recipeForm.proteinPerServing} onChange={(e) => updateRecipeForm("proteinPerServing", e.target.value)} /></label>
              <label className="space-y-1"><span className="text-sm font-medium">Carbs / serving</span><input className="w-full rounded-xl border p-3" type="number" value={recipeForm.carbsPerServing} onChange={(e) => updateRecipeForm("carbsPerServing", e.target.value)} /></label>
              <label className="space-y-1"><span className="text-sm font-medium">Fat / serving</span><input className="w-full rounded-xl border p-3" type="number" value={recipeForm.fatPerServing} onChange={(e) => updateRecipeForm("fatPerServing", e.target.value)} /></label>
            </div>

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-semibold">Ingredients</h3>
                <button onClick={addIngredientRow} className="flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm text-white"><Plus size={16} /> Add ingredient</button>
              </div>

              <div className="space-y-2">
                {recipeForm.ingredients.map((ingredient, index) => (
                  <div key={index} className="grid gap-2 md:grid-cols-[1fr_120px_120px_48px]">
                    <input className="rounded-xl border p-3" value={ingredient.item} onChange={(e) => updateIngredient(index, "item", e.target.value)} placeholder="Ingredient" />
                    <input className="rounded-xl border p-3" type="number" value={ingredient.qty} onChange={(e) => updateIngredient(index, "qty", e.target.value)} placeholder="Qty" />
                    <input className="rounded-xl border p-3" value={ingredient.unit} onChange={(e) => updateIngredient(index, "unit", e.target.value)} placeholder="Unit" />
                    <button onClick={() => removeIngredientRow(index)} className="rounded-xl bg-red-500 p-3 text-white"><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>
            </div>

            <button onClick={saveRecipe} className="mt-5 flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"><Save size={18} /> {editingRecipeId ? "Update Recipe" : "Save Recipe"}</button>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2"><Users size={22} /><h2 className="text-2xl font-semibold">Family</h2></div>

            <div className="space-y-3">
              {family.map((person) => (
                <div key={person.id} className="rounded-2xl border p-3">
                  <input className="mb-2 w-full rounded-xl border p-2 font-medium" value={person.name} onChange={(e) => updateFamilyMember(person.id, "name", e.target.value)} />
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <label>Meal calories<input className="mt-1 w-full rounded-xl border p-2" type="number" value={person.mealCalories} onChange={(e) => updateFamilyMember(person.id, "mealCalories", e.target.value)} /></label>
                    <label>Protein<input className="mt-1 w-full rounded-xl border p-2" type="number" value={person.proteinTarget} onChange={(e) => updateFamilyMember(person.id, "proteinTarget", e.target.value)} /></label>
                    <label>Carbs<input className="mt-1 w-full rounded-xl border p-2" type="number" value={person.carbsTarget} onChange={(e) => updateFamilyMember(person.id, "carbsTarget", e.target.value)} /></label>
                    <label>Fat<input className="mt-1 w-full rounded-xl border p-2" type="number" value={person.fatTarget} onChange={(e) => updateFamilyMember(person.id, "fatTarget", e.target.value)} /></label>
                  </div>
                  <button onClick={() => setFamily((current) => current.filter((p) => p.id !== person.id))} className="mt-3 flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700"><Trash2 size={15} /> Remove</button>
                </div>
              ))}
            </div>

            <button onClick={addFamilyMember} className="mt-4 flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-white"><Plus size={16} /> Add family member</button>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-3xl bg-white p-5 shadow-sm lg:col-span-2">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="text-2xl font-semibold">Recipes</h2>
              <label className="flex items-center gap-2 text-sm">Meals per week<input className="w-20 rounded-xl border p-2" type="number" value={mealsPerWeek} onChange={(e) => setMealsPerWeek(emptyToZero(e.target.value))} /></label>
            </div>

            <div className="space-y-3">
              {recipes.map((recipe) => {
                const selected = selectedRecipeIds.includes(recipe.id);
                const servingsNeeded = recipe.caloriesPerServing > 0 ? totalMealCalories / recipe.caloriesPerServing : family.length;
                const scaleFactor = servingsNeeded / recipe.servings;

                return (
                  <div key={recipe.id} className="rounded-2xl border p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <label className="flex items-center gap-3 text-lg font-semibold"><input type="checkbox" checked={selected} onChange={(e) => { setSelectedRecipeIds((current) => e.target.checked ? [...current, recipe.id] : current.filter((id) => id !== recipe.id)); }} />{recipe.name}</label>
                        <p className="mt-1 text-sm text-slate-500">Original servings: {recipe.servings} · Needed per meal: {round(servingsNeeded)} · Ingredient scale: {round(scaleFactor)}x</p>
                        <p className="mt-1 text-sm text-slate-500">{recipe.caloriesPerServing} cal · {recipe.proteinPerServing}g P · {recipe.carbsPerServing}g C · {recipe.fatPerServing}g F per serving</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => editRecipe(recipe)} className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50">Edit</button>
                        <button onClick={() => deleteRecipe(recipe.id)} className="rounded-xl bg-red-500 px-3 py-2 text-sm text-white">Delete</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-2xl font-semibold">Planned Weekly Macros</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-slate-100 p-4"><p className="text-sm text-slate-500">Calories</p><p className="text-2xl font-bold">{Math.round(plannedMacros.calories).toLocaleString()}</p></div>
              <div className="rounded-2xl bg-slate-100 p-4"><p className="text-sm text-slate-500">Protein</p><p className="text-2xl font-bold">{Math.round(plannedMacros.protein)}g</p></div>
              <div className="rounded-2xl bg-slate-100 p-4"><p className="text-sm text-slate-500">Carbs</p><p className="text-2xl font-bold">{Math.round(plannedMacros.carbs)}g</p></div>
              <div className="rounded-2xl bg-slate-100 p-4"><p className="text-sm text-slate-500">Fat</p><p className="text-2xl font-bold">{Math.round(plannedMacros.fat)}g</p></div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2"><ShoppingCart size={22} /><h2 className="text-2xl font-semibold">Grocery List</h2></div>

          <div className="overflow-hidden rounded-2xl border">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-600"><tr><th className="p-3">Item</th><th className="p-3">Qty</th><th className="p-3">Unit</th><th className="p-3">Recipe</th></tr></thead>
              <tbody>
                {groceryList.length === 0 ? (
                  <tr><td className="p-3 text-slate-500" colSpan={4}>Select a recipe to build your grocery list.</td></tr>
                ) : groceryList.map((grocery) => (
                  <tr key={`${grocery.item}-${grocery.unit}`} className="border-t"><td className="p-3 font-medium">{grocery.item}</td><td className="p-3">{round(grocery.qty)}</td><td className="p-3">{grocery.unit}</td><td className="p-3 text-slate-500">{grocery.recipes.join(", ")}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

