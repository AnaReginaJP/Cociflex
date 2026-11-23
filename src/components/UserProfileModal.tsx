import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Check,
  LogOut,
  ArrowRight,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.tsx';

export interface UserProfileData {
  name: string;
  email: string;
  dietaryPreference: string;
  allergies?: string[];
  isLoggedIn: boolean;
}

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfileData;
  onSaveProfile: (profile: UserProfileData) => void;
}

export const DIETARY_OPTIONS = [
  { id: 'Omnívoro', label: 'Omnívoro / Tradicional', icon: '🍳', desc: 'Come de todo sin restricciones' },
  { id: 'Vegetariano', label: 'Vegetariano', icon: '🥑', desc: 'Sin carne ni pescado' },
  { id: 'Vegano', label: 'Vegano', icon: '🌱', desc: '100% de origen vegetal' },
  { id: 'Sin gluten', label: 'Sin Gluten / Celiaco', icon: '🌾', desc: 'Sin trigo ni harinas con gluten' },
  { id: 'Sin lactosa', label: 'Sin Lactosa', icon: '🥛', desc: 'Sin derivados lácteos vacunos' },
  { id: 'Ceto', label: 'Keto / Bajo en Carbos', icon: '🥗', desc: 'Grasas saludables y proteína' },
];

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  userProfile,
  onSaveProfile,
}) => {
  const { firebaseUser, isSigningIn, authError, signInWithGoogle, logout } = useAuth();
  const [name, setName] = useState(userProfile.name || '');
  const [selectedDiet, setSelectedDiet] = useState<string>(
    userProfile.dietaryPreference || 'Omnívoro'
  );
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    setName(userProfile.name || firebaseUser?.displayName || '');
    if (userProfile.dietaryPreference) {
      setSelectedDiet(userProfile.dietaryPreference);
    }
  }, [userProfile, firebaseUser]);

  if (!isOpen) return null;

  const isSignedInWithGoogle = Boolean(firebaseUser);

  const handleGoogleLogin = async () => {
    await signInWithGoogle();
  };

  const handleLogout = async () => {
    await logout();
    onSaveProfile({
      name: '',
      email: '',
      dietaryPreference: 'Omnívoro',
      isLoggedIn: false,
    });
    setName('');
    setSelectedDiet('Omnívoro');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const updatedProfile: UserProfileData = {
      name:
        name.trim() ||
        firebaseUser?.displayName ||
        firebaseUser?.email?.split('@')[0] ||
        'Cocinero CociFlex',
      email: firebaseUser?.email || userProfile.email || '',
      dietaryPreference: selectedDiet,
      isLoggedIn: isSignedInWithGoogle || userProfile.isLoggedIn,
    };

    onSaveProfile(updatedProfile);
    setSavedSuccess(true);
    window.setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
      <div className="relative w-full max-w-md bg-[#FFF8F6] border border-[#FED7CD] rounded-[32px] shadow-2xl p-6 overflow-hidden text-[#33252A] max-h-[92vh] flex flex-col">
        <button
          onClick={onClose}
          className="cursor-pointer absolute top-4 right-4 p-2 rounded-full bg-[#FFEAE4] text-[#7D6F76] hover:text-[#33252A] hover:bg-[#FED7CD] transition-colors"
          aria-label="Cerrar"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="text-center pt-1 pb-3">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white border border-[#FED7CD] p-1.5 shadow-xs mb-2 overflow-hidden">
            <img
              src="/assets/aistudio/logo_89042ff1.png"
              alt="Cociflex Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <h2 className="font-display text-2xl font-extrabold text-[#FF7262] tracking-tight">
            Cociflex
          </h2>
          <p className="text-xs text-[#7D6F76] font-medium mt-0.5">
            {isSignedInWithGoogle
              ? 'Tu Perfil y Preferencias Culinarias'
              : 'Personaliza tu dieta o conecta tu cuenta Google'}
          </p>
        </div>

        {/* Account Status Card */}
        {isSignedInWithGoogle && firebaseUser ? (
          <div className="mb-4 p-3.5 rounded-2xl bg-[#FFEFEA] border border-[#FED7CD] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-full bg-[#FF7262] text-white flex items-center justify-center font-bold text-sm shadow-sm shrink-0">
                {(name || firebaseUser.displayName || firebaseUser.email || 'U')[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-[#33252A] leading-tight truncate">
                  {name || firebaseUser.displayName || 'Cocinero'}
                </p>
                <p className="text-[11px] text-[#7D6F76] truncate">
                  {firebaseUser.email}
                </p>
                <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E8F8F0] text-[#1E7E50] border border-[#C6F0DC]">
                  {selectedDiet}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="cursor-pointer p-2 rounded-xl text-[#A66F7B] hover:bg-[#FED7CD]/50 text-xs font-semibold flex items-center gap-1 shrink-0"
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="mb-4 p-3.5 rounded-2xl bg-white border border-[#FED7CD] space-y-2.5">
            <p className="text-xs text-[#5C4A51] leading-relaxed">
              Inicia sesión con Google para guardar tu alacena, lista de mandado, recetas creadas con IA y validaciones entre sesiones.
            </p>
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isSigningIn}
              className="cursor-pointer w-full py-2.5 px-4 rounded-2xl bg-white hover:bg-[#FFF0EB] border border-[#FED7CD] hover:border-[#FF8A80] text-[#33252A] text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-colors disabled:opacity-60"
            >
              {isSigningIn ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#FF7262]" />
                  <span>Conectando con Google...</span>
                </>
              ) : (
                <>
                  <span className="w-4 h-4 rounded-full bg-[#FFEFEA] text-[#FF7262] font-black text-[11px] flex items-center justify-center">
                    G
                  </span>
                  <span>Continuar con Google</span>
                </>
              )}
            </button>

            {authError && (
              <p className="text-[11px] text-[#E11D48] flex items-center gap-1.5 font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{authError}</span>
              </p>
            )}
          </div>
        )}

        {/* Profile & Dietary Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-3.5 pr-1">
          <div>
            <label className="block text-[11px] font-bold text-[#5C4A51] uppercase mb-1">
              Nombre o Apodo en Cocina
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-[#A6979D] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Ana Regina"
                className="w-full bg-white border border-[#FED7CD] focus:border-[#FF7262] rounded-2xl pl-10 pr-3.5 py-2.5 text-xs text-[#33252A] placeholder-[#B5A7AC] focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div className="pt-1">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-bold text-[#5C4A51] uppercase">
                Especificaciones Dietéticas
              </label>
              <span className="text-[10px] text-[#FF7262] font-semibold">
                Personaliza tu catálogo
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {DIETARY_OPTIONS.map((opt) => {
                const isSelected = selectedDiet === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelectedDiet(opt.id)}
                    className={`cursor-pointer p-2.5 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'bg-[#FFE8E2] border-[#FF8A80] shadow-sm'
                        : 'bg-white border-[#FED7CD]/80 hover:border-[#FF8A80]/60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-base">{opt.icon}</span>
                      {isSelected && (
                        <span className="w-4 h-4 rounded-full bg-[#FF7262] text-white flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </span>
                      )}
                    </div>
                    <span
                      className={`text-xs font-bold leading-tight ${
                        isSelected ? 'text-[#FF7262]' : 'text-[#33252A]'
                      }`}
                    >
                      {opt.label}
                    </span>
                    <span className="text-[9px] text-[#8C7E85] line-clamp-1 mt-0.5">
                      {opt.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="cursor-pointer w-full py-3 px-4 rounded-2xl font-black text-xs text-white bg-gradient-to-r from-[#FF7B72] via-[#FF8A80] to-[#FA7268] hover:brightness-105 active:scale-[0.98] transition-all shadow-md shadow-[#FF7B72]/30 flex items-center justify-center gap-2"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>¡Preferencias Guardadas!</span>
                </>
              ) : (
                <>
                  <span>Guardar Preferencias</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>

        <div className="pt-3 border-t border-[#FED7CD]/60 text-center">
          <p className="text-[10px] text-[#A6979D]">
            Tus recetas se adaptarán automáticamente a tu perfil culinario.
          </p>
        </div>
      </div>
    </div>
  );
};
