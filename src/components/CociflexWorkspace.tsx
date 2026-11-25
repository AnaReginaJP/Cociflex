import React, { useState, useMemo } from 'react';
import {
  Home,
  UtensilsCrossed,
  FlaskConical,
  Users2,
  ShoppingCart,
  Sparkles,
  Check,
  Plus,
  X,
  Search,
  ChevronRight,
  ShieldCheck,
  Lightbulb,
  SlidersHorizontal,
  Heart,
  Star,
  User,
  Leaf,
  Compass,
  Trophy,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { Recipe, getRankedRecipes } from '../utils/recipeMatcher.ts';
import { matchWithSubstitutions } from '../utils/ingredientSubstitution.ts';
import { SubstitutionHint } from './SubstitutionHint.tsx';
import { INITIAL_RECIPES, COMMON_PANTRY_INGREDIENTS } from '../data/recipesData.ts';
import { FERMENTATION_GUIDES } from '../data/fermentationData.ts';
import {
  INITIAL_COMMUNITY_RECIPES,
  INNOVATION_CHALLENGES,
  CommunityRecipe,
} from '../data/communityData.ts';
import { GENERATED_IMAGES } from '../data/generatedImages.ts';
import { UserProfileData } from './UserProfileModal.tsx';
import { LocalAiFermentationAssistant } from './mobile/LocalAiFermentationAssistant.tsx';
import { ResilientImage } from './ResilientImage.tsx';
import { WeeklyMenuPlanner } from './WeeklyMenuPlanner.tsx';
import { WorkspaceTab } from '../utils/walkthroughSteps.ts';
import { PantryExpiryPanel } from './PantryExpiryPanel.tsx';

interface CociflexWorkspaceProps {
  activeTab: WorkspaceTab;
  onChangeTab: (tab: WorkspaceTab) => void;
  onOpenRecipeModal: (recipe: Recipe) => void;
  onOpenAiGenerator: (
    ingredients: string[],
    time: number,
    servings: number,
    preference: string
  ) => void;
  selectedIngredients: string[];
  onToggleIngredient: (name: string) => void;
  onAddCustomIngredient: (name: string) => void;
  savedRecipes: Recipe[];
  communityExtraValidations: Record<string, string[]>;
  onValidateCommunityRecipe: (recipeId: string) => Promise<void> | void;
  shoppingList: string[];
  onToggleShoppingItem: (item: string) => void;
  onClearShoppingList: () => void;
  onOpenProfileModal: () => void;
  onStartWalkthrough: () => void;
  userProfile: UserProfileData;
}

const NAV_ITEMS: { id: WorkspaceTab; label: string; mobileLabel: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'inicio', label: 'Inicio', mobileLabel: 'Inicio', icon: Home },
  { id: 'cocina', label: 'Mi Cocina', mobileLabel: 'Cocina', icon: UtensilsCrossed },
  { id: 'fermentos', label: 'Fermentos', mobileLabel: 'Fermentos', icon: FlaskConical },
  { id: 'comunidad', label: 'Comunidad', mobileLabel: 'Comunidad', icon: Users2 },
  { id: 'mandado', label: 'Mandado', mobileLabel: 'Mandado', icon: ShoppingCart },
];

export const CociflexWorkspace: React.FC<CociflexWorkspaceProps> = ({
  activeTab,
  onChangeTab,
  onOpenRecipeModal,
  onOpenAiGenerator,
  selectedIngredients,
  onToggleIngredient,
  onAddCustomIngredient,
  savedRecipes,
  communityExtraValidations,
  onValidateCommunityRecipe,
  shoppingList,
  onToggleShoppingItem,
  onClearShoppingList,
  onOpenProfileModal,
  onStartWalkthrough,
  userProfile,
}) => {
  // Home search & category state
  const [homeSearchQuery, setHomeSearchQuery] = useState('');
  const [homeSelectedCategory, setHomeSelectedCategory] = useState('Todas');

  // Pantry UI state for "Mi Cocina"
  const [customInput, setCustomInput] = useState('');
  const [activePantryCategory, setActivePantryCategory] = useState<string>('todos');

  // Kitchen filters
  const [maxTime, setMaxTime] = useState<number>(0);
  const [servings, setServings] = useState<number>(2);
  const [preference] = useState<string>('Todas');

  // Community state
  const [communitySearch, setCommunitySearch] = useState('');
  const [notification, setNotification] = useState<string | null>(null);

  // Shopping custom item input
  const [newShoppingItem, setNewShoppingItem] = useState('');

  // Fermentation guide & simulator state
  const [selectedGuideId, setSelectedGuideId] = useState<string>(FERMENTATION_GUIDES[0].id);
  const activeGuide =
    FERMENTATION_GUIDES.find((g) => g.id === selectedGuideId) || FERMENTATION_GUIDES[0];

  const [testTemp, setTestTemp] = useState<number>(activeGuide.targetTempC);
  const [testPh, setTestPh] = useState<number>(
    Math.round(((activeGuide.phTargetMin + activeGuide.phTargetMax) / 2) * 10) / 10
  );

  const handleTabSwitch = (tab: WorkspaceTab) => {
    onChangeTab(tab);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }
  };

  const toggleIngredient = (name: string) => {
    onToggleIngredient(name);
  };

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customInput.trim();
    if (!trimmed) return;
    onAddCustomIngredient(trimmed);
    setCustomInput('');
  };

  const handleAddShoppingItem = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newShoppingItem.trim();
    if (!trimmed) return;
    if (!shoppingList.includes(trimmed)) {
      onToggleShoppingItem(trimmed);
    }
    setNewShoppingItem('');
  };

  const allCatalogRecipes = useMemo(() => {
    return [...savedRecipes, ...INITIAL_RECIPES];
  }, [savedRecipes]);

  const rankedResults = useMemo(() => {
    return getRankedRecipes(allCatalogRecipes, selectedIngredients, maxTime, servings, preference);
  }, [allCatalogRecipes, selectedIngredients, maxTime, servings, preference]);

  const filteredHomeRecipes = useMemo(() => {
    return allCatalogRecipes.filter((recipe) => {
      if (homeSelectedCategory !== 'Todas') {
        if (
          homeSelectedCategory === 'Rápidas' &&
          recipe.prepTimeMinutes + recipe.cookTimeMinutes > 20
        ) {
          return false;
        }
        if (
          homeSelectedCategory === 'Postres' &&
          recipe.category !== 'Postres' &&
          recipe.mealType !== 'Postre'
        ) {
          return false;
        }
        if (
          homeSelectedCategory === 'Vegetarianas' &&
          recipe.category !== 'Vegetarianas' &&
          !recipe.ingredients.every(
            (i) => !i.name.includes('Pollo') && !i.name.includes('Carne')
          )
        ) {
          return false;
        }
        if (
          homeSelectedCategory === 'Niños' &&
          recipe.difficulty !== 'Fácil' &&
          recipe.prepTimeMinutes + recipe.cookTimeMinutes > 30
        ) {
          return false;
        }
        if (homeSelectedCategory === 'Populares' && recipe.validationsCount < 45) {
          return false;
        }
        if (homeSelectedCategory === 'Desayunos' && recipe.mealType !== 'Desayuno') {
          return false;
        }
      }

      if (userProfile.dietaryPreference === 'Vegetariano') {
        const hasMeat = recipe.ingredients.some(
          (i) =>
            i.name.toLowerCase().includes('pollo') ||
            i.name.toLowerCase().includes('carne') ||
            i.name.toLowerCase().includes('jamón') ||
            i.name.toLowerCase().includes('atún')
        );
        if (hasMeat) return false;
      } else if (userProfile.dietaryPreference === 'Vegano') {
        const hasAnimal = recipe.ingredients.some(
          (i) =>
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

      if (!homeSearchQuery.trim()) return true;
      const q = homeSearchQuery.toLowerCase().trim();
      return (
        recipe.title.toLowerCase().includes(q) ||
        recipe.description.toLowerCase().includes(q) ||
        recipe.category.toLowerCase().includes(q) ||
        recipe.ingredients.some((ing) => ing.name.toLowerCase().includes(q))
      );
    });
  }, [allCatalogRecipes, homeSearchQuery, homeSelectedCategory, userProfile.dietaryPreference]);

  const communityRecipes = useMemo<CommunityRecipe[]>(() => {
    return INITIAL_COMMUNITY_RECIPES.map((r) => {
      const extras = communityExtraValidations[r.id] || [];
      const mergedValidators = Array.from(new Set([...r.validatedBy, ...extras]));
      const totalCount = Math.max(r.validationsCount, mergedValidators.length);
      return {
        ...r,
        validatedBy: mergedValidators,
        validationsCount: totalCount,
        isValidated: totalCount >= 3,
        likes: r.likes + extras.length,
      };
    });
  }, [communityExtraValidations]);

  const filteredCommunityRecipes = useMemo(() => {
    if (!communitySearch.trim()) return communityRecipes;
    const q = communitySearch.toLowerCase().trim();
    return communityRecipes.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.author.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q)
    );
  }, [communityRecipes, communitySearch]);

  const handleValidateCommunityRecipe = async (recipeId: string) => {
    await onValidateCommunityRecipe(recipeId);
    setNotification('Validación registrada: +1 a la certificación técnica.');
    window.setTimeout(() => setNotification(null), 3500);
  };

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
    return COMMON_PANTRY_INGREDIENTS.filter(
      (item) => item.category === activePantryCategory
    );
  }, [activePantryCategory]);

  const isSimulatorSafe =
    Math.abs(testTemp - activeGuide.targetTempC) <= 3 &&
    testPh >= activeGuide.phTargetMin - 0.2 &&
    testPh <= activeGuide.phTargetMax + 0.2;

  return (
    <div className="flex flex-col min-h-screen bg-[#FFF8F6] text-[#33252A] w-full font-sans">
      {/* ================= RESPONSIVE TOP BAR (3-Zone Desktop Contract + Mobile Compact) ================= */}
      <header className="sticky top-0 z-40 bg-[#FFF8F6]/95 backdrop-blur-md border-b border-[#FED7CD] shadow-xs">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 h-16 flex items-center justify-between gap-4 md:gap-8">
          {/* Zone 1: Brand Identity (Single-line logo + wordmark, no subtitle inside header) */}
          <button
            onClick={() => handleTabSwitch('inicio')}
            className="cursor-pointer flex items-center gap-2.5 whitespace-nowrap shrink-0 group text-left"
            aria-label="Ir al inicio de Cociflex"
          >
            <div className="w-9 h-9 rounded-2xl bg-white border border-[#FED7CD] p-1 shadow-xs flex items-center justify-center overflow-hidden shrink-0">
              <img
                src="/assets/aistudio/logo_89042ff1.png"
                alt="Cociflex Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <span className="font-display font-extrabold text-xl tracking-tight text-[#FF7262]">
              Cociflex
            </span>
          </button>

          {/* Zone 2: Desktop Primary Navigation (5 concise single-line links) */}
          <nav
            aria-label="Navegación principal"
            className="hidden md:flex items-center gap-1 lg:gap-2"
          >
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleTabSwitch(item.id)}
                  className={`cursor-pointer px-3.5 py-2 rounded-2xl text-sm font-bold whitespace-nowrap flex items-center gap-2 transition-colors ${
                    isActive
                      ? 'bg-[#FFEFEA] text-[#FF7262] border border-[#FED7CD]'
                      : 'text-[#6E5E65] hover:text-[#33252A] hover:bg-white/80 border border-transparent'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                  {item.id === 'mandado' && shoppingList.length > 0 && (
                    <span className="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-[#FF7262] text-white tabular-nums">
                      {shoppingList.length}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Compact Action Cluster */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onStartWalkthrough}
              aria-label="Abrir guía interactiva"
              title="Iniciar recorrido paso a paso (Walkthrough)"
              className="cursor-pointer px-2.5 md:px-3.5 py-2 rounded-2xl bg-white border border-[#FED7CD] text-xs font-bold text-[#5C4A51] hover:text-[#FF7262] hover:border-[#FF8A80] transition-colors flex items-center gap-1.5 whitespace-nowrap"
            >
              <Compass className="w-4 h-4 text-[#FF7262] shrink-0" />
              <span className="hidden lg:inline">Guía Interactiva</span>
              <span className="lg:hidden">Guía</span>
            </button>

            <button
              onClick={() =>
                onOpenAiGenerator(selectedIngredients, maxTime || 25, servings, preference)
              }
              className="cursor-pointer px-3 md:px-4 py-2 rounded-2xl bg-[#FF7262] hover:bg-[#FA7268] text-white text-xs font-bold shadow-sm shadow-[#FF7262]/25 flex items-center gap-1.5 whitespace-nowrap transition-colors"
              title="Crear receta personalizada con IA"
            >
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Crear con IA</span>
              <span className="sm:hidden">IA</span>
            </button>

            <button
              onClick={onOpenProfileModal}
              className="cursor-pointer relative p-2 rounded-2xl bg-white border border-[#FED7CD] text-[#7D6F76] hover:text-[#FF7262] hover:border-[#FF8A80] transition-colors shadow-xs flex items-center justify-center shrink-0"
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

              {userProfile.dietaryPreference &&
                userProfile.dietaryPreference !== 'Omnívoro' && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#10B981] text-white text-[9px] font-black flex items-center justify-center shadow-xs">
                    {userProfile.dietaryPreference === 'Vegano' ? 'V' : 'Vg'}
                  </span>
                )}
            </button>
          </div>
        </div>
      </header>

      {/* Floating Notification */}
      {notification && (
        <div className="fixed top-20 left-4 right-4 z-50 max-w-md mx-auto p-3.5 rounded-2xl bg-[#E8F8F0] border border-[#A7F3D0] text-[#1E7E50] text-xs font-semibold flex items-center gap-2 shadow-lg">
          <ShieldCheck className="w-4 h-4 text-[#10B981] shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* ================= MAIN RESPONSIVE WORKSPACE CONTAINER ================= */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-6 lg:px-8 pt-5 md:pt-8 pb-24 md:pb-14">
        {/* ==================== TAB 1: INICIO ==================== */}
        {activeTab === 'inicio' && (
          <div className="space-y-8">
            {/* Editorial Desktop Split Hero + Compact Mobile Search Header */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
              <div className="lg:col-span-7 space-y-5">
                <div className="space-y-2.5">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#FF7262]">
                    Asistente Culinario Inteligente · Cero Desperdicio
                  </p>
                  <h1 className="font-display text-2xl sm:text-3xl lg:text-[42px] font-extrabold tracking-tight leading-[1.12] text-[#33252A]">
                    Cocina hoy con lo que ya tienes en casa.
                  </h1>
                  <p className="text-sm md:text-base text-[#6E5E65] max-w-[60ch] leading-relaxed">
                    Encuentra recetas paso a paso según tu alacena, genera platillos a medida con IA y domina fermentos artesanales con rigor científico.
                  </p>
                </div>

                {/* Search Input + Quick Actions */}
                <div data-tour="home-search" className="space-y-3 bg-white border border-[#FED7CD] rounded-3xl p-4 shadow-xs">
                  <div className="relative">
                    <Search className="w-4 h-4 text-[#A6979D] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={homeSearchQuery}
                      onChange={(e) => setHomeSearchQuery(e.target.value)}
                      placeholder="Buscar recetas por nombre o ingrediente (ej. tortillas, pollo, zanahoria)..."
                      className="w-full bg-[#FFF8F6] border border-[#FED7CD] focus:border-[#FF7262] rounded-2xl pl-10 pr-9 py-2.5 text-sm text-[#33252A] placeholder-[#A6979D] focus:outline-none transition-colors"
                    />
                    {homeSearchQuery && (
                      <button
                        onClick={() => setHomeSearchQuery('')}
                        aria-label="Limpiar búsqueda"
                        className="cursor-pointer absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#A6979D] hover:text-[#33252A]"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Category Filter Buttons */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
                    {[
                      'Todas',
                      'Populares',
                      'Rápidas',
                      'Postres',
                      'Niños',
                      'Vegetarianas',
                      'Desayunos',
                    ].map((cat) => {
                      const isSelected = homeSelectedCategory === cat;
                      return (
                        <button
                          key={cat}
                          onClick={() => setHomeSelectedCategory(cat)}
                          className={`cursor-pointer px-3.5 py-1.5 rounded-xl font-bold whitespace-nowrap text-xs transition-colors ${
                            isSelected
                              ? 'bg-[#FF7262] text-white shadow-xs'
                              : 'bg-[#FFF8F6] text-[#6E5E65] border border-[#FED7CD] hover:border-[#FF8A80]'
                          }`}
                        >
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Desktop & Mobile Primary Hero Buttons */}
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => onChangeTab('cocina')}
                    className="cursor-pointer px-5 py-3 rounded-2xl bg-[#FF7262] hover:bg-[#FA7268] text-white text-sm font-bold flex items-center gap-2 shadow-sm shadow-[#FF7262]/25 transition-colors"
                  >
                    <UtensilsCrossed className="w-4 h-4" />
                    <span>Armar comida con mi alacena</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <button
                    onClick={onStartWalkthrough}
                    className="cursor-pointer px-5 py-3 rounded-2xl bg-white hover:bg-[#FFF0EB] border border-[#FED7CD] text-[#33252A] text-sm font-bold flex items-center gap-2 transition-colors"
                  >
                    <Compass className="w-4 h-4 text-[#FF7262]" />
                    <span>Ver recorrido guiado</span>
                  </button>
                </div>
              </div>

              {/* Right Hero Image (Desktop & Tablet visual anchor) */}
              <div className="hidden md:block lg:col-span-5">
                <div className="relative rounded-3xl overflow-hidden border border-[#FED7CD] bg-[#FFEAE4] shadow-md aspect-[16/11]">
                  <ResilientImage
                    src={GENERATED_IMAGES.heroKitchen}
                    alt="Mesa de cocina mexicana CociFlex con ingredientes frescos y platillos caseros"
                    className="w-full h-full object-cover"
                    fallbackLabel="Cocina CociFlex"
                  />
                </div>
              </div>
            </section>

            {/* Tabular Quick Overview Strip (Clean Desktop Metrics) */}
            <section className="hidden md:grid grid-cols-4 gap-4">
              <div className="bg-white border border-[#FED7CD] rounded-2xl p-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#8C7E85] block">
                  Catálogo Listo
                </span>
                <span className="font-display text-2xl font-extrabold text-[#33252A] tabular-nums">
                  {allCatalogRecipes.length} recetas
                </span>
              </div>
              <div className="bg-white border border-[#FED7CD] rounded-2xl p-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#8C7E85] block">
                  Mi Alacena Activa
                </span>
                <span className="font-display text-2xl font-extrabold text-[#FF7262] tabular-nums">
                  {selectedIngredients.length} insumos
                </span>
              </div>
              <div className="bg-white border border-[#FED7CD] rounded-2xl p-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#8C7E85] block">
                  Rigor Bioartesanal
                </span>
                <span className="font-display text-2xl font-extrabold text-[#10B981] tabular-nums">
                  {FERMENTATION_GUIDES.length} guías pH
                </span>
              </div>
              <div className="bg-white border border-[#FED7CD] rounded-2xl p-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#8C7E85] block">
                  Lista de Mandado
                </span>
                <span className="font-display text-2xl font-extrabold text-[#33252A] tabular-nums">
                  {shoppingList.length} por surtir
                </span>
              </div>
            </section>

            {/* Active Dietary Banner */}
            {userProfile.dietaryPreference &&
              userProfile.dietaryPreference !== 'Omnívoro' && (
                <div className="p-3.5 rounded-2xl bg-[#E8F8F0] border border-[#A7F3D0] flex items-center justify-between text-xs md:text-sm">
                  <div className="flex items-center gap-2 text-[#1E7E50]">
                    <Leaf className="w-4 h-4" />
                    <span className="font-bold">
                      Filtro dietético activo: {userProfile.dietaryPreference}
                    </span>
                  </div>
                  <button
                    onClick={onOpenProfileModal}
                    className="cursor-pointer text-xs text-[#1E7E50] underline font-bold"
                  >
                    Modificar perfil
                  </button>
                </div>
              )}

            {/* Recipes Grid */}
            <section data-tour="recipe-grid" className="space-y-4">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <h2 className="font-display text-lg md:text-xl font-extrabold text-[#33252A]">
                    {homeSearchQuery
                      ? 'Resultados de Búsqueda'
                      : 'Recetas Populares & Disponibles'}
                  </h2>
                  <p className="text-xs md:text-sm text-[#7D6F76] tabular-nums">
                    {filteredHomeRecipes.length} recetas listas con ingredientes de casa
                  </p>
                </div>
                <button
                  onClick={() => onChangeTab('cocina')}
                  className="cursor-pointer text-xs md:text-sm font-bold text-[#FF7262] hover:underline flex items-center gap-1 whitespace-nowrap"
                >
                  <span>Ir a Tu Alacena</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 md:gap-5">
                {filteredHomeRecipes.map((recipe) => {
                  const totalMins = recipe.prepTimeMinutes + recipe.cookTimeMinutes;
                  return (
                    <article
                      key={recipe.id}
                      onClick={() => onOpenRecipeModal(recipe)}
                      className="cursor-pointer bg-white border border-[#FED7CD] rounded-3xl overflow-hidden shadow-xs hover:border-[#FF8A80] hover:shadow-md transition-all flex flex-col group"
                    >
                      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#FFEAE4]">
                        <ResilientImage
                          src={recipe.imageUrl}
                          alt={recipe.title}
                          fallbackLabel={recipe.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>

                      <div className="p-3.5 md:p-4 flex-1 flex flex-col justify-between space-y-2.5">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#8C7E85] tabular-nums flex-wrap">
                            <span className="inline-flex items-center gap-0.5 text-[#33252A] font-bold">
                              <Star className="w-3 h-3 text-[#F59E0B] fill-[#F59E0B]" />
                              {recipe.id === 'pastel-de-zanahoria' ? '4.7' : '4.9'}
                            </span>
                            <span>·</span>
                            <span>{totalMins} min</span>
                            <span className="hidden sm:inline">·</span>
                            <span className="hidden sm:inline text-[#A66F7B] truncate">
                              {recipe.category}
                            </span>
                          </div>

                          <h3 className="font-display text-xs md:text-sm font-extrabold text-[#33252A] line-clamp-2 leading-snug">
                            {recipe.title}
                          </h3>

                          <p className="hidden md:block text-xs text-[#7D6F76] line-clamp-2 leading-relaxed">
                            {recipe.description}
                          </p>
                        </div>

                        <div className="pt-2 border-t border-[#FED7CD]/60 flex items-center justify-between text-[11px] md:text-xs text-[#7D6F76]">
                          <span className="tabular-nums">
                            {recipe.ingredients.length} insumos
                          </span>
                          <span className="font-bold text-[#FF7262] group-hover:underline">
                            Ver receta →
                          </span>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              {filteredHomeRecipes.length === 0 && (
                <div className="text-center py-10 bg-white border border-[#FED7CD] rounded-3xl p-6">
                  <p className="text-sm font-bold text-[#33252A]">
                    No se encontraron recetas con ese término
                  </p>
                  <p className="text-xs text-[#8C7E85] mt-1 mb-4">
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
            </section>

            {/* Bottom Action & Club Row */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <button
                onClick={() =>
                  onOpenAiGenerator(selectedIngredients, maxTime, servings, preference)
                }
                className="cursor-pointer text-left bg-gradient-to-br from-[#FFEFEA] to-[#FFE4DC] border border-[#FED7CD] rounded-3xl p-5 flex items-start gap-4 hover:border-[#FF8A80] transition-all group"
              >
                <div className="w-10 h-10 rounded-2xl bg-white border border-[#FED7CD] flex items-center justify-center text-[#FF7262] shrink-0 shadow-xs">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display text-sm font-extrabold text-[#33252A]">
                    Crear con IA
                  </h3>
                  <p className="text-xs text-[#6E5E65] mt-1 leading-relaxed">
                    Inventa una receta personalizada al instante con los ingredientes que sobran hoy.
                  </p>
                </div>
              </button>

              <button
                onClick={() => onChangeTab('fermentos')}
                className="cursor-pointer text-left bg-gradient-to-br from-[#EAF8F2] to-[#D5F3E5] border border-[#C2EED9] rounded-3xl p-5 flex items-start gap-4 hover:border-[#34D399] transition-all group"
              >
                <div className="w-10 h-10 rounded-2xl bg-white border border-[#C2EED9] flex items-center justify-center text-[#10B981] shrink-0 shadow-xs">
                  <FlaskConical className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display text-sm font-extrabold text-[#264E36]">
                    Bioartesanía y Fermentos
                  </h3>
                  <p className="text-xs text-[#4A6F56] mt-1 leading-relaxed">
                    Queso fresco, kéfir, BioAsistente local y simulador de pH seguro.
                  </p>
                </div>
              </button>

              <div className="bg-[#FFF2EE] border border-[#FED7CD] rounded-3xl p-5 flex flex-col justify-between">
                <div>
                  <span className="text-[11px] font-bold text-[#FF7262] uppercase tracking-wider">
                    Club Cociflex
                  </span>
                  <p className="text-xs text-[#5C4A51] mt-1 leading-relaxed">
                    Personaliza tu dieta (Omnívoro, Vegetariano o Vegano) para filtrar todo el recetario.
                  </p>
                </div>
                <button
                  onClick={onOpenProfileModal}
                  className="cursor-pointer text-xs font-bold text-[#FF7262] hover:underline pt-3 text-left"
                >
                  {userProfile.isLoggedIn
                    ? 'Administrar mi perfil culinario →'
                    : 'Configurar mis preferencias ahora →'}
                </button>
              </div>
            </section>
          </div>
        )}

        {/* ==================== TAB 2: MI COCINA ==================== */}
        {activeTab === 'cocina' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[#FF7262]">
                  Motor de Coincidencia Cero Desperdicio
                </p>
                <h1 className="font-display text-2xl md:text-3xl font-extrabold text-[#33252A]">
                  Mi Cocina y Alacena
                </h1>
              </div>
              <p className="text-xs md:text-sm text-[#7D6F76]">
                Selecciona lo que tienes en casa para ordenar las mejores recetas disponibles.
              </p>
            </div>

            <div data-tour="pantry-expiry">
              <PantryExpiryPanel
                selectedIngredients={selectedIngredients}
                recipes={allCatalogRecipes}
                shoppingList={shoppingList}
                onToggleShoppingItem={onToggleShoppingItem}
                onOpenRecipeModal={onOpenRecipeModal}
                onCreateWithAi={(ingredients) =>
                  onOpenAiGenerator(ingredients, maxTime || 25, servings, preference)
                }
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Pantry Controls */}
              <section
                data-tour="pantry-engine"
                className="lg:col-span-5 lg:sticky lg:top-24 bg-white border border-[#FED7CD] rounded-3xl p-5 shadow-xs space-y-4"
              >
                <div className="flex items-center justify-between pb-3 border-b border-[#FED7CD]/60">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-[#FF7262]" />
                    <h2 className="font-display text-sm font-extrabold text-[#33252A] uppercase tracking-wide">
                      ¿Qué tienes en tu alacena?
                    </h2>
                  </div>
                  <span className="text-xs font-bold text-[#FF7262] bg-[#FFEAE4] px-2.5 py-0.5 rounded-full border border-[#FED7CD] tabular-nums">
                    {selectedIngredients.length} insumos
                  </span>
                </div>

                {/* Category Filter */}
                <div className="flex items-center gap-1.5 overflow-x-auto md:overflow-visible md:flex-wrap pb-1 no-scrollbar text-xs">
                  {pantryCategoryOptions.map((cat) => {
                    const isCatSelected = activePantryCategory === cat.id;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => setActivePantryCategory(cat.id)}
                        className={`cursor-pointer px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                          isCatSelected
                            ? 'bg-[#FF7262] text-white shadow-xs'
                            : 'bg-[#FFF8F6] text-[#6E5E65] border border-[#FED7CD]/80 hover:border-[#FF8A80]'
                        }`}
                      >
                        {cat.label}
                      </button>
                    );
                  })}
                </div>

                {/* Ingredient Selector Grid */}
                <div className="flex flex-wrap gap-1.5 max-h-56 md:max-h-72 overflow-y-auto pr-1">
                  {filteredPantryIngredients.map((item) => {
                    const isSelected = selectedIngredients.includes(item.name);
                    return (
                      <button
                        key={item.id}
                        onClick={() => toggleIngredient(item.name)}
                        className={`cursor-pointer px-2.5 py-1.5 rounded-2xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                          isSelected
                            ? 'bg-[#FF7262] text-white shadow-xs'
                            : 'bg-[#FFF8F6] text-[#5C4A51] border border-[#FED7CD] hover:border-[#FF8A80]'
                        }`}
                      >
                        {isSelected ? (
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        ) : (
                          <Plus className="w-3.5 h-3.5 text-[#A6979D]" />
                        )}
                        <span>{item.name}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Add Custom Ingredient */}
                <form
                  onSubmit={handleAddCustom}
                  className="flex gap-2 pt-3 border-t border-[#FED7CD]/60"
                >
                  <input
                    type="text"
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    placeholder="Agregar otro ingrediente de tu refri..."
                    className="flex-1 bg-[#FFF8F6] border border-[#FED7CD] rounded-2xl px-3.5 py-2 text-xs text-[#33252A] placeholder-[#A6979D] focus:outline-none focus:border-[#FF7262]"
                  />
                  <button
                    type="submit"
                    aria-label="Agregar ingrediente"
                    className="cursor-pointer px-4 py-2 bg-[#FF7262] text-white text-xs font-bold rounded-2xl hover:bg-[#FA7268]"
                  >
                    + Añadir
                  </button>
                </form>

                {/* Time & Servings Filters */}
                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[#FED7CD]/60 text-xs">
                  <div>
                    <label
                      htmlFor="cocina-time-select"
                      className="text-[11px] text-[#8C7E85] block font-bold uppercase mb-1"
                    >
                      Tiempo máximo
                    </label>
                    <select
                      id="cocina-time-select"
                      value={maxTime}
                      onChange={(e) => setMaxTime(Number(e.target.value))}
                      className="w-full bg-[#FFF8F6] border border-[#FED7CD] rounded-xl p-2.5 text-xs text-[#33252A] focus:outline-none"
                    >
                      <option value={0}>Cualquier tiempo</option>
                      <option value={15}>≤ 15 min (Exprés)</option>
                      <option value={25}>≤ 25 min</option>
                      <option value={35}>≤ 35 min</option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="cocina-servings-select"
                      className="text-[11px] text-[#8C7E85] block font-bold uppercase mb-1"
                    >
                      Comensales
                    </label>
                    <select
                      id="cocina-servings-select"
                      value={servings}
                      onChange={(e) => setServings(Number(e.target.value))}
                      className="w-full bg-[#FFF8F6] border border-[#FED7CD] rounded-xl p-2.5 text-xs text-[#33252A] focus:outline-none"
                    >
                      <option value={1}>1 persona</option>
                      <option value={2}>2 personas</option>
                      <option value={4}>4 personas</option>
                      <option value={6}>6 personas</option>
                    </select>
                  </div>
                </div>

                {/* AI Recipe Studio CTA */}
                <div data-tour="ai-cta" className="pt-1">
                  <button
                    onClick={() =>
                      onOpenAiGenerator(selectedIngredients, maxTime, servings, preference)
                    }
                    className="cursor-pointer w-full py-3 px-4 rounded-2xl font-extrabold text-xs sm:text-sm text-white bg-gradient-to-r from-[#FF7B72] to-[#FA7268] hover:brightness-105 flex items-center justify-center gap-2 shadow-md shadow-[#FF7B72]/25 transition-all"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Crear Receta con IA</span>
                  </button>
                </div>
              </section>

              {/* Right Column: Ranked Match Results */}
              <section data-tour="recipe-results" className="lg:col-span-7 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-sm md:text-base font-extrabold text-[#33252A]">
                    Recetas por Coincidencia
                  </h2>
                  <span className="text-xs text-[#7D6F76] font-semibold tabular-nums">
                    {rankedResults.length} encontradas
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {rankedResults.map((result) => {
                    const totalMins =
                      result.recipe.prepTimeMinutes + result.recipe.cookTimeMinutes;
                    const substitution = matchWithSubstitutions(result, selectedIngredients);
                    return (
                      <article
                        key={result.recipe.id}
                        className="bg-white border border-[#FED7CD] rounded-3xl p-4 shadow-xs flex flex-col justify-between space-y-3 hover:border-[#FF8A80] transition-colors"
                      >
                        <div className="space-y-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-[#A66F7B]">
                                {result.recipe.mealType} · {totalMins} min · {result.recipe.servings} p.
                              </span>
                              <h3 className="font-display text-sm font-extrabold text-[#33252A] leading-snug mt-0.5">
                                {result.recipe.title}
                              </h3>
                            </div>
                            <span
                              className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full shrink-0 tabular-nums ${
                                result.matchPercentage >= 70
                                  ? 'bg-[#E8F8F0] text-[#1E7E50] border border-[#A7F3D0]'
                                  : 'bg-[#FFEFEA] text-[#FF7262] border border-[#FED7CD]'
                              }`}
                            >
                              {result.matchPercentage}%
                            </span>
                          </div>

                          <p className="text-xs text-[#6E5E65] line-clamp-2 leading-relaxed">
                            {result.recipe.description}
                          </p>

                          {result.missingIngredients.length > 0 && (
                            <div className="text-[11px] text-[#7D6F76] pt-1">
                              <span className="font-bold text-[#FF7262] block mb-1.5">
                                Te falta (toca para mandar a tu lista):
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {result.missingIngredients.map((item) => {
                                  const inList = shoppingList.includes(item.name);
                                  return (
                                    <button
                                      key={item.name}
                                      onClick={() => onToggleShoppingItem(item.name)}
                                      className={`cursor-pointer px-2.5 py-1 rounded-full border text-[11px] flex items-center gap-1 transition-colors ${
                                        inList
                                          ? 'bg-[#FFEAE4] border-[#FF7262] text-[#FF7262] font-bold'
                                          : 'bg-[#FFF8F6] border-[#FED7CD] text-[#5C4A51] hover:border-[#FF7262]'
                                      }`}
                                      title={
                                        inList
                                          ? 'En lista de mandado (toca para quitar)'
                                          : 'Agregar a lista de mandado'
                                      }
                                    >
                                      {inList ? (
                                        <Check className="w-3 h-3" />
                                      ) : (
                                        <Plus className="w-3 h-3 text-[#FF7262]" />
                                      )}
                                      <span>{item.name}</span>
                                    </button>
                                  );
                                })}
                              </div>

                              {substitution.suggestions.length > 0 && (
                                <div className="space-y-1.5 pt-1.5">
                                  {substitution.suggestions.map((suggestion) => (
                                    <SubstitutionHint key={suggestion.missing} suggestion={suggestion} compact />
                                  ))}
                                  <p className="text-[10px] font-bold text-[#1E7E50]">
                                    Coincidencia con sustituciones: {substitution.matchPercentage}% (antes{' '}
                                    {result.matchPercentage}%)
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-[#FED7CD]/60 text-xs">
                          <span className="text-[#8C7E85] font-medium">
                            {result.matchedIngredients.length}/{result.recipe.ingredients.length}{' '}
                            en casa
                          </span>
                          <button
                            onClick={() => onOpenRecipeModal(result.recipe)}
                            className="cursor-pointer px-4 py-1.5 rounded-2xl bg-[#FF7262] hover:bg-[#FA7268] text-white font-bold text-xs transition-colors"
                          >
                            Cocinar
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            </div>
          </div>
        )}

        {/* ==================== TAB 3: FERMENTOS ==================== */}
        {activeTab === 'fermentos' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-[#EAF8F2] to-[#D5F3E5] border border-[#C2EED9] rounded-3xl p-5 md:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="text-[11px] font-bold text-[#10B981] uppercase tracking-wider block mb-1">
                  Ciencia de Alimentos Casera
                </span>
                <h1 className="font-display text-xl md:text-2xl font-extrabold text-[#264E36]">
                  El Arte de la Fermentación Bioartesanal
                </h1>
                <p className="text-xs md:text-sm text-[#4A6F56] mt-1 max-w-[65ch] leading-relaxed">
                  Ajusta cultivos al clima de tu cocina con nuestro BioAsistente Local y valida parámetros críticos de temperatura y pH.
                </p>
              </div>
              <div className="hidden sm:flex items-center gap-3 shrink-0 bg-white/80 border border-[#C2EED9] px-4 py-2.5 rounded-2xl">
                <ShieldCheck className="w-5 h-5 text-[#10B981]" />
                <div className="text-xs">
                  <span className="font-bold text-[#264E36] block">Inocuidad Activa</span>
                  <span className="text-[#4A6F56]">Control pH y temperatura</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Local AI Fermentation Assistant */}
              <div data-tour="ferment-assistant" className="lg:col-span-5">
                <LocalAiFermentationAssistant />
              </div>

              {/* Right Column: Standardized Guides & Safety Simulator */}
              <div className="lg:col-span-7 space-y-4">
                <div>
                  <span className="text-xs font-bold text-[#8C7E85] uppercase tracking-wider block mb-2.5">
                    Guías Técnicas Estandarizadas:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {FERMENTATION_GUIDES.map((guide) => (
                      <button
                        key={guide.id}
                        onClick={() => {
                          setSelectedGuideId(guide.id);
                          setTestTemp(guide.targetTempC);
                          setTestPh(
                            Math.round(
                              ((guide.phTargetMin + guide.phTargetMax) / 2) * 10
                            ) / 10
                          );
                        }}
                        className={`cursor-pointer p-3.5 rounded-2xl text-left border transition-all ${
                          selectedGuideId === guide.id
                            ? 'bg-white border-[#10B981] shadow-xs ring-2 ring-[#10B981]/15'
                            : 'bg-white/85 border-[#FED7CD]/80 text-[#7D6F76] hover:border-[#10B981]'
                        }`}
                      >
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#10B981] block mb-0.5">
                          {guide.category}
                        </span>
                        <h3 className="font-display text-sm font-extrabold text-[#33252A] leading-tight">
                          {guide.name}
                        </h3>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Active Guide Details + Simulator */}
                <div className="bg-white border border-[#FED7CD] rounded-3xl p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#FED7CD]/60">
                    <div>
                      <span className="text-[11px] font-bold text-[#10B981] uppercase">
                        {activeGuide.category}
                      </span>
                      <h2 className="font-display text-base md:text-lg font-extrabold text-[#33252A]">
                        {activeGuide.name}
                      </h2>
                    </div>
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#E8F8F0] text-[#1E7E50] shrink-0">
                      Rigor Bioartesanal
                    </span>
                  </div>

                  {/* Critical Parameters */}
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-[#FFF8F6] p-3 rounded-2xl border border-[#FED7CD]/80">
                      <span className="text-[10px] text-[#8C7E85] block font-bold uppercase">
                        Temperatura
                      </span>
                      <span className="text-sm md:text-base font-extrabold text-[#FF7262] font-mono tabular-nums">
                        {activeGuide.targetTempC}°C
                      </span>
                    </div>
                    <div className="bg-[#FFF8F6] p-3 rounded-2xl border border-[#FED7CD]/80">
                      <span className="text-[10px] text-[#8C7E85] block font-bold uppercase">
                        Reposo
                      </span>
                      <span className="text-xs md:text-sm font-extrabold text-[#33252A]">
                        {activeGuide.incubationTimeDisplay}
                      </span>
                    </div>
                    <div className="bg-[#FFF8F6] p-3 rounded-2xl border border-[#FED7CD]/80">
                      <span className="text-[10px] text-[#8C7E85] block font-bold uppercase">
                        pH Objetivo
                      </span>
                      <span className="text-sm md:text-base font-extrabold text-[#10B981] font-mono tabular-nums">
                        {activeGuide.phTargetMin}-{activeGuide.phTargetMax}
                      </span>
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] font-bold text-[#8C7E85] uppercase block mb-1.5">
                      Microbiología Estandarizada:
                    </span>
                    <p className="text-xs md:text-sm text-[#5C4A51] bg-[#FFF8F6] p-3 rounded-2xl border border-[#FED7CD]/60 leading-relaxed">
                      {activeGuide.microbiology}
                    </p>
                  </div>

                  {/* Live Safety Simulator */}
                  <div className="pt-3 border-t border-[#FED7CD]/60 space-y-3">
                    <h3 className="font-display text-sm font-extrabold text-[#33252A]">
                      Simulador de Inocuidad Casera
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-[#7D6F76]">Tu Temperatura:</span>
                          <strong className="text-[#FF7262] font-mono tabular-nums">
                            {testTemp}°C
                          </strong>
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
                        <div className="flex justify-between mb-1">
                          <span className="text-[#7D6F76]">Tu pH:</span>
                          <strong className="text-[#10B981] font-mono tabular-nums">
                            {testPh}
                          </strong>
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

                    <div
                      className={`p-3 rounded-2xl text-xs font-bold flex items-center gap-2 ${
                        isSimulatorSafe
                          ? 'bg-[#E8F8F0] text-[#1E7E50] border border-[#A7F3D0]'
                          : 'bg-[#FFF2EE] text-[#E11D48] border border-[#FECDD3]'
                      }`}
                    >
                      <ShieldCheck className="w-4 h-4 shrink-0" />
                      <span>
                        {isSimulatorSafe
                          ? 'Lote dentro de los rangos seguros de inocuidad.'
                          : 'Alerta: Parámetros fuera de rango seguro. Revisa temperatura o pH.'}
                      </span>
                    </div>
                  </div>

                  {/* Preparation Steps */}
                  <div className="pt-3 border-t border-[#FED7CD]/60 space-y-2.5">
                    <span className="text-[11px] font-bold text-[#8C7E85] uppercase block">
                      Pasos de Preparación:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {activeGuide.steps.map((st, i) => (
                        <div
                          key={i}
                          className="text-xs bg-[#FFF8F6] p-3 rounded-2xl border border-[#FED7CD]/60"
                        >
                          <span className="font-extrabold text-[#FF7262] block mb-1">
                            {i + 1}. {st.title}
                          </span>
                          <p className="text-[#5C4A51] leading-relaxed">{st.instruction}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================== TAB 4: COMUNIDAD ==================== */}
        {activeTab === 'comunidad' && (
          <div data-tour="community-mandado" className="space-y-6">
            <div className="bg-gradient-to-br from-[#FFF0EB] to-[#FFE4DC] border border-[#FED7CD] rounded-3xl p-5 md:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="text-[11px] font-bold text-[#FF7262] uppercase tracking-wider block mb-1">
                  Filtro de Calidad (3 Likes Reales)
                </span>
                <h1 className="font-display text-xl md:text-2xl font-extrabold text-[#33252A]">
                  Comunidad y Retos CociFlex
                </h1>
                <p className="text-xs md:text-sm text-[#6E5E65] mt-1 max-w-[65ch]">
                  Las recetas colaborativas se certifican automáticamente cuando 3 miembros de la comunidad las cocinan y validan su funcionamiento.
                </p>
              </div>
              <button
                onClick={() => onChangeTab('mandado')}
                className="cursor-pointer px-4 py-2.5 rounded-2xl bg-white border border-[#FED7CD] text-xs font-bold text-[#FF7262] hover:border-[#FF8A80] flex items-center gap-2 shrink-0 self-start md:self-auto"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>Ver Lista de Mandado ({shoppingList.length})</span>
              </button>
            </div>

            {/* Challenges Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {INNOVATION_CHALLENGES.map((challenge) => (
                <div
                  key={challenge.id}
                  className="bg-white border border-[#FED7CD] rounded-3xl p-5 shadow-xs space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold text-[#FF7262] uppercase bg-[#FFEAE4] px-2.5 py-0.5 rounded-full">
                      {challenge.sponsor}
                    </span>
                    <span className="text-[11px] font-semibold text-[#8C7E85] flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {challenge.deadline}
                    </span>
                  </div>
                  <h2 className="font-display text-sm md:text-base font-extrabold text-[#33252A]">
                    {challenge.title}
                  </h2>
                  <p className="text-xs text-[#6E5E65] leading-relaxed">
                    {challenge.description}
                  </p>
                  <div className="pt-2 border-t border-[#FED7CD]/60 flex items-center justify-between text-xs">
                    <span className="font-bold text-[#10B981] flex items-center gap-1.5">
                      <Trophy className="w-3.5 h-3.5" />
                      Premio: {challenge.reward}
                    </span>
                    <span className="text-[#8C7E85] font-semibold tabular-nums shrink-0">
                      {challenge.participantsCount} inscritos
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Community Search */}
            <div className="relative max-w-md">
              <Search className="w-4 h-4 text-[#A6979D] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={communitySearch}
                onChange={(e) => setCommunitySearch(e.target.value)}
                placeholder="Buscar recetas de la comunidad..."
                className="w-full bg-white border border-[#FED7CD] rounded-2xl pl-10 pr-4 py-2.5 text-xs md:text-sm text-[#33252A] placeholder-[#A6979D] focus:outline-none focus:border-[#FF7262]"
              />
            </div>

            {/* Feed of Community Recipes */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredCommunityRecipes.map((item) => (
                <article
                  key={item.id}
                  className="bg-white border border-[#FED7CD] rounded-3xl p-4 shadow-xs flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-3">
                    <div className="relative aspect-[16/10] rounded-2xl overflow-hidden bg-[#FFEAE4]">
                      <ResilientImage
                        src={item.imageUrl}
                        alt={item.title}
                        fallbackLabel={item.title}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2 text-[11px] font-semibold">
                        <span className="text-[#8C7E85] truncate">
                          <strong className="text-[#33252A]">{item.author}</strong> ·{' '}
                          {item.authorRole}
                        </span>
                        <span
                          className={`shrink-0 font-bold tabular-nums ${
                            item.isValidated ? 'text-[#10B981]' : 'text-[#FF7262]'
                          }`}
                        >
                          {item.validationsCount}/3{' '}
                          {item.isValidated ? 'Certificada' : 'Validaciones'}
                        </span>
                      </div>
                      <h3 className="font-display text-sm md:text-base font-extrabold text-[#33252A]">
                        {item.title}
                      </h3>
                      <p className="text-xs text-[#6E5E65] line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-[#FED7CD]/60 text-xs">
                    <span className="text-[#8C7E85] tabular-nums">
                      {item.ingredients.length} insumos · {item.timeMinutes} min
                    </span>
                    <button
                      onClick={() => handleValidateCommunityRecipe(item.id)}
                      className="cursor-pointer px-3.5 py-1.5 rounded-2xl bg-[#FFEFEA] hover:bg-[#FFEAE4] text-[#FF7262] font-bold text-xs border border-[#FED7CD] flex items-center gap-1.5 transition-colors"
                    >
                      <Heart className="w-3.5 h-3.5 fill-[#FF7262]" />
                      <span>Validar ({item.validationsCount})</span>
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}

        {/* ==================== TAB 5: MANDADO ==================== */}
        {activeTab === 'mandado' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-[#FFEFEA] to-[#FFE4DC] border border-[#FED7CD] rounded-3xl p-5 md:p-6 shadow-xs">
              <span className="text-[11px] font-bold text-[#FF7262] uppercase tracking-wider block mb-1">
                Alacena & Supermercado
              </span>
              <h1 className="font-display text-xl md:text-2xl font-extrabold text-[#33252A]">
                Lista de Mandado Inteligente
              </h1>
              <p className="text-xs md:text-sm text-[#6E5E65] mt-1 leading-relaxed">
                Insumos faltantes detectados automáticamente por el motor de recetas o añadidos manualmente por ti.
              </p>
            </div>

            <section data-tour="weekly-menu">
              <WeeklyMenuPlanner
                recipes={allCatalogRecipes}
                shoppingList={shoppingList}
                onToggleShoppingItem={onToggleShoppingItem}
                onOpenRecipeModal={onOpenRecipeModal}
                defaultDiet={userProfile.dietaryPreference}
              />
            </section>


            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-7 space-y-4">
                {/* Manual Add Form */}
                <form
                  onSubmit={handleAddShoppingItem}
                  className="bg-white border border-[#FED7CD] rounded-3xl p-4 flex gap-2 shadow-xs"
                >
                  <input
                    type="text"
                    value={newShoppingItem}
                    onChange={(e) => setNewShoppingItem(e.target.value)}
                    placeholder="Añadir artículo manualmente (ej. Cilantro, Limones)..."
                    className="flex-1 bg-[#FFF8F6] border border-[#FED7CD] rounded-2xl px-3.5 py-2 text-xs md:text-sm text-[#33252A] placeholder-[#A6979D] focus:outline-none focus:border-[#FF7262]"
                  />
                  <button
                    type="submit"
                    className="cursor-pointer px-4 py-2 rounded-2xl bg-[#FF7262] hover:bg-[#FA7268] text-white text-xs font-bold transition-colors"
                  >
                    + Agregar
                  </button>
                </form>

                {shoppingList.length === 0 ? (
                  <div className="bg-white border border-[#FED7CD] rounded-3xl p-8 text-center space-y-3">
                    <div className="w-12 h-12 mx-auto rounded-2xl bg-[#FFEAE4] flex items-center justify-center text-[#FF7262]">
                      <ShoppingCart className="w-6 h-6" />
                    </div>
                    <h2 className="font-display text-base font-extrabold text-[#33252A]">
                      ¡No tienes insumos faltantes!
                    </h2>
                    <p className="text-xs text-[#8C7E85] max-w-md mx-auto">
                      Cuando una receta requiera ingredientes que no tienes en casa, pulsa el botón "+" para agregarlos aquí.
                    </p>
                    <button
                      onClick={() => onChangeTab('cocina')}
                      className="cursor-pointer px-5 py-2.5 rounded-2xl bg-[#FF7262] text-white text-xs font-bold shadow-xs hover:brightness-105"
                    >
                      Ir a Mi Cocina
                    </button>
                  </div>
                ) : (
                  <div className="bg-white border border-[#FED7CD] rounded-3xl p-5 space-y-3 shadow-xs">
                    <div className="flex items-center justify-between pb-2.5 border-b border-[#FED7CD]/60">
                      <span className="font-display text-sm font-extrabold text-[#33252A] tabular-nums">
                        {shoppingList.length} artículos por comprar
                      </span>
                      <button
                        onClick={onClearShoppingList}
                        className="cursor-pointer text-xs font-semibold text-[#A66F7B] hover:text-[#E11D48]"
                      >
                        Limpiar todo
                      </button>
                    </div>

                    <div className="space-y-2">
                      {shoppingList.map((item) => (
                        <div
                          key={item}
                          className="flex items-center justify-between p-3 rounded-2xl bg-[#FFF8F6] border border-[#FED7CD] text-xs md:text-sm text-[#33252A]"
                        >
                          <span className="font-semibold">{item}</span>
                          <button
                            onClick={() => onToggleShoppingItem(item)}
                            className="cursor-pointer text-[#A6979D] hover:text-[#E11D48] p-1"
                            title="Quitar artículo"
                            aria-label={`Quitar ${item}`}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="lg:col-span-5 bg-white border border-[#FED7CD] rounded-3xl p-5 space-y-3 shadow-xs">
                <div className="flex items-center gap-2 text-[#FF7262]">
                  <Lightbulb className="w-4 h-4" />
                  <h2 className="font-display text-sm font-extrabold text-[#33252A]">
                    Consejos para ahorrar en el súper
                  </h2>
                </div>
                <p className="text-xs text-[#6E5E65] leading-relaxed">
                  Antes de salir de compras, revisa tu pestaña de <strong>Mi Cocina</strong> para verificar si puedes sustituir un ingrediente faltante con lo que ya tienes en refrigeración.
                </p>
                <div className="pt-2 flex flex-wrap gap-2">
                  <button
                    onClick={() => onChangeTab('inicio')}
                    className="cursor-pointer px-3.5 py-2 rounded-xl bg-[#FFF8F6] border border-[#FED7CD] text-xs font-bold text-[#33252A] hover:border-[#FF8A80]"
                  >
                    Explorar Recetas
                  </button>
                  <button
                    onClick={() => onChangeTab('cocina')}
                    className="cursor-pointer px-3.5 py-2 rounded-xl bg-[#FFEFEA] border border-[#FED7CD] text-xs font-bold text-[#FF7262] hover:border-[#FF8A80]"
                  >
                    Ajustar Alacena
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ================= MOBILE BOTTOM NAVIGATION BAR (< 768px) ================= */}
      <nav
        aria-label="Navegación móvil"
        className="flex md:hidden sticky bottom-0 z-40 w-full bg-white/95 backdrop-blur-lg border-t border-[#FED7CD] px-2 py-1.5 items-center justify-around mt-auto shadow-md"
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleTabSwitch(item.id)}
              className={`cursor-pointer flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-2xl transition-colors relative ${
                isActive
                  ? 'text-[#FF7262] font-extrabold'
                  : 'text-[#8C7E85] hover:text-[#33252A]'
              }`}
              aria-label={`Pestaña ${item.label}`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px]">{item.mobileLabel}</span>
              {item.id === 'mandado' && shoppingList.length > 0 && (
                <span className="absolute top-0.5 right-2 w-2 h-2 rounded-full bg-[#FF7262]" />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
};
