// Which wishlist items a stop on the plan suggests. Pure; wrapped as `Wish` inside the page script.
//
// An item's `fits[]` names the days it suits. An entry may also name its meal (`meal: 'dinner'`, or a list), so an item
// meant for one day's dinner isn't offered at that day's lunch on the other side of the region. An entry with no meal
// suits every meal stop that day, as before.

/** the meals a fits entry names: [] when it names none */
export const fitMeals = (f) => (f && f.meal ? [].concat(f.meal) : []);

/** does the item suit a stop on this day, serving these meals? (the stop's meals, e.g. ['lunch']) */
export function fitsStop(fits, dayId, meals) {
	return (fits || []).some((f) => f && f.day === dayId && (!fitMeals(f).length || fitMeals(f).some((m) => (meals || []).includes(m))));
}

/** the meals a fits entry may name: the meals a stop's `mealAt` serves, and a snack */
export const MEALS = ['breakfast', 'lunch', 'dinner', 'supper', 'snack'];

/** what's wrong with an item's fits[] meals, for the contract: [] when nothing */
export const fitMealProblems = (id, fits) =>
	(fits || []).flatMap((f, i) =>
		f && f.meal != null && !(fitMeals(f).length && fitMeals(f).every((m) => MEALS.includes(m)))
			? [`wish ${id}: fits[${i}].meal must be one of ${MEALS.join(', ')}, or a list of them; got ${JSON.stringify(f.meal)}`]
			: [],
	);
