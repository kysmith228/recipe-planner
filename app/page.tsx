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
};

type Recipe = {
  id: number;
  name: string;
  servings: number;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number;
  ingredients: Ingredient[];
};

const STORAGE_KEY = "recipe-planner-clean-v1";

export default function Home() {
  const [family, setFamily] = useState<FamilyMember[]>([
    {
      id: 1,
      name: "Kyle",
      mealCalories: 700,
      mealProtein: 60,
      mealFat: 25,
      mealCarbs: 70,
      mealFiber: 10,
    },
    {
      id: 2,
      name: "Kathie",
      mealCalories: 500,
      mealProtein: 40,
      mealFat: 18,
      mealCarbs: 50,
      mealFiber: 8,
    },
  ]);

  const [recipes, setRecipes] = useState<Recipe[]>([]);

  const [recipeName, setRecipeName] = useState("");
  const [servings, setServings] = useState(4);
  const [calories, setCalories] = useState(500);
  const [protein, setProtein] = useState(35);
  const [fat, setFat] = useState(15);
  const [carbs, setCarbs] = useState(45);
  const [fiber, setFiber] = useState(5);

  const [ingredientsText, setIngredientsText] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (saved) {
      const parsed = JSON.parse(saved);

      setFamily(parsed.family || []);
      setRecipes(parsed.recipes || []);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        family,
        recipes,
      })
    );
  }, [family, recipes]);

  function updateFamily(
    id: number,
    field: keyof FamilyMember,
    value: string
  ) {
    setFamily((current) =>
      current.map((person) =>
        person.id === id
          ? {
              ...person,
              [field]:
                field === "name"
                  ? value
                  : Number(value),
            }
          : person
      )
    );
  }

  function addRecipe() {
    const ingredients = ingredientsText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split(" ");

        return {
          qty: Number(parts[0]) || 1,
          unit: parts[1] || "each",
          item: parts.slice(2).join(" "),
        };
      });

    setRecipes((current) => [
      ...current,
      {
        id: Date.now(),
        name: recipeName,
        servings,
        calories,
        protein,
        fat,
        carbs,
        fiber,
        ingredients,
      },
    ]);
  }

  const groceryList = useMemo(() => {
    const totalMealCalories = family.reduce(
      (sum, person) => sum + person.mealCalories,
      0
    );

    const list: Record<
      string,
      {
        qty: number;
        unit: string;
      }
    > = {};

    recipes.forEach((recipe) => {
      const servingsNeeded =
        totalMealCalories / recipe.calories;

      const scale =
        servingsNeeded / recipe.servings;

      recipe.ingredients.forEach((ingredient) => {
        if (!list[ingredient.item]) {
          list[ingredient.item] = {
            qty: 0,
            unit: ingredient.unit,
          };
        }

        list[ingredient.item].qty +=
          ingredient.qty * scale;
      });
    });

    return list;
  }, [family, recipes]);

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-6xl space-y-6">

        <h1 className="text-4xl font-bold">
          Recipe Macro Grocery Planner
        </h1>

        <section className="rounded-2xl bg-white p-6 shadow">
          <h2 className="mb-4 text-2xl font-semibold">
            Family Meal Targets
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full border text-sm">
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
                      <input
                        className="w-28 rounded border p-1"
                        value={person.name}
                        onChange={(e) =>
                          updateFamily(
                            person.id,
                            "name",
                            e.target.value
                          )
                        }
                      />
                    </td>

                    {[
                      "mealCalories",
                      "mealProtein",
                      "mealFat",
                      "mealCarbs",
                      "mealFiber",
                    ].map((field) => (
                      <td
                        key={field}
                        className="border p-2"
                      >
                        <input
                          className="w-20 rounded border p-1"
                          type="number"
                          value={
                            person[
                              field as keyof FamilyMember
                            ] as number
                          }
                          onChange={(e) =>
                            updateFamily(
                              person.id,
                              field as keyof FamilyMember,
                              e.target.value
                            )
                          }
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-6 shadow">
          <h2 className="mb-4 text-2xl font-semibold">
            Add Recipe
          </h2>

          <div className="grid gap-4 md:grid-cols-2">

            <div>
              <label className="mb-1 block text-sm font-medium">
                Recipe Name
              </label>

              <input
                className="w-full rounded border p-2"
                value={recipeName}
                onChange={(e) =>
                  setRecipeName(e.target.value)
                }
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Servings
              </label>

              <input
                className="w-full rounded border p-2"
                type="number"
                value={servings}
                onChange={(e) =>
                  setServings(Number(e.target.value))
                }
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Calories Per Serving
              </label>

              <input
                className="w-full rounded border p-2"
                type="number"
                value={calories}
                onChange={(e) =>
                  setCalories(Number(e.target.value))
                }
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Protein Per Serving
              </label>

              <input
                className="w-full rounded border p-2"
                type="number"
                value={protein}
                onChange={(e) =>
                  setProtein(Number(e.target.value))
                }
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Fat Per Serving
              </label>

              <input
                className="w-full rounded border p-2"
                type="number"
                value={fat}
                onChange={(e) =>
                  setFat(Number(e.target.value))
                }
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Carbs Per Serving
              </label>

              <input
                className="w-full rounded border p-2"
                type="number"
                value={carbs}
                onChange={(e) =>
                  setCarbs(Number(e.target.value))
                }
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Fiber Per Serving
              </label>

              <input
                className="w-full rounded border p-2"
                type="number"
                value={fiber}
                onChange={(e) =>
                  setFiber(Number(e.target.value))
                }
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium">
                Ingredients
              </label>

              <textarea
                className="min-h-32 w-full rounded border p-2"
                value={ingredientsText}
                onChange={(e) =>
                  setIngredientsText(
                    e.target.value
                  )
                }
                placeholder="One ingredient per line"
              />
            </div>

            <button
              onClick={addRecipe}
              className="rounded bg-blue-600 px-4 py-2 text-white"
            >
              Save Recipe
            </button>

          </div>
        </section>

        <section className="rounded-2xl bg-white p-6 shadow">
          <h2 className="mb-4 text-2xl font-semibold">
            Saved Recipes
          </h2>

          <div className="space-y-3">
            {recipes.map((recipe) => (
              <div
                key={recipe.id}
                className="rounded border p-3"
              >
                <div className="font-semibold">
                  {recipe.name}
                </div>

                <div className="text-sm text-slate-600">
                  {recipe.servings} servings |{" "}
                  {recipe.calories} cal |{" "}
                  {recipe.protein}g protein |{" "}
                  {recipe.fat}g fat |{" "}
                  {recipe.carbs}g carbs |{" "}
                  {recipe.fiber}g fiber
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-white p-6 shadow">
          <h2 className="mb-4 text-2xl font-semibold">
            Grocery List
          </h2>

          <div className="space-y-2">
            {Object.entries(groceryList).map(
              ([item, data]) => (
                <div
                  key={item}
                  className="flex justify-between border-b py-2"
                >
                  <span>{item}</span>

                  <span>
                    {data.qty.toFixed(2)}{" "}
                    {data.unit}
                  </span>
                </div>
              )
            )}
          </div>
        </section>

      </div>
    </main>
  );
}