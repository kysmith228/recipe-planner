"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

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
  ingredients: Ingredient[];
};

type FamilyMember = {
  id: number;
  name: string;
  caloriesNeeded: number;
};

export default function Home() {
  const [recipes, setRecipes] = useState<Recipe[]>([
    {
      id: 1,
      name: "Chicken Rice Bowls",
      servings: 4,
      caloriesPerServing: 500,
      ingredients: [
        { item: "Chicken Breast", qty: 2, unit: "lb" },
        { item: "Rice", qty: 2, unit: "cups" },
        { item: "Broccoli", qty: 1, unit: "lb" },
      ],
    },
  ]);

  const [family, setFamily] = useState<FamilyMember[]>([
    { id: 1, name: "Kyle", caloriesNeeded: 700 },
    { id: 2, name: "Family Member", caloriesNeeded: 500 },
  ]);

  const totalCaloriesNeeded = family.reduce(
    (sum, person) => sum + person.caloriesNeeded,
    0
  );

  const groceryList = useMemo(() => {
    const groceries: Record<string, { qty: number; unit: string }> = {};

    recipes.forEach((recipe) => {
      const neededServings =
        totalCaloriesNeeded / recipe.caloriesPerServing;

      const scaleFactor = neededServings / recipe.servings;

      recipe.ingredients.forEach((ingredient) => {
        const key = ingredient.item;

        if (!groceries[key]) {
          groceries[key] = {
            qty: 0,
            unit: ingredient.unit,
          };
        }

        groceries[key].qty += ingredient.qty * scaleFactor;
      });
    });

    return groceries;
  }, [recipes, totalCaloriesNeeded]);

  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-6 text-4xl font-bold">
          Recipe Macro Grocery Planner
        </h1>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl bg-white p-6 shadow">
            <h2 className="mb-4 text-2xl font-semibold">Family Members</h2>

            <div className="space-y-3">
              {family.map((person) => (
                <div
                  key={person.id}
                  className="flex items-center gap-2"
                >
                  <input
                    className="rounded border p-2"
                    value={person.name}
                    onChange={(e) => {
                      setFamily((prev) =>
                        prev.map((p) =>
                          p.id === person.id
                            ? { ...p, name: e.target.value }
                            : p
                        )
                      );
                    }}
                  />

                  <input
                    type="number"
                    className="rounded border p-2"
                    value={person.caloriesNeeded}
                    onChange={(e) => {
                      setFamily((prev) =>
                        prev.map((p) =>
                          p.id === person.id
                            ? {
                                ...p,
                                caloriesNeeded: Number(e.target.value),
                              }
                            : p
                        )
                      );
                    }}
                  />

                  <button
                    className="rounded bg-red-500 p-2 text-white"
                    onClick={() =>
                      setFamily((prev) =>
                        prev.filter((p) => p.id !== person.id)
                      )
                    }
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>

            <button
              className="mt-4 flex items-center gap-2 rounded bg-blue-500 px-4 py-2 text-white"
              onClick={() =>
                setFamily((prev) => [
                  ...prev,
                  {
                    id: Date.now(),
                    name: "New Member",
                    caloriesNeeded: 500,
                  },
                ])
              }
            >
              <Plus size={16} />
              Add Family Member
            </button>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow">
            <h2 className="mb-4 text-2xl font-semibold">
              Grocery List
            </h2>

            <div className="space-y-2">
              {Object.entries(groceryList).map(([item, data]) => (
                <div
                  key={item}
                  className="flex justify-between rounded border p-3"
                >
                  <span>{item}</span>

                  <span>
                    {data.qty.toFixed(2)} {data.unit}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl bg-white p-6 shadow">
          <h2 className="mb-4 text-2xl font-semibold">Recipes</h2>

          {recipes.map((recipe) => (
            <div
              key={recipe.id}
              className="mb-4 rounded border p-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold">
                  {recipe.name}
                </h3>

                <span>
                  {recipe.caloriesPerServing} cal/serving
                </span>
              </div>

              <p className="mt-2 text-sm text-gray-500">
                Servings: {recipe.servings}
              </p>

              <div className="mt-4 space-y-2">
                {recipe.ingredients.map((ingredient, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between"
                  >
                    <span>{ingredient.item}</span>

                    <span>
                      {ingredient.qty} {ingredient.unit}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}