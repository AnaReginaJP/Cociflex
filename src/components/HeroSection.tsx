import React, { useState } from 'react';
import { Sparkles, ShieldCheck, Users, CheckCircle2, ArrowRight } from 'lucide-react';

interface HeroSectionProps {
  onScrollToMatcher: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onScrollToMatcher }) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [ticketNumber, setTicketNumber] = useState<number | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) return;
    const generatedTicket = Math.floor(1000 + Math.random() * 9000);
    setTicketNumber(generatedTicket);
    setIsSubmitted(true);
  };

  return (
    <section className="relative overflow-hidden pt-8 pb-16 px-4 sm:px-6 lg:px-8">
      {/* Background ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-pink-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/3 left-1/4 w-[300px] h-[300px] bg-rose-500/10 rounded-full blur-[90px] pointer-events-none" />

      <div className="max-w-4xl mx-auto relative z-10 text-center">
        {/* Pilot Announcement Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-pink-950/60 border border-pink-500/30 text-pink-300 text-xs font-semibold mb-6 shadow-inner">
          <Sparkles className="w-3.5 h-3.5 text-pink-400" />
          <span>Beneficio Exclusivo de Lanzamiento</span>
        </div>

        {/* Main Heading matching Video */}
        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight mb-5">
          ¡Únete a nuestra fase piloto y obtén{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-rose-300 to-pink-500">
            acceso anticipado
          </span>{' '}
          a las funciones Premium!
        </h1>

        {/* Subtitle */}
        <p className="text-sm sm:text-base text-zinc-300 max-w-2xl mx-auto mb-8 leading-relaxed">
          Diseñado especialmente para <strong>estudiantes foráneos</strong>, <strong>profesionales</strong> y <strong>cocineros caseros</strong>.
          Recibe tu invitación VIP con 3 meses de suscripción Premium gratis (IA ilimitada y recetario microbiológico de fermentos).
        </p>

        {/* Interactive Pilot Registration Box */}
        <div className="max-w-xl mx-auto bg-[#1b0a21]/90 border border-pink-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-pink-950/50 backdrop-blur-xl">
          {!isSubmitted ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                <div>
                  <label htmlFor="hero-name" className="block text-[11px] font-bold text-pink-300 uppercase tracking-wider mb-1.5">
                    Nombre Completo
                  </label>
                  <div className="relative">
                    <input
                      id="hero-name"
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Ej. Gretel Pineda"
                      className="w-full bg-[#120716] border border-pink-900/60 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="hero-email" className="block text-[11px] font-bold text-pink-300 uppercase tracking-wider mb-1.5">
                    Correo Electrónico
                  </label>
                  <div className="relative">
                    <input
                      id="hero-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="tu-correo@universidad.edu.mx"
                      className="w-full bg-[#120716] border border-pink-900/60 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Status and privacy guarantees */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-400 pt-1">
                <span className="flex items-center gap-1 text-pink-300 font-medium">
                  <Users className="w-3.5 h-3.5 text-pink-400" />
                  Cupos disponibles México: <strong>146 de 500</strong>
                </span>
                <span className="flex items-center gap-1 text-zinc-400">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Privacidad 100% protegida
                </span>
              </div>

              {/* Submit CTA */}
              <button
                type="submit"
                className="cursor-pointer w-full mt-2 py-3.5 px-6 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-pink-600 via-rose-500 to-pink-700 hover:brightness-110 shadow-lg shadow-pink-900/50 transition-all flex items-center justify-center gap-2 group"
              >
                <span>¡Quiero Acceso Anticipado!</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </form>
          ) : (
            <div className="py-4 text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-white">¡Bienvenido a CociFlex, {fullName}!</h2>
              <p className="text-xs text-zinc-300 max-w-sm mx-auto">
                Tu pase de acceso piloto <strong>#VIP-{ticketNumber}</strong> ha sido reservado para <strong>{email}</strong> con 3 meses de suscripción Premium gratis.
              </p>
              <div className="pt-2">
                <button
                  onClick={onScrollToMatcher}
                  className="cursor-pointer px-6 py-2.5 rounded-full text-xs font-bold text-white bg-pink-600 hover:bg-pink-500 transition-all inline-flex items-center gap-2"
                >
                  Probar Motor de Coincidencia Ahora
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
