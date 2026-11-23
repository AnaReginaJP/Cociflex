import React, { useState, useMemo } from 'react';
import { 
  Home, 
  UtensilsCrossed, 
  FlaskConical, 
  Users2, 
  ShoppingCart, 
  Sparkles, 
  Clock, 
  Users, 
  Check, 
  Plus, 
  X, 
  Search, 
  ChevronRight, 
  AlertCircle, 
  Flame, 
  ShieldCheck, 
  Trophy, 
  Lightbulb, 
  Share2, 
  SlidersHorizontal,
  RotateCcw,
  Camera,
  Play,
  Heart,
  Star,
  User,
  Leaf
} from 'lucide-react';
import { Recipe, getRankedRecipes } from '../../utils/recipeMatcher.ts';
import { INITIAL_RECIPES, COMMON_PANTRY_INGREDIENTS } from '../../data/recipesData.ts';
import { FERMENTATION_GUIDES } from '../../data/fermentationData.ts';
import { INITIAL_COMMUNITY_RECIPES, INNOVATION_CHALLENGES, CommunityRecipe } from '../../data/communityData.ts';
import { UserProfileData } from '../UserProfileModal.tsx';
import { LocalAiFermentationAssistant } from './LocalAiFermentationAssistant.tsx';

interface MobileAppViewProps {
  onOpenRecipeModal: (recipe: Recipe) => void;
  onOpenAiGenerator: (ingredients: string[], time: number, servings: number, preference: string) => void;
  shoppingList: string[];
  onToggleShoppingItem: (item: string) => void;
  onClearShoppingList: () => void;
  onOpenPilotModal: () => void;
  onOpenProfileModal: () => void;
  userProfile: UserProfileData;
}

type MobileTab = 'inicio' | 'cocina' | 'fermentos' | 'comunidad' | 'mandado';

export const MobileAppView: React.FC<MobileAppViewProps> = ({
  onOpenRecipeModal,
  onOpenAiGenerator,
  shoppingList,
  onToggleShoppingItem,
  onClearShoppingList,
  onOpenPilotModal,
  onOpenProfileModal,
  userProfile,
}) => {
  const [activeTab, setActiveTab] = useState<MobileTab>('inicio');

  // Search and filter state for "Inicio" tab (Point 3 from PDF)
  const [homeSearchQuery, setHomeSearchQuery] = useState('');
  const [homeSelectedCategory, setHomeSelectedCategory] = useState('Todas');

  // Pantry state for "Cocina" tab (Point 4 from PDF - more variety)
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>(
    COMMON_PANTRY_INGREDIENTS.filter(i => i.defaultSelected).map(i => i.name)
  );
  const [customInput, setCustomInput] = useState('');
  const [activePantryCategory, setActivePantryCategory] = useState<string>('todos');

  // Filters for kitchen
  const [maxTime, setMaxTime] = useState<number>(0);
  const [servings, setServings] = useState<number>(2);
  const [preference, setPreference] = useState<string>('Todas');

  // Community state
  const [communityRecipes, setCommunityRecipes] = useState<CommunityRecipe[]>(INITIAL_COMMUNITY_RECIPES);
  const [communitySearch, setCommunitySearch] = useState('');
  const [notification, setNotification] = useState<string | null>(null);

  // Active fermentation guide
  const [selectedGuideId, setSelectedGuideId] = useState<string>(FERMENTATION_GUIDES[0].id);
  const activeGuide = FERMENTATION_GUIDES.find(g => g.id === selectedGuideId) || FERMENTATION_GUIDES[0];

  // Fermentation test simulator
  const [testTemp, setTestTemp] = useState<number>(activeGuide.targetTempC);
  const [testPh, setTestPh] = useState<number>(
    Math.round(((activeGuide.phTargetMin + activeGuide.phTargetMax) / 2) * 10) / 10
  );

  const toggleIngredient = (name: string) => {
    setSelectedIngredients(prev =>
      prev.includes(name) ? prev.filter(i => i !== name) : [...prev, name]
    );
  };

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customInput.trim();
    if (!trimmed) return;
    if (!selectedIngredients.includes(trimmed)) {
      setSelectedIngredients(prev => [...prev, trimmed]);
    }
    setCustomInput('');
  };

  // Ranked recipes calculation for "Cocina" tab
  const rankedResults = useMemo(() => {
    return getRankedRecipes(INITIAL_RECIPES, selectedIngredients, maxTime, servings, preference);
  }, [selectedIngredients, maxTime, servings, preference]);

  // Filtered available recipes for "Inicio" tab (Point 3 from PDF)
  const filteredHomeRecipes = useMemo(() => {
    return INITIAL_RECIPES.filter(recipe => {
      // Category filter
      if (homeSelectedCategory !== 'Todas') {
        if (homeSelectedCategory === 'Rápidas' && (recipe.prepTimeMinutes + recipe.cookTimeMinutes) > 20) {
          return false;
        }
        if (homeSelectedCategory === 'Postres' && recipe.category !== 'Postres' && recipe.mealType !== 'Postre') {
          return false;
        }
        if (homeSelectedCategory === 'Vegetarianas' && recipe.category !== 'Vegetarianas' && !recipe.ingredients.every(i => !i.name.includes('Pollo') && !i.name.includes('Carne'))) {
          return false;
        }
        if (homeSelectedCategory === 'Niños' && recipe.difficulty !== 'Fácil' && (recipe.prepTimeMinutes + recipe.cookTimeMinutes) > 30) {
          return false;
        }
        if (homeSelectedCategory === 'Populares' && recipe.validationsCount < 45) {
          return false;
        }
        if (homeSelectedCategory === 'Desayunos' && recipe.mealType !== 'Desayuno') {
          return false;
        }
      }

      // Dietary preference filter from user profile (Point 2)
      if (userProfile.dietaryPreference === 'Vegetariano') {
        const hasMeat = recipe.ingredients.some(i => 
          i.name.toLowerCase().includes('pollo') || 
          i.name.toLowerCase().includes('carne') || 
          i.name.toLowerCase().includes('jamón') || 
          i.name.toLowerCase().includes('atún')
        );
        if (hasMeat) return false;
      } else if (userProfile.dietaryPreference === 'Vegano') {
        const hasAnimal = recipe.ingredients.some(i => 
          i.name.toLowerCase().includes('pollo') || 
          i.name.toLowerCase().includes('carne') || 
          i.name.toLowerCase().includes('huevo') || 
          i.name.toLowerCase().includes('leche') || 
          i.name.toLowerCase().includes('queso') || 
          i.name.toLowerCase().includes('crema') || 
          i.name.toLowerCase().includes('mantequilla')
        );
        if (hasAnimal) return false;
      }

      // Search query filter
      if (!homeSearchQuery.trim()) return true;
      const q = homeSearchQuery.toLowerCase().trim();
      return (
        recipe.title.toLowerCase().includes(q) ||
        recipe.description.toLowerCase().includes(q) ||
        recipe.category.toLowerCase().includes(q) ||
        recipe.ingredients.some(ing => ing.name.toLowerCase().includes(q))
      );
    });
  }, [homeSearchQuery, homeSelectedCategory, userProfile.dietaryPreference]);

  const handleValidateCommunityRecipe = (recipeId: string) => {
    setCommunityRecipes(prev =>
      prev.map(r => {
        if (r.id === recipeId) {
          const newCount = r.validationsCount + 1;
          return {
            ...r,
            validationsCount: newCount,
            isValidated: newCount >= 3,
            validatedBy: [...r.validatedBy, `${userProfile.name || 'Tú'} (Verificado)`],
            likes: r.likes + 1,
          };
        }
        return r;
      })
    );
    setNotification('¡Validación registrada desde tu móvil! +1 a la certificación técnica.');
    setTimeout(() => setNotification(null), 3500);
  };

  // Pantry categories
  const pantryCategoryOptions = [
    { id: 'todos', label: 'Todos' },
    { id: 'verdura', label: 'Verduras' },
    { id: 'proteina', label: 'Proteínas' },
    { id: 'grano', label: 'Granos / Cereales' },
    { id: 'lacteo', label: 'Lácteos' },
    { id: 'condimento', label: 'Despensa / Especias' },
  ];

  const filteredPantryIngredients = useMemo(() => {
    if (activePantryCategory === 'todos') return COMMON_PANTRY_INGREDIENTS;
    return COMMON_PANTRY_INGREDIENTS.filter(item => item.category === activePantryCategory);
  }, [activePantryCategory]);

  return (
    <div className="flex flex-col min-h-screen bg-[#FFF8F6] text-[#33252A] w-full select-none font-sans">
      {/* Mobile Top App Bar (Pastel theme, New Logo, Profile customization button) */}
      <header className="sticky top-0 z-40 bg-[#FFF8F6]/95 backdrop-blur-md border-b border-[#FED7CD] px-4 py-3 flex items-center justify-between shadow-xs">
        {/* Brand Logo - New Pastel Cociflex Typography & Icon (Point 1 from PDF) */}
        <div 
          onClick={() => setActiveTab('inicio')}
          className="flex items-center gap-2.5 cursor-pointer group"
        >
          <div className="w-9 h-9 rounded-2xl bg-white border border-[#FED7CD] p-1 shadow-xs flex items-center justify-center overflow-hidden shrink-0">
            <img
              src="/assets/aistudio/logo_89042ff1.png"
              alt="Cociflex Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <div className="flex items-center leading-none">
              <span className="font-black text-xl tracking-tight text-[#FF7262]">
                Cociflex
              </span>
            </div>
            <p className="text-[10px] text-[#8C7E85] font-semibold tracking-wide">Asistente Culinario</p>
          </div>
        </div>

        {/* Quick Actions in Mobile Header */}
        <div className="flex items-center gap-2">
          {/* Quick AI Recipe Generator button */}
          <button
            onClick={() => onOpenAiGenerator(selectedIngredients, maxTime || 25, servings, preference)}
            className="cursor-pointer text-[11px] font-bold px-3 py-1.5 rounded-2xl bg-gradient-to-r from-[#FF7B72] to-[#FA7268] text-white shadow-sm shadow-[#FF7B72]/30 flex items-center gap-1.5 active:scale-95 transition-all hover:brightness-105"
            title="Crear receta personalizada con IA"
          >
            <Sparkles className="w-3.5 h-3.5 text-white/90" />
            <span className="hidden xs:inline">Crear con IA</span>
          </button>

          {/* User Profile / Personalization Button (Point 6 from PDF: Cambiar carrito por personalizar perfil) */}
          <button
            onClick={onOpenProfileModal}
            className="cursor-pointer relative p-2 rounded-2xl bg-white border border-[#FED7CD] text-[#7D6F76] hover:text-[#FF7262] hover:border-[#FF8A80] active:scale-95 transition-all shadow-xs flex items-center justify-center"
            title="Personalizar tu perfil y preferencias dietéticas"
            aria-label="Personalizar tu perfil"
          >
            {userProfile.isLoggedIn && userProfile.name ? (
              <div className="w-5 h-5 rounded-full bg-[#FFE5DE] text-[#FF7262] flex items-center justify-center text-[11px] font-black">
                {userProfile.name[0].toUpperCase()}
              </div>
            ) : (
              <User className="w-5 h-5 text-[#FF7262]" />
            )}

            {/* Dietary Badge Indicator */}
            {userProfile.dietaryPreference && userProfile.dietaryPreference !== 'Omnívoro' && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#34D399] text-white text-[9px] font-black flex items-center justify-center shadow-xs">
                {userProfile.dietaryPreference === 'Vegano' ? '🌱' : '🥑'}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Floating Notification */}
      {notification && (
        <div className="fixed top-16 left-4 right-4 z-50 max-w-sm mx-auto p-3 rounded-2xl bg-[#E8F8F0] border border-[#A7F3D0] text-[#1E7E50] text-xs font-semibold flex items-center gap-2 shadow-lg animate-in slide-in-from-top">
          <ShieldCheck className="w-4 h-4 text-[#10B981] shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Main Tab Screen Content Area */}
      <main className="flex-1 overflow-y-auto pb-24 px-4 pt-3">
        {/* ===================== TAB 1: INICIO (Busqueda y Recetas Disponibles - Punto 3 PDF) ===================== */}
        {activeTab === 'inicio' && (
          <div className="space-y-4 animate-in fade-in">
            {/* Search Bar (Point 3 from PDF) */}
            <div className="relative">
              <Search className="w-4 h-4 text-[#A6979D] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={homeSearchQuery}
                onChange={(e) => setHomeSearchQuery(e.target.value)}
                placeholder="Buscar recetas por nombre, ingrediente..."
                className="w-full bg-white border border-[#FED7CD] focus:border-[#FF7262] rounded-2xl pl-10 pr-9 py-2.5 text-xs text-[#33252A] placeholder-[#B5A7AC] focus:outline-none transition-colors shadow-xs"
              />
              {homeSearchQuery && (
                <button
                  onClick={() => setHomeSearchQuery('')}
                  className="cursor-pointer absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#A6979D] hover:text-[#33252A]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Category Filter Pills (Point 3 from PDF) */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
              {['Todas', 'Populares', 'Rápidas', 'Postres', 'Niños', 'Vegetarianas', 'Desayunos'].map((cat) => {
                const isSelected = homeSelectedCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setHomeSelectedCategory(cat)}
                    className={`cursor-pointer px-3.5 py-1.5 rounded-2xl font-bold whitespace-nowrap text-xs transition-all ${
                      isSelected
                        ? 'bg-[#FF7262] text-white shadow-xs'
                        : 'bg-white text-[#7D6F76] border border-[#FED7CD] hover:border-[#FF8A80]'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>

            {/* Active User Dietary Specification Pill if set */}
            {userProfile.dietaryPreference && userProfile.dietaryPreference !== 'Omnívoro' && (
              <div className="p-2.5 rounded-2xl bg-[#E8F8F0] border border-[#A7F3D0] flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-[#1E7E50]">
                  <Leaf className="w-3.5 h-3.5" />
                  <span className="font-bold">Filtro activo: {userProfile.dietaryPreference}</span>
                </div>
                <button
                  onClick={onOpenProfileModal}
                  className="cursor-pointer text-[10px] text-[#1E7E50] underline font-semibold"
                >
                  Modificar
                </button>
              </div>
            )}

            {/* Section Header: Recetas Disponibles / Populares (Point 3 from PDF) */}
            <div className="flex items-center justify-between pt-1">
              <div>
                <h3 className="text-sm font-black text-[#33252A]">
                  {homeSearchQuery ? 'Resultados de Búsqueda' : 'Recetas Populares & Disponibles'}
                </h3>
                <p className="text-[11px] text-[#8C7E85]">
                  {filteredHomeRecipes.length} recetas listas con ingredientes de casa
                </p>
              </div>
              <button
                onClick={() => setActiveTab('cocina')}
                className="cursor-pointer text-xs font-bold text-[#FF7262] hover:underline flex items-center gap-0.5"
              >
                <span>Tu alacena</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Grid of Available Recipes (Matches PDF Screenshot: Pastel de Zanahoria, Arroz con Pollo, etc.) */}
            <div className="grid grid-cols-2 gap-3">
              {filteredHomeRecipes.map((recipe) => (
                <div
                  key={recipe.id}
                  onClick={() => onOpenRecipeModal(recipe)}
                  className="cursor-pointer bg-white border border-[#FED7CD] rounded-3xl overflow-hidden shadow-xs hover:border-[#FF8A80] hover:shadow-md transition-all flex flex-col group"
                >
                  {/* Recipe Image with Rating Pill */}
                  <div className="relative h-28 w-full overflow-hidden bg-[#FFEAE4]">
                    <img
                      src={recipe.imageUrl}
                      alt={recipe.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-white/95 backdrop-blur-xs text-[#33252A] text-[10px] font-bold flex items-center gap-1 shadow-xs">
                      <Star className="w-3 h-3 text-[#F59E0B] fill-[#F59E0B]" />
                      <span>{recipe.id === 'pastel-de-zanahoria' ? '4.7' : '4.9'}</span>
                    </div>

                    <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-[#FF7262]/90 text-white text-[9px] font-bold backdrop-blur-xs">
                      {recipe.prepTimeMinutes + recipe.cookTimeMinutes} min
                    </div>
                  </div>

                  {/* Card Info */}
                  <div className="p-3 flex-1 flex flex-col justify-between space-y-1.5">
                    <div>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-[#A66F7B]">
                        {recipe.category}
                      </span>
                      <h4 className="text-xs font-black text-[#33252A] line-clamp-2 leading-tight">
                        {recipe.title}
                      </h4>
                    </div>

                    <div className="pt-1 border-t border-[#FED7CD]/60 flex items-center justify-between text-[10px] text-[#7D6F76]">
                      <span>{recipe.ingredients.length} insumos</span>
                      <span className="font-bold text-[#FF7262] group-hover:underline">
                        Ver receta →
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {filteredHomeRecipes.length === 0 && (
              <div className="text-center py-8 bg-white border border-[#FED7CD] rounded-3xl p-6">
                <span className="text-3xl block mb-2">🔍</span>
                <p className="text-xs font-bold text-[#33252A]">No se encontraron recetas con ese término</p>
                <p className="text-[11px] text-[#8C7E85] mt-1 mb-3">
                  Prueba buscando otro ingrediente o restablece los filtros.
                </p>
                <button
                  onClick={() => {
                    setHomeSearchQuery('');
                    setHomeSelectedCategory('Todas');
                  }}
                  className="cursor-pointer px-4 py-2 rounded-2xl bg-[#FFEFEA] text-[#FF7262] text-xs font-bold border border-[#FED7CD]"
                >
                  Restablecer búsqueda
                </button>
              </div>
            )}

            {/* Quick Action Cards Banner */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div
                onClick={() => onOpenAiGenerator(selectedIngredients, maxTime, servings, preference)}
                className="cursor-pointer bg-gradient-to-br from-[#FFEFEA] to-[#FFE4DC] border border-[#FED7CD] rounded-3xl p-3.5 flex flex-col justify-between hover:border-[#FF8A80] transition-all group"
              >
                <div className="w-8 h-8 rounded-2xl bg-white border border-[#FED7CD] flex items-center justify-center text-[#FF7262] mb-2 shadow-xs group-hover:scale-105">
                  <Sparkles className="w-4 h-4 text-[#FF7262]" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-[#33252A]">Crear con IA</h4>
                  <p className="text-[10px] text-[#7D6F76]">Recetas con tus sobras</p>
                </div>
              </div>

              <div
                onClick={() => setActiveTab('fermentos')}
                className="cursor-pointer bg-gradient-to-br from-[#EAF8F2] to-[#D5F3E5] border border-[#C2EED9] rounded-3xl p-3.5 flex flex-col justify-between hover:border-[#34D399] transition-all group"
              >
                <div className="w-8 h-8 rounded-2xl bg-white border border-[#C2EED9] flex items-center justify-center text-[#10B981] mb-2 shadow-xs group-hover:scale-105">
                  <FlaskConical className="w-4 h-4 text-[#10B981]" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-[#33252A]">Bioartesanía</h4>
                  <p className="text-[10px] text-[#7D6F76]">Quesos, Kéfir y pH</p>
                </div>
              </div>
            </div>

            {/* Club CociFlex Banner */}
            <div className="bg-[#FFF2EE] border border-[#FED7CD] rounded-3xl p-4 text-center space-y-2">
              <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#FF7262] uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-[#FF7262]" />
                <span>Club Cociflex</span>
              </div>
              <p className="text-xs text-[#5C4A51] leading-relaxed">
                Personaliza tus especificaciones de cocina y guarda tus platillos favoritos.
              </p>
              <button
                onClick={onOpenProfileModal}
                className="cursor-pointer text-xs font-bold text-[#FF7262] hover:text-[#FA7268] underline pt-0.5 block mx-auto"
              >
                {userProfile.isLoggedIn ? 'Administrar mi perfil culinario' : 'Configurar mis preferencias ahora'}
              </button>
            </div>
          </div>
        )}

        {/* ===================== TAB 2: MI COCINA / MATCHER (Punto 4 PDF: Más Variedad) ===================== */}
        {activeTab === 'cocina' && (
          <div className="space-y-4 animate-in fade-in">
            {/* Pantry Selector Box in Pastel Theme */}
            <div className="bg-white border border-[#FED7CD] rounded-3xl p-4 shadow-xs">
              <div className="flex items-center justify-between pb-2.5 border-b border-[#FED7CD]/60">
                <div className="flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-[#FF7262]" />
                  <span className="text-xs font-black text-[#33252A] uppercase tracking-wider">
                    ¿Qué tienes en tu alacena?
                  </span>
                </div>
                <span className="text-[10px] font-bold text-[#FF7262] bg-[#FFEAE4] px-2.5 py-0.5 rounded-full border border-[#FED7CD]">
                  {selectedIngredients.length} insumos
                </span>
              </div>

              {/* Category Filter for Pantry (Point 4: Más variedad) */}
              <div className="flex items-center gap-1.5 overflow-x-auto py-2 no-scrollbar text-xs">
                {pantryCategoryOptions.map((cat) => {
                  const isCatSelected = activePantryCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setActivePantryCategory(cat.id)}
                      className={`cursor-pointer px-2.5 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all ${
                        isCatSelected
                          ? 'bg-[#FF7262] text-white shadow-xs'
                          : 'bg-[#FFF8F6] text-[#7D6F76] border border-[#FED7CD]/80'
                      }`}
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>

              {/* Tag Chips with High Variety */}
              <div className="flex flex-wrap gap-1.5 my-2 max-h-48 overflow-y-auto pr-1">
                {filteredPantryIngredients.map(item => {
                  const isSelected = selectedIngredients.includes(item.name);
                  return (
                    <button
                      key={item.id}
                      onClick={() => toggleIngredient(item.name)}
                      className={`cursor-pointer px-2.5 py-1.5 rounded-2xl text-[11px] font-semibold flex items-center gap-1 transition-all ${
                        isSelected
                          ? 'bg-[#FF7262] text-white shadow-xs'
                          : 'bg-[#FFF8F6] text-[#5C4A51] border border-[#FED7CD] hover:border-[#FF8A80]'
                      }`}
                    >
                      {isSelected ? (
                        <Check className="w-3 h-3 stroke-[3]" />
                      ) : (
                        <Plus className="w-3 h-3 text-[#A6979D]" />
                      )}
                      <span>{item.name}</span>
                    </button>
                  );
                })}
              </div>

              {/* Add Custom Ingredient */}
              <form onSubmit={handleAddCustom} className="flex gap-2 mt-3 pt-2.5 border-t border-[#FED7CD]/60">
                <input
                  type="text"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  placeholder="Agregar otro ingrediente..."
                  className="flex-1 bg-[#FFF8F6] border border-[#FED7CD] rounded-2xl px-3 py-2 text-xs text-[#33252A] placeholder-[#B5A7AC] focus:outline-none focus:border-[#FF7262]"
                />
                <button
                  type="submit"
                  className="cursor-pointer px-3.5 py-2 bg-[#FF7262] text-white text-xs font-bold rounded-2xl hover:brightness-105"
                >
                  +
                </button>
              </form>

              {/* Cook Filters */}
              <div className="grid grid-cols-2 gap-2 mt-3 pt-2.5 border-t border-[#FED7CD]/60 text-xs">
                <div>
                  <span className="text-[10px] text-[#8C7E85] block font-bold uppercase mb-1">Tiempo</span>
                  <select
                    value={maxTime}
                    onChange={(e) => setMaxTime(Number(e.target.value))}
                    className="w-full bg-[#FFF8F6] border border-[#FED7CD] rounded-xl p-2 text-xs text-[#33252A] focus:outline-none"
                  >
                    <option value={0}>Cualquier tiempo</option>
                    <option value={15}>≤ 15 min (Exprés)</option>
                    <option value={25}>≤ 25 min</option>
                    <option value={35}>≤ 35 min</option>
                  </select>
                </div>

                <div>
                  <span className="text-[10px] text-[#8C7E85] block font-bold uppercase mb-1">Comensales</span>
                  <select
                    value={servings}
                    onChange={(e) => setServings(Number(e.target.value))}
                    className="w-full bg-[#FFF8F6] border border-[#FED7CD] rounded-xl p-2 text-xs text-[#33252A] focus:outline-none"
                  >
                    <option value={1}>1 persona</option>
                    <option value={2}>2 personas</option>
                    <option value={4}>4 personas</option>
                    <option value={6}>6 personas</option>
                  </select>
                </div>
              </div>

              {/* AI Trigger */}
              <button
                onClick={() => onOpenAiGenerator(selectedIngredients, maxTime, servings, preference)}
                className="cursor-pointer w-full mt-3 py-2.5 px-4 rounded-2xl font-black text-xs text-white bg-gradient-to-r from-[#FF7B72] to-[#FA7268] hover:brightness-105 flex items-center justify-center gap-1.5 shadow-md shadow-[#FF7B72]/30 active:scale-[0.98] transition-all"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Crear Receta con IA</span>
              </button>
            </div>

            {/* Match Results List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-[#33252A] uppercase tracking-wider">
                  Recetas por Coincidencia:
                </h3>
                <span className="text-[11px] text-[#8C7E85] font-semibold">
                  {rankedResults.length} encontradas
                </span>
              </div>

              {rankedResults.map(result => (
                <div
                  key={result.recipe.id}
                  className="bg-white border border-[#FED7CD] rounded-3xl p-4 shadow-xs space-y-2.5 hover:border-[#FF8A80] transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-[#A66F7B]">
                        {result.recipe.mealType}
                      </span>
                      <h4 className="text-xs font-black text-[#33252A] leading-tight">
                        {result.recipe.title}
                      </h4>
                    </div>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ${
                      result.matchPercentage >= 70
                        ? 'bg-[#E8F8F0] text-[#1E7E50] border border-[#A7F3D0]'
                        : 'bg-[#FFEFEA] text-[#FF7262] border border-[#FED7CD]'
                    }`}>
                      {result.matchPercentage}% Match
                    </span>
                  </div>

                  <p className="text-[11px] text-[#7D6F76] line-clamp-2 leading-relaxed">
                    {result.recipe.description}
                  </p>

                  {/* Missing items pill */}
                  {result.missingIngredients.length > 0 && (
                    <div className="text-[10px] text-[#7D6F76] pt-1">
                      <span className="font-bold text-[#FF7262] block mb-1">Te falta:</span>
                      <div className="flex flex-wrap gap-1">
                        {result.missingIngredients.map(item => (
                          <button
                            key={item.name}
                            onClick={() => onToggleShoppingItem(item.name)}
                            className="cursor-pointer px-2 py-0.5 rounded-full bg-[#FFF5F2] border border-[#FED7CD] text-[#5C4A51] hover:border-[#FF7262] text-[10px] flex items-center gap-1"
                            title="Toca para agregar a tu lista de mandado"
                          >
                            <Plus className="w-2.5 h-2.5 text-[#FF7262]" />
                            <span>{item.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-[#FED7CD]/60 text-xs text-[#8C7E85]">
                    <span>{result.recipe.prepTimeMinutes + result.recipe.cookTimeMinutes} min • {result.recipe.servings} p.</span>
                    <button
                      onClick={() => onOpenRecipeModal(result.recipe)}
                      className="cursor-pointer px-3.5 py-1.5 rounded-2xl bg-[#FF7262] hover:bg-[#FA7268] text-white font-bold text-[11px]"
                    >
                      Cocinar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===================== TAB 3: FERMENTOS (Pastel Style) ===================== */}
        {activeTab === 'fermentos' && (
          <div className="space-y-4 animate-in fade-in">
            <div className="bg-gradient-to-br from-[#EAF8F2] to-[#D5F3E5] border border-[#C2EED9] rounded-3xl p-4 shadow-xs">
              <span className="text-[10px] font-bold text-[#10B981] uppercase tracking-wider block mb-1">
                Ciencia de Alimentos Casera
              </span>
              <h2 className="text-base font-black text-[#264E36] mb-1">
                El Arte de la Fermentación
              </h2>
              <p className="text-xs text-[#4A6F56] leading-relaxed">
                Guías técnicas con control estricto de temperatura, pH e inocuidad microbiológica.
              </p>
            </div>
            
            {/* Local AI Fermentation Assistant (Microclimate Personalization & Sensory Triage) */}
            <LocalAiFermentationAssistant />

            {/* Technical Dossier Guides Section */}
            <div className="pt-2">
              <span className="text-[10px] font-bold text-[#8C7E85] uppercase tracking-wider block mb-2">
                Guías Técnicas Estandarizadas:
              </span>
            </div>

            {/* Fermentation Guide Selector */}
            <div className="grid grid-cols-2 gap-2">
              {FERMENTATION_GUIDES.map(guide => (
                <button
                  key={guide.id}
                  onClick={() => {
                    setSelectedGuideId(guide.id);
                    setTestTemp(guide.targetTempC);
                    setTestPh(Math.round(((guide.phTargetMin + guide.phTargetMax) / 2) * 10) / 10);
                  }}
                  className={`cursor-pointer p-3 rounded-3xl text-left border transition-all ${
                    selectedGuideId === guide.id
                      ? 'bg-white border-[#10B981] shadow-xs'
                      : 'bg-white/80 border-[#FED7CD]/60 text-[#7D6F76] hover:border-[#10B981]'
                  }`}
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#10B981] block mb-0.5">
                    {guide.category}
                  </span>
                  <h4 className="text-xs font-black text-[#33252A] leading-tight line-clamp-1">
                    {guide.name}
                  </h4>
                </button>
              ))}
            </div>

            {/* Detailed Active Guide Card */}
            <div className="bg-white border border-[#FED7CD] rounded-3xl p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#FED7CD]/60">
                <div>
                  <span className="text-[10px] font-bold text-[#10B981] uppercase">{activeGuide.category}</span>
                  <h3 className="text-xs font-black text-[#33252A]">{activeGuide.name}</h3>
                </div>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#E8F8F0] text-[#1E7E50]">
                  100% Rigor Bioartesanal
                </span>
              </div>

              {/* Critical Parameters */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-[#FFF8F6] p-2 rounded-2xl border border-[#FED7CD]/80">
                  <span className="text-[9px] text-[#8C7E85] block font-bold">Temp</span>
                  <span className="text-xs font-black text-[#FF7262] font-mono">{activeGuide.targetTempC}°C</span>
                </div>
                <div className="bg-[#FFF8F6] p-2 rounded-2xl border border-[#FED7CD]/80">
                  <span className="text-[9px] text-[#8C7E85] block font-bold">Reposo</span>
                  <span className="text-[11px] font-black text-[#33252A] line-clamp-1">{activeGuide.incubationTimeDisplay}</span>
                </div>
                <div className="bg-[#FFF8F6] p-2 rounded-2xl border border-[#FED7CD]/80">
                  <span className="text-[9px] text-[#8C7E85] block font-bold">pH</span>
                  <span className="text-xs font-black text-[#10B981] font-mono">{activeGuide.phTargetMin}-{activeGuide.phTargetMax}</span>
                </div>
              </div>

              {/* Strains */}
              <div>
                <span className="text-[10px] font-bold text-[#8C7E85] uppercase block mb-1">
                  Microbiología Estandarizada:
                </span>
                <p className="text-xs text-[#5C4A51] bg-[#FFF8F6] p-2.5 rounded-2xl border border-[#FED7CD]/60 leading-relaxed">
                  {activeGuide.microbiology}
                </p>
              </div>

              {/* Live Safety Simulator */}
              <div className="pt-2 border-t border-[#FED7CD]/60">
                <span className="text-xs font-black text-[#33252A] block mb-2">
                  Simulador de Inocuidad Casera:
                </span>
                <div className="space-y-2 text-xs">
                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-[#7D6F76]">Tu Temperatura:</span>
                      <strong className="text-[#FF7262] font-mono">{testTemp}°C</strong>
                    </div>
                    <input
                      type="range"
                      min="15"
                      max="48"
                      value={testTemp}
                      onChange={(e) => setTestTemp(Number(e.target.value))}
                      className="w-full accent-[#FF7262]"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-[#7D6F76]">Tu pH:</span>
                      <strong className="text-[#10B981] font-mono">{testPh}</strong>
                    </div>
                    <input
                      type="range"
                      min="3"
                      max="7"
                      step="0.1"
                      value={testPh}
                      onChange={(e) => setTestPh(Number(e.target.value))}
                      className="w-full accent-[#10B981]"
                    />
                  </div>
                </div>

                <div className={`mt-3 p-2.5 rounded-2xl text-[11px] font-bold flex items-center gap-1.5 ${
                  Math.abs(testTemp - activeGuide.targetTempC) <= 3 &&
                  testPh >= activeGuide.phTargetMin - 0.2 &&
                  testPh <= activeGuide.phTargetMax + 0.2
                    ? 'bg-[#E8F8F0] text-[#1E7E50] border border-[#A7F3D0]'
                    : 'bg-[#FFF2EE] text-[#E11D48] border border-[#FECDD3]'
                }`}>
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>
                    {Math.abs(testTemp - activeGuide.targetTempC) <= 3 &&
                    testPh >= activeGuide.phTargetMin - 0.2 &&
                    testPh <= activeGuide.phTargetMax + 0.2
                      ? 'Lote dentro de los rangos seguros de inocuidad.'
                      : 'Alerta: Parámetros fuera de rango seguro. Revisa temperatura o pH.'}
                  </span>
                </div>
              </div>

              {/* Preparation Steps */}
              <div className="pt-2 border-t border-[#FED7CD]/60 space-y-2">
                <span className="text-[10px] font-bold text-[#8C7E85] uppercase block">
                  Pasos de Preparación:
                </span>
                {activeGuide.steps.map((st, i) => (
                  <div key={i} className="text-xs bg-[#FFF8F6] p-2.5 rounded-2xl border border-[#FED7CD]/60">
                    <span className="font-black text-[#FF7262] block mb-0.5">{i + 1}. {st.title}</span>
                    <p className="text-[#5C4A51] leading-relaxed text-[11px]">{st.instruction}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ===================== TAB 4: COMUNIDAD (Pastel Style) ===================== */}
        {activeTab === 'comunidad' && (
          <div className="space-y-4 animate-in fade-in">
            <div className="bg-gradient-to-br from-[#FFF0EB] to-[#FFE4DC] border border-[#FED7CD] rounded-3xl p-4 shadow-xs">
              <span className="text-[10px] font-bold text-[#FF7262] uppercase tracking-wider block mb-1">
                Filtro de Calidad (3 Likes)
              </span>
              <h2 className="text-base font-black text-[#33252A] mb-1">
                Comunidad Cociflex
              </h2>
              <p className="text-xs text-[#7D6F76] leading-relaxed">
                Las recetas se certifican con 3 validaciones de cocineros que ya las probaron.
              </p>
            </div>

            {/* Sponsored Challenge Card */}
            <div className="bg-white border border-[#FED7CD] rounded-3xl p-4 shadow-xs space-y-2">
              <span className="text-[9px] font-bold text-[#FF7262] uppercase bg-[#FFEAE4] px-2 py-0.5 rounded-full">
                {INNOVATION_CHALLENGES[0].sponsor}
              </span>
              <h4 className="text-xs font-black text-[#33252A]">
                Premio: {INNOVATION_CHALLENGES[0].reward}
              </h4>
              <p className="text-[11px] text-[#7D6F76] leading-relaxed">
                {INNOVATION_CHALLENGES[0].description} {INNOVATION_CHALLENGES[0].participantsCount} cocineros inscritos.
              </p>
            </div>

            {/* Feed of Community Recipes */}
            <div className="space-y-3">
              {communityRecipes.map(item => (
                <div
                  key={item.id}
                  className="bg-white border border-[#FED7CD] rounded-3xl p-4 shadow-xs space-y-2.5"
                >
                  <div className="relative h-32 rounded-2xl overflow-hidden bg-[#FFEAE4]">
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-white/95 text-[10px] font-black text-[#1E7E50] border border-[#A7F3D0]">
                      {item.validationsCount}/3 {item.isValidated ? 'Certificada' : 'Validaciones'}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5 text-[10px] text-[#8C7E85] mb-1">
                      <span className="font-bold text-[#33252A]">{item.author}</span>
                      <span>•</span>
                      <span>{item.authorRole}</span>
                    </div>
                    <h4 className="text-xs font-black text-[#33252A]">{item.title}</h4>
                    <p className="text-[11px] text-[#7D6F76] line-clamp-2 mt-1 leading-relaxed">
                      {item.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#FED7CD]/60 text-xs">
                    <span className="text-[10px] text-[#8C7E85]">{item.ingredients.length} insumos exactos</span>
                    <button
                      onClick={() => handleValidateCommunityRecipe(item.id)}
                      className="cursor-pointer px-3 py-1.5 rounded-2xl bg-[#FFEFEA] hover:bg-[#FFEAE4] text-[#FF7262] font-bold text-[11px] border border-[#FED7CD] flex items-center gap-1 active:scale-95 transition-all"
                    >
                      <Heart className="w-3.5 h-3.5 fill-[#FF7262]" />
                      <span>Validar ({item.validationsCount})</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===================== TAB 5: MANDADO (Lista de Compras Pastel) ===================== */}
        {activeTab === 'mandado' && (
          <div className="space-y-4 animate-in fade-in">
            <div className="bg-gradient-to-br from-[#FFEFEA] to-[#FFE4DC] border border-[#FED7CD] rounded-3xl p-4 shadow-xs">
              <span className="text-[10px] font-bold text-[#FF7262] uppercase tracking-wider block mb-1">
                Alacena & Supermercado
              </span>
              <h2 className="text-base font-black text-[#33252A] mb-1">
                Lista de Mandado
              </h2>
              <p className="text-xs text-[#7D6F76] leading-relaxed">
                Insumos faltantes detectados automáticamente por el motor de recetas.
              </p>
            </div>

            {shoppingList.length === 0 ? (
              <div className="bg-white border border-[#FED7CD] rounded-3xl p-8 text-center space-y-3">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-[#FFEAE4] flex items-center justify-center text-[#FF7262]">
                  <ShoppingCart className="w-6 h-6" />
                </div>
                <h4 className="text-xs font-bold text-[#33252A]">¡No tienes insumos faltantes!</h4>
                <p className="text-[11px] text-[#8C7E85]">
                  Cuando una receta requiera ingredientes que no tienes en casa, pulsa el botón "+" para agregarlos aquí.
                </p>
                <button
                  onClick={() => setActiveTab('inicio')}
                  className="cursor-pointer px-4 py-2 rounded-2xl bg-[#FF7262] text-white text-xs font-bold shadow-xs hover:brightness-105"
                >
                  Explorar Recetas
                </button>
              </div>
            ) : (
              <div className="bg-white border border-[#FED7CD] rounded-3xl p-4 space-y-3 shadow-xs">
                <div className="flex items-center justify-between pb-2 border-b border-[#FED7CD]/60">
                  <span className="text-xs font-black text-[#33252A]">
                    {shoppingList.length} artículos por comprar
                  </span>
                  <button
                    onClick={onClearShoppingList}
                    className="cursor-pointer text-[11px] text-[#A66F7B] hover:text-[#E11D48]"
                  >
                    Limpiar todo
                  </button>
                </div>

                <div className="space-y-2">
                  {shoppingList.map(item => (
                    <div
                      key={item}
                      className="flex items-center justify-between p-2.5 rounded-2xl bg-[#FFF8F6] border border-[#FED7CD] text-xs text-[#33252A]"
                    >
                      <span className="font-semibold">{item}</span>
                      <button
                        onClick={() => onToggleShoppingItem(item)}
                        className="cursor-pointer text-[#A6979D] hover:text-[#E11D48] p-1"
                        title="Quitar"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="p-3 bg-[#FFEFEA] border border-[#FED7CD] rounded-2xl text-[11px] text-[#7D6F76] flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-[#FF7262] shrink-0" />
                  <span>Tip: Puedes tachar los ingredientes comprados con un solo toque.</span>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Persistent Mobile Bottom Navigation Bar (Pastel theme, clear active indicators) */}
      <nav className="sticky bottom-0 z-40 w-full bg-white/95 backdrop-blur-lg border-t border-[#FED7CD] px-2 py-2 flex items-center justify-around mt-auto shadow-md">
        <button
          onClick={() => setActiveTab('inicio')}
          className={`cursor-pointer flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-all ${
            activeTab === 'inicio' ? 'text-[#FF7262] font-black' : 'text-[#A6979D] hover:text-[#33252A]'
          }`}
          aria-label="Pestaña Inicio"
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px]">Inicio</span>
        </button>

        <button
          onClick={() => setActiveTab('cocina')}
          className={`cursor-pointer flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-all ${
            activeTab === 'cocina' ? 'text-[#FF7262] font-black' : 'text-[#A6979D] hover:text-[#33252A]'
          }`}
          aria-label="Pestaña Mi Cocina"
        >
          <UtensilsCrossed className="w-5 h-5" />
          <span className="text-[10px]">Cocina</span>
        </button>

        <button
          onClick={() => setActiveTab('fermentos')}
          className={`cursor-pointer flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-all ${
            activeTab === 'fermentos' ? 'text-[#FF7262] font-black' : 'text-[#A6979D] hover:text-[#33252A]'
          }`}
          aria-label="Pestaña Fermentación"
        >
          <FlaskConical className="w-5 h-5" />
          <span className="text-[10px]">Fermentos</span>
        </button>

        <button
          onClick={() => setActiveTab('comunidad')}
          className={`cursor-pointer flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-all ${
            activeTab === 'comunidad' ? 'text-[#FF7262] font-black' : 'text-[#A6979D] hover:text-[#33252A]'
          }`}
          aria-label="Pestaña Comunidad"
        >
          <Users2 className="w-5 h-5" />
          <span className="text-[10px]">Comunidad</span>
        </button>

        <button
          onClick={() => setActiveTab('mandado')}
          className={`cursor-pointer flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-all relative ${
            activeTab === 'mandado' ? 'text-[#FF7262] font-black' : 'text-[#A6979D] hover:text-[#33252A]'
          }`}
          aria-label="Pestaña Lista de Mandado"
        >
          <ShoppingCart className="w-5 h-5" />
          <span className="text-[10px]">Mandado</span>
          {shoppingList.length > 0 && (
            <span className="absolute top-0 right-2 w-2 h-2 rounded-full bg-[#FF7262]" />
          )}
        </button>
      </nav>
    </div>
  );
};
