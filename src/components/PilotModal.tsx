import React, { useState } from 'react';
import { X, Sparkles, CheckCircle2, Download, ShieldCheck, ArrowRight } from 'lucide-react';

interface PilotModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PilotModal: React.FC<PilotModalProps> = ({ isOpen, onClose }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('Estudiante Foráneo');
  const [isSuccess, setIsSuccess] = useState(false);
  const [code, setCode] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    setCode(Math.floor(1000 + Math.random() * 9000));
    setIsSuccess(true);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in">
      <div className="relative w-full max-w-sm bg-[#FFF8F6] border border-[#FED7CD] rounded-[32px] shadow-2xl p-6 sm:p-7 overflow-hidden text-center text-[#33252A]">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="cursor-pointer absolute top-4 right-4 p-1.5 rounded-full bg-[#FFEAE4] text-[#7D6F76] hover:text-[#33252A] hover:bg-[#FED7CD]"
        >
          <X className="w-4 h-4" />
        </button>

        {!isSuccess ? (
          <div>
            <div className="w-14 h-14 mx-auto rounded-2xl bg-white border border-[#FED7CD] p-1.5 shadow-xs mb-3 flex items-center justify-center overflow-hidden">
              <img
                src="/assets/aistudio/logo_89042ff1.png"
                alt="Cociflex Logo"
                className="w-full h-full object-contain"
              />
            </div>

            <h3 className="text-xl font-black text-[#33252A] mb-1">
              Descargar Cociflex (Acceso VIP)
            </h3>

            <p className="text-xs text-[#7D6F76] mb-5 leading-relaxed">
              Recibe tu pase de acceso exclusivo para la app con <strong>3 meses de funciones Premium gratis</strong>.
            </p>

            <form onSubmit={handleSubmit} className="space-y-3 text-left text-xs">
              <div>
                <label className="block text-[11px] font-bold text-[#5C4A51] uppercase mb-1">
                  Nombre Completo
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tu nombre y apellido"
                  className="w-full bg-white border border-[#FED7CD] focus:border-[#FF7262] rounded-2xl px-3.5 py-2.5 text-xs text-[#33252A] placeholder-[#B5A7AC] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#5C4A51] uppercase mb-1">
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu-correo@ejemplo.com"
                  className="w-full bg-white border border-[#FED7CD] focus:border-[#FF7262] rounded-2xl px-3.5 py-2.5 text-xs text-[#33252A] placeholder-[#B5A7AC] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#5C4A51] uppercase mb-1">
                  Perfil de Cocinero
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-white border border-[#FED7CD] focus:border-[#FF7262] rounded-2xl px-3.5 py-2.5 text-xs text-[#33252A] focus:outline-none"
                >
                  <option value="Estudiante Foráneo">Estudiante Foráneo</option>
                  <option value="Cocinero Casero / Familia">Cocinero Casero / Familia</option>
                  <option value="Entusiasta de la Fermentación">Entusiasta de la Fermentación</option>
                  <option value="Vegetariano / Vegano">Vegetariano / Vegano</option>
                </select>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="cursor-pointer w-full py-3 px-4 rounded-2xl font-black text-xs text-white bg-gradient-to-r from-[#FF7B72] to-[#FA7268] hover:brightness-105 shadow-md shadow-[#FF7B72]/30 flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                  <span>Obtener Clave VIP y Descarga</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="py-3 space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-[#E8F8F0] text-[#10B981] border border-[#A7F3D0] flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-black text-[#33252A]">¡Pase VIP Generado!</h3>

            <div className="p-3.5 rounded-2xl bg-white border border-[#FED7CD] font-mono text-center">
              <span className="text-[10px] text-[#8C7E85] uppercase tracking-widest block mb-1">
                Tu Clave de Activación
              </span>
              <span className="text-xl font-black text-[#FF7262] tracking-wider">
                COCIFLEX-VIP-{code}
              </span>
            </div>

            <p className="text-xs text-[#7D6F76] leading-relaxed">
              Hemos enviado las instrucciones a <strong>{email}</strong>.
            </p>

            <button
              onClick={onClose}
              className="cursor-pointer px-5 py-2 rounded-2xl text-xs font-bold text-white bg-[#FF7262] hover:bg-[#FA7268] shadow-xs"
            >
              Comenzar a explorar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
