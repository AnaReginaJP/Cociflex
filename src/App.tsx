import React, { useState, useCallback, useEffect } from 'react';
import { RecipeModal } from './components/RecipeModal.tsx';
import { AiRecipeModal } from './components/AiRecipeModal.tsx';
import { UserProfileModal, UserProfileData, type RecipeHistoryEntry } from './components/UserProfileModal.tsx';
import { CociflexWorkspace } from './components/CociflexWorkspace.tsx';
import { WalkthroughTour } from './components/WalkthroughTour.tsx';
import { AuthProvider, useAuth } from './contexts/AuthContext.tsx';
import { Recipe } from './utils/recipeMatcher.ts';
import { buildRecipeFromAi } from './utils/aiRecipe.ts';
import { COMMON_PANTRY_INGREDIENTS } from './data/recipesData.ts';
import {
  WALKTHROUGH_STORAGE_KEY,
  WorkspaceTab,
  shouldAutoStartWalkthrough,
} from './utils/walkthroughSteps.ts';

const USER_PROFILE_STORAGE_KEY = 'cociflex_user_profile_v2';
const DEFAULT_PANTRY = COMMON_PANTRY_INGREDIENTS.filter((i) => i.defaultSelected).map(
  (i) => i.name
);

const CociflexAppContent: React.FC = () => {
  const { user, isAuthReady } = useAuth();

  const [activeTab, setActiveTab] = useState<WorkspaceTab>('inicio');
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [activeRecipe, setActiveRecipe] = useState<Recipe | null>(null);

  // Interactive Walkthrough state
  const [isWalkthroughOpen, setIsWalkthroughOpen] = useState<boolean>(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem(WALKTHROUGH_STORAGE_KEY);
        return shouldAutoStartWalkthrough(window.location.search, saved);
      }
    } catch {
      // ignore
    }
    return true;
  });
  const [walkthroughStepIndex, setWalkthroughStepIndex] = useState<number>(0);

  // User Profile state
  const [userProfile, setUserProfile] = useState<UserProfileData>(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem(USER_PROFILE_STORAGE_KEY);
        if (saved) return JSON.parse(saved);
      }
    } catch {
      // ignore
    }
    return {
      name: '',
      email: '',
      dietaryPreference: 'Omnívoro',
      isLoggedIn: false,
    };
  });

  // Pantry, Shopping list, Saved AI recipes, Community validations
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>(DEFAULT_PANTRY);
  const [shoppingList, setShoppingList] = useState<string[]>([]);
  const [savedRecipes, setSavedRecipes] = useState<Recipe[]>([]);
  const [recipeHistory, setRecipeHistory] = useState<RecipeHistoryEntry[]>([]);
  const [communityExtraValidations, setCommunityExtraValidations] = useState<
    Record<string, string[]>
  >({});

  // AI Modal state
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiIngredients, setAiIngredients] = useState<string[]>([]);
  const [aiTime, setAiTime] = useState<number>(25);
  const [aiServings, setAiServings] = useState<number>(2);
  const [aiPreference, setAiPreference] = useState<string>('Tradicional Mexicana');

  // Load persisted community validations on mount
  useEffect(() => {
    let active = true;
    fetch('/api/community/validations')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data?.validations) return;
        const grouped: Record<string, string[]> = {};
        for (const row of data.validations) {
          if (!grouped[row.communityRecipeId]) {
            grouped[row.communityRecipeId] = [];
          }
          grouped[row.communityRecipeId].push(row.validatorName);
        }
        setCommunityExtraValidations(grouped);
      })
      .catch(() => {
        // Fallback silently to local defaults if offline
      });
    return () => {
      active = false;
    };
  }, []);

  // A profile saved in the browser must not look signed in once the session is gone.
  useEffect(() => {
    if (!isAuthReady || user || !userProfile.isLoggedIn) return;
    const signedOut = { ...userProfile, isLoggedIn: false };
    setUserProfile(signedOut);
    try {
      localStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(signedOut));
    } catch {
      // ignore
    }
  }, [isAuthReady, user, userProfile]);

  // Load the signed-in user's state from MariaDB (session cookie) whenever the account changes
  useEffect(() => {
    if (!user) return;
    let active = true;

    fetch('/api/me/state', { credentials: 'same-origin' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data?.user) return;
        const syncedProfile: UserProfileData = {
          name: data.user.displayName || user.displayName || '',
          email: data.user.email || user.email || '',
          dietaryPreference: data.user.dietaryPreference || 'Omnívoro',
          isLoggedIn: true,
        };
        setUserProfile(syncedProfile);
        try {
          localStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(syncedProfile));
        } catch {
          // ignore
        }

        if (Array.isArray(data.pantryIngredients) && data.pantryIngredients.length > 0) {
          setSelectedIngredients(data.pantryIngredients);
        }
        if (Array.isArray(data.shoppingList)) {
          setShoppingList(data.shoppingList);
        }
        if (Array.isArray(data.savedRecipes)) {
          setSavedRecipes(data.savedRecipes);
        }
        if (Array.isArray(data.recipeHistory)) {
          setRecipeHistory(data.recipeHistory);
        }
        if (data.user.walkthroughCompleted) {
          try {
            localStorage.setItem(WALKTHROUGH_STORAGE_KEY, 'true');
          } catch {
            // ignore
          }
        }
      })
      .catch(() => {
        // Keep responsive local state if network hiccups
      });

    return () => {
      active = false;
    };
  }, [user?.uid]);

  const syncWithAuth = useCallback(
    async (path: string, method: 'PUT' | 'POST', payload: unknown) => {
      if (!user) return null;
      try {
        const res = await fetch(path, {
          method,
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        return res.ok ? await res.json() : null;
      } catch {
        return null;
      }
    },
    [user]
  );

  const handleCloseWalkthrough = useCallback(
    (completed: boolean) => {
      setIsWalkthroughOpen(false);
      try {
        localStorage.setItem(WALKTHROUGH_STORAGE_KEY, 'true');
      } catch {
        // ignore
      }
      if (completed) {
        syncWithAuth('/api/me/preferences', 'PUT', { walkthroughCompleted: true });
      }
    },
    [syncWithAuth]
  );

  const handleStartWalkthrough = useCallback(() => {
    setWalkthroughStepIndex(0);
    setActiveTab('inicio');
    setIsWalkthroughOpen(true);
  }, []);

  const handleSaveProfile = useCallback(
    (profile: UserProfileData) => {
      setUserProfile(profile);
      try {
        localStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(profile));
      } catch {
        // ignore
      }
      if (profile.isLoggedIn) {
        syncWithAuth('/api/me/preferences', 'PUT', {
          displayName: profile.name,
          dietaryPreference: profile.dietaryPreference,
        });
      }
    },
    [syncWithAuth]
  );

  const handleToggleIngredient = useCallback(
    (name: string) => {
      setSelectedIngredients((prev) => {
        const next = prev.includes(name)
          ? prev.filter((i) => i !== name)
          : [...prev, name];
        syncWithAuth('/api/me/pantry', 'PUT', { ingredients: next });
        return next;
      });
    },
    [syncWithAuth]
  );

  const handleAddCustomIngredient = useCallback(
    (name: string) => {
      setSelectedIngredients((prev) => {
        if (prev.includes(name)) return prev;
        const next = [...prev, name];
        syncWithAuth('/api/me/pantry', 'PUT', { ingredients: next });
        return next;
      });
    },
    [syncWithAuth]
  );

  const toggleShoppingItem = useCallback(
    (item: string) => {
      setShoppingList((prev) => {
        const next = prev.includes(item)
          ? prev.filter((i) => i !== item)
          : [...prev, item];
        syncWithAuth('/api/me/shopping-list', 'PUT', { items: next });
        return next;
      });
    },
    [syncWithAuth]
  );

  const clearShoppingList = useCallback(() => {
    setShoppingList([]);
    syncWithAuth('/api/me/shopping-list', 'PUT', { items: [] });
  }, [syncWithAuth]);

  const handleValidateCommunityRecipe = useCallback(
    async (recipeId: string) => {
      const validatorName =
        userProfile.name || user?.displayName || 'Tú (Verificado)';

      setCommunityExtraValidations((prev) => {
        const existing = prev[recipeId] || [];
        if (existing.includes(validatorName)) return prev;
        return {
          ...prev,
          [recipeId]: [...existing, validatorName],
        };
      });

      const data = await syncWithAuth('/api/community/validate', 'POST', {
        communityRecipeId: recipeId,
        validatorName,
      });

      if (data?.validations) {
        setCommunityExtraValidations((prev) => ({
          ...prev,
          [recipeId]: data.validations.map((v: any) => v.validatorName),
        }));
      }
    },
    [userProfile.name, user, syncWithAuth]
  );

  const handleOpenAiGenerator = (
    ingredients: string[],
    time: number,
    servings: number,
    preference: string
  ) => {
    setAiIngredients(ingredients);
    setAiTime(time || 25);
    setAiServings(servings || 2);
    setAiPreference(preference || 'Tradicional Mexicana');
    setIsAiModalOpen(true);
  };

  const refreshRecipeHistory = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch('/api/me/history', { credentials: 'same-origin' });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.recipeHistory)) setRecipeHistory(data.recipeHistory);
    } catch {
      // Keep the history already on screen
    }
  }, [user]);

  const handleGeneratedRecipeSuccess = (recipe: Recipe) => {
    setIsAiModalOpen(false);
    setSavedRecipes((prev) => [recipe, ...prev]);
    setActiveRecipe(recipe);
    syncWithAuth('/api/me/recipes', 'POST', { recipe }).then(() => refreshRecipeHistory());
  };

  const handleOpenHistoryRecipe = (entry: RecipeHistoryEntry) => {
    if (!entry.recipe) return;
    setIsProfileModalOpen(false);
    setActiveRecipe(
      buildRecipeFromAi(
        entry.recipe,
        { preference: entry.preference, servings: entry.servings },
        `history-${entry.id}`
      )
    );
  };

  const handleDeleteHistoryEntry = async (id: number) => {
    setRecipeHistory((prev) => prev.filter((entry) => entry.id !== id));
    if (!user) return;
    try {
      await fetch(`/api/me/history/${id}`, { method: 'DELETE', credentials: 'same-origin' });
    } catch {
      refreshRecipeHistory();
    }
  };

  return (
    <div className="min-h-screen bg-[#FFF8F6] text-[#33252A] font-sans selection:bg-[#FF8A80] selection:text-white flex flex-col">
      <CociflexWorkspace
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        onOpenRecipeModal={(recipe) => setActiveRecipe(recipe)}
        onOpenAiGenerator={handleOpenAiGenerator}
        selectedIngredients={selectedIngredients}
        onToggleIngredient={handleToggleIngredient}
        onAddCustomIngredient={handleAddCustomIngredient}
        savedRecipes={savedRecipes}
        communityExtraValidations={communityExtraValidations}
        onValidateCommunityRecipe={handleValidateCommunityRecipe}
        shoppingList={shoppingList}
        onToggleShoppingItem={toggleShoppingItem}
        onClearShoppingList={clearShoppingList}
        onOpenProfileModal={() => setIsProfileModalOpen(true)}
        onStartWalkthrough={handleStartWalkthrough}
        userProfile={userProfile}
      />

      <WalkthroughTour
        isOpen={isWalkthroughOpen}
        currentStepIndex={walkthroughStepIndex}
        onChangeStep={setWalkthroughStepIndex}
        onSwitchTab={setActiveTab}
        onClose={handleCloseWalkthrough}
      />

      {activeRecipe && (
        <RecipeModal
          recipe={activeRecipe}
          onClose={() => setActiveRecipe(null)}
          shoppingList={shoppingList}
          onToggleShoppingItem={toggleShoppingItem}
          pantryIngredients={selectedIngredients}
        />
      )}

      {isAiModalOpen && (
        <AiRecipeModal
          isOpen={isAiModalOpen}
          onClose={() => setIsAiModalOpen(false)}
          ingredients={aiIngredients}
          initialTime={aiTime}
          initialServings={aiServings}
          initialPreference={aiPreference}
          onGeneratedSuccess={handleGeneratedRecipeSuccess}
        />
      )}

      {isProfileModalOpen && (
        <UserProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          userProfile={userProfile}
          onSaveProfile={handleSaveProfile}
          recipeHistory={recipeHistory}
          onOpenHistoryRecipe={handleOpenHistoryRecipe}
          onDeleteHistoryEntry={handleDeleteHistoryEntry}
        />
      )}
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <CociflexAppContent />
    </AuthProvider>
  );
}
