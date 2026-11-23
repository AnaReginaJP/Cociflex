import React, { useState } from 'react';
import { GENERATED_IMAGES } from '../data/generatedImages.ts';
import { 
  Users2, 
  CheckCircle2, 
  Award, 
  Flame, 
  Clock, 
  Share2, 
  Plus, 
  Search, 
  Camera, 
  Heart, 
  X, 
  Trophy, 
  Star,
  Quote,
  ShieldCheck,
  Check
} from 'lucide-react';
import { 
  INITIAL_COMMUNITY_RECIPES, 
  INNOVATION_CHALLENGES, 
  PILOT_TESTIMONIALS,
  CommunityRecipe 
} from '../data/communityData.ts';

export const CommunitySection: React.FC = () => {
  const [recipes, setRecipes] = useState<CommunityRecipe[]>(INITIAL_COMMUNITY_RECIPES);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState<CommunityRecipe | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // New Recipe Form states
  const [newTitle, setNewTitle] = useState('');
  const [newAuthor, setNewAuthor] = useState('');
  const [newCategory, setNewCategory] = useState('Tradicional Mexicana');
  const [newServings, setNewServings] = useState(2);
  const [newTime, setNewTime] = useState(25);
  const [newDescription, setNewDescription] = useState('');
  const [newIngredientsText, setNewIngredientsText] = useState('');
  const [newStepsText, setNewStepsText] = useState('');
  const [notification, setNotification] = useState<string | null>(null);

  // Filter recipes
  const filteredRecipes = recipes.filter(r => {
    const q = searchQuery.toLowerCase();
    return (
      r.title.toLowerCase().includes(q) ||
      r.author.toLowerCase().includes(q) ||
      r.category.toLowerCase().includes(q)
    );
  });

  // Handle peer validation (+1 validation action)
  const handleValidateRecipe = (recipeId: string) => {
    setRecipes(prev =>
      prev.map(r => {
        if (r.id === recipeId) {
          const newCount = r.validationsCount + 1;
          const isValidatedNow = newCount >= 3;
          return {
            ...r,
            validationsCount: newCount,
            isValidated: isValidatedNow,
            validatedBy: [...r.validatedBy, 'Tú (Cocinero Verificado)'],
            likes: r.likes + 1,
          };
        }
        return r;
      })
    );

    // Also update modal recipe if currently open
    if (selectedRecipe && selectedRecipe.id === recipeId) {
      setSelectedRecipe(prev => prev ? {
        ...prev,
        validationsCount: prev.validationsCount + 1,
        isValidated: prev.validationsCount + 1 >= 3,
        validatedBy: [...prev.validatedBy, 'Tú (Cocinero Verificado)'],
        likes: prev.likes + 1,
      } : null);
    }

    setNotification('¡Gracias por validar la receta con rigor técnico! Tu validación ha sido registrada.');
    setTimeout(() => setNotification(null), 4000);
  };

  // Submit new recipe
  const handleShareSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newAuthor.trim() || !newIngredientsText.trim()) return;

    const parsedIngredients = newIngredientsText
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        const parts = line.split('-');
        return {
          name: parts[0]?.trim() || line,
          amount: parts[1]?.trim() || 'Al gusto',
        };
      });

    const parsedSteps = newStepsText
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .map((line, idx) => ({
        stepNumber: idx + 1,
        title: `Paso ${idx + 1}`,
        instruction: line,
      }));

    const createdRecipe: CommunityRecipe = {
      id: `comm-user-${Date.now()}`,
      title: newTitle,
      author: newAuthor,
      authorRole: 'Cocinero de la Comunidad CociFlex',
      authorAvatar: newAuthor.substring(0, 2).toUpperCase(),
      category: newCategory,
      servings: Number(newServings) || 2,
      timeMinutes: Number(newTime) || 20,
      imageUrl: GENERATED_IMAGES.arrozPollo,
      description: newDescription || 'Receta colaborativa enviada para validación de la comunidad.',
      validationsCount: 0, // Starts at 0, needs 3 to be certified!
      isValidated: false,
      validatedBy: [],
      likes: 1,
      createdAt: 'Justo ahora',
      ingredients: parsedIngredients.length > 0 ? parsedIngredients : [{ name: 'Ingredientes variados', amount: 'Exactas' }],
      steps: parsedSteps.length > 0 ? parsedSteps : [{ stepNumber: 1, title: 'Preparación', instruction: 'Seguir las indicaciones con cuidado.' }],
    };

    setRecipes(prev => [createdRecipe, ...prev]);
    setIsShareModalOpen(false);
    setNewTitle('');
    setNewAuthor('');
    setNewDescription('');
    setNewIngredientsText('');
    setNewStepsText('');
    setNotification('¡Receta enviada a la comunidad! Ahora está en proceso de recibir las 3 validaciones técnicas.');
    setTimeout(() => setNotification(null), 5000);
  };

  return (
    <section id="comunidad" className="py-16 px-4 sm:px-6 lg:px-8 border-t border-pink-950/40 relative">
      <div className="max-w-7xl mx-auto space-y-16">
        {/* Quality System Banner matching Video */}
        <div className="text-center max-w-3xl mx-auto">
          <span className="text-[11px] font-bold tracking-widest uppercase text-pink-400 bg-pink-950/80 border border-pink-800/40 px-3.5 py-1 rounded-full">
            Filtro de Calidad Único
          </span>

          <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight mt-4 mb-3">
            Aquí las recetas se ganan su lugar
          </h2>

          <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed mb-8">
            Cada platillo compartido pasa por un estricto <strong>sistema de validación comunitaria</strong> antes 
            de certificarse, asegurando que las proporciones siempre salgan perfectas. Olvídate de recetas fallidas con pasos confusos.
          </p>

          {/* 3 Quality Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
            <div className="bg-[#1b0a21] border border-pink-900/60 rounded-2xl p-3.5 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-white">
                Mínimo 3 validaciones con foto real
              </span>
            </div>

            <div className="bg-[#1b0a21] border border-pink-900/60 rounded-2xl p-3.5 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 shrink-0">
                <Award className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-white">
                Cantidades exactas en gramos / tazas
              </span>
            </div>

            <div className="bg-[#1b0a21] border border-pink-900/60 rounded-2xl p-3.5 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 shrink-0">
                <Trophy className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-white">
                Retos patrocinados por marcas reales
              </span>
            </div>
          </div>
        </div>

        {/* Global Floating Notification Toast */}
        {notification && (
          <div className="p-4 rounded-2xl bg-emerald-950/90 border border-emerald-500/50 text-emerald-200 text-xs font-bold flex items-center gap-3 max-w-xl mx-auto shadow-xl animate-in fade-in">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{notification}</span>
          </div>
        )}

        {/* Community Recipes Feed Header & Search */}
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                <Users2 className="w-5 h-5 text-pink-400" />
                Explorar Ideas a Disposición
              </h3>
              <p className="text-xs text-zinc-400">
                Buscador visual y feed colaborativo de recetas probadas y auditadas
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsShareModalOpen(true)}
                className="cursor-pointer px-4 py-2 rounded-xl text-xs font-bold text-white bg-pink-600 hover:bg-pink-500 transition-colors flex items-center gap-1.5 shadow-md"
              >
                <Plus className="w-4 h-4" />
                <span>Compartir Mi Receta</span>
              </button>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative max-w-md">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por platillo, autor o categoría..."
              className="w-full bg-[#16071c] border border-pink-950 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-pink-500"
            />
          </div>

          {/* Feed Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {filteredRecipes.map(recipe => {
              const isCertified = recipe.validationsCount >= 3;

              return (
                <div
                  key={recipe.id}
                  className="bg-[#18081e] border border-pink-950 rounded-3xl overflow-hidden shadow-lg hover:border-pink-800 transition-all flex flex-col group"
                >
                  {/* Recipe Image with overlay tags */}
                  <div className="relative h-44 w-full overflow-hidden bg-zinc-900">
                    <img
                      src={recipe.imageUrl}
                      alt={recipe.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#18081e] via-transparent to-black/40" />

                    {/* Status Badge */}
                    <div className="absolute top-3 left-3">
                      {isCertified ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-600/90 text-white flex items-center gap-1 shadow-md">
                          <CheckCircle2 className="w-3 h-3" />
                          3/3 Validada & Certificada
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/90 text-zinc-950 flex items-center gap-1 shadow-md">
                          <Clock className="w-3 h-3" />
                          {recipe.validationsCount}/3 Validaciones
                        </span>
                      )}
                    </div>

                    {recipe.challengeTag && (
                      <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-[10px] font-bold bg-pink-950/80 text-pink-300 border border-pink-800">
                        {recipe.challengeTag}
                      </span>
                    )}
                  </div>

                  {/* Body Content */}
                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    <div>
                      {/* Author info */}
                      <div className="flex items-center gap-2 mb-2 text-xs">
                        <div className="w-7 h-7 rounded-full bg-pink-900/60 border border-pink-700/50 flex items-center justify-center font-bold text-[10px] text-pink-300">
                          {recipe.authorAvatar}
                        </div>
                        <div>
                          <p className="text-white font-bold leading-none">{recipe.author}</p>
                          <p className="text-[10px] text-zinc-400">{recipe.authorRole}</p>
                        </div>
                      </div>

                      <h4 className="text-base font-bold text-white mb-1.5 group-hover:text-pink-300 transition-colors">
                        {recipe.title}
                      </h4>

                      <p className="text-xs text-zinc-300 line-clamp-2 leading-relaxed">
                        {recipe.description}
                      </p>
                    </div>

                    {/* Footer Info & Actions */}
                    <div className="pt-3 border-t border-pink-950/80 flex items-center justify-between text-xs">
                      <span className="text-[11px] text-zinc-400 font-medium">
                        {recipe.ingredients.length} ingredientes exactos
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleValidateRecipe(recipe.id)}
                          className="cursor-pointer px-2.5 py-1 rounded-lg bg-pink-950/70 hover:bg-pink-900 text-pink-300 border border-pink-800 text-[11px] font-semibold flex items-center gap-1 transition-colors"
                          title="Validar que la preparaste"
                        >
                          <ShieldCheck className="w-3.5 h-3.5 text-pink-400" />
                          <span>Validar ({recipe.validationsCount})</span>
                        </button>

                        <button
                          onClick={() => setSelectedRecipe(recipe)}
                          className="cursor-pointer px-3 py-1 rounded-lg bg-pink-600 hover:bg-pink-500 text-white font-bold text-[11px] transition-colors"
                        >
                          Ver
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Retos de Innovación Abierta Patrocinados B2B */}
        <div className="bg-gradient-to-r from-[#1f0b26] to-[#17071b] border border-pink-900/60 rounded-3xl p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-pink-400 block mb-1">
                Innovación Abierta B2B
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-white">
                Retos Culinarios Patrocinados
              </h3>
              <p className="text-xs text-zinc-300">
                Marcas corporativas de alimentos premian tu creatividad y técnicas de cero desperdicio
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-pink-950 text-pink-300 border border-pink-800">
              {INNOVATION_CHALLENGES.length} retos activos
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {INNOVATION_CHALLENGES.map(challenge => (
              <div
                key={challenge.id}
                className="bg-[#120716] border border-pink-950 rounded-2xl p-5 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400">
                      {challenge.sponsorLogoText}
                    </span>
                    <h4 className="text-base font-bold text-white">{challenge.title}</h4>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {challenge.badge}
                  </span>
                </div>

                <p className="text-xs text-zinc-300 leading-relaxed">
                  {challenge.description}
                </p>

                <div className="bg-[#1a0c20] p-3 rounded-xl border border-pink-950 text-xs">
                  <span className="text-[10px] font-bold text-pink-300 uppercase block mb-1">
                    Premio Patrocinado:
                  </span>
                  <p className="text-amber-200 font-bold">{challenge.reward}</p>
                </div>

                <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1">
                  <span>Cierre: <strong>{challenge.deadline}</strong></span>
                  <span><strong>{challenge.participantsCount}</strong> cocineros inscritos</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pilot Testimonials matching Video */}
        <div>
          <div className="text-center mb-8">
            <h3 className="text-xl sm:text-2xl font-black text-white mb-2">
              Lo que dice nuestra comunidad piloto
            </h3>
            <p className="text-xs text-zinc-400">
              Estudiantes foráneos, aficionados a la fermentación y familias mexicanas
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PILOT_TESTIMONIALS.map((testi, idx) => (
              <div
                key={idx}
                className="bg-[#18081e] border border-pink-950 rounded-3xl p-6 flex flex-col justify-between space-y-4 shadow-md"
              >
                <div className="space-y-3">
                  <div className="flex items-center gap-1 text-amber-400">
                    {[...Array(testi.rating)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-400" />
                    ))}
                  </div>

                  <p className="text-xs text-zinc-300 italic leading-relaxed">
                    "{testi.quote}"
                  </p>
                </div>

                <div className="flex items-center gap-3 pt-3 border-t border-pink-950/80">
                  <div className="w-8 h-8 rounded-full bg-pink-900/60 border border-pink-700/50 flex items-center justify-center font-bold text-xs text-pink-300">
                    {testi.avatar}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">{testi.author}</h4>
                    <p className="text-[10px] text-zinc-400">{testi.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modal: View Single Community Recipe */}
      {selectedRecipe && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in">
          <div className="relative w-full max-w-2xl bg-[#190a1e] border border-pink-700/50 rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-pink-950 flex items-center justify-between bg-[#120716]">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-pink-900/60 text-pink-300">
                  {selectedRecipe.category}
                </span>
                <span className="text-xs text-zinc-400">
                  Validaciones: {selectedRecipe.validationsCount}/3
                </span>
              </div>
              <button
                onClick={() => setSelectedRecipe(null)}
                className="cursor-pointer p-1 rounded-full text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              <div>
                <h3 className="text-2xl font-black text-white mb-2">{selectedRecipe.title}</h3>
                <p className="text-xs text-zinc-300">{selectedRecipe.description}</p>
              </div>

              {/* Validation Status Box */}
              <div className="p-4 rounded-2xl bg-[#120716] border border-pink-950 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-white block">
                    {selectedRecipe.validationsCount >= 3 ? 'Receta Certificada con Rigor' : 'Validación en Proceso'}
                  </span>
                  <span className="text-[10px] text-zinc-400">
                    Auditada por: {selectedRecipe.validatedBy.join(', ') || 'Pendiente de cocineros'}
                  </span>
                </div>
                <button
                  onClick={() => handleValidateRecipe(selectedRecipe.id)}
                  className="cursor-pointer px-4 py-2 rounded-xl text-xs font-bold text-white bg-pink-600 hover:bg-pink-500 transition-colors flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Validar que la cociné (+1)</span>
                </button>
              </div>

              {/* Ingredients */}
              <div>
                <h4 className="text-xs font-bold text-pink-300 uppercase mb-2">Ingredientes con cantidades exactas:</h4>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {selectedRecipe.ingredients.map((ing, i) => (
                    <li key={i} className="p-2.5 rounded-xl bg-[#120716] border border-pink-950 text-zinc-200 flex justify-between">
                      <span>{ing.name}</span>
                      <strong className="text-pink-300">{ing.amount}</strong>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Steps */}
              <div>
                <h4 className="text-xs font-bold text-pink-300 uppercase mb-2">Procedimiento paso a paso numerado:</h4>
                <div className="space-y-3">
                  {selectedRecipe.steps.map(step => (
                    <div key={step.stepNumber} className="p-3.5 rounded-xl bg-[#120716] border border-pink-950 text-xs">
                      <div className="font-bold text-white mb-1">
                        Paso {step.stepNumber}: {step.title}
                      </div>
                      <p className="text-zinc-300 leading-relaxed">{step.instruction}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Share New Recipe Form */}
      {isShareModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in">
          <div className="relative w-full max-w-2xl bg-[#190a1e] border border-pink-700/50 rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-pink-950 flex items-center justify-between bg-[#120716]">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-pink-400" />
                Compartir Receta en CociFlex
              </h3>
              <button
                onClick={() => setIsShareModalOpen(false)}
                className="cursor-pointer p-1 rounded-full text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleShareSubmit} className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-pink-950/40 border border-pink-900/60 text-[11px] text-pink-200">
                <strong>Regla de Calidad:</strong> Tu receta pasará por 3 likes de validación técnica de otros usuarios que ya la hicieron antes de recibir el sello de certificación oficial.
              </div>

              <div>
                <label className="block text-[11px] font-bold text-pink-300 uppercase mb-1">
                  Nombre de la Receta
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ej. Queso fresco estilo Morelos, Enchiladas de alacena..."
                  className="w-full bg-[#120716] border border-pink-900/60 rounded-xl p-2.5 text-white placeholder-zinc-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-pink-300 uppercase mb-1">
                    Tu Nombre o Alias
                  </label>
                  <input
                    type="text"
                    required
                    value={newAuthor}
                    onChange={(e) => setNewAuthor(e.target.value)}
                    placeholder="Ej. Gretel Pineda"
                    className="w-full bg-[#120716] border border-pink-900/60 rounded-xl p-2.5 text-white placeholder-zinc-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-pink-300 uppercase mb-1">
                    Categoría
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full bg-[#120716] border border-pink-900/60 rounded-xl p-2.5 text-white"
                  >
                    <option value="Tradicional Mexicana">Tradicional Mexicana</option>
                    <option value="Fermentación Bioartesanal">Fermentación Bioartesanal</option>
                    <option value="Cero Desperdicio">Cero Desperdicio</option>
                    <option value="Estudiantil Rápida">Estudiantil Rápida</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-pink-300 uppercase mb-1">
                    Porciones
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={newServings}
                    onChange={(e) => setNewServings(Number(e.target.value))}
                    className="w-full bg-[#120716] border border-pink-900/60 rounded-xl p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-pink-300 uppercase mb-1">
                    Tiempo Total (minutos)
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="240"
                    value={newTime}
                    onChange={(e) => setNewTime(Number(e.target.value))}
                    className="w-full bg-[#120716] border border-pink-900/60 rounded-xl p-2.5 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-pink-300 uppercase mb-1">
                  Descripción breve
                </label>
                <textarea
                  rows={2}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Explica el origen de la receta y cómo aprovecha los insumos..."
                  className="w-full bg-[#120716] border border-pink-900/60 rounded-xl p-2.5 text-white placeholder-zinc-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-pink-300 uppercase mb-1">
                  Lista de Ingredientes (Un ingrediente por línea: Nombre - Cantidad)
                </label>
                <textarea
                  rows={3}
                  required
                  value={newIngredientsText}
                  onChange={(e) => setNewIngredientsText(e.target.value)}
                  placeholder="Tortillas de maíz - 6 piezas&#10;Frijoles cocidos - 1 taza&#10;Queso fresco - 80 gramos"
                  className="w-full bg-[#120716] border border-pink-900/60 rounded-xl p-2.5 text-white placeholder-zinc-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-pink-300 uppercase mb-1">
                  Procedimiento Paso a Paso (Una indicación por línea)
                </label>
                <textarea
                  rows={3}
                  required
                  value={newStepsText}
                  onChange={(e) => setNewStepsText(e.target.value)}
                  placeholder="Cortar las tortillas en tiras y dorar en comal&#10;Licuar los frijoles con caldo y sazonar en sartén&#10;Bañar las tortillas y espolvorear el queso fresco"
                  className="w-full bg-[#120716] border border-pink-900/60 rounded-xl p-2.5 text-white placeholder-zinc-500"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsShareModalOpen(false)}
                  className="cursor-pointer px-4 py-2 rounded-xl text-zinc-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="cursor-pointer px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-pink-600 hover:bg-pink-500 shadow-md"
                >
                  Publicar para Validación Comunitaria
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
