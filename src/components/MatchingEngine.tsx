import React, { useState, useMemo } from 'react';
import { 
  Sparkles, 
  Clock, 
  Users, 
  Check, 
  Plus, 
  X, 
  ShoppingCart, 
  RotateCcw, 
  ChefHat, 
  ArrowRight,
  SlidersHorizontal,
  Flame,
  AlertCircle
} from 'lucide-react';
import { Recipe, getRankedRecipes } from '../utils/recipeMatcher.ts';
import { INITIAL_RECIPES, COMMON_PANTRY_INGREDIENTS } from '../data/recipesData.ts';

interface MatchingEngineProps {
  onOpenRecipeModal: (recipe: Recipe) => void;
  onOpenAiGenerator: (ingredients: string[], time: number, servings: number, preference: string) => void;
  shoppingList: string[];
  onToggleShoppingItem: (item: string) => void;
}

export const MatchingEngine: React.FC<MatchingEngineProps> = ({
  onOpenRecipeModal,
  onOpenAiGenerator,
  shoppingList,
  onToggleShoppingItem,
}) => {
  // Selected ingredient names
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>(
    COMMON_PANTRY_INGREDIENTS.filter(item => item.defaultSelected).map(item => item.name)
  );

  // Custom user ingredients added on the fly
  const [customInput, setCustomInput] = useState('');

  // Filters
  const [maxTime, setMaxTime] = useState<number>(0); // 0 = Any time
  const [servings, setServings] = useState<number>(2);
  const [preference, setPreference] = useState<string>('Todas');

  // Toggle selection
  const toggleIngredient = (name: string) => {
    setSelectedIngredients(prev =>
      prev.includes(name) ? prev.filter(item => item !== name) : [...prev, name]
    );
  };

  // Add custom ingredient
  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customInput.trim();
    if (!trimmed) return;
    if (!selectedIngredients.includes(trimmed)) {
      setSelectedIngredients(prev => [...prev, trimmed]);
    }
    setCustomInput('');
  };

  // Reset to default selection
  const handleReset = () => {
    setSelectedIngredients(
      COMMON_PANTRY_INGREDIENTS.filter(item => item.defaultSelected).map(item => item.name)
    );
    setMaxTime(0);
    setServings(2);
    setPreference('Todas');
  };

  // Ranked recipes calculation
  const rankedResults = useMemo(() => {
    return getRankedRecipes(INITIAL_RECIPES, selectedIngredients, maxTime, servings, preference);
  }, [selectedIngredients, maxTime, servings, preference]);

  return (
    <section id="asistente" className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-pink-950/80 border border-pink-700/40 text-pink-300 text-xs font-semibold mb-3">
          <Flame className="w-3.5 h-3.5 text-rose-400" />
          <span>Demostrador Interactivo</span>
        </div>
        <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight mb-3">
          Prueba el Motor de Coincidencia de CociFlex
        </h2>
        <p className="text-xs sm:text-sm text-zinc-300 max-w-2xl mx-auto">
          Selecciona lo que tienes en tu refrigerador o alacena ahora mismo y observa cómo calcula en tiempo real 
          las recetas más compatibles y los insumos faltantes:
        </p>
      </div>

      {/* Main Grid: Inputs on Left (4 cols) & Results on Right (8 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Pantry & Selectors */}
        <div className="lg:col-span-5 bg-[#1a0a20]/95 border border-pink-900/50 rounded-3xl p-6 shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between pb-4 border-b border-pink-950">
            <h3 className="text-xs font-extrabold text-pink-400 uppercase tracking-wider flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4" />
              1. Marca los ingredientes que tienes en casa:
            </h3>
            <span className="text-[11px] font-bold text-zinc-400 bg-pink-950 px-2.5 py-0.5 rounded-full border border-pink-900/60">
              {selectedIngredients.length} activos
            </span>
          </div>

          {/* Interactive Tag Chips */}
          <div className="flex flex-wrap gap-2 my-5">
            {COMMON_PANTRY_INGREDIENTS.map(item => {
              const isSelected = selectedIngredients.includes(item.name);
              return (
                <button
                  key={item.id}
                  onClick={() => toggleIngredient(item.name)}
                  className={`cursor-pointer px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 flex items-center gap-1.5 border ${
                    isSelected
                      ? 'bg-pink-600 text-white border-pink-500 shadow-md shadow-pink-950'
                      : 'bg-[#120716] text-zinc-300 border-pink-950 hover:border-pink-800 hover:text-white'
                  }`}
                  aria-pressed={isSelected}
                >
                  <span>{item.name}</span>
                  {isSelected ? (
                    <Check className="w-3.5 h-3.5 text-white" />
                  ) : (
                    <Plus className="w-3.5 h-3.5 text-zinc-500" />
                  )}
                </button>
              );
            })}

            {/* Custom Ingredients added by user */}
            {selectedIngredients
              .filter(name => !COMMON_PANTRY_INGREDIENTS.some(item => item.name === name))
              .map(name => (
                <button
                  key={name}
                  onClick={() => toggleIngredient(name)}
                  className="cursor-pointer px-3 py-1.5 rounded-full text-xs font-semibold bg-rose-700 text-white border border-rose-500 shadow-sm flex items-center gap-1.5"
                >
                  <span>{name}</span>
                  <X className="w-3.5 h-3.5" />
                </button>
              ))}
          </div>

          {/* Custom ingredient input form */}
          <form onSubmit={handleAddCustom} className="flex gap-2 mb-6">
            <input
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder="¿Tienes otro ingrediente? Ej: Cilantro, Papas..."
              className="flex-1 bg-[#120716] border border-pink-950 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-pink-500"
            />
            <button
              type="submit"
              className="cursor-pointer px-4 py-2 bg-pink-700/60 hover:bg-pink-600 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1 border border-pink-600/40"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Agregar</span>
            </button>
          </form>

          {/* Filter Selectors matching Video */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-pink-950 text-xs">
            {/* Tiempo Máximo */}
            <div>
              <label htmlFor="max-time-select" className="block text-[11px] font-bold text-pink-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-pink-400" />
                Tiempo Máximo
              </label>
              <select
                id="max-time-select"
                value={maxTime}
                onChange={(e) => setMaxTime(Number(e.target.value))}
                className="w-full bg-[#120716] border border-pink-900/60 rounded-xl px-3 py-2 text-zinc-200 text-xs focus:outline-none focus:border-pink-500"
              >
                <option value={0}>Cualquier tiempo</option>
                <option value={15}>Máximo 15 minutos (Exprés)</option>
                <option value={25}>Máximo 25 minutos</option>
                <option value={35}>Máximo 35 minutos</option>
                <option value={60}>Máximo 60 minutos</option>
              </select>
            </div>

            {/* Comensales */}
            <div>
              <label htmlFor="servings-select" className="block text-[11px] font-bold text-pink-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-pink-400" />
                Comensales
              </label>
              <select
                id="servings-select"
                value={servings}
                onChange={(e) => setServings(Number(e.target.value))}
                className="w-full bg-[#120716] border border-pink-900/60 rounded-xl px-3 py-2 text-zinc-200 text-xs focus:outline-none focus:border-pink-500"
              >
                <option value={1}>1 persona (Individual)</option>
                <option value={2}>2 personas</option>
                <option value={4}>4 personas (Familiar)</option>
                <option value={6}>6 personas</option>
              </select>
            </div>
          </div>

          {/* Preferencia Gastronómica */}
          <div className="mt-4">
            <label htmlFor="preference-select" className="block text-[11px] font-bold text-pink-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <ChefHat className="w-3.5 h-3.5 text-pink-400" />
              Preferencia Culinaria
            </label>
            <select
              id="preference-select"
              value={preference}
              onChange={(e) => setPreference(e.target.value)}
              className="w-full bg-[#120716] border border-pink-900/60 rounded-xl px-3 py-2 text-zinc-200 text-xs focus:outline-none focus:border-pink-500"
            >
              <option value="Todas">Todas las categorías</option>
              <option value="Tradicional Mexicana">Tradicional Mexicana</option>
              <option value="Desayuno">Desayuno</option>
              <option value="Comida">Comida / Almuerzo</option>
              <option value="Cena">Cena Ligera</option>
              <option value="Sopa y Caldo">Sopas y Caldos</option>
              <option value="Fermentación y Bioartesanal">Bioartesanal & Fermentos</option>
            </select>
          </div>

          {/* Reset and AI Generator Action Buttons */}
          <div className="mt-6 pt-4 border-t border-pink-950 flex flex-col gap-2.5">
            <button
              onClick={() => onOpenAiGenerator(selectedIngredients, maxTime, servings, preference)}
              className="cursor-pointer w-full py-3 px-4 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-pink-600 via-rose-500 to-amber-500 hover:brightness-110 shadow-lg shadow-pink-950 flex items-center justify-center gap-2 transition-all"
            >
              <Sparkles className="w-4 h-4 text-amber-200" />
              <span>Generar Nueva Receta con IA (Gemini 3.8)</span>
            </button>

            <button
              onClick={handleReset}
              className="cursor-pointer w-full py-2 px-3 rounded-xl text-[11px] font-semibold text-zinc-400 hover:text-white bg-transparent hover:bg-white/5 border border-pink-950 transition-colors flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Restablecer ingredientes predeterminados</span>
            </button>
          </div>
        </div>

        {/* Right Column: Recommendations List */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <ChefHat className="w-4 h-4 text-pink-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Recetas recomendadas por compatibilidad:
              </h3>
            </div>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-pink-950/80 text-pink-300 border border-pink-800/40">
              {rankedResults.length} opciones
            </span>
          </div>

          {/* Recipe Cards List */}
          <div className="space-y-4">
            {rankedResults.map(({ recipe, matchPercentage, matchedIngredients, missingIngredients }) => {
              const isFullMatch = matchPercentage === 100;
              const isHighMatch = matchPercentage >= 70;

              return (
                <div
                  key={recipe.id}
                  className={`relative rounded-3xl p-5 sm:p-6 transition-all border ${
                    isFullMatch
                      ? 'bg-[#200d27] border-pink-500/70 shadow-lg shadow-pink-950/50 ring-1 ring-pink-500/30'
                      : 'bg-[#18081e] border-pink-950 hover:border-pink-900/60'
                  }`}
                >
                  {/* Top Header of Card */}
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-rose-400">
                          {recipe.mealType}
                        </span>
                        <span className="text-zinc-600">•</span>
                        <span className="text-[10px] text-zinc-400 font-medium">
                          {recipe.category}
                        </span>
                      </div>
                      <h4 className="text-lg font-bold text-white hover:text-pink-300 transition-colors">
                        {recipe.title}
                      </h4>
                    </div>

                    {/* Match Badge */}
                    <div className="text-right shrink-0">
                      <div
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black tracking-wide ${
                          isFullMatch
                            ? 'bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-md shadow-emerald-950'
                            : isHighMatch
                            ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white'
                            : 'bg-zinc-800 text-zinc-300'
                        }`}
                      >
                        <span>{matchPercentage}% Match</span>
                      </div>
                      <p className="text-[10px] text-zinc-400 mt-0.5 font-medium">
                        {missingIngredients.length === 0
                          ? '0 faltantes'
                          : `${missingIngredients.length} ingrediente${missingIngredients.length > 1 ? 's' : ''} faltante${missingIngredients.length > 1 ? 's' : ''}`}
                      </p>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-zinc-300 leading-relaxed mb-4">
                    {recipe.description}
                  </p>

                  {/* Matching Ingredients Visual Breakdown */}
                  <div className="space-y-2 mb-4 bg-[#110515]/70 p-3 rounded-2xl border border-pink-950">
                    {/* Ingredients You Have */}
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mr-1">
                        Tienes ({matchedIngredients.length}):
                      </span>
                      {matchedIngredients.map(ing => (
                        <span
                          key={ing}
                          className="px-2 py-0.5 rounded-full bg-emerald-950/70 border border-emerald-800/40 text-emerald-300 text-[11px] font-medium flex items-center gap-1"
                        >
                          <Check className="w-3 h-3 text-emerald-400" />
                          {ing}
                        </span>
                      ))}
                    </div>

                    {/* Missing Ingredients */}
                    {missingIngredients.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 text-xs pt-1.5 border-t border-pink-950/60">
                        <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider mr-1">
                          Te falta ({missingIngredients.length}):
                        </span>
                        {missingIngredients.map(ing => {
                          const inShopping = shoppingList.includes(ing.name);
                          return (
                            <button
                              key={ing.name}
                              onClick={() => onToggleShoppingItem(ing.name)}
                              className={`cursor-pointer px-2 py-0.5 rounded-full text-[11px] font-medium transition-all flex items-center gap-1 border ${
                                inShopping
                                  ? 'bg-pink-700 text-white border-pink-500'
                                  : 'bg-rose-950/40 text-rose-300 border-rose-900/40 hover:bg-rose-900/60'
                              }`}
                              title={inShopping ? 'En tu lista de mandado' : 'Click para agregar a lista de mandado'}
                            >
                              <AlertCircle className="w-3 h-3 text-rose-400" />
                              <span>{ing.name}</span>
                              <ShoppingCart className={`w-2.5 h-2.5 ${inShopping ? 'text-white' : 'text-rose-400'}`} />
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Bottom Meta & Action Button */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <div className="flex items-center gap-4 text-xs text-zinc-400">
                      <span className="flex items-center gap-1 font-medium">
                        <Clock className="w-3.5 h-3.5 text-pink-400" />
                        {recipe.prepTimeMinutes + recipe.cookTimeMinutes} min
                      </span>
                      <span className="flex items-center gap-1 font-medium">
                        <Users className="w-3.5 h-3.5 text-pink-400" />
                        {recipe.servings} porciones
                      </span>
                      <span className="hidden sm:inline text-pink-300 font-semibold text-[11px]">
                        ★ 4.9 ({recipe.validationsCount} validaciones)
                      </span>
                    </div>

                    <button
                      onClick={() => onOpenRecipeModal(recipe)}
                      className="cursor-pointer px-4 py-2 rounded-xl text-xs font-bold text-white bg-pink-600/80 hover:bg-pink-600 transition-colors flex items-center gap-1.5 shadow-sm"
                    >
                      <span>Ver Guía Paso a Paso</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
