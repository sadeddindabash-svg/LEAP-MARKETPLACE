import { useCallback, useEffect, useRef, useState } from "react";
import { fetchBrands, fetchModelsForBrand, fetchGenerationsForModel } from "./auth";
import { yearsWithin } from "./vehicleLabels";

/**
 * The vehicle picker's state, shared by "Add product" and "Bulk upload": Brand, then Model, then Year.
 *   - a Year entry added through the admin's Vehicle Data holds ONE year, so choosing it also chooses the year;
 *   - an older entry (a name with a range of years) asks "Which year?" within its range;
 *   - the result for the product is always { generationId, year } (the same shape the server has always taken; engine and transmission are not asked any more).
 * `initialGenerationId` / `initialYear` are for a vehicle that is already decided (a buyer's quote request): the picker is not used then.
 */
export function useVehicleCascade({ initialGenerationId = "", initialYear = "", onError } = {}) {
  // The newest onError is always used, without making the effect below re-run when the caller passes a new function.
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const report = useCallback((e) => { if (onErrorRef.current) onErrorRef.current(e.message); }, []);
  const [brands, setBrands] = useState([]);
  const [selectedBrandId, setSelectedBrandId] = useState("");
  const [models, setModels] = useState([]);
  const [selectedModelId, setSelectedModelId] = useState("");
  const [years, setYears] = useState([]);                       // the model's year entries, newest first (the server sorts them)
  const [selectedGenerationId, setSelectedGenerationId] = useState(initialGenerationId || "");
  const [selectedYear, setSelectedYear] = useState(initialYear ? String(initialYear) : "");

  useEffect(() => { fetchBrands().then(setBrands).catch(report); }, [report]);

  const chooseBrand = async (brandId) => {
    setSelectedBrandId(brandId);
    setSelectedModelId(""); setModels([]);
    setSelectedGenerationId(""); setYears([]); setSelectedYear("");
    if (!brandId) return;
    try { setModels(await fetchModelsForBrand(brandId)); } catch (e) { report(e); }
  };
  const chooseModel = async (modelId) => {
    setSelectedModelId(modelId);
    setSelectedGenerationId(""); setYears([]); setSelectedYear("");
    if (!modelId) return;
    try { setYears(await fetchGenerationsForModel(modelId)); } catch (e) { report(e); }
  };
  const chooseYearEntry = (generationId) => {
    setSelectedGenerationId(generationId);
    const entry = years.find((g) => g.id === generationId);
    const choices = entry ? yearsWithin(entry) : [];
    setSelectedYear(choices.length === 1 ? String(choices[0]) : "");      // a one-year entry decides the year; an older entry asks
  };

  const selectedBrand = brands.find((b) => b.id === selectedBrandId);
  const selectedModel = models.find((m) => m.id === selectedModelId);
  const selectedGeneration = years.find((g) => g.id === selectedGenerationId);
  const yearChoices = selectedGeneration ? yearsWithin(selectedGeneration) : [];

  return {
    brands, models, years,
    selectedBrandId, selectedModelId, selectedGenerationId, selectedYear, setSelectedYear,
    selectedBrand, selectedModel, selectedGeneration, yearChoices, needsYearChoice: yearChoices.length > 1,
    chooseBrand, chooseModel, chooseYearEntry,
    isComplete: Boolean(selectedGenerationId && selectedYear),
  };
}
