import { useEffect, useState } from "react";

export default function OwnerPortal() {
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("http://localhost:4000/api/owner/restaurant", {
      credentials: "include",
    })
      .then((res) => {
        if (res.status === 401) {
          // not logged in
          window.location.href = "/owner/login";
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (!data) return;
        if (!data.success) {
          alert(data.error || "Failed to load restaurant");
        } else {
          setRestaurant(data.restaurant);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="p-4">Loading portal...</div>;
  }

  if (!restaurant) {
    return (
      <div className="p-4">
        <p>No restaurant found for this account.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      <div className="border rounded p-4">
        <h1 className="text-xl font-semibold mb-2">
          {restaurant.name}
        </h1>
        <p className="text-sm text-gray-600">
          {restaurant.location}
        </p>

        {restaurant.heroImageUrl && (
          <img
            src={restaurant.heroImageUrl}
            alt="Hero"
            className="mt-3 rounded border"
          />
        )}

        <p className="text-xs text-gray-500 mt-2">
          (Future: edit restaurant details here)
        </p>
      </div>

      <div className="border rounded p-4">
        <h2 className="font-semibold mb-2">Your Offers / Items</h2>
        <p className="text-sm text-gray-600">
          (Future: list & create offers for THIS restaurant only)
        </p>
      </div>
    </div>
  );
}
