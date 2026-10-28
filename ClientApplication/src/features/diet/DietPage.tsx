import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { FiActivity, FiChevronLeft, FiChevronRight, FiEdit2, FiPlus, FiSearch, FiSettings, FiTrash2, FiX } from "react-icons/fi";
import {
  calculateFoodNutrition,
  NUTRIENTS,
  scaleNutritionSnapshot,
  type FoodReferenceBasis,
  type FoodUnit,
  type Nutrient,
  type NutritionValues,
} from "./nutritionCalculations";
import {
  createDietEntry,
  createDietFood,
  deleteDietEntry,
  deleteDietFood,
  getDietDayData,
  getDietFoods,
  updateDietEntry,
  updateDietFood,
  saveDietTargets,
  type DietDayData,
  type DietEntry,
  type DietFood,
  type DietFoodInput,
  type DietTargets,
} from "./dietRepository";

const nutrientLabels: Record<Nutrient, string> = {
  calories: "Calories",
  protein: "Protein",
  carbohydrates: "Carbohydrates",
  fat: "Fat",
};
const nutrientUnits: Record<Nutrient, string> = { calories: "kcal", protein: "g", carbohydrates: "g", fat: "g" };
const unitChoices: FoodUnit[] = ["g", "ml", "piece", "serving"];

const localDateValue = (value = new Date()) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
const localDateTimeValue = (value = new Date()) => `${localDateValue(value)}T${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
const timestampToLocalInput = (timestamp: string) => localDateTimeValue(new Date(timestamp));
const formatNumber = (value: number) => new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value);
const defaultTargets = (): DietTargets => ({ calories: null, protein: null, carbohydrates: null, fat: null });
const valueToInput = (value: number | null) => value === null ? "" : String(value);
const parseOptionalNumber = (value: string, label: string) => {
  if (!value.trim()) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${label} must be a non-negative number or left blank.`);
  return parsed;
};
const parseQuantity = (value: string) => {
  if (!value.trim()) throw new Error("Quantity is required.");
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error("Quantity must be greater than zero.");
  return parsed;
};
const formatTimestamp = (timestamp: string) => new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(timestamp));
const formatDateLabel = (date: string) => new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date(`${date}T12:00:00`));

interface FoodDraft {
  name: string;
  referenceBasis: FoodReferenceBasis;
  servingSize: string;
  servingUnit: FoodUnit;
  nutrients: Record<Nutrient, string>;
}
const blankFoodDraft = (): FoodDraft => ({ name: "", referenceBasis: "per_100g", servingSize: "100", servingUnit: "g", nutrients: { calories: "", protein: "", carbohydrates: "", fat: "" } });

interface EntryDraft {
  foodId: string;
  foodName: string;
  quantity: string;
  unit: FoodUnit;
  timestamp: string;
  notes: string;
  nutrients: Record<Nutrient, string>;
}
const blankEntryDraft = (): EntryDraft => ({ foodId: "", foodName: "", quantity: "100", unit: "g", timestamp: localDateTimeValue(), notes: "", nutrients: { calories: "", protein: "", carbohydrates: "", fat: "" } });

export default function DietPage() {
  const [date, setDate] = useState(localDateValue());
  const [day, setDay] = useState<DietDayData | null>(null);
  const [foods, setFoods] = useState<DietFood[]>([]);
  const [foodSearch, setFoodSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"diary" | "foods">("diary");
  const [loading, setLoading] = useState(true);
  const [foodsLoading, setFoodsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [foodEditor, setFoodEditor] = useState<DietFood | "new" | null>(null);
  const [foodDraft, setFoodDraft] = useState<FoodDraft>(blankFoodDraft());
  const [entryEditor, setEntryEditor] = useState<DietEntry | "new" | null>(null);
  const [expandedEntryKey, setExpandedEntryKey] = useState<string | null>(null);
  const [entryDraft, setEntryDraft] = useState<EntryDraft>(blankEntryDraft());
  const [entryBaseline, setEntryBaseline] = useState<{ quantity: number; nutrition: NutritionValues } | null>(null);
  const [targetsEditor, setTargetsEditor] = useState(false);
  const [targetDraft, setTargetDraft] = useState<Record<Nutrient, string>>({ calories: "", protein: "", carbohydrates: "", fat: "" });
  const [deleteTarget, setDeleteTarget] = useState<{ type: "food" | "entry"; id: number; source?: "diet" | "legacy"; name: string } | null>(null);

  useEffect(() => {
    const onHardwareBack = (event: Event) => {
      if (!deleteTarget && !entryEditor && !foodEditor && !targetsEditor && activeTab !== "foods") return;
      event.preventDefault();
      if (saving) return;
      if (deleteTarget) setDeleteTarget(null);
      else if (entryEditor) setEntryEditor(null);
      else if (foodEditor) setFoodEditor(null);
      else if (targetsEditor) setTargetsEditor(false);
      else setActiveTab("diary");
    };
    window.addEventListener("daylens:back", onHardwareBack);
    return () => window.removeEventListener("daylens:back", onHardwareBack);
  }, [activeTab, deleteTarget, entryEditor, foodEditor, saving, targetsEditor]);

  const loadDay = useCallback(async () => {
    setError("");
    try { setDay(await getDietDayData(date)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load Diet data."); }
    finally { setLoading(false); }
  }, [date]);

  const loadFoods = useCallback(async () => {
    try { setFoods(await getDietFoods(foodSearch)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load saved foods."); }
    finally { setFoodsLoading(false); }
  }, [foodSearch]);

  useEffect(() => {
    let active = true;
    getDietDayData(date)
      .then(data => { if (active) { setDay(data); setError(""); } })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "Could not load Diet data."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [date]);

  useEffect(() => {
    let active = true;
    getDietFoods(foodSearch)
      .then(data => { if (active) setFoods(data); })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "Could not load saved foods."); })
      .finally(() => { if (active) setFoodsLoading(false); });
    return () => { active = false; };
  }, [foodSearch]);

  const openNewEntry = () => {
    setError(""); setEntryBaseline(null); setEntryDraft(blankEntryDraft()); setEntryEditor("new");
  };

  const openEditEntry = (entry: DietEntry) => {
    if (entry.source !== "diet") return;
    setError("");
    setEntryBaseline({ quantity: entry.quantity, nutrition: { calories: entry.calories, protein: entry.protein, carbohydrates: entry.carbohydrates, fat: entry.fat } });
    setEntryDraft({
      foodId: entry.foodId === null ? "" : String(entry.foodId),
      foodName: entry.foodName,
      quantity: String(entry.quantity),
      unit: unitChoices.includes(entry.unit as FoodUnit) ? entry.unit as FoodUnit : "g",
      timestamp: timestampToLocalInput(entry.timestamp),
      notes: entry.notes ?? "",
      nutrients: { calories: valueToInput(entry.calories), protein: valueToInput(entry.protein), carbohydrates: valueToInput(entry.carbohydrates), fat: valueToInput(entry.fat) },
    });
    setEntryEditor(entry);
  };

  const changeEntryQuantity = (value: string) => {
    setEntryDraft(current => {
      if (!entryBaseline) return { ...current, quantity: value };
      const quantity = Number(value);
      if (!Number.isFinite(quantity) || quantity <= 0) return { ...current, quantity: value };
      const scaled = scaleNutritionSnapshot(entryBaseline.nutrition, entryBaseline.quantity, quantity);
      return { ...current, quantity: value, nutrients: Object.fromEntries(NUTRIENTS.map(nutrient => [nutrient, valueToInput(scaled[nutrient])])) as Record<Nutrient, string> };
    });
  };

  const chooseFood = (id: string) => {
    const food = foods.find(item => String(item.id) === id);
    if (!food) {
      setEntryDraft(current => ({ ...current, foodId: "", foodName: "" }));
      return;
    }
    const quantity = food.referenceBasis === "per_100g" || food.referenceBasis === "per_100ml" ? "100" : String(food.servingSize);
    setEntryDraft(current => ({
      ...current,
      foodId: id,
      foodName: food.name,
      quantity,
      unit: food.servingUnit,
      nutrients: Object.fromEntries(NUTRIENTS.map(nutrient => [nutrient, valueToInput(food[nutrient])])) as Record<Nutrient, string>,
    }));
  };

  const updateEntryQuantityFromFood = (value: string) => {
    setEntryDraft(current => {
      const food = foods.find(item => String(item.id) === current.foodId);
      if (!food) return { ...current, quantity: value };
      const quantity = Number(value);
      if (!Number.isFinite(quantity) || quantity <= 0) return { ...current, quantity: value };
      const nutrition = calculateFoodNutrition({
        referenceBasis: food.referenceBasis,
        servingSize: food.servingSize,
        servingUnit: food.servingUnit,
        nutrition: { calories: food.calories, protein: food.protein, carbohydrates: food.carbohydrates, fat: food.fat },
      }, quantity, current.unit);
      return { ...current, quantity: value, nutrients: Object.fromEntries(NUTRIENTS.map(nutrient => [nutrient, valueToInput(nutrition[nutrient])])) as Record<Nutrient, string> };
    });
  };

  const saveFood = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      const unit = foodDraft.referenceBasis === "per_100g" ? "g" : foodDraft.referenceBasis === "per_100ml" ? "ml" : foodDraft.servingUnit;
      const input: DietFoodInput = {
        name: foodDraft.name,
        referenceBasis: foodDraft.referenceBasis,
        servingSize: foodDraft.referenceBasis === "per_serving" ? Number(foodDraft.servingSize) : 100,
        servingUnit: unit,
        calories: parseOptionalNumber(foodDraft.nutrients.calories, "Calories"),
        protein: parseOptionalNumber(foodDraft.nutrients.protein, "Protein"),
        carbohydrates: parseOptionalNumber(foodDraft.nutrients.carbohydrates, "Carbohydrates"),
        fat: parseOptionalNumber(foodDraft.nutrients.fat, "Fat"),
      };
      if (foodEditor === "new") await createDietFood(input);
      else if (foodEditor) await updateDietFood(foodEditor.id, input);
      setFoodEditor(null); setNotice(foodEditor === "new" ? "Food saved to your library." : "Food updated. Existing diary entries were not changed.");
      await loadFoods();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save this food."); }
    finally { setSaving(false); }
  };

  const saveEntry = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      const timestamp = new Date(entryDraft.timestamp);
      if (!Number.isFinite(timestamp.getTime())) throw new Error("Choose a valid date and time.");
      const input = {
        foodId: entryDraft.foodId ? Number(entryDraft.foodId) : null,
        foodName: entryDraft.foodName,
        quantity: parseQuantity(entryDraft.quantity),
        unit: entryDraft.unit,
        timestamp: timestamp.toISOString(),
        notes: entryDraft.notes.trim() || null,
        calories: parseOptionalNumber(entryDraft.nutrients.calories, "Calories"),
        protein: parseOptionalNumber(entryDraft.nutrients.protein, "Protein"),
        carbohydrates: parseOptionalNumber(entryDraft.nutrients.carbohydrates, "Carbohydrates"),
        fat: parseOptionalNumber(entryDraft.nutrients.fat, "Fat"),
      };
      if (entryEditor === "new") await createDietEntry(input);
      else if (entryEditor?.source === "diet") await updateDietEntry(entryEditor.id, input);
      setEntryEditor(null); setNotice(entryEditor === "new" ? "Food entry saved." : "Food entry updated.");
      setLoading(true); await loadDay();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save this food entry."); }
    finally { setSaving(false); }
  };

  const saveTargets = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      const targets: DietTargets = {
        calories: parseOptionalNumber(targetDraft.calories, "Calories target"),
        protein: parseOptionalNumber(targetDraft.protein, "Protein target"),
        carbohydrates: parseOptionalNumber(targetDraft.carbohydrates, "Carbohydrates target"),
        fat: parseOptionalNumber(targetDraft.fat, "Fat target"),
      };
      await saveDietTargets(targets);
      setTargetsEditor(false); setNotice("Daily targets saved."); setLoading(true); await loadDay();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save daily targets."); }
    finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true); setError(""); setNotice("");
    try {
      if (deleteTarget.type === "food") {
        await deleteDietFood(deleteTarget.id); setNotice("Saved food deleted. Diary entries remain unchanged."); await loadFoods();
      } else {
        await deleteDietEntry({ id: deleteTarget.id, source: deleteTarget.source ?? "legacy" });
        setNotice("Food entry deleted."); setLoading(true); await loadDay();
      }
      setDeleteTarget(null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not delete this item."); }
    finally { setSaving(false); }
  };

  const changeDateBy = (days: number) => {
    const selected = new Date(`${date}T12:00:00`);
    selected.setDate(selected.getDate() + days);
    setLoading(true); setDate(localDateValue(selected));
  };

  const openTargets = () => {
    const targets = day?.targets ?? defaultTargets();
    setTargetDraft(Object.fromEntries(NUTRIENTS.map(nutrient => [nutrient, valueToInput(targets[nutrient])])) as Record<Nutrient, string>);
    setTargetsEditor(true);
  };

  const isToday = date === localDateValue();
  const selectedFood = useMemo(() => foods.find(food => String(food.id) === entryDraft.foodId) ?? null, [foods, entryDraft.foodId]);

  return <div className="diet-page">
    <div className="diet-heading-row">
      <div className="page-heading"><div><span className="section-kicker">FOOD &amp; NUTRITION</span><h1>Diet</h1><p>Keep track of meals and daily nutrition.</p></div></div>
      <div className="diet-heading-actions"><button type="button" className="secondary-button" onClick={openTargets}><FiSettings /> Daily targets</button><button type="button" className="primary-button" onClick={openNewEntry}><FiPlus /> Log food</button></div>
    </div>
    {error && <div className="money-alert money-alert-error" role="alert"><span>{error}</span><button type="button" className="icon-button" aria-label="Dismiss error" onClick={() => setError("")}><FiX /></button></div>}
    {notice && <div className="money-alert money-alert-success" role="status"><span>{notice}</span><button type="button" className="icon-button" aria-label="Dismiss message" onClick={() => setNotice("")}><FiX /></button></div>}

    <section className="diet-date-bar" aria-label="Choose diary date">
      <div className="diet-date-nav"><button type="button" className="icon-button" aria-label="Previous day" onClick={() => changeDateBy(-1)}><FiChevronLeft /></button><label><span className="sr-only">Selected date</span><input type="date" value={date} onChange={event => { if (event.target.value) { setLoading(true); setDate(event.target.value); } }} /></label><button type="button" className="icon-button" aria-label="Next day" onClick={() => changeDateBy(1)}><FiChevronRight /></button></div>
      <div className="diet-date-label"><strong>{formatDateLabel(date)}</strong>{!isToday && <button type="button" className="clear-filters" onClick={() => { setLoading(true); setDate(localDateValue()); }}>Back to today</button>}</div>
    </section>

    <section className="diet-summary-grid" aria-label="Daily nutrition">
      {NUTRIENTS.map(nutrient => {
        const total = day?.totals[nutrient];
        const target = day?.targets[nutrient] ?? null;
        const hasEntries = Boolean(day?.entryCount);
        const known = total?.value ?? 0;
        const progress = total?.complete && target ? Math.min(100, known / target * 100) : 0;
        return <article className={`diet-nutrient-card ${nutrient === "calories" ? "diet-calories-card" : ""}`} key={nutrient}>
          <span className="diet-nutrient-label">{nutrientLabels[nutrient]}</span>
          <strong>{loading ? "Loading…" : !hasEntries ? "—" : formatNumber(known)} <small>{nutrientUnits[nutrient]}</small></strong>
          {loading ? <span className="diet-card-meta">Loading daily totals</span> : !hasEntries ? <span className="diet-card-meta">No entries for this day</span> : <>
            {total?.complete ? <span className="diet-card-meta">{target ? `Target ${formatNumber(target)} ${nutrientUnits[nutrient]}` : "Target not configured"}</span> : <span className="diet-incomplete-note">Known subtotal · incomplete</span>}
            {target && total?.complete && <><div className="diet-progress-track"><span style={{ width: `${progress}%` }} /></div><span className="diet-card-meta">{formatNumber(Math.max(0, target - known))} {nutrientUnits[nutrient]} remaining</span></>}
            {target && !total?.complete && <span className="diet-card-meta">Target progress unavailable while values are incomplete</span>}
          </>}
        </article>;
      })}
    </section>

    <section className="diet-panel money-panel">
      <div className="money-panel-heading diet-panel-heading"><div><h2>Food diary</h2><p>{loading ? "Loading entries…" : `${day?.entryCount ?? 0} ${day?.entryCount === 1 ? "entry" : "entries"} · ${formatDateLabel(date)}`}</p></div><div className="diet-tabs" role="tablist" aria-label="Diet views"><button type="button" role="tab" aria-selected={activeTab === "diary"} className={activeTab === "diary" ? "selected" : ""} onClick={() => setActiveTab("diary")}>Diary</button><button type="button" role="tab" aria-selected={activeTab === "foods"} className={activeTab === "foods" ? "selected" : ""} onClick={() => setActiveTab("foods")}>Food library <span>{foods.length}</span></button></div></div>
      {activeTab === "diary" ? <>
        {loading ? <div className="money-inline-loading" role="status">Loading diary…</div> : !day?.entries.length ? <div className="diet-empty-state"><span className="money-empty-mark"><FiActivity /></span><strong>No food logged for this day</strong><p>Add a manual entry or choose a saved food. Unknown nutrition stays marked as unavailable.</p><button type="button" className="secondary-button" onClick={openNewEntry}><FiPlus /> Log food</button></div> : <div className="diet-entry-list">{day.entries.map(entry => {
          const entryKey = `${entry.source}:${entry.id}`;
          const detailsId = `diet-entry-details-${entry.source}-${entry.id}`;
          const expanded = expandedEntryKey === entryKey;
          const calories = entry.calories === null ? "—" : `${formatNumber(entry.calories)} kcal`;
          const entryActions = entry.source === "diet" ? <><button type="button" className="icon-button" aria-label={`Edit ${entry.foodName}`} onClick={() => openEditEntry(entry)}><FiEdit2 /></button><button type="button" className="icon-button danger-icon" aria-label={`Delete ${entry.foodName}`} onClick={() => setDeleteTarget({ type: "entry", id: entry.id, source: entry.source, name: entry.foodName })}><FiTrash2 /></button></> : <span className="diet-legacy-badge">Read only</span>;
          return <article className={`diet-entry-row ${expanded ? "diet-entry-row-expanded" : ""}`} key={entryKey}>
            <div className="diet-entry-time"><strong>{formatTimestamp(entry.timestamp)}</strong><span>{entry.source === "legacy" ? "Earlier food log" : "Diet entry"}</span></div>
            <div className="diet-entry-main"><strong>{entry.foodName}</strong><span>{formatNumber(entry.quantity)} {entry.unit}{entry.notes ? ` · ${entry.notes}` : ""}</span></div>
            <div className="diet-entry-nutrients">{NUTRIENTS.map(nutrient => <span key={nutrient}><small>{nutrient === "carbohydrates" ? "Carbs" : nutrientLabels[nutrient]}</small><b>{entry[nutrient] === null ? "—" : `${formatNumber(entry[nutrient] as number)} ${nutrientUnits[nutrient]}`}</b></span>)}</div>
            <div className="diet-entry-actions">{entryActions}</div>
            <button type="button" className="diet-entry-card-toggle" aria-expanded={expanded} aria-controls={detailsId} onClick={() => setExpandedEntryKey(expanded ? null : entryKey)}>
              <span className="diet-entry-card-main"><span className="diet-entry-card-icon"><FiActivity aria-hidden="true" /></span><span className="diet-entry-card-copy"><span>{entry.source === "legacy" ? "Earlier food log" : "Food diary"} · {formatNumber(entry.quantity)} {entry.unit}</span><strong>{entry.foodName}</strong><time dateTime={entry.timestamp}>{formatTimestamp(entry.timestamp)}</time></span></span>
              <span className="diet-entry-card-side"><strong>{calories}</strong><small>{expanded ? "Hide details" : "View details"}</small></span>
            </button>
            <div id={detailsId} className="diet-entry-mobile-details" aria-label={`Nutrition details for ${entry.foodName}`}>
              <div className="diet-entry-mobile-nutrients">{NUTRIENTS.map(nutrient => <span key={nutrient}><small>{nutrient === "carbohydrates" ? "Carbs" : nutrientLabels[nutrient]}</small><b>{entry[nutrient] === null ? "—" : `${formatNumber(entry[nutrient] as number)} ${nutrientUnits[nutrient]}`}</b></span>)}</div>
              {entry.notes && <p className="diet-entry-mobile-notes">{entry.notes}</p>}
              <div className="diet-entry-mobile-actions">{entryActions}</div>
            </div>
          </article>;
        })}</div>}
        {!!day?.entries.some(entry => entry.source === "legacy") && <p className="diet-legacy-note">Earlier food logs are shown separately as read-only history. Their missing carbohydrates and fat remain unknown.</p>}
      </> : <div className="diet-food-library">
        <div className="diet-library-toolbar"><label className="search-filter"><FiSearch aria-hidden="true" /><input type="search" aria-label="Search saved foods" placeholder="Search your foods" value={foodSearch} onChange={event => { setFoodsLoading(true); setFoodSearch(event.target.value); }} /></label><button type="button" className="secondary-button" onClick={() => { setFoodDraft(blankFoodDraft()); setFoodEditor("new"); }}><FiPlus /> Add custom food</button></div>
        {foodsLoading ? <div className="money-inline-loading" role="status">Loading saved foods…</div> : foods.length === 0 ? <div className="diet-empty-state"><strong>{foodSearch ? "No foods match your search" : "Your food library is empty"}</strong><p>Save foods you use often, with only the nutrition values you know.</p>{!foodSearch && <button type="button" className="secondary-button" onClick={() => { setFoodDraft(blankFoodDraft()); setFoodEditor("new"); }}><FiPlus /> Add custom food</button>}</div> : <div className="diet-food-list">{foods.map(food => <article className="diet-food-row" key={food.id}>
          <div className="diet-food-name"><strong>{food.name}</strong><span>{food.referenceBasis === "per_100g" ? "Per 100 g" : food.referenceBasis === "per_100ml" ? "Per 100 ml" : `Per ${formatNumber(food.servingSize)} ${food.servingUnit}`}</span></div>
          <div className="diet-food-values">{NUTRIENTS.map(nutrient => <span key={nutrient}><small>{nutrient === "carbohydrates" ? "Carbs" : nutrientLabels[nutrient]}</small><b>{food[nutrient] === null ? "Unknown" : `${formatNumber(food[nutrient] as number)} ${nutrientUnits[nutrient]}`}</b></span>)}</div>
          <div className="diet-entry-actions"><button type="button" className="icon-button" aria-label={`Log ${food.name}`} onClick={() => { openNewEntry(); setEntryDraft(current => ({ ...current, foodId: String(food.id), foodName: food.name, quantity: food.referenceBasis === "per_100g" || food.referenceBasis === "per_100ml" ? "100" : String(food.servingSize), unit: food.servingUnit, nutrients: Object.fromEntries(NUTRIENTS.map(nutrient => [nutrient, valueToInput(food[nutrient])])) as Record<Nutrient, string> })); setActiveTab("diary"); }}><FiPlus /></button><button type="button" className="icon-button" aria-label={`Edit ${food.name}`} onClick={() => { setFoodDraft({ name: food.name, referenceBasis: food.referenceBasis, servingSize: String(food.servingSize), servingUnit: food.servingUnit, nutrients: Object.fromEntries(NUTRIENTS.map(nutrient => [nutrient, valueToInput(food[nutrient])])) as Record<Nutrient, string> }); setFoodEditor(food); }}><FiEdit2 /></button><button type="button" className="icon-button danger-icon" aria-label={`Delete ${food.name}`} onClick={() => setDeleteTarget({ type: "food", id: food.id, name: food.name })}><FiTrash2 /></button></div>
        </article>)}</div>}
      </div>}
    </section>

    {foodEditor && <Modal title={foodEditor === "new" ? "Add custom food" : "Edit custom food"} onClose={() => setFoodEditor(null)}><form className="money-form" onSubmit={saveFood}>
      <label>Food name<input autoFocus required maxLength={100} value={foodDraft.name} onChange={event => setFoodDraft(current => ({ ...current, name: event.target.value }))} placeholder="e.g. Homemade dal" /></label>
      <label>Nutrition reference<select value={foodDraft.referenceBasis} onChange={event => { const basis = event.target.value as FoodReferenceBasis; setFoodDraft(current => ({ ...current, referenceBasis: basis, servingSize: basis === "per_serving" ? "1" : "100", servingUnit: basis === "per_100g" ? "g" : basis === "per_100ml" ? "ml" : "serving" })); }}><option value="per_100g">Per 100 g</option><option value="per_100ml">Per 100 ml</option><option value="per_serving">Per serving or piece</option></select></label>
      <div className="diet-serving-fields"><label>Serving size<input type="number" min="0.01" step="any" required readOnly={foodDraft.referenceBasis !== "per_serving"} value={foodDraft.referenceBasis === "per_serving" ? foodDraft.servingSize : "100"} onChange={event => setFoodDraft(current => ({ ...current, servingSize: event.target.value }))} /></label><label>Unit<select disabled={foodDraft.referenceBasis !== "per_serving"} value={foodDraft.referenceBasis === "per_100g" ? "g" : foodDraft.referenceBasis === "per_100ml" ? "ml" : foodDraft.servingUnit} onChange={event => setFoodDraft(current => ({ ...current, servingUnit: event.target.value as FoodUnit }))}>{unitChoices.map(unit => <option key={unit} value={unit}>{unit}</option>)}</select></label></div>
      <div className="diet-nutrient-input-grid">{NUTRIENTS.map(nutrient => <label key={nutrient}>{nutrientLabels[nutrient]} <small>({nutrientUnits[nutrient]} per reference)</small><input type="number" min="0" step="any" value={foodDraft.nutrients[nutrient]} onChange={event => setFoodDraft(current => ({ ...current, nutrients: { ...current.nutrients, [nutrient]: event.target.value } }))} placeholder="Unknown" /></label>)}</div>
      <p className="form-help">Leave any unavailable nutrition value blank. It will remain unknown in diary totals.</p>
      {error && <p role="alert" className="form-error">{error}</p>}
      <div className="modal-actions"><button type="button" className="secondary-button" disabled={saving} onClick={() => setFoodEditor(null)}>Cancel</button><button type="submit" className="primary-button" disabled={saving}>{saving ? "Saving…" : foodEditor === "new" ? "Save food" : "Save changes"}</button></div>
    </form></Modal>}

    {entryEditor && <Modal title={entryEditor === "new" ? "Log food" : "Edit food entry"} onClose={() => setEntryEditor(null)}><form className="money-form" onSubmit={saveEntry}>
      {entryEditor === "new" && <label>Choose saved food (optional)<select value={entryDraft.foodId} onChange={event => chooseFood(event.target.value)}><option value="">Manual entry</option>{foods.map(food => <option key={food.id} value={food.id}>{food.name}</option>)}</select></label>}
      <label>Food name<input autoFocus required maxLength={100} value={entryDraft.foodName} onChange={event => setEntryDraft(current => ({ ...current, foodName: event.target.value, foodId: current.foodId }))} placeholder="What did you eat?" /></label>
      <div className="diet-serving-fields"><label>Quantity<input type="number" min="0.001" step="any" required value={entryDraft.quantity} onChange={event => entryEditor === "new" && selectedFood ? updateEntryQuantityFromFood(event.target.value) : changeEntryQuantity(event.target.value)} /></label><label>Unit<select value={entryDraft.unit} disabled={entryEditor !== "new" || Boolean(selectedFood)} onChange={event => setEntryDraft(current => ({ ...current, unit: event.target.value as FoodUnit }))}>{unitChoices.map(unit => <option key={unit} value={unit}>{unit}</option>)}</select></label></div>
      <label>Date and time<input type="datetime-local" required value={entryDraft.timestamp} onChange={event => setEntryDraft(current => ({ ...current, timestamp: event.target.value }))} /></label>
      <div className="diet-nutrient-input-grid">{NUTRIENTS.map(nutrient => <label key={nutrient}>{nutrientLabels[nutrient]} <small>({nutrientUnits[nutrient]} total)</small><input type="number" min="0" step="any" value={entryDraft.nutrients[nutrient]} onChange={event => setEntryDraft(current => ({ ...current, nutrients: { ...current.nutrients, [nutrient]: event.target.value } }))} placeholder="Unknown" /></label>)}</div>
      {entryEditor !== "new" && <p className="form-help">Changing quantity scales the saved nutrition snapshot. It does not pull new values from the food library.</p>}
      <label>Notes <span className="optional-label">Optional</span><textarea maxLength={500} value={entryDraft.notes} onChange={event => setEntryDraft(current => ({ ...current, notes: event.target.value }))} placeholder="Add a note" /></label>
      {entryEditor === "new" && <p className="form-help">Saved foods calculate values from their reference basis. Manual entries accept nutrition totals for the quantity entered.</p>}
      {error && <p role="alert" className="form-error">{error}</p>}
      <div className="modal-actions"><button type="button" className="secondary-button" disabled={saving} onClick={() => setEntryEditor(null)}>Cancel</button><button type="submit" className="primary-button" disabled={saving}>{saving ? "Saving…" : entryEditor === "new" ? "Save entry" : "Save changes"}</button></div>
    </form></Modal>}

    {targetsEditor && <Modal title="Daily nutrition targets" onClose={() => setTargetsEditor(false)}><form className="money-form" onSubmit={saveTargets}>
      <p className="form-help">Targets use the existing metrics system. Leave a target blank to keep it unchanged; only values you enter are saved.</p>
      <div className="diet-target-input-grid">{NUTRIENTS.map(nutrient => <label key={nutrient}>{nutrientLabels[nutrient]} target ({nutrientUnits[nutrient]})<input type="number" min="0.01" max="1000000" step="any" value={targetDraft[nutrient]} onChange={event => setTargetDraft(current => ({ ...current, [nutrient]: event.target.value }))} placeholder="Not configured" /></label>)}</div>
      {error && <p role="alert" className="form-error">{error}</p>}
      <div className="modal-actions"><button type="button" className="secondary-button" disabled={saving} onClick={() => setTargetsEditor(false)}>Cancel</button><button type="submit" className="primary-button" disabled={saving}>{saving ? "Saving…" : "Save targets"}</button></div>
    </form></Modal>}

    {deleteTarget && <Modal title={deleteTarget.type === "food" ? "Delete custom food?" : "Delete food entry?"} onClose={() => setDeleteTarget(null)}><div className="delete-confirm"><p>{deleteTarget.type === "food" ? `Delete “${deleteTarget.name}” from your library? Existing diary entries keep their recorded nutrition.` : `Delete the “${deleteTarget.name}” entry? This cannot be undone.`}</p>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="secondary-button" disabled={saving} onClick={() => setDeleteTarget(null)}>Keep it</button><button type="button" className="danger-button" disabled={saving} onClick={() => void confirmDelete()}>{saving ? "Deleting…" : "Delete"}</button></div></div></Modal>}
  </div>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section className="money-modal diet-modal" role="dialog" aria-modal="true" aria-labelledby="diet-modal-title"><div className="modal-heading"><h2 id="diet-modal-title">{title}</h2><button type="button" className="icon-button" aria-label="Close dialog" onClick={onClose}><FiX /></button></div>{children}</section></div>;
}

