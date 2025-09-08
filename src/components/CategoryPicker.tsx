"use client";

import React from "react";

export type KioskCategory = {
  id: string;
  name: string;
  code: string;
  children?: { id: string; name: string; code: string }[];
};

type Props = {
  categories: KioskCategory[];
  value: string | null;                // selected *child* category id
  onChange: (id: string | null) => void;
};

export default function CategoryPicker({ categories, value, onChange }: Props) {
  const [topId, setTopId] = React.useState<string | null>(null);

  // When parent changes, clear child selection
  React.useEffect(() => {
    onChange(null);
  }, [topId]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedParent = categories.find(c => c.id === topId) || null;

  const childOptions =
    selectedParent?.children && selectedParent.children.length > 0
      ? selectedParent.children
      : selectedParent
      ? [{ id: selectedParent.id, name: selectedParent.name, code: selectedParent.code }] // virtual child = parent
      : [];

  return (
    <div className="space-y-4">
      {/* STEP 1: Top-level grid (max 8) */}
      <div>
        <h3 className="text-sm font-medium mb-2">Choose a category</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {categories.slice(0, 8).map((cat) => {
            const active = topId === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setTopId(cat.id)}
                className={
                  "rounded-xl px-3 py-4 ring-1 transition " +
                  (active
                    ? "bg-black text-white ring-black"
                    : "bg-white text-gray-900 ring-gray-300 hover:ring-gray-400")
                }
              >
                <div className="text-xs opacity-60">{cat.code}</div>
                <div className="font-medium">{cat.name}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* STEP 2: Sub-grid (required) */}
      <div>
        <h3 className="text-sm font-medium mb-2">Choose a subcategory</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {childOptions.map((sub) => {
            const active = value === sub.id;
            return (
              <button
                key={sub.id}
                type="button"
                onClick={() => onChange(sub.id)}
                className={
                  "rounded-xl px-3 py-3 ring-1 transition " +
                  (active
                    ? "bg-blue-600 text-white ring-blue-600"
                    : "bg-white text-gray-900 ring-gray-300 hover:ring-gray-400")
                }
              >
                <div className="text-xs opacity-60">{sub.code}</div>
                <div className="font-medium">{sub.name}</div>
              </button>
            );
          })}

          {/* No parent selected yet → gentle nudge */}
          {(!selectedParent || childOptions.length === 0) && (
            <div className="col-span-2 md:col-span-4 text-sm text-gray-500 rounded-lg bg-gray-50 ring-1 ring-gray-200 p-3">
              Select a category above to see its subcategories.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
